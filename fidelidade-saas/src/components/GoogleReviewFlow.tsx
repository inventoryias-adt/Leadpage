'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { checkGoogleReviewAction, confirmGoogleReviewAction, startGoogleReviewAction, type GoogleFlowState } from '@/app/actions/customer';
import { GoogleG } from './BrandIcons';

type Step = 'prompt' | 'waiting' | 'checking' | 'approved' | 'rejected';

/** Quanto tempo a tela fica procurando a avaliação sozinha, e de quanto em quanto tempo. */
const POLL_MS = 20_000;
const POLL_MAX_MS = 10 * 60_000;

/**
 * Avaliação no Google em três telas: (1) "Curtiu? Conta pra cidade", (2) "Te esperando no Google", (3) "Conferindo sua avaliação…".
 * O cliente abre o Google, escreve a avaliação e volta; a gente procura a avaliação sozinho (quando o lugar ligou o Google)
 * ou o lugar confere. Nada aqui promete uma nota: os pontos são por avaliar, não por avaliar bem.
 */
export function GoogleReviewFlow({
  ruleId,
  restaurantId,
  unitId,
  googleUrl,
  points,
  placeName,
  initial,
  auto,
  autoAt,
}: {
  ruleId: string;
  restaurantId: string;
  unitId: string | null;
  googleUrl: string;
  points: number;
  placeName: string;
  /** 'idle': ainda não pediu; 'checking': já pediu e está em análise; 'approved': pontos já recebidos (sem botão, mas a tela aberta continua até fechar). */
  initial: 'idle' | 'checking' | 'approved';
  /** O Google deste lugar está ligado: a conferência é automática. */
  auto: boolean;
  autoAt: string | null;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<Step>(initial === 'checking' ? 'checking' : initial === 'approved' ? 'approved' : 'prompt');
  const [info, setInfo] = useState<{ auto: boolean; autoAt: string | null; points: number }>({ auto, autoAt, points });
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const polledFor = useRef(0);

  const apply = useCallback(
    (s: GoogleFlowState) => {
      if ('error' in s) return setError(s.error);
      setError('');
      if (s.step === 'checking') {
        setInfo((i) => ({ ...i, auto: s.auto, autoAt: s.autoAt }));
        setStep('checking');
      } else if (s.step === 'approved') {
        setInfo((i) => ({ ...i, points: s.points }));
        setStep('approved');
        router.refresh();
      } else {
        setStep('rejected');
        router.refresh();
      }
    },
    [router],
  );

  const show = () => {
    setError('');
    if (step === 'waiting') setStep('prompt'); // reabrir recomeça pela primeira tela
    dialog.current?.showModal();
    setOpen(true);
  };
  const close = () => dialog.current?.close();

  // Tela 3 aberta: procura a avaliação de tempos em tempos, por até 10 minutos.
  useEffect(() => {
    if (!open || step !== 'checking' || !info.auto) return;
    polledFor.current = 0;
    const t = window.setInterval(() => {
      polledFor.current += POLL_MS;
      if (polledFor.current > POLL_MAX_MS) return window.clearInterval(t);
      checkGoogleReviewAction(ruleId, restaurantId).then(apply).catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(t);
  }, [open, step, info.auto, ruleId, restaurantId, apply]);

  const openGoogle = () => {
    // O link abre numa aba nova (é o próprio <a>); aqui só guardamos a hora em que o cliente foi ao Google.
    void startGoogleReviewAction(ruleId, unitId);
    setStep('waiting');
  };
  const done = () =>
    startTransition(async () => {
      apply(await confirmGoogleReviewAction(ruleId, restaurantId));
      router.refresh(); // a linha da ação passa a mostrar "Em análise"
    });
  const recheck = () => startTransition(async () => apply(await checkGoogleReviewAction(ruleId, restaurantId)));

  return (
    <>
      {initial !== 'approved' && step !== 'approved' && (
        <button type="button" onClick={show} className="glass-button-ghost btn-sm" data-testid="gr-trigger">
          <GoogleG size={16} />
          {initial === 'checking' ? 'Ver a conferência' : 'Avaliar no Google'}
        </button>
      )}

      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        onClick={(e) => { if (e.target === dialog.current) close(); }}
        aria-labelledby={`gr-title-${ruleId}`}
        className="m-0 mt-auto w-full max-w-none rounded-t-3xl bg-white p-0 text-primary shadow-2xl backdrop:bg-[#0F1F3D]/55 sm:m-auto sm:max-w-md sm:rounded-3xl"
        data-testid="gr-dialog"
      >
        <div className="space-y-4 px-6 pb-6 pt-5">
          <div className="flex items-center justify-between">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF0FF]"><GoogleG size={26} /></span>
            <button type="button" onClick={close} aria-label="Fechar" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F1F3F6] text-slate-600">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>

          {step === 'prompt' && (
            <section data-testid="gr-step-prompt" className="space-y-3">
              <h3 id={`gr-title-${ruleId}`} className="text-2xl font-extrabold tracking-tight">Curtiu? Conta pra cidade</h3>
              <p className="text-slate-600">Conte no Google como foi a sua experiência em <b>{placeName}</b> e ganhe <b>+{info.points} pts</b>. Escreva o que você realmente achou.</p>
              <a href={googleUrl} target="_blank" rel="noopener noreferrer" onClick={openGoogle} className="glass-button-primary" data-testid="gr-open">
                Avaliar no Google
              </a>
              <button type="button" onClick={close} className="glass-button-ghost w-full" data-testid="gr-later">Agora não</button>
            </section>
          )}

          {step === 'waiting' && (
            <section data-testid="gr-step-waiting" className="space-y-3">
              <h3 id={`gr-title-${ruleId}`} className="text-2xl font-extrabold tracking-tight">Te esperando no Google</h3>
              <p className="text-slate-600">Abra o Google, escreva a sua avaliação e <b>volte aqui</b> para receber seus pontos.</p>
              <button type="button" onClick={done} disabled={pending} className="glass-button-primary" data-testid="gr-done">{pending ? 'Enviando…' : 'Já avaliei'}</button>
              <a href={googleUrl} target="_blank" rel="noopener noreferrer" onClick={() => void startGoogleReviewAction(ruleId, unitId)} className="glass-button-ghost w-full" data-testid="gr-open-again">
                Abrir Google
              </a>
            </section>
          )}

          {step === 'checking' && (
            <section data-testid="gr-step-checking" className="space-y-3" aria-live="polite">
              <h3 id={`gr-title-${ruleId}`} className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
                <span aria-hidden className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-electric-500 border-t-transparent" />
                Conferindo sua avaliação…
              </h3>
              {info.auto ? (
                <p className="text-slate-600">Estamos procurando a sua avaliação no Google. Costuma levar poucos minutos e pode levar até 10 min. Pode fechar esta tela: os pontos entram sozinhos assim que a avaliação for encontrada.</p>
              ) : (
                <p className="text-slate-600">O lugar vai conferir a sua avaliação e liberar os pontos.{info.autoAt ? ' Se o lugar não recusar, os pontos entram sozinhos em até 24 h.' : ''}</p>
              )}
              {info.auto && info.autoAt && <p className="text-sm text-slate-500">Se não acharmos, o lugar confere, ou os pontos entram em até 24 h se ele não recusar.</p>}
              {info.auto && <button type="button" onClick={recheck} disabled={pending} className="glass-button-ghost w-full" data-testid="gr-recheck">{pending ? 'Procurando…' : 'Conferir de novo'}</button>}
              <button type="button" onClick={close} className="glass-button-primary" data-testid="gr-close">Fechar</button>
            </section>
          )}

          {step === 'approved' && (
            <section data-testid="gr-step-approved" className="space-y-3" aria-live="polite">
              <h3 id={`gr-title-${ruleId}`} className="text-2xl font-extrabold tracking-tight">Avaliação confirmada!</h3>
              <p className="text-slate-600"><b>+{info.points} pts</b> entraram na sua carteira. Obrigado por contar pra cidade.</p>
              <button type="button" onClick={close} className="glass-button-primary" data-testid="gr-close">Fechar</button>
            </section>
          )}

          {step === 'rejected' && (
            <section data-testid="gr-step-rejected" className="space-y-3">
              <h3 id={`gr-title-${ruleId}`} className="text-2xl font-extrabold tracking-tight">Não conseguimos confirmar</h3>
              <p className="text-slate-600">O lugar não confirmou este pedido. Fale com o caixa se achar que foi engano.</p>
              <button type="button" onClick={close} className="glass-button-primary" data-testid="gr-close">Fechar</button>
            </section>
          )}

          {error && <p role="alert" className="glass-error !py-2 text-sm" data-testid="gr-error">{error}</p>}
        </div>
      </dialog>
    </>
  );
}
