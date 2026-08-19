import { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { UserState } from '../types';
import { PEER_PREFIX, stripPeerPrefix } from '../lib/multiplayerUtils';

export interface MultiplayerMessage {
  type:
    | 'SYNC_PROGRESS'
    | 'FRIEND_REQUEST'
    | 'FRIEND_ACCEPT'
    | 'FRIEND_REJECT'
    | 'FRIEND_REMOVE'
    | 'BATTLE_INVITE'
    | 'BATTLE_ACCEPT'
    | 'BATTLE_REJECT'
    | 'BATTLE_ACTION'
    | 'PING'
    | 'PONG';
  payload: any;
}

let globalPeer: Peer | null = null;

export type BattleMode = 'RPG' | 'TUG' | 'SPRINT';

export type BattleEvent =
  | { type: 'INVITE'; hostId: string; mode: BattleMode }
  | { type: 'ACCEPT'; hostId: string; mode: BattleMode }
  | { type: 'REJECT'; hostId: string; mode: BattleMode };

export type PeerErrorCode = 'notReady' | 'connectSelf' | null;

/** UX for kids — hints only; reconnect Peer only on explicit retry (no auto destroy loops). */
export type KidConnectionHint = null | 'slow' | 'tapRetry';

const HINT_SLOW_MS = 8_000;
const HINT_TAP_RETRY_MS = 28_000;

const peerPayload = (u: UserState) => ({
  id: u.peerId,
  name: u.playerName?.trim() ?? '',
  level: u.currentLevel,
  avatar: u.selectedAvatar,
});

export const useMultiplayer = (
  user: UserState,
  onUpdateUser: (u: Partial<UserState> | ((prev: UserState) => Partial<UserState>)) => void,
  onBattleEvent?: (ev: BattleEvent) => void
) => {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [connections, setConnections] = useState<DataConnection[]>([]);
  const connectionsRef = useRef<DataConnection[]>([]);
  const userRef = useRef(user);
  const [isReady, setIsReady] = useState(false);
  const [errorCode, setErrorCode] = useState<PeerErrorCode>(null);
  const [peerEpoch, setPeerEpoch] = useState(0);
  const [kidConnectionHint, setKidConnectionHint] = useState<KidConnectionHint>(null);
  /** Id corto visto al abrir el canal (algunos navegadores actualizan el estado padre un poco tarde). */
  const [openedPeerShortId, setOpenedPeerShortId] = useState<string | undefined>(undefined);

  const openPeersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    connectionsRef.current = connections;
  }, [connections]);

  useLayoutEffect(() => {
    openPeersRef.current = new Set(connections.filter((c) => c.open).map((c) => c.peer));
  }, [connections]);

  const onUpdateUserRef = useRef(onUpdateUser);
  onUpdateUserRef.current = onUpdateUser;

  /** Long wait / stuck → soft messages only (never destroy Peer here — avoids connect/disconnect flicker). */
  useEffect(() => {
    if (!user.peerId || isReady) return;
    let cancelled = false;
    const tSlow = window.setTimeout(() => {
      if (!cancelled) setKidConnectionHint('slow');
    }, HINT_SLOW_MS);
    const tTap = window.setTimeout(() => {
      if (!cancelled) setKidConnectionHint('tapRetry');
    }, HINT_TAP_RETRY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(tSlow);
      window.clearTimeout(tTap);
    };
  }, [user.peerId, isReady]);

  useEffect(() => {
    if (!errorCode) return;
    if (errorCode !== 'notReady' && errorCode !== 'connectSelf') return;
    const t = window.setTimeout(() => setErrorCode(null), 5_000);
    return () => window.clearTimeout(t);
  }, [errorCode]);

  useEffect(() => {
    if (user.peerId) return;
    const newId =
      Math.random().toString(36).substring(2, 6).toUpperCase() +
      '-' +
      Math.random().toString(36).substring(2, 6).toUpperCase();
    onUpdateUserRef.current({ peerId: newId });
  }, [user.peerId]);

  const sendSyncProgress = useCallback((conn: DataConnection) => {
    const u = userRef.current;
    conn.send({
      type: 'SYNC_PROGRESS',
      payload: peerPayload(u),
    });
  }, []);

  const handleIncomingData = useCallback(
    (data: MultiplayerMessage, conn: DataConnection) => {
      if (data.type === 'SYNC_PROGRESS') {
        const { id, name, level, avatar } = data.payload;
        if (!id) return;
        onUpdateUser((prevUser) => {
          if (!prevUser.friends?.some((f) => f.id === id)) return {};
          const currentFriends = prevUser.friends || [];
          const existing = currentFriends.findIndex((f) => f.id === id);
          const newFriends = [...currentFriends];
          const trimmed = typeof name === 'string' ? name.trim() : '';
          if (existing >= 0) {
            const prevName = newFriends[existing].name?.trim();
            const displayName = trimmed || prevName || id;
            newFriends[existing] = { id, name: displayName, level, avatar };
          }
          return { friends: newFriends };
        });
      } else if (data.type === 'FRIEND_REQUEST') {
        const { id, name, level, avatar } = data.payload;
        if (!id) return;
        const trimmed = typeof name === 'string' ? name.trim() : '';
        const alreadyFriend = userRef.current.friends?.some((f) => f.id === id);
        if (alreadyFriend) {
          onUpdateUser((prevUser) => {
            const currentFriends = prevUser.friends || [];
            const existing = currentFriends.findIndex((f) => f.id === id);
            if (existing < 0) return {};
            const newFriends = [...currentFriends];
            const prevName = newFriends[existing].name?.trim();
            const displayName = trimmed || prevName || id;
            newFriends[existing] = { id, name: displayName, level, avatar };
            return { friends: newFriends };
          });
          sendSyncProgress(conn);
          return;
        }
        onUpdateUser((prevUser) => {
          const incoming = prevUser.friendRequestsIncoming || [];
          const idx = incoming.findIndex((r) => r.fromId === id);
          const entry = {
            fromId: id,
            name: trimmed || id,
            level,
            avatar,
            receivedAt: Date.now(),
          };
          if (idx >= 0) {
            const next = [...incoming];
            next[idx] = entry;
            return { friendRequestsIncoming: next };
          }
          return { friendRequestsIncoming: [...incoming, entry] };
        });
      } else if (data.type === 'FRIEND_ACCEPT') {
        const { id, name, level, avatar } = data.payload;
        if (!id) return;
        const remoteShort = stripPeerPrefix(conn.peer);
        const trimmed = typeof name === 'string' ? name.trim() : '';
        onUpdateUser((prevUser) => {
          const friends = [...(prevUser.friends || [])];
          const fi = friends.findIndex((f) => f.id === id);
          const entry = { id, name: trimmed || id, level, avatar };
          if (fi >= 0) friends[fi] = entry;
          else friends.push(entry);
          const outgoing = (prevUser.friendRequestsOutgoing || []).filter(
            (o) => o.toId !== id && o.toId !== remoteShort
          );
          const incoming = (prevUser.friendRequestsIncoming || []).filter(
            (r) => r.fromId !== id && r.fromId !== remoteShort
          );
          return { friends, friendRequestsOutgoing: outgoing, friendRequestsIncoming: incoming };
        });
        sendSyncProgress(conn);
      } else if (data.type === 'FRIEND_REJECT') {
        const remoteShort = stripPeerPrefix(conn.peer);
        onUpdateUser((prevUser) => ({
          friendRequestsOutgoing: (prevUser.friendRequestsOutgoing || []).filter((o) => o.toId !== remoteShort),
        }));
      } else if (data.type === 'FRIEND_REMOVE') {
        const removerId = stripPeerPrefix(conn.peer);
        if (!removerId) return;
        onUpdateUser((prevUser) => ({
          friends: (prevUser.friends || []).filter((f) => f.id !== removerId),
          friendRequestsIncoming: (prevUser.friendRequestsIncoming || []).filter((r) => r.fromId !== removerId),
          friendRequestsOutgoing: (prevUser.friendRequestsOutgoing || []).filter((o) => o.toId !== removerId),
        }));
      } else if (data.type === 'BATTLE_INVITE') {
        if (onBattleEvent) onBattleEvent({ type: 'INVITE', hostId: data.payload.hostId, mode: data.payload.mode || 'RPG' });
      } else if (data.type === 'BATTLE_ACCEPT') {
        if (onBattleEvent) onBattleEvent({ type: 'ACCEPT', hostId: data.payload.hostId, mode: data.payload.mode || 'RPG' });
      } else if (data.type === 'BATTLE_REJECT') {
        if (onBattleEvent) onBattleEvent({ type: 'REJECT', hostId: data.payload.hostId, mode: data.payload.mode || 'RPG' });
      } else if (data.type === 'PING') {
        /* keepalive */
      } else if (data.type === 'PONG') {
        /* ignored */
      }
    },
    [onUpdateUser, onBattleEvent, sendSyncProgress]
  );

  type OutboundMode = 'friend' | 'invite' | 'silent';

  const wireOutboundConnection = useCallback(
    (conn: DataConnection, mode: OutboundMode) => {
      conn.on('open', () => {
        setErrorCode(null);
        setConnections((prev) => [...prev.filter((c) => c.peer !== conn.peer), conn]);
        if (mode === 'friend') {
          sendSyncProgress(conn);
        } else if (mode === 'invite') {
          conn.send({
            type: 'FRIEND_REQUEST',
            payload: peerPayload(userRef.current),
          });
        }
      });
      conn.on('data', (data: any) => handleIncomingData(data, conn));
      conn.on('close', () => {
        setConnections((prev) => prev.filter((c) => c.peer !== conn.peer));
      });
      conn.on('error', (err) => {
        console.warn('Peer outbound error', err);
      });
    },
    [handleIncomingData, sendSyncProgress]
  );

  const handleIncomingDataRef = useRef(handleIncomingData);
  const sendSyncProgressRef = useRef(sendSyncProgress);
  handleIncomingDataRef.current = handleIncomingData;
  sendSyncProgressRef.current = sendSyncProgress;

  useEffect(() => {
    if (!user.peerId) return;

    const fullId = `${PEER_PREFIX}${user.peerId}`;
    let instanceToDestroy: Peer | null = null;

    if (globalPeer && !globalPeer.destroyed && globalPeer.id === fullId) {
      setPeer(globalPeer);
      setIsReady(true);
      setErrorCode(null);
      setKidConnectionHint(null);
      setOpenedPeerShortId(stripPeerPrefix(globalPeer.id));
      instanceToDestroy = globalPeer;

      return () => {
        if (instanceToDestroy && !instanceToDestroy.destroyed && instanceToDestroy.id === fullId) {
          instanceToDestroy.destroy();
          if (globalPeer === instanceToDestroy) globalPeer = null;
        }
        setPeer(null);
        setIsReady(false);
        setOpenedPeerShortId(undefined);
      };
    }

    try {
      const newPeer = new Peer(fullId, {
        debug: import.meta.env.DEV ? 1 : 0,
      });
      globalPeer = newPeer;
      instanceToDestroy = newPeer;

      newPeer.on('open', () => {
        setIsReady(true);
        setErrorCode(null);
        setKidConnectionHint(null);
        const shortFromPeer = stripPeerPrefix(newPeer.id);
        if (shortFromPeer) {
          setOpenedPeerShortId(shortFromPeer);
          onUpdateUserRef.current((prev) => {
            if (prev.peerId === shortFromPeer) return {};
            return { peerId: shortFromPeer };
          });
        }
      });

      newPeer.on('connection', (conn) => {
        conn.on('data', (data: any) => handleIncomingDataRef.current(data, conn));

        const registerConn = () => {
          setConnections((prev) => [...prev.filter((c) => c.peer !== conn.peer), conn]);
          const remoteShort = stripPeerPrefix(conn.peer);
          const isFriend = userRef.current.friends?.some((f) => f.id === remoteShort);
          if (isFriend) {
            sendSyncProgressRef.current(conn);
          }
        };

        if (conn.open) {
          registerConn();
        } else {
          conn.on('open', registerConn);
        }
        conn.on('close', () => {
          setConnections((prev) => prev.filter((c) => c.peer !== conn.peer));
        });
      });

      newPeer.on('error', (err: any) => {
        console.error('PeerJS error:', err);
        if (err.type === 'unavailable-id') {
          setKidConnectionHint(null);
          newPeer.destroy();
          if (globalPeer === newPeer) globalPeer = null;
          setPeer(null);
          setIsReady(false);
          setOpenedPeerShortId(undefined);
          const newId =
            Math.random().toString(36).substring(2, 6).toUpperCase() +
            '-' +
            Math.random().toString(36).substring(2, 6).toUpperCase();
          onUpdateUserRef.current({ peerId: newId });
        }
        /* Do not destroy/recreate Peer on other errors — that caused reconnect storms and broken sync. */
      });

      setPeer(newPeer);
    } catch (err: any) {
      console.error(err);
    }

    return () => {
      if (instanceToDestroy && !instanceToDestroy.destroyed) {
        instanceToDestroy.destroy();
        if (globalPeer === instanceToDestroy) globalPeer = null;
      }
      setPeer(null);
      setIsReady(false);
      setOpenedPeerShortId(undefined);
    };
  }, [user.peerId, peerEpoch]);

  const retryMultiplayerConnection = useCallback(() => {
    setKidConnectionHint(null);
    setErrorCode(null);
    setPeerEpoch((e) => e + 1);
  }, []);

  const buildReconnectTargets = useCallback(() => {
    const u = userRef.current;
    const friends = u.friends || [];
    const outgoing = u.friendRequestsOutgoing || [];
    const incoming = u.friendRequestsIncoming || [];
    const map = new Map<string, OutboundMode>();
    friends.forEach((f) => map.set(f.id, 'friend'));
    outgoing.forEach((o) => {
      if (!friends.some((f) => f.id === o.toId) && !map.has(o.toId)) map.set(o.toId, 'invite');
    });
    incoming.forEach((i) => {
      if (friends.some((f) => f.id === i.fromId)) return;
      if (!map.has(i.fromId)) map.set(i.fromId, 'silent');
    });
    return map;
  }, []);

  const refreshFriendConnections = useCallback(() => {
    if (!peer || !isReady) return;
    setConnections((prev) => prev.filter((c) => c.open));

    window.setTimeout(() => {
      const targets = buildReconnectTargets();
      const entries = [...targets.entries()];
      entries.forEach(([shortId, mode], idx) => {
        window.setTimeout(() => {
          const targetPeer = `${PEER_PREFIX}${shortId}`;
          if (openPeersRef.current.has(targetPeer)) return;
          const conn = peer.connect(targetPeer, { reliable: false });
          wireOutboundConnection(conn, mode);
        }, idx * 400);
      });
    }, 120);
  }, [peer, isReady, wireOutboundConnection, buildReconnectTargets]);

  const connectToFriend = useCallback(
    (friendNumericId: string) => {
      if (!peer || !isReady) {
        setErrorCode('notReady');
        return;
      }

      const targetPeerId = `${PEER_PREFIX}${friendNumericId}`;
      if (targetPeerId === peer.id) {
        setErrorCode('connectSelf');
        return;
      }

      setErrorCode(null);

      if (userRef.current.friends?.some((f) => f.id === friendNumericId)) {
        if (openPeersRef.current.has(targetPeerId)) return;
        const conn = peer.connect(targetPeerId, { reliable: false });
        wireOutboundConnection(conn, 'friend');
        return;
      }

      const alreadyPending = userRef.current.friendRequestsOutgoing?.some((o) => o.toId === friendNumericId);
      if (!alreadyPending) {
        onUpdateUser((prev) => ({
          friendRequestsOutgoing: [
            ...(prev.friendRequestsOutgoing || []),
            { toId: friendNumericId, sentAt: Date.now() },
          ],
        }));
      }

      if (openPeersRef.current.has(targetPeerId)) return;
      const conn = peer.connect(targetPeerId, { reliable: false });
      wireOutboundConnection(conn, 'invite');
    },
    [peer, isReady, wireOutboundConnection, onUpdateUser]
  );

  const friendsKey = useMemo(() => (user.friends || []).map((f) => f.id).sort().join(','), [user.friends]);
  const pendingPeersKey = useMemo(() => {
    const out = (user.friendRequestsOutgoing || [])
      .map((x) => x.toId)
      .sort()
      .join(',');
    const inc = (user.friendRequestsIncoming || [])
      .map((x) => x.fromId)
      .sort()
      .join(',');
    return `${out}|${inc}`;
  }, [user.friendRequestsOutgoing, user.friendRequestsIncoming]);

  useEffect(() => {
    if (!peer || !isReady) return;
    if (!friendsKey && !pendingPeersKey) return;
    const t = window.setTimeout(() => refreshFriendConnections(), 600);
    return () => clearTimeout(t);
  }, [peer, isReady, friendsKey, pendingPeersKey, refreshFriendConnections]);

  useEffect(() => {
    const interval = setInterval(() => {
      connectionsRef.current.forEach((conn) => {
        if (conn.open) {
          conn.send({ type: 'PING', payload: {} });
        }
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const trimmedUserPid = user.peerId?.trim();
  const fromLivePeer =
    peer && !peer.destroyed && peer.id ? stripPeerPrefix(peer.id).trim() : '';
  const resolvedPeerId =
    trimmedUserPid ||
    (openedPeerShortId?.trim() ? openedPeerShortId.trim() : undefined) ||
    (fromLivePeer || undefined);

  return {
    peerId: resolvedPeerId,
    isReady,
    connections,
    errorCode,
    kidConnectionHint,
    retryMultiplayerConnection,
    connectToFriend,
    refreshFriendConnections,
  };
};
