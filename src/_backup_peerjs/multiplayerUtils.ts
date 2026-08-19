import { DataConnection } from 'peerjs';
import { UserState } from '../types';

export const PEER_PREFIX = 'multihero-peer-v1-';

/** Normalize stored / UI id to short friend id (without PeerJS prefix). */
export function stripPeerPrefix(peerOrId: string | null | undefined): string {
  if (!peerOrId) return '';
  return peerOrId.startsWith(PEER_PREFIX) ? peerOrId.slice(PEER_PREFIX.length) : peerOrId;
}

export function getOpponentConnection(
  connections: DataConnection[],
  opponentId: string | null
): DataConnection | undefined {
  const shortId = stripPeerPrefix(opponentId);
  if (!shortId) return undefined;
  const full = `${PEER_PREFIX}${shortId}`;
  return connections.find((c) => c.peer === full && c.open);
}

export function findFriendByOpponentId(
  friends: UserState['friends'],
  opponentId: string | null
) {
  const shortId = stripPeerPrefix(opponentId);
  if (!shortId) return undefined;
  return friends?.find((f) => f.id === shortId);
}

/** Amigo conectado solo si el canal PeerJS está abierto (evita “offline” fantasma). */
export function isFriendPeerOnline(connections: DataConnection[], friendShortId: string): boolean {
  const full = `${PEER_PREFIX}${friendShortId}`;
  return connections.some((c) => c.peer === full && c.open);
}

export function findOpenConnectionToFriend(
  connections: DataConnection[],
  friendShortId: string
): DataConnection | undefined {
  const full = `${PEER_PREFIX}${friendShortId}`;
  return connections.find((c) => c.peer === full && c.open);
}

/** Send quit notice and allow message to flush before closing UI. */
export function sendQuitAndLeave(
  conn: DataConnection | undefined,
  onDone: () => void,
  delayMs = 220
): void {
  if (conn?.open) {
    try {
      conn.send({ type: 'BATTLE_ACTION', payload: { action: 'SURRENDER' } });
    } catch {
      /* ignore */
    }
    window.setTimeout(onDone, delayMs);
  } else {
    onDone();
  }
}
