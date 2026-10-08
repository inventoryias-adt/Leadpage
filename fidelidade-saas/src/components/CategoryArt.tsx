import type { CSSProperties, ReactNode } from 'react';

/**
 * Ilustrações coloridas e animadas das categorias (64×64). Cada uma tem um movimento sutil:
 * vapor subindo, bolhas, faixas girando, brilho piscando. As animações param para quem pede menos movimento.
 */

export const CATEGORY_TINT: Record<string, string> = {
  todos: '#E6EEFF',
  pizza: '#FFF0DA',
  hamburguer: '#FFEBD2',
  japones: '#E2F4E8',
  churrasco: '#FFE4DF',
  brasileira: '#FFF3D4',
  massas: '#FFF0CE',
  lanches: '#FFE8D3',
  acai: '#EFE4FA',
  sorvete: '#FFE3EE',
  cafe: '#E4F5EF',
  padaria: '#FFF0D9',
  doces: '#FCE4EF',
  saudavel: '#E1F4E6',
  bar: '#FFEFCB',
  barbearia: '#E5ECFA',
  estetica: '#F7E6F0',
  pet: '#F7ECDD',
  farmacia: '#E0F3EA',
  servicos: '#E6EAF2',
  academia: '#E4E9F7',
  mercado: '#E8F3E4',
  moda: '#ECE8FA',
  outros: '#ECEFF6',
};

const d = (s: number): CSSProperties => ({ animationDelay: `${s}s` });

/** Faísca de 4 pontas que pisca. */
function Twinkle({ x, y, s = 1, fill = '#FFC93C', delay = 0 }: { x: number; y: number; s?: number; fill?: string; delay?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path className="cat-twinkle" style={d(delay)} fill={fill} d="M0-6 1.7-1.7 6 0 1.7 1.7 0 6-1.7 1.7-6 0-1.7-1.7Z" />
    </g>
  );
}

/** Três fiapos de vapor subindo. */
function Steam({ x, y, color = '#fff' }: { x: number; y: number; color?: string }) {
  return (
    <g stroke={color} strokeWidth="2.6" strokeLinecap="round" fill="none" opacity=".9">
      <path className="cat-steam" style={d(0)} d={`M${x} ${y}c-3-3 3-5 0-9`} />
      <path className="cat-steam" style={d(0.6)} d={`M${x + 8} ${y + 2}c-3-3 3-5 0-9`} />
      <path className="cat-steam" style={d(1.2)} d={`M${x + 16} ${y}c-3-3 3-5 0-9`} />
    </g>
  );
}

const art: Record<string, ReactNode> = {
  todos: (
    <g className="cat-bob">
      <rect x="9" y="9" width="21" height="21" rx="6" fill="#8FA3C7" />
      <rect x="34" y="9" width="21" height="21" rx="6" fill="#C9D3E6" />
      <rect x="9" y="34" width="21" height="21" rx="6" fill="#C9D3E6" />
      <rect x="34" y="34" width="21" height="21" rx="6" fill="#8FA3C7" />
      <Twinkle x={47} y={20} s={0.9} fill="#fff" delay={0.3} />
    </g>
  ),
  pizza: (
    <>
      <g className="cat-wiggle">
        <path d="M32 57 9 19a33 33 0 0 1 46 0L32 57Z" fill="#FFC843" />
        <path d="M9 19a33 33 0 0 1 46 0" stroke="#D9772B" strokeWidth="7" strokeLinecap="round" />
        <circle cx="24" cy="29" r="4.5" fill="#E5483B" />
        <circle cx="39" cy="27" r="4.5" fill="#E5483B" />
        <circle cx="32" cy="42" r="4.5" fill="#E5483B" />
        <circle cx="31" cy="26" r="1.6" fill="#3FA85B" />
      </g>
      <Twinkle x={51} y={14} s={0.8} delay={0.5} />
    </>
  ),
  hamburguer: (
    <>
      <g className="cat-bob">
        <path d="M9 31a23 17 0 0 1 46 0H9Z" fill="#E59A3A" />
        <g fill="#FFF1C9">
          <ellipse cx="22" cy="21" rx="2.4" ry="1.4" />
          <ellipse cx="32" cy="17.5" rx="2.4" ry="1.4" />
          <ellipse cx="42" cy="21" rx="2.4" ry="1.4" />
          <ellipse cx="28" cy="25" rx="2.4" ry="1.4" />
          <ellipse cx="38" cy="26" rx="2.4" ry="1.4" />
        </g>
        <path d="M7 33c4 5 8-2 12 2s8-2 13 2 8-2 13 2 8-2 12 0v-6H7v2Z" fill="#58B95F" />
        <path d="M9 38h46l-5 8H14L9 38Z" fill="#FFC93C" />
        <rect x="8" y="43" width="48" height="8" rx="4" fill="#6B3A22" />
        <path d="M9 52h46a0 0 0 0 1 0 0v1a6 6 0 0 1-6 6H15a6 6 0 0 1-6-6v-1Z" fill="#E59A3A" />
      </g>
    </>
  ),
  japones: (
    <>
      <g className="cat-bob">
        <circle cx="24" cy="38" r="16" fill="#2B3737" />
        <circle cx="24" cy="38" r="12.5" fill="#FFFDF7" />
        <circle cx="24" cy="38" r="6" fill="#FF8467" />
        <circle cx="24" cy="38" r="2.4" fill="#FFB199" />
      </g>
      <g className="cat-bob" style={d(0.9)}>
        <circle cx="43" cy="27" r="14" fill="#2B3737" />
        <circle cx="43" cy="27" r="11" fill="#FFFDF7" />
        <circle cx="43" cy="27" r="5.4" fill="#6CC070" />
        <circle cx="43" cy="27" r="2.2" fill="#E8F7C8" />
      </g>
      <Twinkle x={52} y={50} s={0.8} delay={0.4} />
    </>
  ),
  churrasco: (
    <>
      <g className="cat-bob">
        <path d="M8 33c0-11 13-18 27-15s21 12 17 24-19 17-31 11S8 42 8 33Z" fill="#F4B3A1" />
        <path d="M13 34c0-8 10-13 21-11s17 9 14 18-15 12-24 8-11-7-11-15Z" fill="#C8453A" />
        <g stroke="#8E2B25" strokeWidth="2.6" strokeLinecap="round">
          <path d="M20 30l12 9M28 25l14 10M18 38l8 6" />
        </g>
        <circle cx="42" cy="44" r="4" fill="#fff" opacity=".85" />
      </g>
      <Steam x={22} y={14} color="#FFB9A8" />
    </>
  ),
  brasileira: (
    <>
      <g className="cat-wiggle">
        <circle cx="32" cy="34" r="25" fill="#fff" />
        <circle cx="32" cy="34" r="25" stroke="#E8D6B5" strokeWidth="3" />
        <path d="M32 12a22 22 0 0 0 0 44V12Z" fill="#FFF3CF" />
        <path d="M32 12a22 22 0 0 1 17 8L32 34V12Z" fill="#7A4A2B" />
        <path d="M49 20a22 22 0 0 1 3 22L32 34l17-14Z" fill="#59B05F" />
        <circle cx="22" cy="28" r="2" fill="#fff" />
        <circle cx="26" cy="38" r="2" fill="#fff" />
        <circle cx="19" cy="40" r="2" fill="#fff" />
        <circle cx="40" cy="48" r="5" fill="#E5483B" />
      </g>
      <Steam x={22} y={10} color="#FFE2A8" />
    </>
  ),
  massas: (
    <>
      <g className="cat-bob">
        <path d="M7 36h50a25 21 0 0 1-50 0Z" fill="#fff" />
        <path d="M7 36h50" stroke="#D5DCE8" strokeWidth="3" />
        <path d="M13 36c0-9 8-14 19-14s19 5 19 14H13Z" fill="#FFD76A" />
        <g stroke="#F2B63B" strokeWidth="2.4" strokeLinecap="round" fill="none">
          <path d="M16 33c4-4 7-4 11 0s7 4 11 0 7-4 10 0" />
          <path d="M20 28c3-3 6-3 9 0s6 3 9 0" />
        </g>
        <path d="M27 24a6 5 0 0 1 12 0c0 3-12 3-12 0Z" fill="#E5483B" />
        <circle cx="38" cy="22" r="1.6" fill="#3FA85B" />
      </g>
      <Steam x={22} y={14} color="#FFE6A2" />
    </>
  ),
  lanches: (
    <>
      <g className="cat-wiggle">
        <rect x="5" y="30" width="54" height="22" rx="11" fill="#E8A64E" />
        <rect x="3" y="26" width="58" height="12" rx="6" fill="#D2563F" />
        <path d="M8 31c4-4 6 4 10 0s6 4 10 0 6 4 10 0 6 4 10 0 6 4 8 1" stroke="#FFCF3A" strokeWidth="3" strokeLinecap="round" fill="none" />
        <rect x="5" y="42" width="54" height="11" rx="5.5" fill="#F0B766" />
      </g>
      <Twinkle x={52} y={14} s={0.8} delay={0.2} />
    </>
  ),
  acai: (
    <>
      <g className="cat-bob">
        <path d="M8 34h48a24 22 0 0 1-48 0Z" fill="#fff" />
        <path d="M8 34h48" stroke="#E2D7F0" strokeWidth="3" />
        <path d="M11 34c0-11 9-17 21-17s21 6 21 17H11Z" fill="#7B2CBF" />
        <circle cx="23" cy="25" r="5" fill="#FFD94F" />
        <circle cx="35" cy="22" r="5" fill="#FFD94F" />
        <circle cx="43" cy="29" r="4.2" fill="#F25C6E" />
        <circle cx="29" cy="30" r="3.4" fill="#F25C6E" />
        <g fill="#D8A15B">
          <circle cx="19" cy="31" r="1.5" />
          <circle cx="39" cy="31" r="1.5" />
          <circle cx="47" cy="25" r="1.5" />
        </g>
        <path d="M44 12c4-1 8 1 9 5-5 1-9-1-9-5Z" fill="#4EB36B" />
      </g>
      <Twinkle x={14} y={14} s={0.9} fill="#B07BE0" delay={0.6} />
      <Twinkle x={52} y={47} s={0.7} delay={0.1} />
    </>
  ),
  sorvete: (
    <>
      <g className="cat-bob">
        <path d="M21 33 32 59l11-26H21Z" fill="#E3A957" />
        <g stroke="#C98A3A" strokeWidth="1.8" strokeLinecap="round">
          <path d="M24 38l12 14M31 36l10 12M27 46l6-3M23 40l-1-1" />
          <path d="M40 38 28 52M33 36 23 48" />
        </g>
        <circle cx="32" cy="29" r="13" fill="#FF9EC4" />
        <path d="M19 30c3 4 5-2 8 2s5-2 8 2 5-2 10 0v-5H19v1Z" fill="#FFB8D4" />
        <circle cx="32" cy="17" r="9" fill="#FFF3C2" />
        <circle cx="32" cy="9" r="3.4" fill="#E5483B" />
      </g>
      <circle className="cat-drip" cx="46" cy="38" r="2.6" fill="#FF9EC4" />
    </>
  ),
  cafe: (
    <>
      <ellipse cx="31" cy="55" rx="23" ry="5" fill="#CFE3DB" />
      <path d="M12 26h34v13a17 17 0 0 1-17 17h0A17 17 0 0 1 12 39V26Z" fill="#fff" />
      <path d="M46 31h3a7 7 0 0 1 0 14h-5" stroke="#E9EEF0" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <ellipse cx="29" cy="26" rx="17" ry="4.5" fill="#7A4A2B" />
      <ellipse cx="29" cy="25" rx="11" ry="2.4" fill="#A4693F" />
      <path d="M12 39a17 17 0 0 0 34 0H12Z" fill="#F1F5F6" />
      <Steam x={19} y={20} color="#9FB8B0" />
    </>
  ),
  padaria: (
    <>
      <g className="cat-wiggle">
        <path d="M8 41C3 27 15 15 32 15s29 12 24 26c-1 6-5 9-10 9H18c-5 0-9-3-10-9Z" fill="#E7A55B" />
        <path d="M13 38c-2-9 8-18 19-18s21 9 19 18c-1 4-4 6-8 6H21c-4 0-7-2-8-6Z" fill="#F1BD7A" />
        <g stroke="#C98840" strokeWidth="3.4" strokeLinecap="round">
          <path d="M20 28l5 8M30 24l5 9M40 28l5 8" />
        </g>
      </g>
      <Twinkle x={12} y={14} s={0.8} fill="#fff" delay={0.2} />
      <Twinkle x={54} y={18} s={0.7} fill="#fff" delay={0.9} />
    </>
  ),
  doces: (
    <>
      <g className="cat-bob">
        <path d="M14 34h36l-4 22H18l-4-22Z" fill="#F277A5" />
        <g stroke="#FFC1D8" strokeWidth="2.6" strokeLinecap="round">
          <path d="M23 38l2 14M32 38v14M41 38l-2 14" />
        </g>
        <path d="M11 35a8 8 0 0 1 4-12 9 9 0 0 1 17-5 9 9 0 0 1 17 5 8 8 0 0 1 4 12H11Z" fill="#FFE0EC" />
        <path d="M17 29c4 2 7-2 11 0s7-2 11 0 6-1 8 0" stroke="#FFB5CF" strokeWidth="3" strokeLinecap="round" fill="none" />
        <circle cx="32" cy="10" r="5" fill="#E5483B" />
        <path d="M32 6c1-3 4-4 6-3" stroke="#3FA85B" strokeWidth="2" strokeLinecap="round" fill="none" />
      </g>
      <Twinkle x={14} y={16} s={0.8} delay={0.3} />
    </>
  ),
  saudavel: (
    <>
      <g className="cat-bob">
        <path d="M7 34h50a25 20 0 0 1-50 0Z" fill="#fff" />
        <path d="M7 34h50" stroke="#D3E8D9" strokeWidth="3" />
        <path d="M12 34c0-4 4-8 8-9 2-6 12-8 16-2 5-3 11 0 12 5 4 1 6 4 6 6H12Z" fill="#59B05F" />
        <path d="M18 33c4-6 9-8 14-8" stroke="#8FD18E" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <circle cx="23" cy="29" r="5.4" fill="#E5483B" />
        <circle cx="41" cy="28" r="5" fill="#E5483B" />
        <circle cx="32" cy="24" r="4" fill="#FF9F43" />
        <circle cx="21" cy="27.5" r="1.4" fill="#fff" opacity=".7" />
      </g>
      <Twinkle x={52} y={14} s={0.8} fill="#9BE19E" delay={0.5} />
    </>
  ),
  bar: (
    <>
      <path d="M44 24h5a8 8 0 0 1 8 8v8a8 8 0 0 1-8 8h-5" stroke="#E8E4DC" strokeWidth="5" strokeLinecap="round" fill="none" />
      <rect x="12" y="20" width="32" height="38" rx="6" fill="#FFC13B" />
      <rect x="17" y="26" width="5" height="26" rx="2.5" fill="#FFE08A" />
      <g fill="#fff">
        <circle cx="16" cy="19" r="7" />
        <circle cx="26" cy="15" r="8" />
        <circle cx="36" cy="18" r="7" />
        <circle cx="42" cy="22" r="5" />
      </g>
      <g fill="#FFF3C4">
        <circle className="cat-rise" style={d(0)} cx="26" cy="48" r="1.8" />
        <circle className="cat-rise" style={d(0.7)} cx="33" cy="52" r="1.6" />
        <circle className="cat-rise" style={d(1.4)} cx="38" cy="46" r="1.8" />
      </g>
    </>
  ),
  barbearia: (
    <>
      <defs>
        <clipPath id="cat-pole">
          <rect x="23" y="13" width="18" height="38" rx="3" />
        </clipPath>
      </defs>
      <rect x="23" y="13" width="18" height="38" rx="3" fill="#fff" />
      <g clipPath="url(#cat-pole)">
        <g className="cat-stripes">
          {[-24, -8, 8, 24, 40].map((y) => (
            <g key={y}>
              <path d={`M20 ${y + 6}l24 -12v8l-24 12Z`} fill="#E5483B" />
              <path d={`M20 ${y + 14}l24 -12v8l-24 12Z`} fill="#2F6BFF" />
            </g>
          ))}
        </g>
      </g>
      <rect x="21" y="8" width="22" height="8" rx="4" fill="#B8C2D6" />
      <rect x="21" y="48" width="22" height="8" rx="4" fill="#B8C2D6" />
      <path d="M26 8V6a6 6 0 0 1 12 0v2" fill="#D5DCEA" />
      <Twinkle x={50} y={22} s={0.8} delay={0.4} />
    </>
  ),
  estetica: (
    <>
      <g className="cat-bob">
        <rect x="27" y="7" width="10" height="17" rx="3.5" fill="#3B2F4A" />
        <rect x="29" y="23" width="6" height="6" fill="#E8E1F0" />
        <rect x="17" y="28" width="30" height="28" rx="9" fill="#E4568B" />
        <path d="M23 36c0-3 2-5 5-5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" opacity=".55" fill="none" />
        <rect x="23" y="42" width="18" height="8" rx="4" fill="#fff" opacity=".35" />
      </g>
      <Twinkle x={13} y={16} s={0.9} delay={0.2} />
      <Twinkle x={52} y={34} s={0.7} fill="#E4568B" delay={0.9} />
    </>
  ),
  pet: (
    <>
      <g className="cat-wiggle">
        <ellipse cx="32" cy="42" rx="13" ry="10.5" fill="#B9774A" />
        <ellipse cx="15.5" cy="30" rx="5.5" ry="7.5" fill="#B9774A" transform="rotate(-20 15.5 30)" />
        <ellipse cx="25.5" cy="19.5" rx="5.5" ry="8" fill="#B9774A" transform="rotate(-6 25.5 19.5)" />
        <ellipse cx="38.5" cy="19.5" rx="5.5" ry="8" fill="#B9774A" transform="rotate(6 38.5 19.5)" />
        <ellipse cx="48.5" cy="30" rx="5.5" ry="7.5" fill="#B9774A" transform="rotate(20 48.5 30)" />
        <ellipse cx="32" cy="44" rx="6" ry="4" fill="#D9A079" opacity=".6" />
      </g>
      <Twinkle x={54} y={10} s={0.8} delay={0.5} />
    </>
  ),
  farmacia: (
    <>
      <g className="cat-bob">
        <rect x="23" y="9" width="18" height="46" rx="6" fill="#2FB67C" />
        <rect x="9" y="23" width="46" height="18" rx="6" fill="#2FB67C" />
        <rect x="26" y="12" width="12" height="40" rx="4" fill="#fff" opacity=".18" />
        <rect x="12" y="26" width="40" height="12" rx="4" fill="#fff" opacity=".18" />
      </g>
      <Twinkle x={52} y={14} s={0.9} fill="#fff" delay={0.3} />
    </>
  ),
  servicos: (
    <>
      <g className="cat-wiggle">
        <g transform="rotate(45 32 32)">
          <rect x="29" y="16" width="6" height="40" rx="3" fill="#8C9BB5" />
          <circle cx="32" cy="15" r="9.5" fill="#8C9BB5" />
          <rect x="28.5" y="3" width="7" height="12" rx="1.5" fill="#F3F5F8" />
        </g>
        <g transform="rotate(-45 32 32)">
          <rect x="28.5" y="36" width="7" height="20" rx="3.5" fill="#F59E0B" />
          <rect x="30.5" y="12" width="3" height="26" fill="#94A3B8" />
          <path d="M30 12h4l-2 -4Z" fill="#64748B" />
        </g>
      </g>
      <Twinkle x={52} y={52} s={0.7} delay={0.6} />
    </>
  ),
  academia: (
    <>
      <g className="cat-bob">
        <rect x="14" y="29" width="36" height="6" rx="3" fill="#64748B" />
        <rect x="9" y="20" width="9" height="24" rx="3.5" fill="#2150C9" />
        <rect x="46" y="20" width="9" height="24" rx="3.5" fill="#2150C9" />
        <rect x="3" y="25" width="6" height="14" rx="2.5" fill="#334155" />
        <rect x="55" y="25" width="6" height="14" rx="2.5" fill="#334155" />
      </g>
      <Twinkle x={32} y={13} s={0.8} delay={0.4} />
    </>
  ),
  mercado: (
    <>
      <g className="cat-bob">
        <circle cx="26" cy="19" r="6" fill="#E5483B" />
        <circle cx="38" cy="17" r="5.5" fill="#34A87B" />
        <path d="M10 26h44l-5 24a4 4 0 0 1-4 3H19a4 4 0 0 1-4-3L10 26Z" fill="#F4B860" />
        <rect x="6" y="23" width="52" height="6" rx="3" fill="#E39A2D" />
        <path d="M22 33v14M32 33v14M42 33v14" stroke="#E39A2D" strokeWidth="2.6" strokeLinecap="round" />
      </g>
      <Twinkle x={54} y={10} s={0.7} delay={0.7} />
    </>
  ),
  moda: (
    <>
      <g className="cat-wiggle">
        <path d="M22 10 8 18l6 11 7-3v29h22V26l7 3 6-11-14-8c-2 4-5 6-10 6s-8-2-10-6Z" fill="#6366F1" />
        <path d="M24 11c2 4 5 6 8 6s6-2 8-6" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" opacity=".7" />
        <path d="M24 34h16" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".35" />
      </g>
      <Twinkle x={53} y={46} s={0.8} fill="#6366F1" delay={0.5} />
    </>
  ),
  outros: (
    <>
      <g className="cat-bob">
        <path d="m32 8 6.7 14 15.3 2.2-11 10.8 2.6 15.2L32 42.8 18.4 50.2 21 35 10 24.2 25.3 22 32 8Z" fill="#FFC93C" />
        <path d="m32 15 3.6 7.6 8.2 1.2-6 5.8" stroke="#FFE58F" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      </g>
      <Twinkle x={12} y={14} s={0.8} fill="#7FA6FF" delay={0.3} />
      <Twinkle x={52} y={50} s={0.9} fill="#FF7BA9" delay={0.8} />
    </>
  ),
};

/** Quadradinho de fundo neutro com o desenho colorido e animado da categoria. */
export function CategoryArt({ name, size = 64 }: { name: string; size?: number }) {
  return (
    <span
      className="cat-anim flex items-center justify-center overflow-hidden rounded-[10px] border border-[#E2E5EB] bg-[#F3F5F8]"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 64 64" width={size * 0.74} height={size * 0.74} fill="none" aria-hidden>
        {art[name] ?? art.outros}
      </svg>
    </span>
  );
}
