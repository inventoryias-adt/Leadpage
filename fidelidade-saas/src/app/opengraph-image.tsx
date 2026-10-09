import { ImageResponse } from 'next/og';

export const alt = 'Fidelize — Programa de pontos para o seu negócio';
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
          background: '#0F1F3D',
          color: '#ffffff',
        }}
      >
        <svg width="300" height="300" viewBox="0 0 64 64">
          <rect width="64" height="64" rx="10" fill="#16294d" />
          <g transform="translate(32 32) scale(1.18) translate(-34 -36)">
            <path fill="#fff" d="M21 17a3 3 0 0 1 3-3h20a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H29v6h12a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H29v9a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3Z" />
            <rect x="40" y="46" width="8" height="4" rx="2" fill="#5B84E6" />
          </g>
        </svg>
        <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -2, marginTop: 28 }}>Fidelize</div>
      </div>
    ),
    size,
  );
}
