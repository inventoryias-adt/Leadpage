'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Icons';
import { DISMISS_KEY, detectPlatform, isInAppBrowser, shouldOffer, type InstallPlatform } from '@/lib/install-app';

type DeferredPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

const read = () => {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
};
const write = (v: string) => {
  try {
    localStorage.setItem(DISMISS_KEY, v);
  } catch {
    /* sem armazenamento: o convite volta na próxima visita */
  }
};

/**
 * Convite para adicionar o Fidelize à tela inicial. Só aparece no celular, fora do app já instalado.
 * Android/Chrome: botão que abre o instalador do sistema. iPhone e demais: passo a passo curto.
 */
export function InstallApp({ className = '' }: { className?: string }) {
  const [platform, setPlatform] = useState<InstallPlatform>('other');
  const [visible, setVisible] = useState(false);
  const [inApp, setInApp] = useState(false);
  const [prompt, setPrompt] = useState<DeferredPrompt | null>(null);
  const [steps, setSteps] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const p = detectPlatform(ua, navigator.maxTouchPoints);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setPlatform(p);
    setInApp(isInAppBrowser(ua));
    setVisible(shouldOffer({ platform: p, standalone, stored: read(), now: Date.now() }));

    const onPrompt = (e: Event) => {
      e.preventDefault(); // guarda o evento para abrir só quando a pessoa tocar no botão
      setPrompt(e as DeferredPrompt);
    };
    const onInstalled = () => {
      write('installed');
      setVisible(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!visible) return null;

  async function install() {
    if (!prompt) {
      setSteps((s) => !s);
      return;
    }
    await prompt.prompt();
    const { outcome } = await prompt.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
    setPrompt(null);
    if (outcome === 'accepted') {
      write('installed');
      setVisible(false);
    }
  }

  function dismiss() {
    write(String(Date.now()));
    setVisible(false);
  }

  return (
    <section aria-label="Adicionar à tela inicial" className={`glass-panel p-4 ${className}`}>
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-96.png" alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-primary">Tenha o Fidelize na tela inicial</p>
          <p className="mt-0.5 text-sm text-slate-600">Abra seus pontos com um toque, como um app — sem baixar nada na loja.</p>
        </div>
      </div>

      {steps && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
          {inApp ? (
            <p>Este navegador não consegue instalar. Toque nos três pontinhos, escolha <strong>Abrir no navegador</strong> ({platform === 'ios' ? 'Safari' : 'Chrome'}) e volte aqui.</p>
          ) : platform === 'ios' ? (
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Toque em <strong>Compartilhar</strong> <Icon name="share" size={15} className="inline align-text-bottom" /> na barra do navegador.</li>
              <li>Role e toque em <strong>Adicionar à Tela de Início</strong>.</li>
              <li>Confirme em <strong>Adicionar</strong>.</li>
            </ol>
          ) : (
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Toque no menu <strong>⋮</strong> do navegador (canto superior).</li>
              <li>Escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</li>
              <li>Confirme em <strong>Instalar</strong>.</li>
            </ol>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={() => void install()} className="glass-button btn-sm flex-1" aria-expanded={prompt ? undefined : steps}>
          <Icon name="plus" size={16} /> {prompt ? 'Adicionar à tela inicial' : steps ? 'Entendi' : 'Como adicionar'}
        </button>
        <button type="button" onClick={dismiss} className="glass-button-ghost btn-sm shrink-0">Agora não</button>
      </div>
    </section>
  );
}
