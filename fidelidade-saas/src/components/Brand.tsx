import Link from 'next/link';

/** Símbolo do Fidelize: um "F" com uma faísca dourada (a recompensa). */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0 drop-shadow-[0_6px_10px_rgba(26,67,199,0.35)]">
      <defs>
        <linearGradient id="fz-g" x1="6" y1="2" x2="58" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4F8FFF" />
          <stop offset="1" stopColor="#1A43C7" />
        </linearGradient>
        <linearGradient id="fz-s" x1="34" y1="39" x2="48" y2="53" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFE48F" />
          <stop offset="1" stopColor="#FFB22E" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#fz-g)" />
      <path d="M8 22C8 12 14 6 24 5c7-.6 14-.3 20 .6C34 7 18 9 8 22Z" fill="#fff" opacity=".16" />
      <path
        fill="#fff"
        d="M21 17a3 3 0 0 1 3-3h20a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H29v6h12a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H29v9a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3Z"
      />
      <path fill="url(#fz-s)" d="M41 39l2.1 5.4L48.5 46.5 43.1 48.6 41 54l-2.1-5.4L33.5 46.5l5.4-2.1Z" />
    </svg>
  );
}

/** Marca completa: símbolo + nome. */
export function Brand({ href = '/', size = 36 }: { href?: string; size?: number }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label="Fidelize — início">
      <LogoMark size={size} />
      <span className="text-[1.15rem] font-extrabold leading-none tracking-tight text-primary">Fidelize</span>
    </Link>
  );
}
