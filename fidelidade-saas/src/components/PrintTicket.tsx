'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatPoints } from '@/lib/points';

/**
 * Cupom do QR Code para imprimir (impressora térmica de 80 mm ou comum). Fica fora da tela e só aparece
 * ao imprimir: o resto da página é escondido pelo CSS de impressão (`.print-portal`).
 */
export function PrintTicket({ placeName, points, description, url, expiresAt }: { placeName: string; points: number; description: string; url: string; expiresAt: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div className="print-portal" aria-hidden>
      <p className="pt-name">{placeName}</p>
      <p className="pt-sub">Ganhe pontos na sua carteira</p>
      <div className="pt-qr">
        <QRCodeSVG value={url} size={256} fgColor="#000000" bgColor="#ffffff" level="M" marginSize={1} style={{ width: '100%', height: 'auto' }} />
      </div>
      <p className="pt-points">{formatPoints(points)} pontos</p>
      {description && <p className="pt-desc">{description}</p>}
      <p className="pt-how">Escaneie com a câmera do celular. Não precisa baixar nada.</p>
      <p className="pt-small">Uso único · válido até {new Date(expiresAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
    </div>,
    document.body,
  );
}
