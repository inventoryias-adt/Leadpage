import type { SVGProps } from 'react';

/** "G" do Google, nas quatro cores da marca. Usado só para indicar "avaliação no Google". */
export function GoogleG({ size = 20, className, ...rest }: { size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className={`shrink-0 ${className ?? ''}`} {...rest}>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5Z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5Z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1Z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48Z" />
    </svg>
  );
}

/** Ícone do Instagram (câmera num quadrado arredondado) com o degradê da marca. */
export function InstagramGlyph({ size = 20, className, ...rest }: { size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  const id = 'fz-ig-grad'; // mesmo degradê em todas as cópias, então repetir o id não atrapalha
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={`shrink-0 ${className ?? ''}`} {...rest}>
      <defs>
        <linearGradient id={id} x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FEDA75" />
          <stop offset=".35" stopColor="#FA7E1E" />
          <stop offset=".65" stopColor="#D62976" />
          <stop offset="1" stopColor="#4F5BD5" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="18" height="18" rx="5.2" stroke={`url(#${id})`} strokeWidth="2" />
      <circle cx="12" cy="12" r="4.1" stroke={`url(#${id})`} strokeWidth="2" />
      <circle cx="17.2" cy="6.8" r="1.2" fill={`url(#${id})`} />
    </svg>
  );
}

/** Tipo de uma ação, pelo texto que o dono cadastrou. */
export function actionKind(label: string): 'google' | 'instagram' | 'other' {
  const t = label.toLowerCase();
  if (/google|avalia/.test(t)) return 'google';
  if (/instagram|story|stories|foto|post|marc/.test(t)) return 'instagram';
  return 'other';
}

/** O texto da ação como o cliente lê: "Avaliação 5 estrelas no Google" vira "Avaliação no Google" (não dá para conferir a nota). */
export function actionTitle(label: string): string {
  return label.replace(/\s*\b5\s*estrelas?\b\s*/i, ' ').replace(/\s{2,}/g, ' ').trim();
}
