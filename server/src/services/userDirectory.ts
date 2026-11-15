import { db } from '../database';
import { UserProfileDto } from '../database/types';
import { config } from '../config';

/**
 * User Directory abstraction.
 *
 * Backend tidak boleh bergantung langsung pada satu sumber data user.
 * Sekarang: PocketBase auth collection `users` (Google OAuth).
 * Nanti: API database server lain via ExternalApiDirectory — tinggal
 * tambahkan provider baru dan atur USER_SOURCE_ORDER.
 */

export interface UserIdentity {
  /** ID user dari provider auth (PB record id, external user id, dll). */
  providerUserId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  /** 'pocketbase' | 'external' | dll */
  source: string;
}

export interface UserDirectoryProvider {
  readonly name: string;
  /** Cari profil lokal untuk identitas yang sudah terauntentikasi. */
  findProfile(identity: UserIdentity): Promise<UserProfileDto | null>;
  /** Buat/update profil lokal (JIT provisioning) untuk identitas tersebut. */
  syncProfile(identity: UserIdentity): Promise<UserProfileDto>;
}

/** Provider PocketBase — profil disimpan di auth collection `users`. */
class PocketBaseDirectory implements UserDirectoryProvider {
  readonly name = 'pocketbase';

  async findProfile(identity: UserIdentity): Promise<UserProfileDto | null> {
    try {
      let profile = await db.getUserProfileByUserId(identity.providerUserId);
      if (!profile) profile = await db.getUserProfileByEmail(identity.email);
      return profile;
    } catch {
      return null;
    }
  }

  async syncProfile(identity: UserIdentity): Promise<UserProfileDto> {
    const existing = await this.findProfile(identity);
    if (existing) {
      const patch: Partial<UserProfileDto> = {};
      // Pastikan user_id terisi dengan id record auth PB agar lookup by userId bekerja
      if (!existing.userId && identity.providerUserId) patch.userId = identity.providerUserId;
      if (identity.name && existing.name !== identity.name) patch.name = identity.name;
      if (identity.avatarUrl && existing.avatarUrl !== identity.avatarUrl) patch.avatarUrl = identity.avatarUrl;
      if (Object.keys(patch).length > 0) {
        return db.updateUserProfile(existing.id, patch);
      }
      return existing;
    }
    return db.createUserProfile({
      userId: identity.providerUserId,
      name: identity.name || identity.email.split('@')[0],
      nim: '',
      email: identity.email,
      role: 'student',
      avatarUrl: identity.avatarUrl || undefined,
    });
  }
}

/**
 * Provider API eksternal (database server lain) — SIAP PAKAI,
 * aktif setelah EXTERNAL_USER_API_URL + EXTERNAL_USER_API_KEY diisi.
 * Endpoint yang diharapkan:
 *   GET  {base}/users?email=...   -> { id, email, name, nim, department, role, ... }
 *   POST {base}/users/sync        -> upsert, return user object
 */
class ExternalApiDirectory implements UserDirectoryProvider {
  readonly name = 'external';
  private baseUrl = (process.env.EXTERNAL_USER_API_URL || '').replace(/\/$/, '');
  private apiKey = process.env.EXTERNAL_USER_API_KEY || '';

  get enabled(): boolean {
    return Boolean(this.baseUrl && this.apiKey);
  }

  private headers() {
    return { 'Content-Type': 'application/json', 'X-API-Key': this.apiKey };
  }

  async findProfile(identity: UserIdentity): Promise<UserProfileDto | null> {
    if (!this.enabled) return null;
    try {
      const res = await fetch(`${this.baseUrl}/users?email=${encodeURIComponent(identity.email)}`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const data: any = await res.json();
      const u = data?.user || data?.data || data;
      if (!u?.email) return null;
      // Map ke profil lokal PB (upsert by email)
      return this.syncProfile({ ...identity, ...this.mapExternal(u) });
    } catch (e) {
      console.warn('[userdir] external lookup failed:', (e as Error).message);
      return null;
    }
  }

  async syncProfile(identity: UserIdentity): Promise<UserProfileDto> {
    // External provider tidak menyimpan profil sendiri — delegasikan ke PB.
    return new PocketBaseDirectory().syncProfile(identity);
  }

  private mapExternal(u: any): Partial<UserIdentity> {
    return {
      name: u.name || u.full_name || u.fullName,
      avatarUrl: u.avatar_url || u.avatarUrl || u.photo,
    };
  }
}

/**
 * Composite: coba provider berurutan sesuai USER_SOURCE_ORDER
 * (default "pocketbase"; contoh "external,pocketbase" untuk prioritas API luar).
 */
class CompositeUserDirectory implements UserDirectoryProvider {
  readonly name = 'composite';
  private providers: UserDirectoryProvider[];

  constructor() {
    const pbDir = new PocketBaseDirectory();
    const extDir = new ExternalApiDirectory();
    const all: Record<string, UserDirectoryProvider> = {
      pocketbase: pbDir,
      external: extDir,
    };
    const order = (process.env.USER_SOURCE_ORDER || 'pocketbase')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    this.providers = order.map((n) => all[n]).filter(Boolean);
    if (this.providers.length === 0) this.providers = [pbDir];
    // External selalu fallback terakhir bila tidak termasuk order
    if (extDir.enabled && !this.providers.includes(extDir)) this.providers.push(extDir);
  }

  async findProfile(identity: UserIdentity): Promise<UserProfileDto | null> {
    for (const p of this.providers) {
      try {
        const r = await p.findProfile(identity);
        if (r) return r;
      } catch (e) {
        console.warn(`[userdir] ${p.name} findProfile error:`, (e as Error).message);
      }
    }
    return null;
  }

  async syncProfile(identity: UserIdentity): Promise<UserProfileDto> {
    for (const p of this.providers) {
      try {
        const r = await p.syncProfile(identity);
        if (r) return r;
      } catch (e) {
        console.warn(`[userdir] ${p.name} syncProfile error:`, (e as Error).message);
      }
    }
    // Last resort: PB langsung
    return new PocketBaseDirectory().syncProfile(identity);
  }
}

export const userDirectory = new CompositeUserDirectory();
