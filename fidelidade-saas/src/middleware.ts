import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * Proteção central de rotas: quem não tem sessão válida do tipo certo é mandado para o login antes de a página rodar.
 * As páginas continuam conferindo a sessão no banco (isto é uma segunda barreira, para que uma página nova esquecida não abra dados).
 */
type Rule = { prefix: string; cookie: string; kind: string; login: string; withNext?: boolean; open?: string[] };

const RULES: Rule[] = [
  { prefix: '/dashboard', cookie: 'rs_session', kind: 'restaurant', login: '/login' },
  { prefix: '/admin', cookie: 'ad_session', kind: 'admin', login: '/admin/entrar', open: ['/admin/entrar', '/admin/convite'] },
  { prefix: '/carteira', cookie: 'cs_session', kind: 'customer', login: '/entrar', withNext: true },
  { prefix: '/perfil', cookie: 'cs_session', kind: 'customer', login: '/entrar', withNext: true },
  { prefix: '/avisos', cookie: 'cs_session', kind: 'customer', login: '/entrar', withNext: true },
];

const under = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + '/');

async function valid(token: string | undefined, kind: string): Promise<boolean> {
  if (!token) return false;
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) return true; // sem segredo configurado quem decide (e reclama) é a página
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload.kind === kind && !!payload.sub;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const rule = RULES.find((r) => under(path, r.prefix));
  if (!rule || rule.open?.some((o) => under(path, o))) return NextResponse.next();
  if (await valid(req.cookies.get(rule.cookie)?.value, rule.kind)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = rule.login;
  url.search = rule.withNext ? `?next=${encodeURIComponent(path + req.nextUrl.search)}` : '';
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/dashboard/:path*', '/admin/:path*', '/carteira/:path*', '/perfil/:path*', '/avisos/:path*'] };
