import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { config } from '../config';
import { db } from '../database';
import { UserProfileDto, LecturerDto } from '../database/types';
import { userDirectory, UserIdentity } from './userDirectory';

export interface AuthUser {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: 'student' | 'lecturer' | 'kaprodi' | 'akademik' | 'admin';
  isAdmin: boolean;
  profile?: UserProfileDto | null;
  lecturer?: LecturerDto | null;
}

export class AuthService {
  /** PocketBase client bila DB_ADAPTER=pocketbase. */
  private pb(): any {
    return (db as any).client;
  }

  /**
   * Universal Login: Verifies credentials against provider, loads user role & profile,
   * and issues a signed JWT token.
   */
  async login(email: string, pass: string): Promise<{ token: string; user: AuthUser }> {
    const cleanEmail = email.trim().toLowerCase();

    if (config.dbAdapter === 'pocketbase') {
      return this.loginPocketBase(cleanEmail, pass);
    }

    // 1. Verify credentials via Appwrite REST session endpoint
    const url = `${config.appwrite.endpoint}/account/sessions/email`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': config.appwrite.projectId,
      },
      body: JSON.stringify({
        email: cleanEmail,
        password: pass,
      }),
    });

    if (!res.ok) {
      const errData: any = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Email atau kata sandi tidak valid.');
    }

    const sessionData: any = await res.json();
    const appwriteUserId = sessionData.userId;

    // 2. Fetch role and user details
    const user = await this.resolveUserData(appwriteUserId, cleanEmail);

    // 3. Sign universal JWT token
    const token = jwt.sign(
      {
        id: user.id,
        userId: user.userId,
        email: user.email,
        name: user.name,
        role: user.role,
        isAdmin: user.isAdmin,
      },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    return { token, user };
  }

  /** Login email+password langsung ke PocketBase auth collection `users`. */
  private async loginPocketBase(cleanEmail: string, pass: string): Promise<{ token: string; user: AuthUser }> {
    const pb = this.pb();
    if (!pb?.collection) throw new Error('PocketBase belum terkonfigurasi.');
    let record: any;
    try {
      const res = await pb.collection('users').authWithPassword(cleanEmail, pass);
      record = res.record;
    } catch {
      throw new Error('Email atau kata sandi tidak valid.');
    }
    const user = await this.resolveUserData(record.id, cleanEmail);
    const token = jwt.sign(
      { id: user.id, userId: user.userId, email: user.email, name: user.name, role: user.role, isAdmin: user.isAdmin },
      config.jwtSecret,
      { expiresIn: '7d' }
    );
    return { token, user };
  }

  // ---------- PocketBase OAuth2 (Google) ----------
  // Flow: backend publish authUrl -> user login Google di browser ->
  // PB /api/oauth2-redirect push event via realtime @oauth2 -> backend
  // exchange code -> simpan hasil di pending map -> app polling /status.

  private oauthPending = new Map<string, {
    provider: string;
    codeVerifier: string;
    redirectUrl: string;
    state: string;
    createdAt: number;
    result?: { token: string; user: AuthUser };
    error?: string;
  }>();
  private oauthRealtimeStarted = false;
  private oauthSubscribed = false;
  private oauthResubscribeTimer: NodeJS.Timeout | null = null;

  private oauthEventHandler: ((event: any) => Promise<void>) | null = null;

  private subscribeOAuthTopic(pb: any): Promise<void> {
    const handler = async (event: any) => {
      await this.processOAuth2Event(pb, event);
      // PB menjalankan `defer client.Unsubscribe('@oauth2')` SETELAH event
      // dikirim — resubscribe langsung bisa didahului unsubscribe tsb.
      // Jadi: tandai unsubscribed + resubscribe dengan delay.
      this.oauthSubscribed = false;
      if (this.oauthResubscribeTimer) clearTimeout(this.oauthResubscribeTimer);
      this.oauthResubscribeTimer = setTimeout(() => {
        void this.resubscribeOAuth(pb);
      }, 1000);
    };
    this.oauthEventHandler = handler;
    return pb.realtime.subscribe('@oauth2', handler).then(() => {
      this.oauthSubscribed = true;
    });
  }

  private async resubscribeOAuth(pb: any): Promise<void> {
    if (this.oauthSubscribed) return;
    try {
      await pb.realtime.unsubscribe('@oauth2').catch(() => {});
      await this.subscribeOAuthTopic(pb);
      console.log('[auth] @oauth2 subscription dipulihkan');
    } catch (e) {
      console.warn('[auth] Gagal resubscribe @oauth2:', (e as Error).message);
      // Coba lagi dalam 2 detik
      this.oauthResubscribeTimer = setTimeout(() => void this.resubscribeOAuth(pb), 2000);
    }
  }

  private async ensureOAuthRealtime(pb: any): Promise<void> {
    if (this.oauthRealtimeStarted && this.oauthSubscribed) return;
    this.oauthRealtimeStarted = true;
    try {
      await this.subscribeOAuthTopic(pb);
      console.log('[auth] PocketBase OAuth realtime listener aktif');
    } catch (e) {
      this.oauthRealtimeStarted = false;
      this.oauthSubscribed = false;
      console.warn('[auth] OAuth realtime subscribe gagal:', (e as Error).message);
    }
  }

  private async processOAuth2Event(pb: any, event: any): Promise<void> {
    const state = event?.state;
    console.log(`[auth] @oauth2 event: state=${state} code=${event?.code ? 'yes' : 'no'} error=${event?.error || '-'}`);
    if (!state) return;
    // PB oauth2-redirect memakai `state` sebagai realtime clientId:
    // ClientById(state) harus menemukan koneksi SSE yang subscribe @oauth2.
    // Jadi state = pb.realtime.clientId (bukan state dari auth-methods).
    for (const p of this.oauthPending.values()) {
      if (p.state !== state) continue;
      if (event.error || !event.code) {
        p.error = event.error || 'OAuth2 code missing';
        continue;
      }
      await this.completeOAuthExchange(p, event.code);
    }
  }

  /** Exchange OAuth code → PB auth record → resolve user → simpan JWT di pending. */
  private async completeOAuthExchange(p: {
    provider: string;
    codeVerifier: string;
    redirectUrl: string;
    result?: { token: string; user: AuthUser };
    error?: string;
  }, code: string): Promise<void> {
    const pb = this.pb();
    try {
      const res = await pb.collection('users').authWithOAuth2Code(
        p.provider, code, p.codeVerifier, p.redirectUrl
      );
      const record = res.record;
      console.log(`[auth] OAuth exchange OK: ${record?.email}`);
      const identity: UserIdentity = {
        providerUserId: record.id,
        email: (record.email || '').toLowerCase(),
        name: record.name || undefined,
        avatarUrl: record.avatar || undefined,
        source: 'pocketbase',
      };
      if (identity.email) {
        await userDirectory.syncProfile(identity);
        const user = await this.resolveUserData(record.id, identity.email);
        p.result = {
          token: jwt.sign(
            { id: user.id, userId: user.userId, email: user.email, name: user.name, role: user.role, isAdmin: user.isAdmin },
            config.jwtSecret,
            { expiresIn: '30d' }
          ),
          user,
        };
      } else {
        p.error = 'Email tidak ditemukan dari provider.';
      }
    } catch (e: any) {
      console.warn('[auth] OAuth exchange failed:', e?.message || e, JSON.stringify(e?.response || '').slice(0, 300));
      p.error = e?.message || 'Gagal menyelesaikan OAuth.';
    }
  }

  /** Mulai flow OAuth — return URL untuk dibuka user + key untuk polling status. */
  async startOAuth(provider = 'google'): Promise<{ url: string; key: string }> {
    if (config.dbAdapter !== 'pocketbase') {
      throw new Error('OAuth PocketBase hanya aktif dengan DB_ADAPTER=pocketbase');
    }
    const pb = this.pb();
    if (!pb?.collection) throw new Error('PocketBase belum terkonfigurasi.');

    // Force reconnect SSE supaya clientId SELALU fresh dan subscription
    // @oauth2 dijamin ada di koneksi yang hidup — PB oauth2-redirect
    // mencari client via ClientById(state) dan gagal ("Auth failed") bila
    // koneksi lama sudah putus/di-resume dengan ID baru.
    try {
      await pb.realtime.disconnect();
    } catch {}
    this.oauthSubscribed = false;
    this.oauthRealtimeStarted = false;
    await this.ensureOAuthRealtime(pb);
    if (!this.oauthSubscribed) {
      throw new Error('Realtime PocketBase belum siap. Coba lagi.');
    }

    const methods: any = await pb.collection('users').listAuthMethods();
    const prov = methods?.oauth2?.providers?.find((p: any) => p.name === provider);
    if (!prov?.authURL || !prov?.codeVerifier) {
      throw new Error(`Provider OAuth '${provider}' tidak tersedia.`);
    }

    const redirectUrl = pb.buildURL('/api/oauth2-redirect');
    const key = randomBytes(16).toString('hex');

    // PB oauth2-redirect: `state` diquery Google dipakai sebagai realtime
    // clientId (ClientById(state)) untuk mengirim event @oauth2 ke koneksi
    // SSE kita. Karena itu state WAJIB = pb.realtime.clientId.
    const pbState = pb.realtime.clientId;
    if (!pbState) throw new Error('Realtime PocketBase belum siap. Coba lagi.');
    let url = `${prov.authURL}${redirectUrl}`;
    if (/[?&]state=/.test(url)) {
      url = url.replace(/([?&]state=)[^&]*/, `$1${pbState}`);
    } else {
      url += `${url.includes('?') ? '&' : '?'}state=${pbState}`;
    }
    // Paksa Google menampilkan account chooser + consent screen
    // (default Google skip kalau browser sudah punya sesi Google).
    url += '&prompt=select_account%20consent';

    console.log(`[auth] OAuth start provider=${provider} key=${key} state=${pbState}`);
    this.oauthPending.set(key, {
      provider,
      codeVerifier: prov.codeVerifier,
      redirectUrl,
      state: pbState,
      createdAt: Date.now(),
    });

    // Auto-cleanup pending lama
    for (const [k, p] of this.oauthPending) {
      if (Date.now() - p.createdAt > 10 * 60 * 1000) this.oauthPending.delete(k);
    }

    return { url, key };
  }

  /** Polling status OAuth — return {status:'pending'|'done'|'error', ...}. */
  pollOAuth(key: string): { status: string; token?: string; user?: AuthUser; error?: string } {
    const p = this.oauthPending.get(key);
    if (!p) return { status: 'expired', error: 'Sesi OAuth tidak ditemukan atau kedaluwarsa.' };
    if (p.error) {
      this.oauthPending.delete(key);
      return { status: 'error', error: p.error };
    }
    if (p.result) {
      this.oauthPending.delete(key);
      return { status: 'done', token: p.result.token, user: p.result.user };
    }
    if (Date.now() - p.createdAt > 5 * 60 * 1000) {
      this.oauthPending.delete(key);
      return { status: 'expired', error: 'Waktu login habis. Coba lagi.' };
    }
    return { status: 'pending' };
  }

  /**
   * Callback Google → backend (flow redirect_uri backend, nonaktif saat ini
   * karena Google Console belum mendaftarkan URI tsb). Lookup pending by
   * state(=key), exchange code via PocketBase, return key utk redirect app.
   */
  async handleOAuthCallback(query: { code?: string; state?: string; error?: string }): Promise<string> {
    const key = typeof query?.state === 'string' ? query.state : '';
    const p = key ? this.oauthPending.get(key) : undefined;
    if (!p) {
      console.warn(`[auth] OAuth callback dengan state tidak dikenal: ${key || '-'}`);
      return key;
    }
    if (query.error || !query.code) {
      p.error = query.error || 'Authorization code tidak ditemukan.';
      return key;
    }
    await this.completeOAuthExchange(p, query.code);
    return key;
  }

  /**
   * Exchange Google OAuth token (userId & secret from Appwrite OAuth redirect)
   * for a universal JWT token and verified user profile.
   */
  async exchangeOAuthSession(userId: string, secret: string): Promise<{ token: string; user: AuthUser }> {
    // 1. Verify and exchange session with Appwrite — must succeed
    const sessionUrl = `${config.appwrite.endpoint}/account/sessions/token`;
    const sessionRes = await fetch(sessionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': config.appwrite.projectId,
      },
      body: JSON.stringify({ userId, secret }),
    });

    if (!sessionRes.ok) {
      const errData: any = await sessionRes.json().catch(() => ({}));
      const err = new Error(errData.message || 'Sesi OAuth tidak valid atau sudah kedaluwarsa.');
      (err as any).statusCode = 401;
      throw err;
    }

    // 2. Fetch user information using server Appwrite API Key (Admin)
    let email = '';
    let name = '';

    try {
      const userUrl = `${config.appwrite.endpoint}/users/${userId}`;
      const userRes = await fetch(userUrl, {
        headers: {
          'X-Appwrite-Project': config.appwrite.projectId,
          'X-Appwrite-Key': config.appwrite.apiKey,
        },
      });

      if (userRes.ok) {
        const u = await userRes.json();
        email = u.email || '';
        name = u.name || '';
      }
    } catch (e) {
      console.warn('Appwrite user lookup failed:', e);
    }

    // 3. Fallback to existing user profile in database if Appwrite lookup failed.
    //    NEVER fabricate an email — an invalid identity must not get a JWT.
    if (!email) {
      const existingProfile = await db.getUserProfileByUserId(userId);
      if (existingProfile?.email) {
        email = existingProfile.email;
        name = existingProfile.name || name;
      }
    }

    if (!email) {
      const err = new Error('Data pengguna tidak ditemukan. Silakan hubungi administrator.');
      (err as any).statusCode = 401;
      throw err;
    }

    // 4. Resolve user data (profile, lecturer record, role, isAdmin)
    const user = await this.resolveUserData(userId, email);
    if (name && (!user.name || user.name === email.split('@')[0])) {
      user.name = name;
    }

    // 5. Sign universal JWT token
    const token = jwt.sign(
      {
        id: user.id,
        userId: user.userId,
        email: user.email,
        name: user.name,
        role: user.role,
        isAdmin: user.isAdmin,
      },
      config.jwtSecret,
      { expiresIn: '30d' }
    );

    return { token, user };
  }

  /**
   * Resolve user profile, lecturer record, and role
   */
  async resolveUserData(userId: string, email: string): Promise<AuthUser> {
    const cleanEmail = email.toLowerCase().trim();
    const isAdmin = cleanEmail === 'ws.basithachmed@gmail.com';

    let profile: UserProfileDto | null = null;
    let lecturer: LecturerDto | null = null;

    try {
      // User directory abstraction: PocketBase sekarang, external API nanti.
      const identity: UserIdentity = {
        providerUserId: userId,
        email: cleanEmail,
        source: config.dbAdapter === 'pocketbase' ? 'pocketbase' : 'appwrite',
      };
      profile = await userDirectory.findProfile(identity);
      if (!profile) {
        profile = await db.getUserProfileByUserId(userId);
      }
      if (!profile) {
        profile = await db.getUserProfileByEmail(cleanEmail);
      }
    } catch (e) {
      console.warn('Profile lookup failed:', e);
    }

    try {
      lecturer = await db.getLecturerByEmail(cleanEmail);
    } catch (e) {
      console.warn('Lecturer lookup failed:', e);
    }

    // Role resolution logic (consistent with spsm.js & authService.ts)
    let role: AuthUser['role'] = 'student';
    if (isAdmin) {
      role = 'admin';
    } else if (lecturer) {
      const lecName = (lecturer.name || '').toLowerCase();
      const lecRole = (lecturer.role || '').toLowerCase();
      if (
        lecRole === 'kaprodi' ||
        lecRole === 'admin' ||
        lecRole === 'akademik' ||
        lecName.includes('kaprodi') ||
        (profile && profile.role === 'kaprodi')
      ) {
        role = lecRole === 'admin' ? 'admin' : lecRole === 'akademik' ? 'akademik' : 'kaprodi';
      } else {
        role = 'lecturer';
      }
    } else if (profile?.role === 'akademik') {
      role = 'akademik';
    } else if (profile?.role === 'kaprodi') {
      role = 'kaprodi';
    } else if (profile?.role === 'admin') {
      role = 'admin';
    }

    return {
      id: profile?.id || userId,
      userId: userId,
      email: cleanEmail,
      name: profile?.name || lecturer?.name || cleanEmail.split('@')[0],
      role,
      isAdmin: isAdmin || role === 'admin',
      profile,
      lecturer,
    };
  }

  /**
   * Verify JWT Token and return decoded payload
   */
  verifyToken(token: string): any {
    return jwt.verify(token, config.jwtSecret);
  }
}

export const authService = new AuthService();
