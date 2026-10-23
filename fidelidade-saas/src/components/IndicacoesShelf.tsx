import Link from 'next/link';
import { Carousel } from './Carousel';
import { Icon } from './Icons';
import { Stars } from './Stars';
import { feed } from '@/lib/posts-db';

/** Faixa do Início com as indicações mais novas (fotos pequenas) e o atalho para o feed e para indicar. */
export async function IndicacoesShelf({ customerId, hasWallets }: { customerId: string; hasWallets: boolean }) {
  const { posts } = await feed(customerId, { take: 8 });
  if (posts.length === 0) {
    if (!hasWallets) return null;
    return (
      <Link href="/indicacoes/nova" className="glass-panel-sm card-link flex items-center gap-3 !rounded-[20px] px-4 py-3" data-testid="shelf-cta">
        <span className="icon-tile"><Icon name="camera" size={20} /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-slate-800">Indique um lugar</span>
          <span className="block truncate text-xs text-slate-500">Poste uma foto com a sua nota e mostre o que você gostou</span>
        </span>
        <Icon name="chevron" size={18} className="text-slate-400" />
      </Link>
    );
  }
  return (
    <section aria-labelledby="indicacoes-inicio" data-testid="indicacoes-shelf">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="indicacoes-inicio" className="text-xs font-bold uppercase tracking-wider text-slate-500">Indicações</h2>
        <Link href="/indicacoes" className="text-xs font-bold text-electric-600">Ver todas</Link>
      </div>
      <Carousel label="Indicações recentes">
        {posts.map((p) => (
          <li key={p.id} className="w-36 shrink-0 snap-start">
            <Link href={`/indicacoes?lugar=${p.place.id}`} className="card-link block" aria-label={`Indicação de ${p.place.name}, nota ${p.rating}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.photoUrl} alt="" loading="lazy" className="aspect-square w-full rounded-[18px] bg-slate-100 object-cover" />
              <span className="mt-1.5 block truncate text-xs font-bold text-slate-800">{p.place.name}</span>
              <Stars value={p.rating} size={12} />
            </Link>
          </li>
        ))}
      </Carousel>
    </section>
  );
}
