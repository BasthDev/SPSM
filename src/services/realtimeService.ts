import { API_BASE_URL, getAuthToken } from './apiClient';

/**
 * Realtime client — WebSocket ke backend bridge (/api/realtime).
 * Event dipakai untuk invalidasi cache + refetch selektif; UI tidak pernah
 * menerima payload database mentah, hanya sinyal "data berubah".
 */

export interface RealtimeEvent {
  v: 1;
  type: 'ready' | 'entity' | 'settings' | 'pong';
  collection?: string;
  id?: string;
  action?: 'create' | 'update' | 'delete';
  submissionId?: string;
  ownerId?: string;
}

type Listener = (event: RealtimeEvent) => void;

const listeners = new Set<Listener>();
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let intentionalClose = false;
let connecting = false;

function wsUrl(token: string): string {
  const base = API_BASE_URL.replace(/^http/, 'ws').replace(/\/+$/, '');
  return `${base}/realtime?token=${encodeURIComponent(token)}`;
}

function scheduleReconnect() {
  if (intentionalClose || reconnectTimer) return;
  const delay = Math.min(1000 * 2 ** reconnectAttempts, 30_000);
  reconnectAttempts += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connectRealtime();
  }, delay);
}

export function onRealtimeEvent(listener: Listener): () => void {
  listeners.add(listener);
  // Pastikan socket hidup saat ada subscriber pertama
  void connectRealtime();
  return () => {
    listeners.delete(listener);
  };
}

export async function connectRealtime(): Promise<void> {
  if (ws && ws.readyState <= WebSocket.OPEN) return;
  if (connecting || intentionalClose) return;

  const token = await getAuthToken();
  if (!token) return;

  connecting = true;
  try {
    const socket = new WebSocket(wsUrl(token));
    ws = socket;

    socket.onopen = () => {
      connecting = false;
      reconnectAttempts = 0;
    };

    socket.onmessage = (e) => {
      try {
        const event = JSON.parse(String(e.data)) as RealtimeEvent;
        if (event.type === 'pong' || event.type === 'ready') return;
        listeners.forEach((l) => {
          try {
            l(event);
          } catch {}
        });
      } catch {
        // ignore malformed payload
      }
    };

    socket.onclose = () => {
      connecting = false;
      ws = null;
      if (!intentionalClose) scheduleReconnect();
    };

    socket.onerror = () => {
      // onclose akan menyusul dan menangani reconnect
    };
  } catch {
    connecting = false;
    scheduleReconnect();
  }
}

export function disconnectRealtime() {
  intentionalClose = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  connecting = false;
  if (ws) {
    try {
      ws.close();
    } catch {}
    ws = null;
  }
}

/** Dipanggil saat login agar socket langsung tersambung tanpa menunggu mount. */
export function resetRealtimeForLogin() {
  intentionalClose = false;
  reconnectAttempts = 0;
  void connectRealtime();
}
