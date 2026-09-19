# Sports Operator (V1)

Operador pessoal de análise esportiva focado em futebol. Aplicação de uso
individual, sem multi-tenant, sem login complexo.

## Demo pública (temporária)

**https://sports-operator-demo.vercel.app**

Deploy de demonstração rodando em modo DEMO (dados fictícios), só para
visualizar a interface e os cálculos. **Não use para registrar seu
histórico real de entradas**: o banco (`better-sqlite3`) grava em disco, e
o filesystem da Vercel é somente leitura exceto `/tmp`, que é efêmero —
o histórico registrado nesse deploy pode ser perdido a qualquer momento.
Para uso real e persistente, rode localmente (seção abaixo).

## 1. Instalação

```bash
cd sports-operator
npm install
```

## 2. Configuração da API de odds

Copie o arquivo de exemplo:

```bash
cp .env.local.example .env.local
```

Duas opções:

- **Modo DEMO (padrão, sem configuração nenhuma):** deixe `ODDS_PROVIDER=demo`
  ou simplesmente não configure `THE_ODDS_API_KEY`. A interface funciona
  normalmente com dados fictícios e exibe claramente o selo **MODO DEMO**.
- **API real ([The Odds API](https://the-odds-api.com/)):** crie uma conta,
  gere uma chave e preencha:

  ```
  ODDS_PROVIDER=theoddsapi
  THE_ODDS_API_KEY=sua_chave_aqui
  ODDS_REGION=eu
  ```

A chave nunca é enviada ao frontend — todo o acesso à API externa acontece
em `app/api/*` (backend / Route Handlers do Next.js). **Nunca** use
`NEXT_PUBLIC_THE_ODDS_API_KEY` — qualquer variável `NEXT_PUBLIC_*` é
embutida no bundle do navegador e ficaria pública.

A The Odds API não tem um "sport key" único que cubra todo o futebol —
cada campeonato é uma chave própria. O provider (`lib/providers/odds/theOddsApiProvider.ts`)
consulta em paralelo uma lista curada de campeonatos (Premier League, La Liga,
Serie A, Bundesliga, Ligue 1, Brasileirão, Champions League) e junta os
resultados. Uma liga fora de temporada ou com falha pontual não derruba a
tela — só um erro sistêmico (chave inválida, rate limit, rede indisponível
em todas as ligas) é reportado como erro visível na UI.

## 3. Configuração do banco de dados

- **LOCAL (padrão):** SQLite em arquivo, via `better-sqlite3`. Não precisa
  configurar nada — funciona automaticamente com `DATABASE_PATH`.
- **PRODUÇÃO:** Postgres (Supabase), via `DATABASE_URL`. Quando essa
  variável está definida, a aplicação usa Postgres em vez de SQLite,
  automaticamente (`lib/db/index.ts`).

### Configurar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) (ou use um
   existente).
2. Rode a migration abaixo no SQL Editor do painel do Supabase (mesmo
   schema usado no SQLite, adaptado para Postgres):

   ```sql
   CREATE TABLE IF NOT EXISTS settings (
     id integer PRIMARY KEY CHECK (id = 1),
     bankroll numeric NOT NULL,
     stake_percent numeric NOT NULL,
     max_stake numeric NOT NULL,
     profit_target numeric NOT NULL,
     min_probability numeric NOT NULL,
     min_odd numeric NOT NULL,
     max_odd numeric NOT NULL,
     max_legs_multiple integer NOT NULL
   );

   CREATE TABLE IF NOT EXISTS entries (
     id text PRIMARY KEY,
     created_at timestamptz NOT NULL,
     type text NOT NULL,
     description text NOT NULL,
     odd numeric NOT NULL,
     implied_probability numeric NOT NULL,
     model_probability numeric NOT NULL,
     edge numeric NOT NULL,
     expected_value numeric NOT NULL,
     score numeric NOT NULL,
     stake numeric NOT NULL,
     potential_return numeric NOT NULL,
     potential_profit numeric NOT NULL,
     status text NOT NULL DEFAULT 'pending',
     settled_at timestamptz,
     profit_loss numeric,
     raw jsonb NOT NULL
   );

   INSERT INTO settings (id, bankroll, stake_percent, max_stake, profit_target, min_probability, min_odd, max_odd, max_legs_multiple)
   VALUES (1, 100, 2, 20, 10, 0.40, 1.30, 6.0, 3)
   ON CONFLICT (id) DO NOTHING;
   ```

3. Pegue a connection string em **Project Settings → Database → Connection
   string → URI**, modo **Transaction pooler** (porta 6543 — necessário
   para ambientes serverless como a Vercel, que não suportam conexões
   diretas de longa duração):

   ```
   postgresql://postgres.<project-ref>:<db-password>@aws-0-<region>.pooler.supabase.com:6543/postgres
   ```

4. Cole essa string em `DATABASE_URL` no `.env.local` (local) ou nas
   variáveis de ambiente do projeto na Vercel (produção).

**Nunca** commite essa string — ela contém a senha do banco. Ela só deve
existir em `.env.local` (gitignored) ou nas env vars da plataforma de
deploy.

## 4. Variáveis de ambiente

| Variável            | Obrigatória | Descrição                                             |
|---------------------|-------------|--------------------------------------------------------|
| `ODDS_PROVIDER`     | não         | `demo` (padrão) ou `theoddsapi`                        |
| `THE_ODDS_API_KEY`  | só p/ API real | Chave da The Odds API (server-side apenas)         |
| `ODDS_REGION`       | não         | Região de bookmakers (`eu`, `uk`, `us`, `au`)          |
| `DATABASE_PATH`     | não         | Caminho do arquivo SQLite local (padrão `./data/sports-operator.db`), usado quando `DATABASE_URL` não está definida |
| `DATABASE_URL`      | só em produção | Connection string Postgres/Supabase. Quando definida, substitui o SQLite |

## 5. Execução (desenvolvimento)

```bash
npm run dev
```

Acesse `http://localhost:3000`. Sem `DATABASE_URL` configurada, usa SQLite
local automaticamente.

## 6. Build de produção

```bash
npm run build
npm start
```

## 7. Instalação como aplicativo (PWA)

Com o app rodando (`npm run build && npm start` ou `npm run dev`), abra no
Chrome/Edge e use "Instalar aplicativo" na barra de endereço, ou o menu
"Adicionar à tela inicial" no celular. O app tem `manifest.json` e um
service worker básico (`public/sw.js`) para permitir a instalação.

## 8. Estrutura do projeto

```
sports-operator/
  app/
    api/
      games/route.ts          Busca jogos + odds do dia (via provider)
      opportunities/route.ts  Aplica motor de análise e filtros
      settings/route.ts       GET/PUT das configurações do usuário
      entries/route.ts        Lista/cria entradas registradas
      entries/[id]/route.ts   Atualiza status (WIN/LOSS/VOID) ou remove
      export/route.ts         Exporta histórico em CSV
    layout.tsx, page.tsx, globals.css
  components/                 UI (Dashboard, cards, modais, histórico)
  lib/
    providers/odds/
      demoProvider.ts          Dados fictícios (MODO DEMO)
      theOddsApiProvider.ts    Integração real com The Odds API
      errors.ts                Erros tipados (chave inválida, rate limit, timeout, ...)
      index.ts                 Factory: escolhe demo vs. real por env var
    analysis/engine.ts         Motor de análise configurável (inalterado nesta etapa)
    db/
      types.ts                 Interface PersistenceAdapter
      sqliteAdapter.ts          Implementação SQLite (local)
      postgresAdapter.ts        Implementação Postgres/Supabase (produção)
      index.ts                  Factory: escolhe SQLite vs. Postgres por DATABASE_URL
    stats.ts                   Cálculo de ROI, yield, drawdown, etc.
    types.ts                   Tipos compartilhados
  public/                     manifest.json, ícone, service worker
  data/                       Banco SQLite local (gitignored)
```

## Sobre a probabilidade

O sistema sempre mostra **duas probabilidades separadas**:

- **Probabilidade implícita**: derivada diretamente da odd (`1 / odd`,
  removendo a margem da casa quando há mercado completo disponível).
- **Probabilidade estimada pelo modelo**: estimativa do motor de análise
  configurável. Não é uma predição de ML treinada nesta V1 — é uma
  heurística transparente baseada nas odds "justas" do mercado, ajustada
  por um fator de confiança configurável. **Nunca é exibida como garantia
  de resultado.**

## Múltiplas

A V1 permite combinar 2 ou 3 seleções, mas **apenas de jogos diferentes**.
Seleções do mesmo jogo são consideradas correlacionadas e o sistema nunca
monta uma múltipla nessas condições, pois a multiplicação simples de
probabilidades seria matematicamente incorreta.

## Segurança

- Chaves de API e connection strings só existem no backend (`.env.local`,
  nunca commitado) — `THE_ODDS_API_KEY` e `DATABASE_URL` nunca usam prefixo
  `NEXT_PUBLIC_*` e nunca são lidas em código de cliente.
- Respostas de APIs externas são validadas campo a campo antes de uso
  (`theOddsApiProvider.ts`), incluindo tratamento explícito de: timeout
  (12s via `AbortController`), rate limit (HTTP 429), chave inválida
  (HTTP 401), resposta não-JSON, formato inesperado, API indisponível
  (outros status) e "nenhum jogo encontrado" (array vazio — não é erro).
- Inputs de configuração são validados no backend antes de gravar no banco.
- Consultas ao Postgres usam parâmetros (`$1, $2, ...`), nunca concatenação
  de string — sem risco de SQL injection.
- Nenhuma credencial de casa de apostas é solicitada ou armazenada.
- Sem login: aplicação de uso pessoal e local.
- MODO DEMO e DADOS REAIS nunca se misturam silenciosamente: o campo
  `demo` na resposta da API reflete sempre o provider realmente usado, e
  uma falha na API real nunca faz a aplicação cair para dados fictícios
  sem avisar — o erro é mostrado explicitamente na UI.

## Limitações / V2 (TODO)

- Modelo de probabilidade continua heurístico (odds-based) nesta etapa,
  **inalterado** — não é um modelo estatístico treinado (Poisson/xG).
  Ponto de extensão isolado em `lib/analysis/engine.ts`.
- Sem gráficos ainda (evolução de banca, curva de drawdown visual).
- Sem suporte a múltiplos esportes (V1 é só futebol).
- A lista de campeonatos consultados na The Odds API é curada manualmente
  (`FOOTBALL_LEAGUE_KEYS` em `theOddsApiProvider.ts`) — não há descoberta
  automática de todas as ligas de futebol disponíveis na API.
- Filtros avançados (por campeonato, por horário) ficam para V2.
- Conexão real do adapter Postgres com o Supabase provisionado ainda
  **não foi testada de ponta a ponta** nesta sessão (a senha do banco não
  é exposta por ferramentas de automação, por segurança) — teste local
  com sua `DATABASE_URL` antes de confiar em produção.
