// Story 1a.7 - Prompt center store (online-game style message log).
//
// Singleton message store backing <PromptPanel/> (bottom area, above the
// StatusBar). Holds an append-only log of prompt messages; confirm() returns a
// Promise<boolean> that settles when the user clicks [确认]/[取消] in the panel.
// The UI is non-modal: the panel pins unanswered confirms so they can't scroll
// out of view, while handleNew awaits the promise before clearing the canvas.
//
// Mirrors the elementStore pattern (factory closure + listeners Set + notify /
// subscribe / getSnapshot) so PromptPanel can subscribe via
// useSyncExternalStore. alert() is reserved but not wired to UI in 1a.7; the
// input/prompt type is out of scope (double-click rename keeps its native
// window.prompt at CanvasView L1083).

export type PromptType = "confirm" | "info" | "toast" | "alert";

export interface PromptMessage {
  id: string;
  type: PromptType;
  text: string;
  ts: number;
  /** confirm only: settled flag (user clicked 确认/取消). */
  resolved?: boolean;
  /** confirm only: true = 确认, false = 取消 (valid once resolved). */
  result?: boolean;
  /** confirm only: settles the promise returned by confirm(). */
  resolve?: (ok: boolean) => void;
}

export interface PromptStore {
  /** Push a confirm; resolves true on 确认, false on 取消. */
  confirm(text: string): Promise<boolean>;
  /** Push an info message (persists until cleared). */
  info(text: string): void;
  /** Push a toast (auto-removed after TOAST_MS). */
  toast(text: string): void;
  /** Reserved (1a.9+); pushes an alert-type message. Not wired to UI in 1a.7. */
  alert(text: string): void;
  /** Remove one message by id. */
  dismiss(id: string): void;
  /** Remove all resolved messages; unanswered confirms are kept. */
  clearResolved(): void;
  /** Current message snapshot. */
  getMessages(): readonly PromptMessage[];
  /** AC-13: unread alert count for the "!" tab badge. */
  getUnreadAlertCount(): number;
  /** AC-13: mark all alerts as read (reset unread count to 0). */
  markAlertRead(): void;
  /** useSyncExternalStore subscription. */
  subscribe(cb: () => void): () => void;
  getSnapshot(): readonly PromptMessage[];
  /** Test-only: clear everything (including unresolved confirms). */
  reset(): void;
}

/** Tab key set for PromptPanel 4-tab container (SDR#1). */
export type TabKey = "alert" | "milestone" | "sourcesink" | "stock";

/** Max retained messages; oldest non-confirm is dropped beyond this. */
export const MAX_MESSAGES = 1000;
/** Toast auto-dismiss delay (ms). */
export const TOAST_MS = 4000;

export function createPromptStore(): PromptStore {
  let messages: PromptMessage[] = [];
  // AC-13: unread alert count for the "!" tab badge.
  let unreadAlertCount = 0;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const cb of listeners) cb();
  };

  const dismiss = (id: string) => {
    const idx = messages.findIndex((m) => m.id === id);
    if (idx === -1) return;
    messages = [...messages.slice(0, idx), ...messages.slice(idx + 1)];
    notify();
  };

  // Drop oldest messages beyond MAX_MESSAGES, but never an unanswered confirm
  // (its awaiter would hang forever). Walk from the front, skipping unresolved
  // confirms until a disposable message is found.
  const trim = () => {
    while (messages.length > MAX_MESSAGES) {
      const idx = messages.findIndex((m) => !(m.type === "confirm" && !m.resolved));
      if (idx === -1) break;
      messages = [...messages.slice(0, idx), ...messages.slice(idx + 1)];
    }
  };

  const push = (msg: PromptMessage) => {
    messages = [...messages, msg];
    trim();
    notify();
  };

  return {
    confirm(text) {
      return new Promise<boolean>((resolveFn) => {
        const id = crypto.randomUUID();
        const msg: PromptMessage = {
          id,
          type: "confirm",
          text,
          ts: Date.now(),
          resolve: (ok) => {
            // Replace the message object (new array ref) so useSyncExternalStore
            // sees the snapshot change and PromptPanel re-renders.
            messages = messages.map((m) =>
              m.id === id ? { ...m, resolved: true, result: ok } : m,
            );
            resolveFn(ok);
            notify();
          },
        };
        push(msg);
      });
    },
    info(text) {
      push({ id: crypto.randomUUID(), type: "info", text, ts: Date.now() });
    },
    toast(text) {
      const id = crypto.randomUUID();
      push({ id, type: "toast", text, ts: Date.now() });
      setTimeout(() => dismiss(id), TOAST_MS);
    },
    alert(text) {
      // SDR#4: push alert (persistent) + toast copy (4s auto-remove).
      // AC-13: bump unread count for the "!" tab badge.
      unreadAlertCount += 1;
      push({ id: crypto.randomUUID(), type: "alert", text, ts: Date.now() });
      const toastId = crypto.randomUUID();
      push({ id: toastId, type: "toast", text, ts: Date.now() });
      setTimeout(() => dismiss(toastId), TOAST_MS);
    },
    dismiss,
    clearResolved() {
      if (!messages.some((m) => m.resolved)) return;
      messages = messages.filter((m) => !m.resolved);
      notify();
    },
    getMessages() {
      return messages;
    },
    getUnreadAlertCount() {
      return unreadAlertCount;
    },
    markAlertRead() {
      if (unreadAlertCount === 0) return;
      unreadAlertCount = 0;
      notify();
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    getSnapshot() {
      return messages;
    },
    reset() {
      messages = [];
      unreadAlertCount = 0;
      notify();
    },
  };
}

/** Shared singleton (imported by PromptPanel + CanvasView's handleNew). */
export const promptStore = createPromptStore();

// ---------------------------------------------------------------------------
// Story 1a.12 T2 - Tab message routing (SDR#2)
// ---------------------------------------------------------------------------

/**
 * SDR#2: route a message to the correct tab.
 * - "!" tab (alert): only confirm + alert types
 * - milestone/sourcesink/stock tabs: no messages (element-based content)
 * - info/toast never appear in any tab (they're transient, shown elsewhere)
 */
export function filterByTab(msg: PromptMessage, tab: TabKey): boolean {
  switch (tab) {
    case "alert":
      return msg.type === "confirm" || msg.type === "alert";
    case "milestone":
    case "sourcesink":
    case "stock":
      return false;
  }
}
