import { AlertCircle, GraduationCap, Loader2, Lock, Mail } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/auth';
import { authService } from '@/services/authService';
import { Button, Field, Input } from '@/components/ui';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.02.15 3.5 2.7.24.02c2.2-2 3.5-5 3.5-8.6z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-.14.01-3.6 2.8-.05.13C3.4 21.3 7.4 24 12 24z" />
      <path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.01-.16-3.7-2.9-.12.06C.5 8.3 0 10.1 0 12s.5 3.7 1.4 5.4l3.8-3z" />
      <path fill="#EA4335" d="M12 4.6c2.2 0 3.7 1 4.6 1.8l3.3-3.2C18 1.2 15.2 0 12 0 7.4 0 3.4 2.7 1.4 6.6l3.8 3c1-2.9 3.7-5 6.8-5z" />
    </svg>
  );
}

export function LoginView() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const afterLogin = async () => {
    await refresh();
    navigate('/dashboard', { replace: true });
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Mohon isi email dan kata sandi.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await authService.loginWithEmail(email, password);
      await afterLogin();
    } catch (err: any) {
      setError(err.message || 'Gagal masuk. Periksa kembali kredensial.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      await authService.loginWithGoogle();
      await afterLogin();
    } catch (err: any) {
      setError(err?.message || 'Login Google gagal.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 p-4">
      {/* decorative gradient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-brand-700/20 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-brand-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-800 shadow-2xl shadow-brand-900/50">
            <GraduationCap size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">SPSM Portal</h1>
          <p className="mt-1 text-[13px] text-ink-400">
            Sarana Pengajuan Skripsi Mahasiswa & Manajemen Bimbingan Akademik
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl">
          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] font-medium text-red-300">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            variant="outline"
            className="w-full border-white/15 bg-white/5 py-2.5 text-white hover:bg-white/10"
            onClick={handleGoogle}
            loading={googleLoading}
          >
            {!googleLoading && <GoogleIcon />}
            Masuk dengan Google
          </Button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">atau</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={handleEmail} className="space-y-4">
            <Field label="Email">
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@kampus.ac.id"
                  className="pl-10"
                  autoComplete="email"
                />
              </div>
            </Field>
            <Field label="Kata Sandi">
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10"
                  autoComplete="current-password"
                />
              </div>
            </Field>
            <Button type="submit" className="w-full py-2.5" loading={loading}>
              {loading ? <Loader2 size={15} className="animate-spin" /> : null}
              Masuk ke Portal
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-ink-500">
          Akses dibatasi untuk Dosen, Kaprodi, Bagian Akademik, Reviewer & Administrator.
          <br />
          Mahasiswa menggunakan aplikasi mobile SPSM.
        </p>
      </div>
    </div>
  );
}
