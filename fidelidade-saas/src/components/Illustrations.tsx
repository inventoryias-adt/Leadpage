/** Ilustrações da marca (SVG próprio, nas cores do Fidelize) para onboarding e telas vazias. */
type Variant = 'qr' | 'places' | 'gift' | 'empty';

const BLUE = '#2F6BFF';
const DEEP = '#1A43C7';
const SKY = '#CFE0FF';
const GOLD = '#FFC24A';

function Sparkle({ x, y, s = 1, fill = GOLD }: { x: number; y: number; s?: number; fill?: string }) {
  return <path transform={`translate(${x} ${y}) scale(${s})`} fill={fill} d="M0-10 2.8-2.8 10 0 2.8 2.8 0 10-2.8 2.8-10 0-2.8-2.8Z" />;
}

export function Illustration({ variant, size = 220 }: { variant: Variant; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 220 220" role="img" aria-hidden fill="none">
      <circle cx="110" cy="112" r="92" fill={SKY} opacity=".55" />
      <circle cx="110" cy="112" r="64" fill="#fff" opacity=".7" />
      {variant === 'qr' && (
        <g>
          <rect x="68" y="42" width="84" height="140" rx="16" fill="#0F2A6B" />
          <rect x="74" y="52" width="72" height="120" rx="10" fill="#fff" />
          <rect x="95" y="44" width="30" height="4" rx="2" fill="#27408F" />
          {/* QR estilizado */}
          <g fill={DEEP}>
            <rect x="84" y="64" width="18" height="18" rx="3" />
            <rect x="118" y="64" width="18" height="18" rx="3" />
            <rect x="84" y="98" width="18" height="18" rx="3" />
            <rect x="107" y="87" width="6" height="6" rx="1" />
            <rect x="118" y="98" width="6" height="6" rx="1" />
            <rect x="130" y="98" width="6" height="6" rx="1" />
            <rect x="107" y="107" width="6" height="6" rx="1" />
            <rect x="118" y="109" width="18" height="6" rx="1" />
          </g>
          <g fill="#fff">
            <rect x="89" y="69" width="8" height="8" rx="1.5" />
            <rect x="123" y="69" width="8" height="8" rx="1.5" />
            <rect x="89" y="103" width="8" height="8" rx="1.5" />
          </g>
          <rect x="84" y="130" width="52" height="28" rx="8" fill={BLUE} />
          <text x="110" y="149" textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff" fontFamily="system-ui, sans-serif">+250 pts</text>
          <Sparkle x={160} y={60} s={1.3} />
          <Sparkle x={52} y={96} s={0.8} fill={BLUE} />
        </g>
      )}
      {variant === 'places' && (
        <g>
          <path d="M40 150c20-18 38 6 62-8s34-34 62-26 26 24 26 24v58H40v-48Z" fill="#fff" opacity=".9" />
          <path d="M44 168c24-10 44 10 68-2s36-22 64-14" stroke={SKY} strokeWidth="6" strokeLinecap="round" />
          <circle cx="110" cy="164" r="22" fill={BLUE} opacity=".12" />
          <circle cx="110" cy="164" r="12" fill={BLUE} opacity=".2" />
          <path d="M110 48c-24 0-42 17-42 40 0 30 42 66 42 66s42-36 42-66c0-23-18-40-42-40Z" fill={BLUE} />
          <path d="M110 48c-24 0-42 17-42 40 0 8 3 16 7 24 8-30 36-48 70-44-8-12-21-20-35-20Z" fill="#fff" opacity=".18" />
          <circle cx="110" cy="88" r="17" fill="#fff" />
          <Sparkle x={110} y={88} s={1.1} />
          <Sparkle x={166} y={64} s={0.9} />
          <Sparkle x={54} y={122} s={0.7} fill={BLUE} />
        </g>
      )}
      {variant === 'gift' && (
        <g>
          <rect x="62" y="92" width="96" height="76" rx="12" fill={BLUE} />
          <rect x="54" y="74" width="112" height="28" rx="10" fill={DEEP} />
          <rect x="102" y="74" width="16" height="94" fill={GOLD} />
          <path d="M110 74c-6-24-34-26-34-10 0 10 18 10 34 10Zm0 0c6-24 34-26 34-10 0 10-18 10-34 10Z" fill={GOLD} />
          <rect x="70" y="178" width="80" height="8" rx="4" fill="#fff" />
          <rect x="70" y="178" width="52" height="8" rx="4" fill="#10B981" />
          <Sparkle x={168} y={70} s={1.2} />
          <Sparkle x={50} y={104} s={0.8} fill={BLUE} />
        </g>
      )}
      {variant === 'empty' && (
        <g>
          <rect x="62" y="86" width="96" height="72" rx="14" fill="#fff" stroke={SKY} strokeWidth="4" />
          <rect x="76" y="102" width="44" height="8" rx="4" fill={SKY} />
          <rect x="76" y="118" width="68" height="8" rx="4" fill={SKY} />
          <rect x="76" y="134" width="30" height="8" rx="4" fill={SKY} />
          <circle cx="148" cy="86" r="22" fill={BLUE} />
          <path d="m138 86 7 7 13-14" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <Sparkle x={58} y={72} s={0.9} />
          <Sparkle x={168} y={140} s={0.8} fill={BLUE} />
        </g>
      )}
    </svg>
  );
}
