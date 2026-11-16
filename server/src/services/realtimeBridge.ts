import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import PocketBase from 'pocketbase';
import { db } from '../database';
import { config } from '../config';
import { authService, AuthUser } from './authService';

/**
 * Realtime bridge: PocketBase SSE / Appwrite delta-poller → WebSocket fan-out.
 */

const POLL_MS = 15_000;
const RECENT_LIMIT = 50;
const PRIVILEGED_ROLES = new Set(['admin', 'kaprodi', 'akademik', 'lecturer', 'reviewer']);

interface ClientSocket {
  ws: WebSocket;
  user: AuthUser;
}

const AUTH_TIMEOUT_MS = 10_000;

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
// socket yang sudah upgrade tapi belum kirim auth — belum menerima event apa pun
const pendingAuth = new Set<WebSocket>();
const wss = new WebSocketServer({ noServer: true });

// watermark per koleksi: docId -> $updatedAt terakhir terlihat
const seen = new Map<string, Map<string, string>>();
// cache submissionId -> studentId (untuk koleksi detail)
const submissionOwners = new Map<string, string>();
// koleksi yang sudah punya baseline — poll pertama hanya mencatat watermark
const initialized = new Set<string>();
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
  { key: 'lecturers', collection: colId('lecturers') },
  { key: 'departments', collection: colId('departments') },
  { key: 'batchYears', collection: colId('batchYears') },
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

/** PocketBase record id: `id` (PB) atau `$id` (Appwrite legacy). */
function docId(doc: any): string {
  return doc?.id ?? doc?.$id ?? '';
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
      const isBaseline = !initialized.has(collection);
      initialized.add(collection);

      for (const doc of docs) {
        const id = docId(doc);
        const updatedAt = doc.updated || doc.$updatedAt || doc.$createdAt || '';
        const prev = map.get(id);
        if (prev === updatedAt) continue;
        const isNew = prev === undefined;

        // Bangun cache owner untuk submissions (doc terbaru saja sudah cukup)
        if (key === 'submissions' && doc.student_id) {
          submissionOwners.set(id, doc.student_id);
        }

        map.set(id, updatedAt);

        // Update dokument lama yang tidak ada di 50 terbaru diabaikan —
        // watermark tetap maju sehingga tidak ada event dobel.
        // Poll pertama (baseline) tidak emit event — hanya membangun watermark,
        // supaya restart server tidak memicu flood 'create' ke semua client.
        if (!isBaseline) {
          void handleDocEvent(key, collection, doc, isNew ? 'create' : 'update');
        }
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
  action: 'create' | 'update' | 'delete'
) {
  const id = docId(doc);
  if (collectionKey === 'systemSettings') {
    broadcast({ v: 1, type: 'settings', collection, id, action });
    return;
  }

  // Update cache owner untuk submissions (termasuk delete: biarkan, record masih ada)
  if (collectionKey === 'submissions' && doc.student_id) {
    submissionOwners.set(id, doc.student_id);
  }

  let ownerId = ownerOfDoc(collectionKey, doc);
  if (!ownerId && collectionKey !== 'users' && collectionKey !== 'submissions') {
    const submissionId = doc.submission_id || doc.submissionId;
    if (submissionId) ownerId = await resolveSubmissionOwner(submissionId);
  }

  const submissionId =
    collectionKey === 'submissions' ? id : doc.submission_id || doc.submissionId || undefined;

  const event: RealtimeEvent = {
    v: 1,
    type: 'entity',
    collection,
    id,
    action,
    submissionId,
    ownerId: ownerId || undefined,
  };

  broadcast(event, (user) => {
    if (isPrivileged(user)) return true;
    if (['departments', 'batch_years', 'system_settings'].includes(collection)) return true;
    return Boolean(ownerId) && user.userId === ownerId;
  });
}

function rejectUpgrade(socket: any, status: number, reason: string) {
  socket.write(`HTTP/1.1 ${status} ${reason}\r\n\r\n`);
  socket.destroy();
}

function handleUpgrade(request: any, socket: any, head: any) {
  const url = new URL(request.url || '', 'http://localhost');
  if (url.pathname !== '/api/realtime') {
    socket.destroy();
    return;
  }

  // Token TIDAK diterima via query param — dikirim sebagai pesan pertama
  // setelah connect ({type:'auth', token}) supaya tidak tercatat di access log.
  wss.handleUpgrade(request, socket, head, (ws) => {
    pendingAuth.add(ws);

    const authTimer = setTimeout(() => {
      if (pendingAuth.has(ws)) {
        try {
          ws.send(JSON.stringify({ v: 1, type: 'auth_error', reason: 'timeout' }));
          ws.close();
        } catch {}
      }
    }, AUTH_TIMEOUT_MS);
    authTimer.unref?.();

    ws.on('message', (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      // Pesan pertama WAJIB auth — socket belum terdaftar di `sockets`
      // jadi tidak menerima event apapun sebelum terverifikasi.
      if (!pendingAuth.has(ws)) {
        if (msg?.type === 'ping') ws.send(JSON.stringify({ v: 1, type: 'pong' }));
        return;
      }

      const token = typeof msg?.token === 'string' ? msg.token : null;
      let user: AuthUser | null = null;
      try {
        if (token) user = authService.verifyToken(token) as AuthUser;
      } catch {
        user = null;
      }

      pendingAuth.delete(ws);
      clearTimeout(authTimer);

      if (!user) {
        try {
          ws.send(JSON.stringify({ v: 1, type: 'auth_error', reason: 'invalid_token' }));
          ws.close();
        } catch {}
        return;
      }

      const client: ClientSocket = { ws, user };
      sockets.add(client);
      send(client, { v: 1, type: 'ready' });
      console.log(`[rt] client connected: ${user.email} (${sockets.size} total)`);

      ws.on('close', (code, reason) => {
        sockets.delete(client);
        const reasonStr = reason ? reason.toString() : '';
        console.log(`[rt] client disconnected: ${user.email} (code: ${code}${reasonStr ? `, reason: ${reasonStr}` : ''}) (${sockets.size} total)`);
      });

      ws.on('error', () => {
        sockets.delete(client);
      });
    });

    ws.on('close', () => {
      pendingAuth.delete(ws);
    });
  });
}

/**
 * PocketBase realtime: subscribe SSE per koleksi yang ditonton.
 * Menggunakan dedicated PocketBase client instance agar tidak pernah terganggu
 * oleh disconnect/resubscribe OAuth di authService.
 */
let rtPb: PocketBase | null = null;

async function startPocketBaseRealtime(): Promise<boolean> {
  if (config.dbAdapter !== 'pocketbase') return false;
  try {
    rtPb = new PocketBase(config.pocketbase.url);
    rtPb.autoCancellation(false);

    try {
      await (rtPb as any).collection('_superusers').authWithPassword(config.pocketbase.adminEmail, config.pocketbase.adminPassword);
    } catch {
      await rtPb.admins.authWithPassword(config.pocketbase.adminEmail, config.pocketbase.adminPassword).catch((err: any) => {
        console.warn('[rt] superuser auth warning:', err?.message);
      });
    }

    for (const { key, collection } of WATCHED) {
      try {
        await rtPb.collection(collection).subscribe('*', (e: any) => {
          const doc = e.record;
          if (!doc) return;
          const action = e.action === 'delete' ? 'delete' : e.action === 'create' ? 'create' : 'update';
          void handleDocEvent(key, collection, doc, action);
        });
        console.log(`[rt] subscribed ${collection}`);
      } catch (err) {
        console.warn(`[rt] subscribe ${collection} gagal:`, (err as Error).message);
      }
    }
    return true;
  } catch (err) {
    console.warn('[rt] PocketBase realtime init failed:', (err as Error).message);
    return false;
  }
}

export function attachRealtimeBridge(server: Server) {
  server.on('upgrade', handleUpgrade);

  void (async () => {
    const usingPb = await startPocketBaseRealtime();
    if (usingPb) {
      console.log('[rt] Realtime bridge aktif via PocketBase SSE, path /api/realtime');
      return;
    }
    // Fallback: Appwrite delta-poller
    pollTimer = setInterval(() => {
      void pollOnce();
    }, POLL_MS);
    pollTimer.unref?.();
    console.log(`[rt] Realtime bridge aktif — poll tiap ${POLL_MS / 1000}s, path /api/realtime`);
  })();

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
}
