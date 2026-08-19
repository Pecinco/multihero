import { UserState } from '../types';
import { MultiplayerConnection } from '../hooks/useMultiplayer';

export function getOpponentConnection(
  connections: MultiplayerConnection[],
  opponentId: string | null
): MultiplayerConnection | undefined {
  if (!opponentId) return undefined;
  return connections.find((c) => c.id === opponentId && c.open);
}

export function findFriendByOpponentId(
  friends: UserState['friends'],
  opponentId: string | null
) {
  if (!opponentId) return undefined;
  return friends?.find((f) => f.id === opponentId);
}

/** Amigo conectado si su nodo `users/{id}/online` está en true. */
export function isFriendOnline(connections: MultiplayerConnection[], friendId: string): boolean {
  return connections.some((c) => c.id === friendId && c.open);
}

export function findOpenConnectionToFriend(
  connections: MultiplayerConnection[],
  friendId: string
): MultiplayerConnection | undefined {
  return connections.find((c) => c.id === friendId && c.open);
}

/** Send quit notice and allow message to flush before closing UI. */
export function sendQuitAndLeave(
  sendBattleAction: (() => void) | undefined,
  onDone: () => void,
  delayMs = 220
): void {
  if (sendBattleAction) {
    try {
      sendBattleAction();
    } catch {
      /* ignore */
    }
    window.setTimeout(onDone, delayMs);
  } else {
    onDone();
  }
}
