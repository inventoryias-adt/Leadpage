import type { ReactNode, SVGProps } from 'react';

/** Ícones de traço (24×24) das categorias da vitrine, no mesmo estilo do restante do app. */
const art: Record<string, ReactNode> = {
  todos: <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" />,
  pizza: (
    <>
      <path d="M12 21 4.5 6.5a17 17 0 0 1 15 0L12 21Z" />
      <path d="M5.5 9a14 14 0 0 1 13 0" />
      <circle cx="10.5" cy="11" r="1" />
      <circle cx="13.5" cy="13.5" r="1" />
      <circle cx="12" cy="8.2" r=".6" />
    </>
  ),
  hamburguer: (
    <>
      <path d="M4 11a8 6 0 0 1 16 0H4Z" />
      <path d="M3 14.5h18" />
      <path d="M5 17.5h14a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3Z" />
      <path d="M9 8h.01M12 7h.01M15 8h.01" />
    </>
  ),
  japones: (
    <>
      <path d="M4 12h16a8 7 0 0 1-16 0Z" />
      <path d="M8 3.5 14 11M12 3 17 10" />
    </>
  ),
  churrasco: (
    <>
      <path d="M5 10c0-3.5 4-5.5 8-4.5s7 3.5 6 7.5-5 7-9 6-5-5-5-9Z" />
      <circle cx="12" cy="12.5" r="2.6" />
    </>
  ),
  brasileira: (
    <>
      <path d="M5 3v6a2 2 0 0 0 4 0V3M7 3v18" />
      <path d="M18 21V3c-3 2-3.5 6-3.5 9H18" />
    </>
  ),
  massas: (
    <>
      <path d="M4 13h16a8 6.5 0 0 1-16 0Z" />
      <path d="M6 10c1.5-2 3-2 4.5 0s3 2 4.5 0 2-2 3-1.2" />
      <path d="M9 6.5c1-1.4 2-1.4 3 0s2 1.4 3 0" />
    </>
  ),
  lanches: (
    <>
      <rect x="2.5" y="8.5" width="19" height="7" rx="3.5" />
      <path d="M5 12c1.5-1.6 2.5-1.6 4 0s2.5 1.6 4 0 2.5-1.6 4 0" />
    </>
  ),
  acai: (
    <>
      <path d="M3 12.5h18a9 8 0 0 1-18 0Z" />
      <circle cx="8" cy="9.5" r="2.4" />
      <circle cx="13" cy="8" r="2.8" />
      <circle cx="17.2" cy="10" r="1.9" />
    </>
  ),
  sorvete: (
    <>
      <path d="M8 11.5 12 21l4-9.5" />
      <path d="M7 11.5a5 5 0 1 1 10 0H7Z" />
    </>
  ),
  cafe: (
    <>
      <path d="M5 9.5h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5v-5Z" />
      <path d="M16 10.5h1.8a2.4 2.4 0 0 1 0 4.8H16" />
      <path d="M8.5 3.5v3M12 3v3.5" />
    </>
  ),
  padaria: (
    <>
      <path d="M5 19.5V12a4.5 4.5 0 0 1 2-7.5h10A4.5 4.5 0 0 1 19 12v7.5H5Z" />
      <path d="m9 9.5 2 3M13 9.5l2 3" />
    </>
  ),
  doces: (
    <>
      <path d="M6.5 13.5h11l-1.4 7.5H7.9L6.5 13.5Z" />
      <path d="M5 13.5a4 4 0 0 1 3-6 4 4 0 0 1 8 0 4 4 0 0 1 3 6H5Z" />
      <circle cx="12" cy="3.8" r="1.2" />
    </>
  ),
  saudavel: (
    <>
      <path d="M5 19C5 10.5 10 5 20 4c0 10-4 15-13 15" />
      <path d="M5 19 13 11" />
    </>
  ),
  bar: (
    <>
      <path d="M5 8h10v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8Z" />
      <path d="M15 10h2.5a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5H15" />
      <path d="M5 8a3 3 0 0 1 3-3.5A3 3 0 0 1 13 4a2.7 2.7 0 0 1 2 4" />
    </>
  ),
  barbearia: (
    <>
      <circle cx="6" cy="6.5" r="3" />
      <circle cx="6" cy="17.5" r="3" />
      <path d="M8.4 8.2 20 19M8.4 15.8 20 5" />
    </>
  ),
  outros: (
    <>
      <circle cx="6" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="18" cy="12" r="1.2" />
    </>
  ),
};

export function CategoryIcon({ name, size = 28, ...rest }: { name: string; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {art[name] ?? art.outros}
    </svg>
  );
}
