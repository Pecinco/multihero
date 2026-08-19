import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  get,
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';
import { UserState } from '../types';
import { auth, db } from '../lib/firebase';

export interface MultiplayerConnection {
  id: string;
  open: boolean;
}

export type BattleMode = 'RPG' | 'TUG' | 'SPRINT';

export type BattleEvent =
  | { type: 'INVITE'; hostId: string; mode: BattleMode; battleId: string }
  | { type: 'ACCEPT'; opponentId: string; mode: BattleMode; battleId: string }
  | { type: 'REJECT'; opponentId: string; mode: BattleMode; battleId: string };

export type ConnectionErrorCode = 'notReady' | 'connectSelf' | 'invalidFriendCode' | null;

/** UX for kids — hints only (Firebase reconnect is automatic). */
export type KidConnectionHint = null | 'slow' | 'tapRetry';

const HINT_SLOW_MS = 8_000;
const HINT_TAP_RETRY_MS = 28_000;

const randomFriendCode = () =>
  Math.random().toString(36).substring(2, 6).toUpperCase() +
  '-' +
  Math.random().toString(36).substring(2, 6).toUpperCase();

const userPayload = (u: UserState) => ({
  name: u.playerName?.trim() ?? '',
  level: u.currentLevel,
  avatar: u.selectedAvatar,
});

export const useMultiplayer = (
  uid: string | undefined,
  user: UserState,
  onUpdateUser: (u: Partial<UserState> | ((prev: UserState) => Partial<UserState>)) => void,
  onBattleEvent?: (ev: BattleEvent) => void
) => {
  const [connections, setConnections] = useState<MultiplayerConnection[]>([]);
  const [friendCode, setFriendCode] = useState<string | undefined>(user.friendCode);
  /** Sin código aún: generando; si falla todo, 'failed' (p. ej. reglas RTDB). */
  const [friendCodeStatus, setFriendCodeStatus] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const userRef = useRef(user);
  const uidRef = useRef(uid);
  const [isReady, setIsReady] = useState(false);
  const [errorCode, setErrorCode] = useState<ConnectionErrorCode>(null);
  const [kidConnectionHint, setKidConnectionHint] = useState<KidConnectionHint>(null);
  const battlePrevRef = useRef<Map<string, { status: string; updatedAt: number }>>(new Map());

  const lastFriendsJsonRef = useRef('');
  const lastIncomingJsonRef = useRef('');
  const lastOutgoingJsonRef = useRef('');

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    uidRef.current = uid;
  }, [uid]);

  useEffect(() => {
    if (user.friendCode) {
      setFriendCode((prev) => prev || user.friendCode);
      setFriendCodeStatus('ready');
    }
  }, [user.friendCode]);

  const onUpdateUserRef = useRef(onUpdateUser);
  onUpdateUserRef.current = onUpdateUser;

  const onBattleEventRef = useRef(onBattleEvent);
  onBattleEventRef.current = onBattleEvent;

  useEffect(() => {
    if (!uid || isReady) return;
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
  }, [uid, isReady]);

  useEffect(() => {
    if (errorCode !== 'notReady' && errorCode !== 'connectSelf' && errorCode !== 'invalidFriendCode') return;
    const t = window.setTimeout(() => setErrorCode(null), 5_000);
    return () => window.clearTimeout(t);
  }, [errorCode]);

  useEffect(() => {
    if (!uid) return;
    const selfRef = ref(db, `users/${uid}`);
    const connectedRef = ref(db, '.info/connected');
    const unsubConnected = onValue(connectedRef, (snap) => {
      const connected = !!snap.val();
      setIsReady(connected);
      if (!connected) return;
      const u = userRef.current;
      const displayName = u.playerName?.trim() || u.friendCode || 'Player';
      // update (no set): si no, se borra users/{uid}/friendCode en cada reconexión.
      update(selfRef, {
        name: displayName,
        level: u.currentLevel,
        avatar: u.selectedAvatar,
        online: true,
        lastSeen: serverTimestamp(),
      }).catch(() => {});
      onDisconnect(selfRef).update({
        online: false,
        lastSeen: serverTimestamp(),
      });
      setKidConnectionHint(null);
    });

    return () => {
      unsubConnected();
      setIsReady(false);
    };
  }, [uid]);

  /** Publica cambios de perfil en caliente (nivel/avatar/nombre) para los amigos. */
  useEffect(() => {
    if (!uid || !isReady) return;
    const u = userRef.current;
    const displayName = u.playerName?.trim() || u.friendCode || 'Player';
    update(ref(db, `users/${uid}`), {
      name: displayName,
      level: u.currentLevel,
      avatar: u.selectedAvatar,
      online: true,
      lastSeen: serverTimestamp(),
    }).catch(() => {});
  }, [uid, isReady, user.playerName, user.currentLevel, user.selectedAvatar, user.friendCode]);

  /**
   * Código corto: `friendCodes/{code} -> uid` + `users/{uid}/friendCode`.
   * - Esperamos authStateReady() para que el token llegue a RTDB antes de escribir.
   * - Primero update multi-ruta (suele funcionar con reglas simples); si falla, runTransaction.
   */
  useEffect(() => {
    if (!uid) {
      setFriendCodeStatus('idle');
      return;
    }
    if (!isReady) return;
    const dbUrl = typeof import.meta.env.VITE_FIREBASE_DATABASE_URL === 'string'
      ? import.meta.env.VITE_FIREBASE_DATABASE_URL.trim()
      : '';
    if (!dbUrl) {
      console.error('[multiplayer] Falta VITE_FIREBASE_DATABASE_URL en .env');
      setFriendCodeStatus('failed');
      return;
    }

    let cancelled = false;
    const myUid = uid;
    const codeRef = ref(db, `users/${myUid}/friendCode`);

    setFriendCodeStatus('loading');

    const unsub = onValue(codeRef, (snap) => {
      const existing = snap.val();
      if (typeof existing === 'string' && existing.length > 0) {
        setFriendCode(existing);
        setFriendCodeStatus('ready');
        onUpdateUserRef.current({ friendCode: existing });
      }
    });

    const allocate = async () => {
      try {
        await auth.authStateReady();
        if (cancelled) return;
        if (!auth.currentUser?.uid) {
          console.error('[multiplayer] Sin usuario de Auth; no se puede generar friendCode.');
          setFriendCodeStatus('failed');
          return;
        }
        if (auth.currentUser.uid !== myUid) {
          console.warn('[multiplayer] uid del hook y auth.currentUser.uid no coinciden');
        }

        const snap = await get(codeRef);
        if (cancelled) return;
        const v = snap.val();
        if (typeof v === 'string' && v.length > 0) {
          setFriendCodeStatus('ready');
          return;
        }

        setFriendCodeStatus('loading');

        const tryClaim = async (candidate: string): Promise<boolean> => {
          try {
            const tx = await runTransaction(ref(db, `friendCodes/${candidate}`), (current) => {
              if (current === null || current === undefined) return myUid;
              return undefined;
            });
            if (!tx.committed) return false;
            await set(codeRef, candidate);
            return true;
          } catch (e) {
            console.warn('[multiplayer] transacción friendCode, probando update:', e);
            try {
              const taken = await get(ref(db, `friendCodes/${candidate}`));
              if (taken.exists()) return false;
              await update(ref(db), {
                [`users/${myUid}/friendCode`]: candidate,
                [`friendCodes/${candidate}`]: myUid,
              });
              return true;
            } catch (e2) {
              console.warn('[multiplayer] update friendCode:', e2);
              return false;
            }
          }
        };

        for (let attempt = 0; attempt < 50 && !cancelled; attempt++) {
          const candidate = randomFriendCode();
          // eslint-disable-next-line no-await-in-loop
          const ok = await tryClaim(candidate);
          if (ok) {
            if (!cancelled) {
              setFriendCode(candidate);
              setFriendCodeStatus('ready');
              onUpdateUserRef.current({ friendCode: candidate });
            }
            return;
          }
        }
        if (!cancelled) {
          console.error('[multiplayer] No se pudo asignar friendCode (reglas RTDB o red).');
          setFriendCodeStatus('failed');
        }
      } catch (e) {
        console.error('[multiplayer] allocate friendCode:', e);
        if (!cancelled) setFriendCodeStatus('failed');
      }
    };

    void allocate();

    return () => {
      cancelled = true;
      unsub();
    };
  }, [uid, isReady]);

  useEffect(() => {
    if (!uid) return;
    const unsubscribe = onValue(ref(db, `friends/${uid}`), (snap) => {
      const value = snap.val() || {};
      const entries = Object.entries(value).map(([id, v]) => {
        const item = (v || {}) as { name?: string; level?: number; avatar?: string };
        return {
          id,
          name: item.name?.trim() || id,
          level: Number(item.level || 1),
          avatar: item.avatar || AVATARS_FALLBACK,
        };
      });
      const json = JSON.stringify(entries);
      if (json === lastFriendsJsonRef.current) return;
      lastFriendsJsonRef.current = json;
      onUpdateUserRef.current({ friends: entries });
    });
    return () => unsubscribe();
  }, [uid]);

  /**
   * Datos vivos del amigo desde users/{friendId} para mapa/listado:
   * nivel, avatar y nombre se actualizan aunque cambie personaje o avance.
   */
  useEffect(() => {
    const friends = user.friends || [];
    if (friends.length === 0) return;
    const unsubs = friends.map((friend) =>
      onValue(ref(db, `users/${friend.id}`), (snap) => {
        const live = (snap.val() || {}) as { name?: string; level?: number; avatar?: string };
        const liveName = live.name?.trim();
        const nextName = liveName && liveName.length > 0 ? liveName : friend.name;
        const nextLevel = typeof live.level === 'number' && Number.isFinite(live.level) ? Math.max(1, Math.floor(live.level)) : friend.level;
        const nextAvatar = typeof live.avatar === 'string' && live.avatar.trim().length > 0 ? live.avatar : friend.avatar;
        onUpdateUserRef.current((prev) => {
          const prevFriends = prev.friends || [];
          let changed = false;
          const nextFriends = prevFriends.map((f) => {
            if (f.id !== friend.id) return f;
            if (f.name === nextName && f.level === nextLevel && f.avatar === nextAvatar) return f;
            changed = true;
            return { ...f, name: nextName, level: nextLevel, avatar: nextAvatar };
          });
          return changed ? { friends: nextFriends } : {};
        });
      })
    );
    return () => {
      unsubs.forEach((off) => off());
    };
  }, [user.friends]);

  useEffect(() => {
    if (!uid) return;
    const unsubscribe = onValue(ref(db, `friendRequests/${uid}`), (snap) => {
      const value = snap.val() || {};
      const incoming = Object.entries(value).map(([fromId, v]) => {
        const item = (v || {}) as { name?: string; level?: number; avatar?: string; timestamp?: number };
        return {
          fromId,
          name: item.name?.trim() || fromId,
          level: Number(item.level || 1),
          avatar: item.avatar || AVATARS_FALLBACK,
          receivedAt: Number(item.timestamp || Date.now()),
        };
      });
      const json = JSON.stringify(incoming);
      if (json === lastIncomingJsonRef.current) return;
      lastIncomingJsonRef.current = json;
      onUpdateUserRef.current({ friendRequestsIncoming: incoming });
    });
    return () => unsubscribe();
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const unsubscribe = onValue(ref(db, `friendRequestsOutgoing/${uid}`), (snap) => {
      const value = snap.val() || {};
      const outgoing = Object.entries(value).map(([toId, v]) => {
        const item = (v || {}) as { sentAt?: number };
        return {
          toId,
          sentAt: Number(item.sentAt || Date.now()),
        };
      });
      const json = JSON.stringify(outgoing);
      if (json === lastOutgoingJsonRef.current) return;
      lastOutgoingJsonRef.current = json;
      onUpdateUserRef.current({ friendRequestsOutgoing: outgoing });
    });
    return () => unsubscribe();
  }, [uid]);

  const friendsKey = useMemo(() => (user.friends || []).map((f) => f.id).sort().join(','), [user.friends]);
  const pendingPeersKey = useMemo(() => {
    const outgoing = (user.friendRequestsOutgoing || [])
      .map((x) => x.toId)
      .sort()
      .join(',');
    const incoming = (user.friendRequestsIncoming || [])
      .map((x) => x.fromId)
      .sort()
      .join(',');
    return `${outgoing}|${incoming}`;
  }, [user.friendRequestsOutgoing, user.friendRequestsIncoming]);

  useEffect(() => {
    const friendIds = (user.friends || []).map((f) => f.id);
    const incomingIds = (user.friendRequestsIncoming || []).map((r) => r.fromId);
    const outgoingIds = (user.friendRequestsOutgoing || []).map((r) => r.toId);
    const targetIds = [...new Set([...friendIds, ...incomingIds, ...outgoingIds])];
    if (targetIds.length === 0) {
      setConnections([]);
      return;
    }
    const onlineMap = new Map<string, boolean>();
    let lastOnlineKey = '';
    const unsubscribers = targetIds.map((fid) =>
      onValue(ref(db, `users/${fid}/online`), (snap) => {
        onlineMap.set(fid, !!snap.val());
        const key = targetIds.map((id) => `${id}:${!!onlineMap.get(id)}`).join(',');
        if (key === lastOnlineKey) return;
        lastOnlineKey = key;
        const next = targetIds.map((id) => ({
          id,
          open: !!onlineMap.get(id),
        }));
        setConnections(next);
      })
    );
    return () => {
      unsubscribers.forEach((off) => off());
    };
  }, [friendsKey, pendingPeersKey, user.friends, user.friendRequestsIncoming, user.friendRequestsOutgoing]);

  useEffect(() => {
    if (!uid) return;
    const battleUnsubs = new Map<string, () => void>();
    const inboxRef = ref(db, `battleInbox/${uid}`);
    const stopInbox = onValue(inboxRef, (snap) => {
      const inbox = snap.val() || {};
      const battleIds = Object.keys(inbox);
      for (const [battleId, off] of battleUnsubs.entries()) {
        if (!battleIds.includes(battleId)) {
          off();
          battleUnsubs.delete(battleId);
          battlePrevRef.current.delete(battleId);
        }
      }
      battleIds.forEach((battleId) => {
        if (battleUnsubs.has(battleId)) return;
        const offBattle = onValue(ref(db, `battles/${battleId}`), (battleSnap) => {
          const battle = battleSnap.val();
          if (!battle) return;
          const st = String(battle.status || 'UNKNOWN');
          const up = Number(battle.updatedAt || 0);
          const prev = battlePrevRef.current.get(battleId);
          if (prev && prev.status === st && prev.updatedAt === up) return;
          battlePrevRef.current.set(battleId, { status: st, updatedAt: up });

          const mode = (battle.mode || 'RPG') as BattleMode;
          const me = uidRef.current!;
          if (!me) return;

          if (st === 'INVITED' && battle.guest === me && onBattleEventRef.current) {
            onBattleEventRef.current({ type: 'INVITE', hostId: battle.host, mode, battleId });
            return;
          }

          if (st === 'ACTIVE' && battle.host === me && onBattleEventRef.current) {
            const justAccepted = prev?.status === 'INVITED';
            const recentActive = !prev && up > 0 && Date.now() - up < 120_000;
            if (justAccepted || recentActive) {
              onBattleEventRef.current({ type: 'ACCEPT', opponentId: battle.guest, mode, battleId });
            }
            return;
          }

          if (st === 'REJECTED' && battle.host === me && onBattleEventRef.current && prev?.status === 'INVITED') {
            onBattleEventRef.current({ type: 'REJECT', opponentId: battle.guest, mode, battleId });
          }
        });
        battleUnsubs.set(battleId, offBattle);
      });

      void (async () => {
        const me = uidRef.current;
        if (!me) return;
        for (const battleId of battleIds) {
          try {
            const stSnap = await get(ref(db, `battles/${battleId}/status`));
            const st = stSnap.val();
            if (st === 'FINISHED' || st === 'REJECTED') {
              await remove(ref(db, `battleInbox/${me}/${battleId}`));
            }
          } catch {
            /* ignore cleanup errors */
          }
        }
      })();
    });
    return () => {
      stopInbox();
      battleUnsubs.forEach((off) => off());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const leavePvpBattle = useCallback(async (battleId: string | null) => {
    const me = uidRef.current;
    if (!me || !battleId) return;
    try {
      const snap = await get(ref(db, `battles/${battleId}`));
      const b = snap.val() as { host?: string; guest?: string } | null;
      const host = b?.host;
      const guest = b?.guest;
      const updates: Record<string, unknown> = {
        [`battles/${battleId}/status`]: 'FINISHED',
        [`battles/${battleId}/updatedAt`]: Date.now(),
        [`battleInbox/${me}/${battleId}`]: null,
      };
      if (host && host !== me) updates[`battleInbox/${host}/${battleId}`] = null;
      if (guest && guest !== me) updates[`battleInbox/${guest}/${battleId}`] = null;
      await update(ref(db), updates);
    } catch {
      try {
        await remove(ref(db, `battleInbox/${me}/${battleId}`));
      } catch {
        /* ignore */
      }
    }
  }, []);

  const retryMultiplayerConnection = useCallback(() => {
    setKidConnectionHint(null);
    setErrorCode(null);
  }, []);

  const refreshFriendConnections = useCallback(() => {
    setErrorCode(null);
    lastFriendsJsonRef.current = '';
    lastIncomingJsonRef.current = '';
    lastOutgoingJsonRef.current = '';
    const me = uidRef.current;
    if (!me) return;
    void (async () => {
      try {
        const friendsSnap = await get(ref(db, `friends/${me}`));
        const friendsRaw = (friendsSnap.val() || {}) as Record<string, { name?: string; level?: number; avatar?: string }>;
        const friendIds = Object.keys(friendsRaw);
        if (friendIds.length === 0) {
          onUpdateUserRef.current({ friends: [] });
          return;
        }
        const entries = await Promise.all(
          friendIds.map(async (id) => {
            try {
              const liveSnap = await get(ref(db, `users/${id}`));
              const live = (liveSnap.val() || {}) as { name?: string; level?: number; avatar?: string };
              const fallback = friendsRaw[id] || {};
              return {
                id,
                name: live.name?.trim() || fallback.name?.trim() || id,
                level: Number(live.level ?? fallback.level ?? 1) || 1,
                avatar: live.avatar || fallback.avatar || AVATARS_FALLBACK,
              };
            } catch {
              const fallback = friendsRaw[id] || {};
              return {
                id,
                name: fallback.name?.trim() || id,
                level: Number(fallback.level || 1),
                avatar: fallback.avatar || AVATARS_FALLBACK,
              };
            }
          })
        );
        onUpdateUserRef.current({ friends: entries });
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const connectToFriend = useCallback(
    (rawCode: string) => {
      const me = uidRef.current;
      const normalized = rawCode.trim().toUpperCase().replace(/\s+/g, '');
      if (!me || !isReady) {
        setErrorCode('notReady');
        return;
      }
      setErrorCode(null);
      void (async () => {
        const targetSnap = await get(ref(db, `friendCodes/${normalized}`));
        const targetUid = targetSnap.val();
        if (!targetUid || typeof targetUid !== 'string') {
          setErrorCode('invalidFriendCode');
          return;
        }
        if (targetUid === me) {
          setErrorCode('connectSelf');
          return;
        }
        const payload = userPayload(userRef.current);
        set(ref(db, `friendRequests/${targetUid}/${me}`), {
          name: payload.name || me.slice(0, 8),
          level: payload.level,
          avatar: payload.avatar,
          timestamp: Date.now(),
        });
        set(ref(db, `friendRequestsOutgoing/${me}/${targetUid}`), { sentAt: Date.now() });
      })();
    },
    [isReady]
  );

  const acceptFriendRequest = useCallback(async (fromId: string) => {
    const me = uidRef.current;
    if (!me) return;
    const incoming = userRef.current.friendRequestsIncoming?.find((r) => r.fromId === fromId);
    if (!incoming) return;
    const mePayload = userPayload(userRef.current);
    await update(ref(db), {
      [`friends/${me}/${fromId}`]: {
        name: incoming.name?.trim() || fromId,
        level: incoming.level || 1,
        avatar: incoming.avatar || AVATARS_FALLBACK,
        since: Date.now(),
      },
      [`friends/${fromId}/${me}`]: {
        name: mePayload.name || me.slice(0, 8),
        level: mePayload.level,
        avatar: mePayload.avatar,
        since: Date.now(),
      },
      [`friendRequests/${me}/${fromId}`]: null,
      [`friendRequestsOutgoing/${fromId}/${me}`]: null,
    });
  }, []);

  const rejectFriendRequest = useCallback(async (fromId: string) => {
    const me = uidRef.current;
    if (!me) return;
    await update(ref(db), {
      [`friendRequests/${me}/${fromId}`]: null,
      [`friendRequestsOutgoing/${fromId}/${me}`]: null,
    });
  }, []);

  const cancelOutgoingFriendRequest = useCallback(async (toId: string) => {
    const me = uidRef.current;
    if (!me) return;
    await update(ref(db), {
      [`friendRequests/${toId}/${me}`]: null,
      [`friendRequestsOutgoing/${me}/${toId}`]: null,
    });
  }, []);

  const removeFriend = useCallback(async (friendId: string) => {
    const me = uidRef.current;
    if (!me) return;
    await update(ref(db), {
      [`friends/${me}/${friendId}`]: null,
      [`friends/${friendId}/${me}`]: null,
      [`friendRequests/${me}/${friendId}`]: null,
      [`friendRequests/${friendId}/${me}`]: null,
      [`friendRequestsOutgoing/${me}/${friendId}`]: null,
      [`friendRequestsOutgoing/${friendId}/${me}`]: null,
    });
  }, []);

  const inviteBattle = useCallback(async (friendId: string, mode: BattleMode) => {
    const me = uidRef.current;
    if (!me) return null;
    const battleRef = push(ref(db, 'battles'));
    const battleId = battleRef.key;
    if (!battleId) return null;
    await set(battleRef, {
      host: me,
      guest: friendId,
      mode,
      status: 'INVITED',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await update(ref(db), {
      [`battleInbox/${me}/${battleId}`]: true,
      [`battleInbox/${friendId}/${battleId}`]: true,
    });
    return battleId;
  }, []);

  const acceptBattleInvite = useCallback(async (battleId: string) => {
    await update(ref(db, `battles/${battleId}`), {
      status: 'ACTIVE',
      updatedAt: Date.now(),
    });
  }, []);

  const rejectBattleInvite = useCallback(async (battleId: string) => {
    await update(ref(db, `battles/${battleId}`), {
      status: 'REJECTED',
      updatedAt: Date.now(),
    });
  }, []);

  const sendBattleAction = useCallback(
    async (battleId: string | null, action: string, payload: Record<string, unknown> = {}) => {
      const me = uidRef.current;
      if (!me || !battleId) return;
      await push(ref(db, `battles/${battleId}/actions`), {
        from: me,
        action,
        ...payload,
        timestamp: Date.now(),
      });
    },
    []
  );

  return {
    friendCode: friendCode?.trim() || undefined,
    friendCodeStatus,
    isReady,
    connections,
    errorCode,
    kidConnectionHint,
    retryMultiplayerConnection,
    connectToFriend,
    refreshFriendConnections,
    acceptFriendRequest,
    rejectFriendRequest,
    cancelOutgoingFriendRequest,
    removeFriend,
    inviteBattle,
    acceptBattleInvite,
    rejectBattleInvite,
    sendBattleAction,
    leavePvpBattle,
  };
};

const AVATARS_FALLBACK = 'hero-main';
