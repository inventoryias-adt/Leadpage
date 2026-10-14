import { ImageResponse } from 'next/og';

export const alt = 'Fidelize — Clube de pontos para o seu negócio';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Logo centralizado. O WhatsApp e outros apps mostram a prévia como miniatura quadrada (corte central),
 * então tudo que importa fica dentro do quadrado do meio (630 × 630) da imagem.
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0B1B3A',
          color: '#ffffff',
        }}
      >
        <svg width="300" height="300" viewBox="0 0 64 64">
          <rect width="64" height="64" rx="16" fill="#C6F432" />
          <g transform="translate(-1 0)">
            <rect x="18" y="12" width="10" height="40" rx="5" fill="#0B1B3A" />
            <rect x="18" y="12" width="30" height="10" rx="5" fill="#0B1B3A" />
            <rect x="18" y="27" width="21" height="10" rx="5" fill="#0B1B3A" />
            <g transform="translate(43.5 47)">
              <circle r="5.4" fill="#2150C9" />
              <path d="M0 -4.6V-2.9M0 2.9V4.6" fill="none" stroke="#C6F432" strokeWidth=".9" strokeLinecap="round" />
              <path d="M2 -1.9C1.8 -3.3 -2 -3.5 -2 -1.4C-2 0.3 2 -0.2 2 1.6C2 3.5 -1.8 3.4 -2 1.9" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" />
            </g>
          </g>
        </svg>
        <div style={{ fontSize: 104, fontWeight: 700, letterSpacing: -5, marginTop: 28 }}>fidelize</div>
      </div>
    ),
    size,
  );
}
