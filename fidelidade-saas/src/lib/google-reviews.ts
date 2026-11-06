import 'server-only';
import { readFile } from 'node:fs/promises';
import { open, seal } from './secret-box';
import type { GoogleReview } from './google-match';

/**
 * Leitura das avaliações do Google Business Profile, com a autorização do dono do lugar (só leitura).
 *
 * ATENÇÃO: as chamadas abaixo seguem a documentação pública da API como a conhecemos, mas ainda NÃO foram testadas contra o
 * Google de verdade: o Google exige uma aprovação do projeto para liberar essa API (até ~14 dias) e, antes dela, todas as
 * chamadas falham. Por isso o recurso só liga quando as chaves estão configuradas e, em qualquer erro, o pedido do cliente
 * segue pelo caminho de sempre (o lugar confere ou os pontos entram em 24 h).
 */

export const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/business.manage';

/** Modo de teste (arquivo JSON no lugar do Google): só em desenvolvimento e em previews, nunca em produção. */
export const googleMock = () =>
  process.env.GOOGLE_REVIEWS_PROVIDER === 'mock' && (process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'preview');

/** A conferência automática só existe quando as chaves do Google estão configuradas (ou no modo de teste). */
export function googleConfigured(): boolean {
  if (googleMock()) return true;
  const e = process.env;
  return Boolean(e.GOOGLE_OAUTH_CLIENT_ID && e.GOOGLE_OAUTH_CLIENT_SECRET && e.GOOGLE_TOKEN_KEY && e.GOOGLE_TOKEN_KEY.length >= 16);
}

export type GoogleLocation = { name: string; title: string; address?: string };

const redirectUri = (origin: string) => `${origin}/api/google/callback`;

/** Endereço da tela de autorização do Google. */
export function authUrl(origin: string, state: string): string {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
    redirect_uri: redirectUri(origin),
    response_type: 'code',
    scope: `${GOOGLE_SCOPE} openid email`,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '', client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '', ...body }),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; id_token?: string; error?: string };
  if (!res.ok || !json.access_token) throw new Error(`Google recusou o token (${json.error ?? res.status}).`);
  return json;
}

const emailOf = (idToken?: string): string | null => {
  try {
    const payload = JSON.parse(Buffer.from((idToken ?? '').split('.')[1] ?? '', 'base64url').toString('utf8')) as { email?: string };
    return payload.email ?? null;
  } catch {
    return null;
  }
};

/** Troca o código da autorização pelo token de renovação (cifrado) e pela lista de perfis do dono. */
export async function connectWithCode(origin: string, code: string) {
  const t = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(origin) });
  if (!t.refresh_token) throw new Error('O Google não devolveu a permissão de longa duração. Tente conectar de novo.');
  return { refreshTokenEnc: seal(t.refresh_token), email: emailOf(t.id_token), locations: await fetchLocations(t.access_token!) };
}

async function accessToken(refreshTokenEnc: string): Promise<string> {
  return (await tokenRequest({ grant_type: 'refresh_token', refresh_token: open(refreshTokenEnc) })).access_token!;
}

async function gget<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Google respondeu ${res.status} em ${new URL(url).pathname}.`);
  return (await res.json()) as T;
}

/** Perfis (locais) a que o dono tem acesso: contas e, em cada uma, os locais. */
async function fetchLocations(token: string): Promise<GoogleLocation[]> {
  const accounts = await gget<{ accounts?: { name: string }[] }>('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', token);
  const out: GoogleLocation[] = [];
  for (const a of (accounts.accounts ?? []).slice(0, 10)) {
    const q = new URLSearchParams({ readMask: 'name,title,storefrontAddress', pageSize: '100' });
    const r = await gget<{ locations?: { name: string; title?: string; storefrontAddress?: { addressLines?: string[]; locality?: string } }[] }>(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${a.name}/locations?${q}`,
      token,
    );
    for (const l of r.locations ?? []) {
      // `l.name` vem como "locations/456"; para ler avaliações a API antiga pede "accounts/123/locations/456".
      const address = [l.storefrontAddress?.addressLines?.[0], l.storefrontAddress?.locality].filter(Boolean).join(', ');
      out.push({ name: `${a.name}/${l.name}`, title: l.title ?? l.name, address: address || undefined });
    }
  }
  return out;
}

type RawReview = { reviewId?: string; reviewer?: { displayName?: string; isAnonymous?: boolean }; starRating?: string; comment?: string; createTime?: string };
const STARS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

const toReview = (r: RawReview): GoogleReview | null => {
  if (!r.reviewId || !r.createTime) return null;
  const at = new Date(r.createTime);
  if (Number.isNaN(at.getTime())) return null;
  return { id: r.reviewId, author: r.reviewer?.isAnonymous ? null : (r.reviewer?.displayName ?? null), rating: STARS[r.starRating ?? ''] ?? 0, comment: r.comment ?? '', createdAt: at };
};

/** Lista dos locais para o dono escolher (modo de teste: lê do arquivo). */
export async function mockLocations(): Promise<GoogleLocation[]> {
  const file = await readMock();
  return Object.keys(file).map((name) => ({ name, title: name.split('/').pop() ?? name }));
}

async function readMock(): Promise<Record<string, { id: string; author: string | null; rating?: number; comment?: string; createdAt: string }[]>> {
  const path = process.env.GOOGLE_REVIEWS_MOCK_FILE;
  if (!path) return {};
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return {};
  }
}

/** Avaliações recentes de um local (as mais novas primeiro), desde `since`. Lança erro se o Google recusar. */
export async function listReviews(refreshTokenEnc: string, location: string, since: Date): Promise<GoogleReview[]> {
  if (googleMock()) {
    const rows = (await readMock())[location] ?? [];
    return rows.map((r) => ({ id: r.id, author: r.author, rating: r.rating ?? 5, comment: r.comment ?? '', createdAt: new Date(r.createdAt) })).filter((r) => r.createdAt >= since);
  }
  const token = await accessToken(refreshTokenEnc);
  const out: GoogleReview[] = [];
  let pageToken = '';
  for (let page = 0; page < 3; page++) {
    const q = new URLSearchParams({ pageSize: '50', orderBy: 'updateTime desc' });
    if (pageToken) q.set('pageToken', pageToken);
    const r = await gget<{ reviews?: RawReview[]; nextPageToken?: string }>(`https://mybusiness.googleapis.com/v4/${location}/reviews?${q}`, token);
    for (const raw of r.reviews ?? []) {
      const rv = toReview(raw);
      if (rv && rv.createdAt >= since) out.push(rv);
    }
    pageToken = r.nextPageToken ?? '';
    // Ordenadas por atualização: se a última da página já é antiga, o resto também é.
    const last = (r.reviews ?? []).map(toReview).filter(Boolean).pop();
    if (!pageToken || (last && last.createdAt < since)) break;
  }
  return out;
}
