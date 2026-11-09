import React, { useState } from 'react';
import { authService } from '../services/authService';
import {
  GraduationCap,
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Building2,
} from 'lucide-react';

interface Props {
  onLoginSuccess: () => void;
}

export const LoginView: React.FC<Props> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('ws.basithachmed@gmail.com');
  const [password, setPassword] = useState('@Maulidia05');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Mohon isi alamat email dan kata sandi.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      await authService.loginWithEmail(email, password);
      onLoginSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal masuk. Periksa kembali kredensial Anda.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setGoogleLoading(true);
    setErrorMsg(null);
    try {
      authService.loginWithGoogle();
    } catch (err: any) {
      setErrorMsg('Gagal menginisiasi login Google: ' + err.message);
      setGoogleLoading(false);
    }
  };

  return (
    <div className="login-page-wrap">
      <div className="login-box-card">
        {/* Academic Portal Crest */}
        <div className="login-crest-header">
          <div className="login-crest-icon">
            <GraduationCap size={36} color="#FFFFFF" />
          </div>
          <h1 className="login-portal-title">SPSM PORTAL</h1>
          <p className="login-portal-subtitle">
            Sarana Pengajuan Skripsi Mahasiswa & Manajemen Bimbingan Akademik
          </p>
        </div>

        {errorMsg && (
          <div className="login-alert-error">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Section 1: Google OAuth for Lecturers (Dosen) */}
        <div className="login-section-block">
          <div className="section-label-chip">
            <ShieldCheck size={14} color="#0A4C8F" />
            <span>Akses Dosen & Tenaga Pendidik</span>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="btn-google-login"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>
              {googleLoading
                ? 'Menghubungkan ke Google...'
                : 'Masuk / Registrasi Dosen via Google'}
            </span>
          </button>
        </div>

        <div className="login-divider">
          <span>atau masuk via Administrator</span>
        </div>

        {/* Section 2: Email & Password (Admin & Staff) */}
        <form onSubmit={handleEmailLogin} className="login-email-form">
          <div className="form-group-login">
            <label className="input-label-login">
              <Mail size={14} />
              <span>Email Administrator / Pengguna</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ws.basithachmed@gmail.com"
              className="login-input"
              required
            />
          </div>

          <div className="form-group-login">
            <label className="input-label-login">
              <Lock size={14} />
              <span>Kata Sandi</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="login-input"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-admin-submit"
          >
            {loading ? (
              <span>Memverifikasi Akun...</span>
            ) : (
              <>
                <span>Masuk Portal Administrator</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="login-footer-info">
          <ShieldCheck size={14} color="#059669" />
          <span>Sistem Informasi Akademik Resmi & Terenkripsi</span>
        </div>
      </div>
    </div>
  );
};
