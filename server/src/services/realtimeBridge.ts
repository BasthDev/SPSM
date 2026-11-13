import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { db } from '../database';
import { config } from '../config';
import { authService, AuthUser } from './authService';

/**
 * Realtime bridge: Appwrite delta-poller → WebSocket fan-out.
 *
 * Server SDK Appwrite tidak support Realtime dengan API key, jadi bridge ini
 * polling ringan: tiap POLL_MS ambil dokumen terbaru per koleksi yang ditonton
 * (orderDesc $updatedAt, limit kecil), bandingkan dengan watermark in-memory,
 * lalu push event ke client WS yang berhak.
 *
 * Biaya DB konstan (~7 query per interval) berapapun jumlah user — tidak
 * ada query per-user seperti polling biasa.
 */

const POLL_MS = 15_000;
const RECENT_LIMIT = 50;
const PRIVILEGED_ROLES = new Set(['admin', 'kaprodi', 'akademik', 'lecturer', 'reviewer']);

interface ClientSocket {
  ws: WebSocket;
  user: AuthUser;
}

interface RealtimeEvent {
  v: 1;
  type: 'ready' | 'entity' | 'settings';
  collection?: string;
  id?: string;
  action?: 'create' | 'update' | 'delete';
  /** submission id untuk koleksi detail (options/logs/surat) */
  submissionId?: string;
  /** pemilik data (student user_id / user_id) — untuk filter di client */
  ownerId?: string;
}

const sockets = new Set<ClientSocket>();
const wss = new WebSocketServer({ noServer: true });

// watermark per koleksi: docId -> $updatedAt terakhir terlihat
const seen = new Map<string, Map<string, string>>();
// cache submissionId -> studentId (untuk koleksi detail)
const submissionOwners = new Map<string, string>();
let pollTimer: NodeJS.Timeout | null = null;
let pingTimer: NodeJS.Timeout | null = null;

function colId(key: keyof typeof config.appwrite.collections): string {
  return config.appwrite.collections[key];
}

const WATCHED: { key: keyof typeof config.appwrite.collections; collection: string }[] = [
  { key: 'submissions', collection: colId('submissions') },
  { key: 'options', collection: colId('options') },
  { key: 'approvalLogs', collection: colId('approvalLogs') },
  { key: 'surat', collection: colId('surat') },
  { key: 'systemSettings', collection: colId('systemSettings') },
  { key: 'users', collection: colId('users') },
];

function isPrivileged(user: AuthUser): boolean {
  return Boolean(user.isAdmin) || PRIVILEGED_ROLES.has(user.role || '');
}

function send(client: ClientSocket, event: RealtimeEvent) {
  if (client.ws.readyState === WebSocket.OPEN) {
    try {
      client.ws.send(JSON.stringify(event));
    } catch {
      // ignore
    }
  }
}

function broadcast(event: RealtimeEvent, predicate?: (user: AuthUser) => boolean) {
  for (const client of sockets) {
    if (!predicate || predicate(client.user)) send(client, event);
  }
}

/** Tentukan pemilik data dari dokumen mentah. */
function ownerOfDoc(collectionKey: string, doc: any): string | null {
  if (collectionKey === 'submissions') return doc.student_id || null;
  if (collectionKey === 'users') return doc.user_id || null;
  if (collectionKey === 'systemSettings') return null; // broadcast
  const submissionId = doc.submission_id || doc.submissionId || null;
  if (submissionId) {
    const cached = submissionOwners.get(submissionId);
    if (cached) return cached;
  }
  return null;
}

async function resolveSubmissionOwner(submissionId: string): Promise<string | null> {
  const cached = submissionOwners.get(submissionId);
  if (cached) return cached;
  try {
    const sub = await db.getSubmissionById(submissionId);
    if (sub?.studentId) {
      submissionOwners.set(submissionId, sub.studentId);
      return sub.studentId;
    }
  } catch {
    // ignore
  }
  return null;
}

async function pollOnce() {
  for (const { key, collection } of WATCHED) {
    try {
      const docs = await db.listRecentDocuments(collection, RECENT_LIMIT);
      let map = seen.get(collection);
      if (!map) {
        map = new Map();
        seen.set(collection, map);
      }

      for (const doc of docs) {
        const docId = doc.$id;
        const updatedAt = doc.$updatedAt || doc.$createdAt || '';
        const prev = map.get(docId);
        if (prev === updatedAt) continue;
        const isNew = prev === undefined;

        // Bangun cache owner untuk submissions (doc terbaru saja sudah cukup)
        if (key === 'submissions' && doc.student_id) {
          submissionOwners.set(docId, doc.student_id);
        }

        map.set(docId, updatedAt);

        // Update dokument lama yang tidak ada di 50 terbaru diabaikan —
        // watermark tetap maju sehingga tidak ada event dobel.
        void handleDocEvent(key, collection, doc, isNew ? 'create' : 'update');
      }
    } catch (e) {
      console.warn(`[rt] poll ${collection} gagal:`, (e as Error).message);
    }
  }
}

async function handleDocEvent(
  collectionKey: string,
  collection: string,
  doc: any,
  action: 'create' | 'update'
) {
  if (collectionKey === 'systemSettings') {
    broadcast({ v: 1, type: 'settings', collection, id: doc.$id, action });
    return;
  }

  let ownerId = ownerOfDoc(collectionKey, doc);
  if (!ownerId && collectionKey !== 'users' && collectionKey !== 'submissions') {
    const submissionId = doc.submission_id || doc.submissionId;
    if (submissionId) ownerId = await resolveSubmissionOwner(submissionId);
  }

  const submissionId =
    collectionKey === 'submissions' ? doc.$id : doc.submission_id || doc.submissionId || undefined;

  const event: RealtimeEvent = {
    v: 1,
    type: 'entity',
    collection: collectionKey,
    id: doc.$id,
    action,
    submissionId,
    ownerId: ownerId || undefined,
  };

  broadcast(event, (user) => {
    if (isPrivileged(user)) return true;
    return Boolean(ownerId) && user.userId === ownerId;
  });
}

function handleUpgrade(request: any, socket: any, head: any) {
  const url = new URL(request.url || '', 'http://localhost');
  if (url.pathname !== '/api/realtime') {
    socket.destroy();
    return;
  }

  const token = url.searchParams.get('token');
  if (!token) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  let user: AuthUser;
  try {
    user = authService.verifyToken(token);
  } catch {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    const client: ClientSocket = { ws, user };
    sockets.add(client);
    send(client, { v: 1, type: 'ready' });
    console.log(`[rt] client connected: ${user.email} (${sockets.size} total)`);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg?.type === 'ping') ws.send(JSON.stringify({ v: 1, type: 'pong' }));
      } catch {
        // ignore
      }
    });

    ws.on('close', () => {
      sockets.delete(client);
      console.log(`[rt] client disconnected: ${user.email} (${sockets.size} total)`);
    });

    ws.on('error', () => {
      sockets.delete(client);
    });
  });
}

export function attachRealtimeBridge(server: Server) {
  server.on('upgrade', handleUpgrade);

  // Poller delta — langsung jalan pertama kali untuk baseline
  pollTimer = setInterval(() => {
    void pollOnce();
  }, POLL_MS);
  pollTimer.unref?.();

  // Keepalive WS
  pingTimer = setInterval(() => {
    for (const client of sockets) {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.ping();
        } catch {
          // ignore
        }
      }
    }
  }, 30_000);
  pingTimer.unref?.();

  console.log(`[rt] Realtime bridge aktif — poll tiap ${POLL_MS / 1000}s, path /api/realtime`);
}
