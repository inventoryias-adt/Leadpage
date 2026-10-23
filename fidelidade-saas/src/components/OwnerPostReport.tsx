'use client';

import { useState, useTransition } from 'react';
import { ownerReportPost } from '@/app/actions/posts';

/** Dono do lugar: botão e caixa de denúncia de uma indicação que cita o negócio. */
export function OwnerPostReport({ postId, reported }: { postId: string; reported: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState(reported ? 'Denunciada: aguardando a administração.' : '');
  const [done, setDone] = useState(reported);
  const [pending, start] = useTransition();
  if (done) return <p className="text-xs font-semibold text-amber-700" data-testid="post-reported">{msg}</p>;
  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs font-semibold text-slate-500" data-testid="owner-report-open">Denunciar esta indicação</button>
      {open && (
        <div className="space-y-2 rounded-2xl bg-slate-50 p-3">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={300} className="glass-input" placeholder="Por que ela deve ser analisada? (foto de outro lugar, ofensa, golpe…)" aria-label="Motivo da denúncia" />
          <button type="button" disabled={pending} className="btn-danger btn-sm" data-testid="owner-report-send" onClick={() => start(async () => {
            const r = await ownerReportPost(postId, reason);
            if ('error' in r) setMsg(r.error); else { setDone(true); setMsg('Denúncia enviada. A administração vai analisar.'); }
          })}>Enviar denúncia</button>
          {msg && !done && <p role="alert" className="text-xs font-semibold text-rose-700">{msg}</p>}
        </div>
      )}
    </div>
  );
}
