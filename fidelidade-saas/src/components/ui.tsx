'use client';

import { useFormStatus } from 'react-dom';
import type { FormState } from '@/lib/form';

export function SubmitButton({
  children,
  pendingText = 'Aguarde…',
  variant = 'primary',
  className = '',
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: 'primary' | 'ghost';
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${variant === 'primary' ? 'glass-button' : 'glass-button-ghost'} ${className}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="glass-error">{state.error}</p>;
  if (state.ok) return <p role="status" className="glass-success">{state.ok}</p>;
  return null;
}

/** Máscaras simples de digitação (o servidor revalida tudo). */
export const maskPhoneInput = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

export const maskCpfInput = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
};
