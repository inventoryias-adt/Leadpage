import Link from 'next/link';

/**
 * Símbolo do Fidelize: um "F" geométrico seguido de um ponto final liso, o "ponto" do clube de pontos.
 * Fundo lima, F e ponto no mesmo azul-marinho. Mantenha igual a public/logo.svg, src/app/icon.svg e src/app/opengraph-image.tsx.
 */
export function LogoMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className={`shrink-0 ${className}`}>
      <rect width="64" height="64" rx="16" fill="#C6F432" />
      <g transform="translate(-1 0)">
        <rect x="18" y="12" width="10" height="40" rx="5" fill="#0B1B3A" />
        <rect x="18" y="12" width="30" height="10" rx="5" fill="#0B1B3A" />
        <rect x="18" y="27" width="21" height="10" rx="5" fill="#0B1B3A" />
        <circle cx="43.5" cy="47" r="5.4" fill="#0B1B3A" />
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

/** O ponto final sozinho (mesmo desenho do símbolo), para enfeitar a página e a abertura do app. */
export function Coin({ size = 64, className = '', color = '#0B1B3A' }: { size?: number; className?: string; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="-6 -6 12 12" aria-hidden className={`shrink-0 ${className}`}>
      <circle r="5.4" fill={color} />
    </svg>
  );
}
