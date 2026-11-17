import Link from 'next/link';

/** Cores do símbolo. Mantenha iguais a public/logo.svg, src/app/icon.svg, src/app/opengraph-image.tsx e scripts/gerar-icones.mjs. */
export const BRAND_INK = '#12241C'; // verde-floresta escuro
export const BRAND_ACAO = '#1E5B43'; // o F sobre fundo claro
export const BRAND_OURO = '#E9C46A'; // o F sobre fundo escuro

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
 * Símbolo do Fidelize: só o "F", numa cor só. `size` é a altura do F.
 * Padrão: verde de ação (sobre fundo claro). Sobre fundo escuro use `mono={BRAND_OURO}`.
 */
export function LogoMark({ size = 36, className = '', mono = BRAND_ACAO }: { size?: number; className?: string; mono?: string }) {
  return (
    <svg width={(size * 32) / 42} height={size} viewBox="17 11 32 42" aria-hidden className={`shrink-0 ${className}`}>
      <FGlyph fill={mono} />
    </svg>
  );
}

/**
 * Marca completa: o F (verde de ação, ou dourado em fundo escuro) é a primeira letra do nome ("F" + "idelize").
 * `light` deixa o nome branco para fundos escuros; `size` é o tamanho da letra do nome; `compact` mostra só o F, um pouco maior, no celular (barras apertadas).
 */
export function Brand({ href = '/', size = 28, compact = false, light = false }: { href?: string; size?: number; compact?: boolean; light?: boolean }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-baseline" aria-label="Fidelize — início">
      <LogoMark size={Math.round(size * 0.74)} mono={light ? BRAND_OURO : BRAND_ACAO} className={`mr-[-0.01em] ${compact ? 'max-sm:!h-[1.9rem] max-sm:!w-auto' : ''}`} />
      <span aria-hidden className={`font-extrabold leading-none tracking-[-0.045em] ${light ? 'text-papel' : 'text-primary'} ${compact ? 'max-sm:hidden' : ''}`} style={{ fontSize: size }}>idelize</span>
    </Link>
  );
}

/** O ponto final sozinho, para enfeitar a página (landing). */
export function Coin({ size = 64, className = '', color = '#12241C' }: { size?: number; className?: string; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="-6 -6 12 12" aria-hidden className={`shrink-0 ${className}`}>
      <circle r="5.4" fill={color} />
    </svg>
  );
}
