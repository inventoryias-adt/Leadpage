'use client';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

const TILES = process.env.NEXT_PUBLIC_MAP_TILES || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export type MapTarget = { lat: number; lng: number; zoom: number; nonce: number };

/**
 * Mapa com o pino fixo no centro (o pino é desenhado por quem usa): o cliente arrasta o mapa até o ponto
 * e a cada parada devolvemos o centro. `target` recentraliza o mapa (nonce novo = nova ordem).
 */
export default function LocationMap({ target, onMove }: { target: MapTarget; onMove: (c: { lat: number; lng: number }) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const cb = useRef(onMove);
  cb.current = onMove;

  useEffect(() => {
    if (!box.current || map.current) return;
    const m = L.map(box.current, { zoomControl: false, attributionControl: true }).setView([target.lat, target.lng], target.zoom);
    L.tileLayer(TILES, { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
    L.control.zoom({ position: 'bottomright' }).addTo(m);
    m.on('moveend', () => {
      const c = m.getCenter();
      cb.current({ lat: c.lat, lng: c.lng });
    });
    map.current = m;
    cb.current({ lat: target.lat, lng: target.lng });
    return () => {
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    map.current?.setView([target.lat, target.lng], target.zoom);
  }, [target.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={box} className="h-full w-full" role="application" aria-label="Mapa. Arraste até o seu ponto." />;
}
