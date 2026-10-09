'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatBRL, formatPoints } from '@/lib/points';

const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Cupom do QR Code para imprimir (impressora térmica de 80 mm ou comum), centralizado na página. Fica fora da tela
 * e só aparece ao imprimir: o resto da página é escondido pelo CSS de impressão (`.print-portal`).
 */
export function PrintTicket({
  placeName,
  points,
  amountCents,
  customerName,
  description,
  url,
  createdAt,
  expiresAt,
}: {
  placeName: string;
  points: number;
  amountCents: number;
  customerName: string;
  description: string;
  url: string;
  createdAt: string;
  expiresAt: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div className="print-portal" aria-hidden>
      <div className="pt-box">
        <p className="pt-name">{placeName}</p>
        <p className="pt-sub">Ganhe pontos na sua carteira</p>
        <div className="pt-qr">
          <QRCodeSVG value={url} size={256} fgColor="#000000" bgColor="#ffffff" level="M" marginSize={1} style={{ width: '100%', height: 'auto' }} />
        </div>
        <p className="pt-points">{formatPoints(points)} pontos</p>
        <dl className="pt-info">
          {customerName && (
            <div>
              <dt>Cliente</dt>
              <dd>{customerName}</dd>
            </div>
          )}
          <div>
            <dt>Data</dt>
            <dd>{when(createdAt)}</dd>
          </div>
          {amountCents > 0 && (
            <div>
              <dt>Valor da compra</dt>
              <dd>{formatBRL(amountCents)}</dd>
            </div>
          )}
        </dl>
        {description && amountCents <= 0 && <p className="pt-desc">{description}</p>}
        <p className="pt-how">Escaneie com a câmera do celular. Não precisa baixar nada.</p>
        <p className="pt-small">Uso único · válido até {when(expiresAt)}</p>
      </div>
    </div>,
    document.body,
  );
}
