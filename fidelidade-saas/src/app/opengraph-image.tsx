import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const alt = 'Fidelize — Clube de pontos para o seu comércio';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Logo "Fidelize" (o F com degradê é a primeira letra) centralizado e grande. O WhatsApp e outros apps mostram a prévia como
 * miniatura quadrada (corte central); o nome é largo, então ele aparece inteiro na prévia larga e o F fica no meio na miniatura.
 * Sem frase (a frase vai no texto ao lado da miniatura, vindo do título e da descrição da página).
 */
export default async function OpenGraphImage() {
  // Figtree ExtraBold (licença OFL), a mesma fonte do app, para o nome ter o mesmo peso do F
  const figtree = await readFile(join(process.cwd(), 'src/app/fonts/Figtree-ExtraBold.ttf'));
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
          fontFamily: 'Figtree',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <svg width="150" height="197" viewBox="17 11 32 42" style={{ marginRight: 4, marginBottom: 14 }}>
            <defs>
              <linearGradient id="g" gradientUnits="userSpaceOnUse" x1="19" y1="12" x2="47" y2="52">
                <stop offset="0" stopColor="#2F63E6" />
                <stop offset="1" stopColor="#7BE08A" />
              </linearGradient>
            </defs>
            <rect x="18" y="12" width="10" height="40" rx="5" fill="url(#g)" />
            <rect x="18" y="12" width="30" height="10" rx="5" fill="url(#g)" />
            <rect x="18" y="27" width="21" height="10" rx="5" fill="url(#g)" />
          </svg>
          <div style={{ fontSize: 214, fontWeight: 800, letterSpacing: -10, lineHeight: 1 }}>idelize</div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: 'Figtree', data: figtree, weight: 800, style: 'normal' }] },
  );
}
