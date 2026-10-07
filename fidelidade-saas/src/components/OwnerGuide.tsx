'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { finishGuide } from '@/app/actions/restaurant';
import { Icon, type IconName } from './Icons';

export type GuideProgress = {
  identity: boolean;
  unit: boolean;
  rewards: boolean;
  onboarded: boolean;
  promos: boolean;
};

type Step = {
  id: string;
  icon: IconName;
  title: string;
  text: string;
  bullets?: string[];
  cta?: { label: string; href: string };
  done?: (p: GuideProgress) => boolean;
  /** Mostra o link do cliente com botão de copiar. */
  clientLink?: boolean;
};

const STEPS: Step[] = [
  {
    id: 'bem-vindo',
    icon: 'spark',
    title: 'Pagamento confirmado! Vamos começar',
    text: 'Em poucos minutos o seu estabelecimento fica pronto para pontuar. Este passo a passo mostra o que fazer, na ordem certa.',
    bullets: ['Configurar o estabelecimento (identidade, unidade, pontos e produtos)', 'Lançar a primeira compra no caixa', 'Mostrar ao cliente como entrar e ganhar pontos'],
  },
  {
    id: 'identidade',
    icon: 'camera',
    title: 'Identidade da marca',
    text: 'É como o seu estabelecimento aparece para os clientes no app.',
    bullets: ['Envie a logo e uma foto de capa', 'Escolha a categoria (Açaí, Café, Padaria…)', 'Informe o Instagram, se tiver'],
    cta: { label: 'Ir para Identidade', href: '/dashboard/configuracoes#identidade' },
    done: (p) => p.identity,
  },
  {
    id: 'unidade',
    icon: 'pin',
    title: 'Endereço, horário e localização',
    text: 'Cada unidade tem endereço, horário e localização próprios. É o que o cliente vê para saber quando pode vir.',
    bullets: ['Digite o CEP: rua, bairro e cidade são preenchidos sozinhos', 'Informe o número e o complemento', 'Defina o horário de cada dia da semana', 'Toque em “Usar minha localização atual” (GPS) ou “Localizar pelo endereço”, para o check-in funcionar'],
    cta: { label: 'Ir para Unidades', href: '/dashboard/configuracoes#unidades' },
    done: (p) => p.unit,
  },
  {
    id: 'pontos',
    icon: 'receipt',
    title: 'Quanto vale cada real',
    text: 'Defina quantos pontos o cliente ganha a cada R$ 1,00 e quantos resgates cada CPF pode fazer por mês.',
    bullets: ['Exemplo: R$ 1 = 10 pontos, então uma conta de R$ 150 vale 1.500 pontos', 'Opcional: pontos por check-in e por indicar amigos', 'Opcional: interações (avaliar no Google, postar no Instagram) e desafios'],
    cta: { label: 'Ir para Conversão', href: '/dashboard/configuracoes#pontos' },
  },
  {
    id: 'produtos',
    icon: 'gift',
    title: 'Cadastre os prêmios',
    text: 'São os produtos que o cliente troca por pontos. Cadastre pelo menos um; com foto, o resgate vende mais.',
    bullets: ['Nome, pontos necessários e uma descrição curta', 'Foto do produto (opcional, mas ajuda muito)'],
    cta: { label: 'Ir para Produtos', href: '/dashboard/configuracoes#produtos' },
    done: (p) => p.rewards,
  },
  {
    id: 'finalizar',
    icon: 'check',
    title: 'Finalize a configuração',
    text: 'No fim da página de Regras, toque em “Concluir configuração”. Só depois disso o caixa e a vitrine ficam liberados.',
    bullets: ['É preciso ter endereço, horário e pelo menos um produto', 'Você pode mudar tudo depois, quando quiser'],
    cta: { label: 'Ir para o final da página', href: '/dashboard/configuracoes#finalizar' },
    done: (p) => p.onboarded,
  },
  {
    id: 'caixa',
    icon: 'receipt',
    title: 'Lance pontos no caixa',
    text: 'Depois que o cliente pagar a conta, gere o QR Code dos pontos dele.',
    bullets: ['Digite o valor da conta e marque as interações que ele fez', 'Toque em “Gerar QR Code”', 'O cliente lê o QR com a câmera do celular, ou você envia o link pelo WhatsApp', 'Cada QR vale uma vez e expira em 24 horas'],
    cta: { label: 'Abrir o Caixa', href: '/dashboard/caixa' },
  },
  {
    id: 'cliente',
    icon: 'users',
    title: 'Como o cliente entra',
    text: 'O cliente não baixa nada. Ele abre o link, entra com CPF e telefone, e a carteira dele é criada na hora.',
    bullets: ['Peça o QR do caixa depois de pagar: ele já cai na carteira', 'Ou compartilhe o link abaixo (Instagram, WhatsApp, balcão)', 'Em “Lugares”, ele encontra o seu estabelecimento e as campanhas'],
    clientLink: true,
  },
  {
    id: 'resgates',
    icon: 'gift',
    title: 'Entregue os prêmios',
    text: 'Quando o cliente resgata, ele recebe um código de 6 caracteres para mostrar no balcão.',
    bullets: ['Em “Resgates”, busque pelo código', 'Confira o prêmio e toque em “Entregar”', 'Cada CPF tem um limite de resgates por mês (você define)'],
    cta: { label: 'Abrir Resgates', href: '/dashboard/resgates' },
  },
  {
    id: 'campanhas',
    icon: 'trophy',
    title: 'Crie campanhas de pontos',
    text: 'Pontos em dobro na terça, +50 pontos em compras acima de R$ 40… As campanhas valem no caixa e viram cards na vitrine dos clientes.',
    bullets: ['Escolha multiplicador ou pontos extras', 'Defina dias, horário e período', 'Pause ou remova quando quiser'],
    cta: { label: 'Criar uma campanha', href: '/dashboard/configuracoes#campanhas' },
    done: (p) => p.promos,
  },
  {
    id: 'pronto',
    icon: 'check',
    title: 'Tudo pronto!',
    text: 'Agora é só pontuar. Acompanhe clientes, pontos e resgates no Início do painel. Você pode reabrir este guia a qualquer momento no botão “Guia”, no topo.',
  },
];

const STEP_KEY = 'fz_guide_step';
const SEEN_KEY = 'fz_guide_seen';

function safeGet(store: 'local' | 'session', key: string) {
  try {
    return (store === 'local' ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}
function safeSet(store: 'local' | 'session', key: string, value: string) {
  try {
    (store === 'local' ? localStorage : sessionStorage).setItem(key, value);
  } catch {
    /* sem armazenamento: o guia só não lembra onde parou */
  }
}

/**
 * Passo a passo em janelas para o dono recém-chegado. Abre sozinho enquanto não for concluído ou dispensado,
 * lembra em que passo parou e pode ser reaberto pelo botão "Guia" do topo.
 */
export function OwnerGuide({ autoOpen, progress, clientUrl }: { autoOpen: boolean; progress: GuideProgress; clientUrl: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const primary = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
    const saved = Number(safeGet('local', STEP_KEY));
    if (Number.isInteger(saved) && saved >= 0 && saved < STEPS.length) setStep(saved);
    if (autoOpen && !safeGet('session', SEEN_KEY)) setOpen(true);
  }, [autoOpen]);

  const close = useCallback(() => {
    setOpen(false);
    safeSet('session', SEEN_KEY, '1');
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    if (open) primary.current?.focus();
  }, [open, step]);

  const go = (n: number) => {
    const next = Math.max(0, Math.min(STEPS.length - 1, n));
    setStep(next);
    safeSet('local', STEP_KEY, String(next));
    setCopied(false);
  };

  async function dismiss() {
    setSkipping(true);
    try {
      await finishGuide();
    } finally {
      setSkipping(false);
      setOpen(false);
      safeSet('session', SEEN_KEY, '1');
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(clientUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* o link segue visível na tela */
    }
  }

  const s = STEPS[step];
  const last = step === STEPS.length - 1;
  const done = s.done?.(progress);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="glass-button-ghost btn-sm" aria-haspopup="dialog">
        <Icon name="info" size={16} /> Guia
      </button>

      {mounted && autoOpen && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-24 left-4 z-30 inline-flex items-center gap-2 rounded-full border border-electric-500 bg-white px-4 py-2.5 text-sm font-semibold text-electric-600 shadow-lg shadow-blue-900/15 transition-colors hover:bg-electric-500 hover:text-white md:bottom-6"
        >
          <Icon name="info" size={16} /> Guia · passo {step + 1} de {STEPS.length}
        </button>
      )}

      {mounted &&
        open &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/55 md:items-center md:p-6" onClick={close}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="guia-titulo"
              onClick={(e) => e.stopPropagation()}
              className="max-h-[92vh] w-full max-w-lg animate-fade-in overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl md:rounded-3xl"
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Passo {step + 1} de {STEPS.length}</p>
                <button type="button" onClick={close} className="glass-button-ghost btn-sm !px-3" aria-label="Fechar o guia (você pode voltar depois)">✕</button>
              </div>

              <div className="mb-5 flex gap-1.5" aria-hidden>
                {STEPS.map((x, i) => (
                  <span key={x.id} className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-electric-500' : i === step ? 'bg-electric-500/60' : 'bg-[#e8ecf8]'}`} />
                ))}
              </div>

              <div className="mb-4 flex items-center gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-electric-500/10 text-electric-600">
                  <Icon name={s.icon} size={28} />
                </span>
                <div className="min-w-0">
                  <h2 id="guia-titulo" className="text-xl font-semibold leading-tight text-primary">{s.title}</h2>
                  {s.done && (
                    <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                      {done ? 'Feito' : 'Falta fazer'}
                    </span>
                  )}
                </div>
              </div>

              <p className="mb-3 text-slate-600">{s.text}</p>
              {s.bullets && (
                <ul className="mb-4 space-y-2">
                  {s.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <Icon name="check" size={16} className="mt-0.5 shrink-0 text-electric-500" /> {b}
                    </li>
                  ))}
                </ul>
              )}

              {s.clientLink && (
                <div className="glass-inset mb-4 p-3">
                  <p className="mb-1 text-xs font-semibold text-slate-500">Link do cliente</p>
                  <p className="break-all text-sm font-semibold text-primary">{clientUrl}</p>
                  <button type="button" onClick={copy} className="glass-button-ghost btn-sm mt-2">
                    <Icon name="copy" size={16} /> {copied ? 'Link copiado!' : 'Copiar link'}
                  </button>
                </div>
              )}

              <div className="space-y-2">
                {s.cta && (
                  <Link href={s.cta.href} onClick={close} className="glass-button">
                    {s.cta.label}
                  </Link>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => go(step - 1)} disabled={step === 0} className="glass-button-ghost">Voltar</button>
                  {last ? (
                    <button ref={primary} type="button" onClick={dismiss} disabled={skipping} className="glass-button">
                      {skipping ? 'Salvando…' : 'Concluir guia'}
                    </button>
                  ) : (
                    <button ref={primary} type="button" onClick={() => go(step + 1)} className={s.cta ? 'glass-button-ghost' : 'glass-button'}>
                      Próximo
                    </button>
                  )}
                </div>
                {!last && (
                  <button type="button" onClick={dismiss} disabled={skipping} className="link-inline w-full pt-1 text-center text-sm">
                    Pular guia
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
