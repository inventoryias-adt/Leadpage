import { Icon } from './Icons';

/** Logo do lugar (ou a inicial sobre azul-marinho quando ainda não há foto). */
export function PlaceAvatar({ name, src, size = 56 }: { name: string; src?: string | null; size?: number }) {
  const style = { width: size, height: size };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={`Logo de ${name}`} style={style} className="shrink-0 rounded-lg border border-slate-200 bg-white object-cover" />;
  }
  return (
    <span
      style={{ ...style, background: '#0F1F3D', fontSize: size * 0.42 }}
      className="flex shrink-0 items-center justify-center rounded-lg font-semibold text-white"
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
      style={{ background: '#F1F3F6' }}
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
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: pct >= 100 ? '#059669' : '#2150C9' }}
        />
      </div>
    </div>
  );
}
