import { GoogleG } from './BrandIcons';
import { disconnectGoogle, saveUnitGoogleLocation } from '@/app/actions/restaurant';
import { prisma } from '@/lib/db';
import { googleConfigured } from '@/lib/google-reviews';

const FLASH: Record<string, [string, 'ok' | 'erro']> = {
  ok: ['Google ligado! Agora escolha abaixo o perfil de cada unidade.', 'ok'],
  negado: ['Você não liberou o acesso no Google. Nada foi ligado.', 'erro'],
  erro: ['Não conseguimos ligar o Google agora. Tente de novo em alguns minutos.', 'erro'],
  indisponivel: ['A conferência automática ainda não está disponível.', 'erro'],
};

type Loc = { name: string; title: string; address?: string };

/**
 * Conferência automática das avaliações do Google. Só aparece quando o Fidelize tem as chaves do Google configuradas:
 * o dono autoriza a leitura das avaliações, escolhe o perfil de cada unidade e os pedidos "Já avaliei" dos clientes são conferidos sozinhos.
 */
export async function GoogleConnectCard({ restaurantId, units, flash }: { restaurantId: string; units: { id: string; name: string; googleLocation: string | null }[]; flash?: string }) {
  if (!googleConfigured()) return null;
  const conn = await prisma.googleConnection.findUnique({ where: { restaurantId } });
  const locations = (Array.isArray(conn?.locations) ? conn!.locations : []) as Loc[];
  const msg = flash ? FLASH[flash] : undefined;

  return (
    <section className="glass-inset mt-5 space-y-3 p-4" data-testid="google-card">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF0FF]"><GoogleG size={22} /></span>
        <div className="min-w-0">
          <h3 className="font-bold text-slate-800">Conferir avaliações do Google sozinho</h3>
          <p className="text-sm text-slate-500">
            Ligue o seu perfil do Google e, quando um cliente avisar “Já avaliei”, o Fidelize procura a avaliação dele (pelo nome, escrita depois de ele abrir o Google) e libera os pontos na hora.
            Só lemos as avaliações: não publicamos nem mudamos nada no seu perfil.
          </p>
        </div>
      </div>

      {msg && <p role="status" className={msg[1] === 'ok' ? 'glass-success !py-2 text-sm' : 'glass-error !py-2 text-sm'} data-testid="google-flash">{msg[0]}</p>}

      {!conn ? (
        <a href="/api/google/connect" className="glass-button-primary !w-auto" data-testid="google-connect">Ligar com o Google</a>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600" data-testid="google-connected">Ligado{conn.googleEmail ? ` como ${conn.googleEmail}` : ''}.</p>
          {conn.lastError && <p className="glass-error !py-2 text-sm" data-testid="google-last-error">Na última conferência o Google respondeu com erro. Os pedidos continuam no caminho de sempre (você confere ou os pontos entram em 24 h).</p>}
          <ul className="space-y-2">
            {units.map((u) => (
              <li key={u.id}>
                <form action={saveUnitGoogleLocation} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="unitId" value={u.id} />
                  <label className="min-w-0 flex-1 text-sm font-semibold text-slate-700">
                    {u.name}
                    <select name="location" defaultValue={u.googleLocation ?? ''} className="glass-input mt-1" data-testid={`google-loc-${u.id}`}>
                      <option value="">Não conferir sozinho</option>
                      {locations.map((l) => (
                        <option key={l.name} value={l.name}>{l.title}{l.address ? ` · ${l.address}` : ''}</option>
                      ))}
                    </select>
                  </label>
                  <button className="glass-button-ghost btn-sm" data-testid={`google-save-${u.id}`}>Salvar</button>
                </form>
              </li>
            ))}
          </ul>
          <form action={disconnectGoogle}>
            <button className="link-inline text-sm" data-testid="google-disconnect">Desligar o Google</button>
          </form>
        </div>
      )}
    </section>
  );
}
