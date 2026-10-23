'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { likePost, removePost, reportPostAction } from '@/app/actions/posts';
import { authorName, instagramCaption, instagramUrl, postAge } from '@/lib/posts';
import type { FeedPost } from '@/lib/posts-db';
import { Icon } from './Icons';
import { Stars } from './Stars';
import { PlaceAvatar } from './Visual';

type Plain = Omit<FeedPost, 'createdAt'> & { createdAt: string };
export type PostCardData = Plain;

/** Uma indicação no feed: foto, lugar, autor, nota, comentário, curtir, compartilhar no Instagram, denunciar (ou apagar a própria). */
export function PostCard({ post, highlight = false }: { post: PostCardData; highlight?: boolean }) {
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.likes);
  const [msg, setMsg] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const [gone, setGone] = useState(false);
  const [pending, start] = useTransition();
  if (gone) return null;
  const when = postAge(new Date(post.createdAt));
  const caption = instagramCaption({ placeName: post.place.name, placeInstagram: post.place.instagram, rating: post.rating, comment: post.comment });

  const like = () => start(async () => {
    setLiked((l) => !l); setLikes((n) => n + (liked ? -1 : 1)); // responde na hora; o servidor confirma
    const r = await likePost(post.id);
    if ('error' in r) { setLiked(post.liked); setLikes(post.likes); setMsg(r.error); } else { setLiked(r.liked); setLikes(r.likes); }
  });

  async function share() {
    setMsg('');
    try {
      const blob = await (await fetch(post.photoUrl)).blob();
      const file = new File([blob], 'indicacao.jpg', { type: blob.type || 'image/jpeg' });
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: caption }); return; }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return; // a pessoa fechou a janela de compartilhar
    }
    try { await navigator.clipboard.writeText(caption); } catch { /* sem permissão */ }
    setMsg('Legenda copiada. Salve a foto e publique no seu Instagram marcando o lugar.');
  }

  return (
    <article className={`glass-panel overflow-hidden !rounded-[22px] ${highlight ? 'ring-2 ring-lima' : ''}`} data-testid="post-card" data-post-id={post.id}>
      <header className="flex items-center gap-3 px-4 py-3">
        <Link href={`/lugar/${post.place.id}`} aria-label={post.place.name}><PlaceAvatar name={post.place.name} src={post.place.logoImageId ? `/api/imagem/${post.place.logoImageId}` : null} size={40} /></Link>
        <div className="min-w-0 flex-1">
          <Link href={`/lugar/${post.place.id}`} className="block truncate font-bold text-slate-900">{post.place.name}</Link>
          <p className="truncate text-xs text-slate-500">
            {post.mine ? 'Você' : authorName(post.author.name)}
            {post.author.instagram && <> · <a href={instagramUrl(post.author.instagram)} target="_blank" rel="noopener noreferrer" className="font-semibold text-electric-600">@{post.author.instagram}</a></>}
            {' · '}{when}
          </p>
        </div>
      </header>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={post.photoUrl} alt={`Indicação de ${post.place.name}`} loading="lazy" className="aspect-[4/5] w-full bg-slate-100 object-cover" />

      <div className="space-y-2 px-4 py-3">
        {post.hidden && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Escondida pela moderação: só você vê esta indicação.</p>}
        <div className="flex items-center justify-between gap-3">
          <Stars value={post.rating} size={20} label={`Nota ${post.rating} de 5`} />
          <button type="button" onClick={like} disabled={pending || post.hidden} aria-pressed={liked} aria-label={liked ? 'Descurtir' : 'Curtir'} data-testid="like" className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold transition-colors ${liked ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
            <span aria-hidden>{liked ? '♥' : '♡'}</span><span data-testid="like-count">{likes}</span>
          </button>
        </div>
        {post.comment && <p className="whitespace-pre-line text-sm text-slate-700" data-testid="post-comment">{post.comment}</p>}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs font-semibold">
          <button type="button" onClick={share} className="flex items-center gap-1 text-electric-600" data-testid="share-instagram"><Icon name="share" size={14} /> Publicar no Instagram</button>
          {post.mine ? (
            <button type="button" onClick={() => { if (confirm('Apagar esta indicação?')) start(async () => { await removePost(post.id); setGone(true); }); }} className="text-slate-500" data-testid="delete-post">Apagar</button>
          ) : (
            <button type="button" onClick={() => setReporting((r) => !r)} className="text-slate-500" data-testid="report-open">Denunciar</button>
          )}
        </div>

        {reporting && (
          <div className="space-y-2 rounded-2xl bg-slate-50 p-3" data-testid="report-box">
            <label htmlFor={`rp-${post.id}`} className="text-xs font-bold text-slate-600">Por que você quer denunciar?</label>
            <textarea id={`rp-${post.id}`} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={300} className="glass-input" placeholder="Foto imprópria, ofensa, spam…" />
            <div className="flex gap-2">
              <button type="button" className="btn-danger btn-sm" data-testid="report-send" onClick={() => start(async () => {
                const r = await reportPostAction(post.id, reason);
                if ('error' in r) setMsg(r.error); else { setMsg('Denúncia enviada. A administração vai analisar.'); setReporting(false); setReason(''); }
              })}>Enviar denúncia</button>
              <button type="button" className="glass-button-ghost btn-sm" onClick={() => setReporting(false)}>Cancelar</button>
            </div>
          </div>
        )}
        {msg && <p role="status" className="text-xs font-semibold text-slate-600" data-testid="post-msg">{msg}</p>}
      </div>
    </article>
  );
}
