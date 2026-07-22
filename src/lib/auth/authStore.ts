// ══════════════════════════════════════════════════════════════════════════════
// Story 2.1 - authStore (session token in-memory, AC-8/AC-11/SDR#3/SDR#9)
// ══════════════════════════════════════════════════════════════════════════════
//
// External store (useSyncExternalStore-compatible) holding the current session
// token + username. Hard invariant (AD-16/SDR#6/SDR#9): the token lives in JS
// memory ONLY — it MUST NOT be written to localStorage or sessionStorage. The
// HttpOnly ns-session cookie is unreadable by JS; the JSON-body token is held
// here for WS first-frame auth (Epic 3) and client-side user display.
//
// Pattern: closure factory + listeners Set + notify/subscribe/getSnapshot,
// mirroring promptStore (project-context L85-87).
// ══════════════════════════════════════════════════════════════════════════════

interface AuthState {
  username: string | null;
  token: string | null;
}

interface MeResponse {
  user: { id: string; username: string };
  token: string;
}

let state: AuthState = { username: null, token: null };
const listeners = new Set<() => void>();

const notify = () => {
  for (const cb of listeners) cb();
};

/** Fetch the current session from GET /api/auth/me. On 200, stores the
 *  username + token in-memory. On 401, clears both (logged out). */
export async function fetchMe(): Promise<void> {
  const resp = await fetch("/api/auth/me");
  if (resp.status === 200) {
    const body = (await resp.json()) as MeResponse;
    state = { username: body.user.username, token: body.token };
  } else {
    state = { username: null, token: null };
  }
  notify();
}

/** Return the current username (null if not authenticated). */
export function getUsername(): string | null {
  return state.username;
}

/** Return the current in-memory session token (null if not authenticated).
 *  Token is held in JS memory ONLY — never written to storage (SDR#6/SDR#9). */
export function getToken(): string | null {
  return state.token;
}

/** Subscribe for useSyncExternalStore. Returns an unsubscribe function. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Return the current snapshot (for useSyncExternalStore). */
export function getSnapshot(): { username: string | null; token: string | null } {
  return state;
}
