import Link from 'next/link';
import { useId } from 'react';

/** Degradê leve do azul da marca para o verde. Mantenha igual a public/logo.svg, src/app/icon.svg, src/app/opengraph-image.tsx e scripts/gerar-icones.mjs. */
export const BRAND_BLUE = '#2F63E6';
export const BRAND_GREEN = '#7BE08A';

/** Definição do degradê, em coordenadas do F (18..48 × 12..52). */
export function FGradient({ id }: { id: string }) {
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="19" y1="12" x2="47" y2="52">
      <stop offset="0" stopColor={BRAND_BLUE} />
      <stop offset="1" stopColor={BRAND_GREEN} />
    </linearGradient>
  );
}

/** Desenho do F: haste e duas barras arredondadas (coordenadas 18..48 × 12..52). As barras aceitam classe para a abertura animada. */
export function FGlyph({ fill, topClass, midClass }: { fill: string; topClass?: string; midClass?: string }) {
  return (
    <>
      <rect x="18" y="12" width="10" height="40" rx="5" fill={fill} />
      <rect className={topClass} x="18" y="12" width="30" height="10" rx="5" fill={fill} />
      <rect className={midClass} x="18" y="27" width="21" height="10" rx="5" fill={fill} />
    </>
  );
}

/**
 * Símbolo do Fidelize: só o "F", com degradê leve do azul para o verde. `size` é a altura do F.
 * Com `mono` o F sai numa cor só (ex.: branco sobre o cartão azul).
 */
export function LogoMark({ size = 36, className = '', mono }: { size?: number; className?: string; mono?: string }) {
  const gid = `fz${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg width={(size * 32) / 42} height={size} viewBox="17 11 32 42" aria-hidden className={`shrink-0 ${className}`}>
      {!mono && (
        <defs>
          <FGradient id={gid} />
        </defs>
      )}
      <FGlyph fill={mono ?? `url(#${gid})`} />
    </svg>
  );
}

/**
 * Marca completa: o F com degradê é a primeira letra do nome ("F" + "idelize").
 * `size` é o tamanho da letra do nome; `compact` mostra só o F, um pouco maior, no celular (barras apertadas).
 */
export function Brand({ href = '/', size = 28, compact = false }: { href?: string; size?: number; compact?: boolean }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-baseline" aria-label="Fidelize — início">
      <LogoMark size={Math.round(size * 0.74)} className={`mr-[-0.01em] ${compact ? 'max-sm:!h-[1.9rem] max-sm:!w-auto' : ''}`} />
      <span aria-hidden className={`font-extrabold leading-none tracking-[-0.045em] text-primary ${compact ? 'max-sm:hidden' : ''}`} style={{ fontSize: size }}>idelize</span>
    </Link>
  );
}

/** O ponto final sozinho, para enfeitar a página (landing). */
export function Coin({ size = 64, className = '', color = '#0B1B3A' }: { size?: number; className?: string; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="-6 -6 12 12" aria-hidden className={`shrink-0 ${className}`}>
      <circle r="5.4" fill={color} />
    </svg>
  );
}
