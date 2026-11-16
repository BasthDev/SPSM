import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

/* ---------- Button ---------- */
type BtnVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
}
const btnVariants: Record<BtnVariant, string> = {
  primary: 'bg-brand-900 text-white hover:bg-brand-800 shadow-sm',
  secondary: 'bg-ink-800 text-white hover:bg-ink-700',
  outline: 'border border-ink-300 bg-white text-ink-700 hover:bg-ink-50 hover:border-ink-400',
  ghost: 'text-ink-600 hover:bg-ink-100',
  danger: 'bg-red-600 text-white hover:bg-red-500',
  success: 'bg-emerald-600 text-white hover:bg-emerald-500',
};
const btnSizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-base' };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', loading, size = 'md', className = '', disabled, children, ...rest }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${btnVariants[variant]} ${btnSizes[size]} ${className}`}
      {...rest}
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  )
);
Button.displayName = 'Button';

/* ---------- Form fields ---------- */
const fieldBase =
  'w-full rounded-lg border border-ink-300 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/15 transition';

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${fieldBase} ${className}`} {...rest} />;
}
export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldBase} min-h-[90px] resize-y ${className}`} {...rest} />;
}
export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${fieldBase} appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2364748b%22 stroke-width=%222.5%22%3E%3Cpath d=%22m6 9 6 6 6-6%22/%3E%3C/svg%3E')] bg-[position:right_12px_center] bg-no-repeat pr-9 ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Field({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-ink-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-400">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-red-500">{error}</span>}
    </label>
  );
}

/* ---------- Card ---------- */
export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-ink-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)] ${className}`}>{children}</div>;
}

export function CardHeader({ title, subtitle, action, icon }: { title: string; subtitle?: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
      <div className="flex items-start gap-3">
        {icon && <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50">{icon}</div>}
        <div>
          <h3 className="text-[15px] font-bold text-ink-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[13px] text-ink-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/* ---------- Badge ---------- */
type Tone = 'blue' | 'green' | 'amber' | 'red' | 'slate' | 'violet' | 'cyan';
const tones: Record<Tone, string> = {
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/25',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  slate: 'bg-ink-100 text-ink-600 ring-ink-500/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20',
};
export function Badge({ tone = 'slate', children, className = '' }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} animate-fade-in rounded-2xl bg-white shadow-2xl`}>
        {title && (
          <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
            <h3 className="text-base font-bold text-ink-900">{title}</h3>
            <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-600">✕</button>
          </div>
        )}
        <div className="max-h-[80vh] overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Lainnya ---------- */
export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 size={22} className={`animate-spin text-brand-600 ${className}`} />;
}

export function EmptyState({ icon, title, desc, action }: { icon?: React.ReactNode; title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      {icon && <div className="mb-1 text-ink-300">{icon}</div>}
      <p className="text-sm font-bold text-ink-700">{title}</p>
      {desc && <p className="max-w-sm text-[13px] text-ink-400">{desc}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Avatar({ name, src, size = 36 }: { name?: string; src?: string | null; size?: number }) {
  const initials = (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  if (src) {
    return <img src={src} alt={name} className="rounded-full object-cover ring-2 ring-white" style={{ width: size, height: size }} />;
  }
  return (
    <div
      className="flex items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-900 font-bold text-white ring-2 ring-white"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}
