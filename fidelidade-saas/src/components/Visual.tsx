import { Icon } from './Icons';

/** Logo do lugar (ou a inicial sobre um degradê azul quando ainda não há foto). */
export function PlaceAvatar({ name, src, size = 56 }: { name: string; src?: string | null; size?: number }) {
  const style = { width: size, height: size };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={`Logo de ${name}`} style={style} className="shrink-0 rounded-2xl border border-white bg-white object-cover shadow-md shadow-blue-900/10" />;
  }
  return (
    <span
      style={{ ...style, background: 'linear-gradient(145deg, #4F8FFF, #1A43C7)', fontSize: size * 0.42 }}
      className="flex shrink-0 items-center justify-center rounded-2xl font-extrabold text-white shadow-md shadow-blue-900/20"
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** Foto de um prêmio (ou um presente estilizado quando não há foto). */
export function RewardImage({ src, name, className = '' }: { src?: string | null; name: string; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} loading="lazy" className={`bg-slate-100 object-cover ${className}`} />;
  }
  return (
    <span
      aria-hidden
      className={`flex items-center justify-center text-electric-600 ${className}`}
      style={{ background: 'linear-gradient(145deg, #E6F0FF, #CFE0FF)' }}
    >
      <Icon name="gift" size={28} />
    </span>
  );
}

/** Barra de progresso até um prêmio ou desafio. */
export function ProgressBar({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)} aria-label={label}>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200/80">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: pct >= 100 ? 'linear-gradient(90deg,#10B981,#34D399)' : 'linear-gradient(90deg,#2F6BFF,#5B9BFF)' }}
        />
      </div>
    </div>
  );
}
