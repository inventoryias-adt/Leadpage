import { Icon, type IconName } from './Icons';

type Variant = 'qr' | 'places' | 'gift' | 'empty' | 'caixa' | 'scan';

const ICON: Record<Variant, IconName> = { qr: 'camera', places: 'pin', gift: 'gift', empty: 'search', caixa: 'receipt', scan: 'qr' };

/** Marca visual discreta das telas de apresentação e vazias: um ícone de linha em um ladrilho neutro. */
export function Illustration({ variant, size = 120 }: { variant: Variant; size?: number }) {
  const box = Math.round(size * 0.42);
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F6F7F9] text-electric-500"
      style={{ width: box, height: box }}
    >
      <Icon name={ICON[variant]} size={Math.round(box * 0.46)} />
    </span>
  );
}
