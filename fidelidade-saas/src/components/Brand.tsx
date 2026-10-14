import Link from 'next/link';

/**
 * Símbolo do Fidelize: um "F" geométrico seguido de um ponto final que é uma moeda com rostinho, o "ponto" do clube de pontos.
 * Fundo lima, F marinho e moeda azul. Mantenha igual a public/logo.svg, src/app/icon.svg e src/app/opengraph-image.tsx.
 */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0">
      <rect width="64" height="64" rx="16" fill="#C6F432" />
      <g transform="translate(-1 0)">
        <rect x="18" y="12" width="10" height="40" rx="5" fill="#0B1B3A" />
        <rect x="18" y="12" width="30" height="10" rx="5" fill="#0B1B3A" />
        <rect x="18" y="27" width="21" height="10" rx="5" fill="#0B1B3A" />
        <g transform="translate(43.5 47)">
          <circle r="5.4" fill="#2150C9" />
          <path d="M0 -4.6V-2.9M0 2.9V4.6" fill="none" stroke="#C6F432" strokeWidth=".9" strokeLinecap="round" />
          <path d="M2 -1.9C1.8 -3.3 -2 -3.5 -2 -1.4C-2 0.3 2 -0.2 2 1.6C2 3.5 -1.8 3.4 -2 1.9" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}

/** Marca completa: símbolo + nome em minúsculas. `compact` esconde o nome no celular (barras apertadas). */
export function Brand({ href = '/', size = 36, compact = false }: { href?: string; size?: number; compact?: boolean }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-2.5" aria-label="Fidelize — início">
      <LogoMark size={size} />
      <span className={`text-[1.25rem] font-bold leading-none tracking-[-0.04em] text-primary ${compact ? 'max-sm:hidden' : ''}`}>fidelize</span>
    </Link>
  );
}

/** A moeda sozinha (mesmo desenho do símbolo), para enfeitar a página e a abertura do app. */
export function Coin({ size = 64, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="-6 -6 12 12" aria-hidden className={`shrink-0 ${className}`}>
      <circle r="5.4" fill="#2150C9" />
      <path d="M0 -4.6V-2.9M0 2.9V4.6" fill="none" stroke="#C6F432" strokeWidth=".9" strokeLinecap="round" />
      <path d="M2 -1.9C1.8 -3.3 -2 -3.5 -2 -1.4C-2 0.3 2 -0.2 2 1.6C2 3.5 -1.8 3.4 -2 1.9" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}
