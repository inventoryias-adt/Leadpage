import Link from 'next/link';

/** Marca do produto: selo azul com estrela + nome. */
export function Brand({ href = '/', subtle = false }: { href?: string; subtle?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label="Fidelize — início">
      <span
        className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-md shadow-blue-700/30"
        style={{ background: 'linear-gradient(145deg, #3b78ff, #1d4ed8)' }}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.5 6.1 20.7l1.2-6.6L2.5 9.5l6.6-.9L12 2.5z" />
        </svg>
      </span>
      <span className={`text-lg font-extrabold tracking-tight ${subtle ? 'text-slate-800' : 'text-primary'}`}>Fidelize</span>
    </Link>
  );
}
