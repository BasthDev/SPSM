import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db } from '../database';
import { UserProfileDto, LecturerDto } from '../database/types';

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
  /**
   * Universal Login: Verifies credentials against provider, loads user role & profile,
   * and issues a signed JWT token.
   */
  async login(email: string, pass: string): Promise<{ token: string; user: AuthUser }> {
    const cleanEmail = email.trim().toLowerCase();

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
      profile = await db.getUserProfileByUserId(userId);
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
      isAdmin,
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
