import Link from 'next/link';
import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId,
} from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---------- Nut ----------
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-600/50',
  secondary: 'bg-surface text-ink border border-line hover:bg-brand-50 disabled:opacity-50',
  ghost: 'text-brand-700 hover:bg-brand-50 disabled:opacity-50',
  danger: 'bg-danger-600 text-white hover:opacity-90 disabled:opacity-50',
};
const base =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition duration-200 active:scale-[0.98] disabled:cursor-not-allowed';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}
export function Button({ variant = 'primary', loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button className={cx(base, VARIANTS[variant], className)} disabled={disabled || loading} {...rest}>
      {loading && <Spinner small />}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = 'primary',
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cx(base, VARIANTS[variant], className)}>
      {children}
    </Link>
  );
}

// ---------- Form ----------
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string | null;
  hint?: string;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}) {
  const id = useId();
  const noteId = error || hint ? `${id}-note` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children(id, noteId)}
      {error ? (
        <p id={noteId} className="text-sm text-danger-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={noteId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const control =
  'w-full min-h-11 rounded-2xl border border-line bg-surface px-3.5 py-2 text-base text-ink placeholder:text-muted/70 focus:border-brand-500 disabled:opacity-60';

export function TextField({
  label,
  error,
  hint,
  ...rest
}: { label: string; error?: string | null; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(id, d) => <input id={id} aria-describedby={d} aria-invalid={!!error} className={control} {...rest} />}
    </Field>
  );
}

export function TextArea({
  label,
  error,
  hint,
  ...rest
}: { label: string; error?: string | null; hint?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(id, d) => <textarea id={id} aria-describedby={d} aria-invalid={!!error} rows={4} className={control} {...rest} />}
    </Field>
  );
}

export function SelectField({
  label,
  error,
  hint,
  children,
  ...rest
}: { label: string; error?: string | null; hint?: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(id, d) => (
        <select id={id} aria-describedby={d} className={control} {...rest}>
          {children}
        </select>
      )}
    </Field>
  );
}

// ---------- Hien thi ----------
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-3xl border border-line/70 bg-surface p-5 shadow-soft sm:p-7', className)}>{children}</div>;
}

type Tone = 'neutral' | 'brand' | 'warm' | 'danger' | 'ok';
const TONES: Record<Tone, string> = {
  neutral: 'bg-line/60 text-ink',
  brand: 'bg-brand-100 text-brand-700',
  warm: 'bg-warm-100 text-warm-600',
  danger: 'bg-danger-50 text-danger-600',
  ok: 'bg-ok-50 text-ok-600',
};
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', TONES[tone])}>{children}</span>;
}

export function Alert({ tone = 'danger', children }: { tone?: 'danger' | 'ok' | 'warm' | 'brand'; children: ReactNode }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cx('rounded-2xl px-4 py-3 text-sm', TONES[tone])}>
      {children}
    </div>
  );
}

export function Spinner({ small }: { small?: boolean }) {
  return (
    <span
      role="status"
      aria-label="Đang tải"
      className={cx('inline-block animate-spin rounded-full border-2 border-current border-t-transparent', small ? 'size-4' : 'size-6')}
    />
  );
}

export function Loading() {
  return (
    <div className="flex justify-center py-12 text-brand-600">
      <Spinner />
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-3xl border border-dashed border-brand-500/40 bg-brand-50/50 px-4 py-10 text-center text-muted">{children}</div>;
}

export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl sm:text-3xl">{title}</h1>
      {children}
    </div>
  );
}

export function QueryState({ loading, error }: { loading: boolean; error: string | null }) {
  if (loading) return <Loading />;
  if (error) return <Alert>{error}</Alert>;
  return null;
}
