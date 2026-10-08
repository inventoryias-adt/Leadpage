import Link from 'next/link';

/** Símbolo do Fidelize: um "F" branco em um ladrilho azul-marinho, sem efeitos. */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0">
      <rect width="64" height="64" rx="12" fill="#0F1F3D" />
      <path
        fill="#fff"
        d="M21 17a3 3 0 0 1 3-3h20a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H29v6h12a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H29v9a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3Z"
      />
      <rect x="40" y="46" width="8" height="4" rx="2" fill="#5B84E6" />
    </svg>
  );
}

/** Marca completa: símbolo + nome. */
export function Brand({ href = '/', size = 36 }: { href?: string; size?: number }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label="Fidelize — início">
      <LogoMark size={size} />
      <span className="text-[1.1rem] font-semibold leading-none tracking-tight text-primary">Fidelize</span>
    </Link>
  );
}
