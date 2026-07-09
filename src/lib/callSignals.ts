/**
 * In-memory call signal store.
 * Manages RING / ACCEPT / REJECT / END signals between users.
 * Signals auto-expire after 60 seconds.
 */

export type SignalType = 'RING' | 'ACCEPT' | 'REJECT' | 'END';

export interface CallSignal {
  matchId: string;
  callerId: string;      // user who initiated the call
  callType: 'voice' | 'video';
  signal: SignalType;
  createdAt: number;     // Date.now()
}

const SIGNAL_TTL_MS = 60_000; // 60 seconds

// Global singleton map — persists across API route invocations within the same process
const signalStore = new Map<string, CallSignal>();

/** Set or update the signal for a given match */
export function setSignal(matchId: string, signal: CallSignal): void {
  signalStore.set(matchId, signal);
}

/** Get the active signal for a match (returns undefined if expired or not found) */
export function getSignal(matchId: string): CallSignal | undefined {
  const sig = signalStore.get(matchId);
  if (!sig) return undefined;
  if (Date.now() - sig.createdAt > SIGNAL_TTL_MS) {
    signalStore.delete(matchId);
    return undefined;
  }
  return sig;
}

/** Remove the signal for a match */
export function clearSignal(matchId: string): void {
  signalStore.delete(matchId);
}

/**
 * Get all active RING signals where the given userId is the callee.
 * Used by the callee to detect incoming calls.
 */
export function getIncomingRings(userId: string, userMatchIds: string[]): CallSignal[] {
  const results: CallSignal[] = [];
  for (const matchId of userMatchIds) {
    const sig = getSignal(matchId);
    if (sig && sig.signal === 'RING' && sig.callerId !== userId) {
      results.push(sig);
    }
  }
  return results;
}
