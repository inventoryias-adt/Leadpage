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

const SKIN_A = '#E8B48E';
const SKIN_B = '#A9694A';
const INK = '#2B1B14';

/** Pano de fundo comum das cenas: círculo suave + sombra no chão. */
function SceneBase({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 320 400" width="100%" role="img" aria-hidden fill="none">
      <circle cx="160" cy="190" r="140" fill={SKY} opacity=".45" />
      <ellipse cx="160" cy="388" rx="120" ry="8" fill="#0F2A6B" opacity=".08" />
      {children}
    </svg>
  );
}

function Face({ skin, cx, cy }: { skin: string; cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="36" fill={skin} />
      <circle cx={cx - 12} cy={cy + 3} r="3" fill={INK} />
      <circle cx={cx + 12} cy={cy + 3} r="3" fill={INK} />
      <path d={`M${cx - 10} ${cy + 16}q10 9 20 0`} stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <circle cx={cx - 20} cy={cy + 13} r="5" fill="#F28B82" opacity=".35" />
      <circle cx={cx + 20} cy={cy + 13} r="5" fill="#F28B82" opacity=".35" />
    </g>
  );
}

/** Atendente no balcão mostrando o QR Code para o cliente pontuar. */
export function SceneCashier() {
  return (
    <SceneBase>
      {/* corpo */}
      <rect x="105" y="190" width="110" height="130" rx="40" fill={BLUE} />
      <rect x="146" y="164" width="28" height="32" rx="10" fill={SKIN_A} />
      <path d="M140 192h40l-8 22h-24l-8-22Z" fill="#fff" opacity=".9" />
      {/* braços */}
      <path d="M205 228c18 4 28 12 30 28" stroke={BLUE} strokeWidth="22" strokeLinecap="round" />
      <circle cx="236" cy="258" r="11" fill={SKIN_A} />
      <path d="M115 228c-12 20-8 44 8 54" stroke={BLUE} strokeWidth="22" strokeLinecap="round" />
      {/* cabeça */}
      <Face skin={SKIN_A} cx={160} cy={138} />
      <path d="M124 134c-2-30 20-48 40-46 22 2 34 20 32 46-8-14-20-22-36-22s-28 8-36 22Z" fill="#3B2A20" />
      <path d="M126 98c10-14 30-20 48-14 14 4 22 12 24 22-14-10-38-14-72-8Z" fill={DEEP} />
      <rect x="122" y="100" width="76" height="9" rx="4.5" fill={DEEP} />
      {/* tablet com QR */}
      <path d="M214 282h42l8 14h-58l8-14Z" fill="#0F2A6B" />
      <rect x="186" y="204" width="86" height="76" rx="10" fill="#0F2A6B" />
      <rect x="192" y="210" width="74" height="64" rx="6" fill="#fff" />
      <g fill={DEEP}>
        <rect x="200" y="218" width="16" height="16" rx="2.5" />
        <rect x="242" y="218" width="16" height="16" rx="2.5" />
        <rect x="200" y="250" width="16" height="16" rx="2.5" />
        <rect x="224" y="238" width="6" height="6" rx="1" />
        <rect x="236" y="246" width="6" height="6" rx="1" />
        <rect x="224" y="256" width="14" height="6" rx="1" />
        <rect x="246" y="256" width="12" height="10" rx="1" />
      </g>
      <g fill="#fff">
        <rect x="204" y="222" width="8" height="8" rx="1.5" />
        <rect x="246" y="222" width="8" height="8" rx="1.5" />
        <rect x="204" y="254" width="8" height="8" rx="1.5" />
      </g>
      {/* balcão */}
      <rect x="40" y="300" width="240" height="88" rx="14" fill={DEEP} />
      <rect x="28" y="286" width="264" height="22" rx="9" fill="#fff" stroke={SKY} strokeWidth="3" />
      <rect x="62" y="322" width="34" height="34" rx="9" fill="#fff" />
      <g fill={BLUE}>
        <rect x="72" y="330" width="7" height="20" rx="2" />
        <rect x="72" y="330" width="18" height="7" rx="2" />
        <rect x="72" y="340" width="14" height="6" rx="2" />
      </g>
      <Sparkle x={248} y={170} s={1.1} />
      <Sparkle x={72} y={190} s={0.8} fill={BLUE} />
      {/* balão de fala */}
      <rect x="14" y="52" width="160" height="46" rx="14" fill="#fff" stroke={SKY} strokeWidth="3" />
      <path d="M118 98l10 18 8-18Z" fill="#fff" stroke={SKY} strokeWidth="3" strokeLinejoin="round" />
      <path d="M121 96h12" stroke="#fff" strokeWidth="5" />
      <text x="94" y="80" textAnchor="middle" fontSize="14" fontWeight="800" fill={DEEP} fontFamily="system-ui, sans-serif">Escaneie e ganhe!</text>
    </SceneBase>
  );
}

/** Cliente feliz com o celular mostrando os pontos recebidos. */
export function SceneCustomer() {
  return (
    <SceneBase>
      {/* pernas e sapatos */}
      <rect x="126" y="296" width="30" height="84" rx="10" fill="#27408F" />
      <rect x="164" y="296" width="30" height="84" rx="10" fill="#27408F" />
      <ellipse cx="136" cy="382" rx="20" ry="7" fill="#0F2A6B" />
      <ellipse cx="184" cy="382" rx="20" ry="7" fill="#0F2A6B" />
      {/* corpo */}
      <rect x="110" y="182" width="100" height="128" rx="36" fill={GOLD} />
      <rect x="146" y="162" width="28" height="30" rx="10" fill={SKIN_B} />
      {/* braço com celular */}
      <path d="M198 214c26 0 38-18 40-46" stroke={GOLD} strokeWidth="22" strokeLinecap="round" />
      <circle cx="240" cy="164" r="11" fill={SKIN_B} />
      <rect x="226" y="86" width="56" height="92" rx="11" fill="#0F2A6B" />
      <rect x="231" y="94" width="46" height="76" rx="7" fill="#fff" />
      <circle cx="254" cy="120" r="14" fill={BLUE} />
      <path d="m247 120 5 5 9-10" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <text x="254" y="152" textAnchor="middle" fontSize="13" fontWeight="800" fill={DEEP} fontFamily="system-ui, sans-serif">+250</text>
      <text x="254" y="163" textAnchor="middle" fontSize="8" fontWeight="700" fill="#64748B" fontFamily="system-ui, sans-serif">pontos</text>
      {/* braço com sacola */}
      <path d="M118 214c-16 18-20 42-12 62" stroke={GOLD} strokeWidth="22" strokeLinecap="round" />
      <circle cx="106" cy="280" r="11" fill={SKIN_B} />
      <path d="M92 284v-10a14 14 0 0 1 28 0v10" stroke={DEEP} strokeWidth="4" strokeLinecap="round" />
      <rect x="76" y="282" width="48" height="56" rx="8" fill={BLUE} />
      <Sparkle x={100} y={310} s={0.9} fill="#fff" />
      {/* cabeça */}
      <Face skin={SKIN_B} cx={160} cy={132} />
      <g fill="#1F1410">
        <circle cx="132" cy="112" r="14" />
        <circle cx="148" cy="100" r="16" />
        <circle cx="168" cy="98" r="16" />
        <circle cx="186" cy="108" r="15" />
        <circle cx="192" cy="124" r="10" />
        <circle cx="128" cy="128" r="10" />
      </g>
      <circle cx="160" cy="142" r="30" fill={SKIN_B} opacity="0" />
      {/* moedas e brilhos */}
      <g>
        <circle cx="196" cy="78" r="12" fill={GOLD} />
        <circle cx="196" cy="78" r="7.5" stroke="#fff" strokeWidth="2" opacity=".8" />
        <circle cx="76" cy="150" r="9" fill={GOLD} />
        <circle cx="76" cy="150" r="5.5" stroke="#fff" strokeWidth="2" opacity=".8" />
      </g>
      <Sparkle x={70} y={206} s={0.9} fill={BLUE} />
      <Sparkle x={274} y={60} s={1.1} />
    </SceneBase>
  );
}

/**
 * Cenas ilustradas nas laterais, só em telas bem largas (≥1600px), onde sobra espaço ao lado do conteúdo.
 * `container` = largura máxima do conteúdo da área, para as cenas caberem sem encostar nele.
 */
export function SideArt({ container }: { container: '64rem' | '72rem' }) {
  const width = `min(380px, calc((100vw - ${container}) / 2 - 2rem))`;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 hidden wide:block">
      <div className="absolute bottom-0 left-4" style={{ width }}>
        <SceneCashier />
      </div>
      <div className="absolute bottom-0 right-4" style={{ width }}>
        <SceneCustomer />
      </div>
    </div>
  );
}
