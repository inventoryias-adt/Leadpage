'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Icons';
import { COLLAPSE_KEY, DISMISS_KEY, INTRO_KEY, detectPlatform, isInAppBrowser, shouldOffer, shouldShowIntro, type InstallPlatform } from '@/lib/install-app';

type DeferredPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
declare global {
  interface Window {
    __fzInstall?: DeferredPrompt;
  }
}

const read = (key = DISMISS_KEY) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (v: string, key = DISMISS_KEY) => {
  try {
    localStorage.setItem(key, v);
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
  const [guide, setGuide] = useState(false);
  const [intro, setIntro] = useState(false);
  const [collapsed, setCollapsed] = useState(false); // preferência (persistida): o cartão aparece comprimido
  const [open, setOpen] = useState(false); // abriu a tira nesta tela (não persiste)
  const [safari, setSafari] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const p = detectPlatform(ua, navigator.maxTouchPoints);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setPlatform(p);
    setInApp(isInAppBrowser(ua));
    setSafari(!/CriOS|FxiOS|EdgiOS/i.test(ua));
    if (window.__fzInstall) setPrompt(window.__fzInstall); // o evento pode ter chegado antes de o React carregar
    // ?instalar na URL reabre tudo (para testar ou ajudar alguém): esquece o que já foi recolhido/aberto neste aparelho
    if (new URLSearchParams(window.location.search).has('instalar')) {
      try {
        localStorage.removeItem(DISMISS_KEY);
        localStorage.removeItem(INTRO_KEY);
        localStorage.removeItem(COLLAPSE_KEY);
      } catch {
        /* sem armazenamento */
      }
    }
    const stored = read();
    setVisible(shouldOffer({ platform: p, standalone, stored }));
    setCollapsed(read(COLLAPSE_KEY) === '1');
    if (shouldShowIntro({ platform: p, standalone, stored, introSeen: !!read(INTRO_KEY) })) {
      write('1', INTRO_KEY); // o pop-up abre só na primeira visita de cada aparelho
      setIntro(true);
    }

    const onPrompt = (e: Event) => {
      e.preventDefault(); // guarda o evento para abrir só quando a pessoa tocar no botão
      window.__fzInstall = e as DeferredPrompt;
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
    setIntro(false);
    if (!prompt) {
      setGuide(true); // iPhone (e navegadores sem instalador): o toque abre o guia na hora, sem passo extra
      return;
    }
    await prompt.prompt();
    const { outcome } = await prompt.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
    window.__fzInstall = undefined;
    setPrompt(null);
    if (outcome === 'accepted') {
      write('installed');
      setVisible(false);
    }
  }

  /** "Agora não": só comprime o cartão numa tira fina; a informação continua fixa no topo. */
  function collapse() {
    write('1', COLLAPSE_KEY);
    setCollapsed(true);
    setOpen(false);
    setIntro(false);
  }

  return (
    <>
      {collapsed && !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-label="Mostrar como adicionar o Fidelize à tela inicial"
          className={`flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white py-1 text-xs font-medium text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700 ${className}`}
        >
          Adicionar à tela inicial
          <Icon name="down" size={14} strokeWidth={1.2} />
        </button>
      ) : (
      <section aria-label="Adicionar à tela inicial" className={`glass-panel p-4 ${className}`}>
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-96.png?v=2" alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-primary">Tenha o Fidelize na tela inicial</p>
            <p className="mt-0.5 text-sm text-slate-600">Abra seus pontos com um toque, como um app — sem baixar nada na loja.</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={() => void install()} className="glass-button btn-sm flex-1">
            <Icon name="plus" size={16} /> Adicionar à tela inicial
          </button>
          <button type="button" onClick={collapse} className="glass-button-ghost btn-sm shrink-0" title="Comprime este aviso no topo da tela">Agora não</button>
        </div>
      </section>
      )}
      {intro && <InstallIntro onInstall={() => void install()} onClose={collapse} />}
      {guide && <InstallGuide platform={platform} inApp={inApp} safari={safari} onClose={() => setGuide(false)} />}
    </>
  );
}

/** Guia de um toque só para quem não tem o instalador automático (iPhone e alguns navegadores). */
function InstallGuide({ platform, inApp, safari, onClose }: { platform: InstallPlatform; inApp: boolean; safari: boolean; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ios = platform === 'ios';
  const steps: { n: number; text: React.ReactNode }[] = inApp
    ? [
        { n: 1, text: <>Toque nos <strong>três pontinhos</strong> deste navegador.</> },
        { n: 2, text: <>Escolha <strong>Abrir no navegador</strong> ({ios ? 'Safari' : 'Chrome'}).</> },
        { n: 3, text: <>Lá, toque de novo em <strong>Adicionar à tela inicial</strong>.</> },
      ]
    : ios
      ? [
          { n: 1, text: <>Toque em <strong>Compartilhar</strong> <span className="mx-0.5 inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white align-middle text-electric-600"><Icon name="share" size={16} /></span> {safari ? 'na barra aqui embaixo.' : 'na barra do navegador.'}</> },
          { n: 2, text: <>Role a lista e toque em <strong>Adicionar à Tela de Início</strong>.</> },
          { n: 3, text: <>Toque em <strong>Adicionar</strong> (canto superior). Pronto!</> },
        ]
      : [
          { n: 1, text: <>Toque no menu <strong>⋮</strong> do navegador (canto superior direito).</> },
          { n: 2, text: <>Escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</> },
          { n: 3, text: <>Confirme em <strong>Instalar</strong>. Pronto!</> },
        ];

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/50 p-3 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="install-guide-title" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 id="install-guide-title" className="text-lg font-bold text-primary">Adicionar à tela inicial</h2>
        <p className="mt-0.5 text-sm text-slate-600">São 3 toques e o Fidelize fica no seu celular, como um app.</p>
        <ol className="mt-4 space-y-3">
          {steps.map((st) => (
            <li key={st.n} className="flex items-start gap-3 text-sm text-slate-800">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">{st.n}</span>
              <span className="pt-0.5 leading-snug">{st.text}</span>
            </li>
          ))}
        </ol>
        {ios && safari && !inApp && (
          <p aria-hidden className="mt-3 animate-bounce text-center text-2xl text-electric-600">↓</p>
        )}
        <button type="button" autoFocus onClick={onClose} className="glass-button mt-4 w-full">Entendi</button>
      </div>
    </div>
  );
}

/** Pop-up no meio da tela na primeira visita: explica o benefício e instala (ou abre o guia) em um toque. */
function InstallIntro({ onInstall, onClose }: { onInstall: () => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-5" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="install-intro-title" className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png?v=2" alt="" width={72} height={72} className="mx-auto h-[72px] w-[72px] rounded-2xl" />
        <h2 id="install-intro-title" className="mt-4 text-xl font-bold text-primary">Instale o Fidelize no seu celular</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Veja seus pontos e prêmios com um toque, direto da tela inicial — como um app, sem baixar nada na loja.
        </p>
        <button type="button" autoFocus onClick={onInstall} className="glass-button mt-5 w-full">
          <Icon name="plus" size={18} /> Adicionar à tela inicial
        </button>
        <button type="button" onClick={onClose} className="glass-button-ghost btn-sm mt-2 w-full">Agora não</button>
      </div>
    </div>
  );
}
