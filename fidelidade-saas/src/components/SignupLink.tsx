'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { focusSignup } from './SignupCta';

/** Leva ao cadastro (que fica na página inicial). Na própria inicial, foca o primeiro campo e faz o cartão piscar. */
export function SignupLink({ className, children }: { className?: string; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <Link
      href="/#assinar"
      className={className}
      onClick={(e) => {
        if (pathname === '/') {
          e.preventDefault();
          focusSignup();
        }
      }}
    >
      {children}
    </Link>
  );
}

/** Quem chega de outra página por "/#assinar" cai no cadastro já com o primeiro campo em foco. */
export function HashFocus() {
  useEffect(() => {
    if (window.location.hash === '#assinar') {
      const t = window.setTimeout(focusSignup, 300);
      return () => window.clearTimeout(t);
    }
  }, []);
  return null;
}
