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
| `SPORTS_DATA_PROVIDER` | não | `demo` (padrão, histórico sintético) ou `footballdata` |
| `FOOTBALL_DATA_API_KEY` | só p/ dados reais | Chave da football-data.org (necessária para `SPORTS_DATA_PROVIDER=footballdata`) |

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

## Motor quantitativo (`football-v1`)

A partir desta etapa, o sistema **não usa mais `1/odd` como probabilidade
própria**. O motor de análise (`lib/analysis/`) é organizado assim:

```
lib/analysis/
  models/footballV1.ts   Modelo Dixon-Coles (Poisson ajustado)
  markets.ts              Resolução de mercado -> probabilidade (compartilhado com o backtest)
  scoring/score.ts         Fórmula de score e de confiança, documentadas
  calibration/calibration.ts  Brier score, log loss, accuracy, curva de calibração
  backtest/backtest.ts     Backtest walk-forward, sem data leakage
  engine.ts                Orquestra tudo: gera Opportunity[] e NoBetReport[]
lib/providers/sportsdata/  Adapter de dados históricos (demo sintético + football-data.org)
```

**Modelo:** Dixon-Coles (Poisson ajustado). Estima força de ataque/defesa de
cada time (mandante e visitante separadamente) a partir de gols marcados e
sofridos em partidas históricas, com peso decrescente por tempo (meia-vida
de 60 dias, para capturar forma recente). Sobre isso, aplica a correção
Dixon-Coles para o viés conhecido do Poisson puro em placares baixos
(0-0, 1-0, 0-1, 1-1). A partir da matriz de probabilidades de placar,
deriva-se 1X2, Over/Under e Ambas Marcam.

**Por que Dixon-Coles e não outra abordagem:** ao contrário de Elo (só dá
vitória/empate/derrota) ou regressão logística (exigiria um dataset grande
e rotulado que não temos), Dixon-Coles modela gols diretamente — cobrindo
os três mercados da V1 — com um método de estimação simples e explicável.

**Simplificação assumida (limitação documentada):** a força de ataque/defesa
é estimada por médias ponderadas (não por máxima verossimilhança completa),
e o parâmetro de correlação de placares baixos (ρ) é fixo, não ajustado aos
seus dados. Ambos são pontos de evolução natural para `football-v2`.

**Probabilidade de mercado vs. probabilidade do modelo:** toda oportunidade
guarda os dois valores separadamente (`marketProbability` = odd de-vigada,
usada só como benchmark; `modelProbability` = saída independente do
Dixon-Coles), além de `edge`, `expectedValue`, `confidence` e `modelVersion`.
Nenhuma delas é apresentada como garantia de resultado.

**Confiança** nunca é "alta" automaticamente por uma probabilidade alta —
exige amostra suficiente, dados não-sintéticos, edge real e evidência de
calibração (ver `lib/analysis/scoring/score.ts` para a lógica exata).

**NO BET:** quando nenhuma seleção de um jogo passa nos filtros (edge,
probabilidade mínima, faixa de odd, amostra insuficiente), o motor retorna
um `NoBetReport` com os motivos específicos por mercado — nunca força uma
recomendação.

### Dados históricos: o que falta

A API de odds (The Odds API) só fornece jogos futuros + preços atuais —
**não fornece placares históricos**, que são o insumo do modelo. Por isso:

- **Modo demo (padrão):** `lib/providers/sportsdata/demoSportsDataProvider.ts`
  gera histórico **sintético** (determinístico, mesmas equipes do modo demo
  de odds). Serve só para validar o pipeline — **nunca é evidência de
  performance real**, e a UI mostra isso claramente ("MODELO: HISTÓRICO
  SINTÉTICO").
- **Dados reais:** `lib/providers/sportsdata/footballDataOrgProvider.ts`
  integra de verdade com [football-data.org](https://football-data.org)
  (grátis, 10 req/min, cobre PL/La Liga/Bundesliga/Serie A/Ligue 1/Champions
  League — **não cobre o Brasileirão no tier free**). Ative com:
  ```
  SPORTS_DATA_PROVIDER=footballdata
  FOOTBALL_DATA_API_KEY=sua_chave_aqui
  ```
  Alternativas avaliadas e não implementadas: API-Football (RapidAPI, free
  100 req/dia, cobre Brasileirão) e SportMonks (pago, cobertura completa).

### Backtesting

```bash
npm run backtest:demo
```

Roda o pipeline completo (ratings walk-forward → predição → calibração →
simulação de stake) contra o histórico **sintético**, e imprime Brier
score, log loss, accuracy, ROI e a curva de calibração. Serve para validar
que o código funciona e não vaza dados futuros — **os números não
representam desempenho real** (dataset é fictício).

Para rodar com dados reais, forneça matches históricos reais (via
`footballDataOrgProvider`) e cotações históricas reais de odds — este
projeto **não tem hoje** uma fonte de odds históricas (a API atual só dá
preços correntes); isso é um TODO explícito, não uma funcionalidade oculta.

### Testes

```bash
npm test
```

Cobre: matriz de probabilidades do Dixon-Coles, edge/EV/stake (incluindo o
exemplo exato do enunciado: banca R$5, stake 100%, odd 1,5 → lucro R$2,50),
a regra "nunca alta confiança automática", e o guard anti-data-leakage do
backtest (dado um jogo "envenenado" no futuro, os registros de jogos
anteriores não podem mudar).

## Sobre a probabilidade

O sistema sempre mostra **duas probabilidades separadas**:

- **Probabilidade de mercado**: de-vigada a partir da odd (remove a margem
  da casa), usada como **benchmark/feature**, nunca como a estimativa
  própria do modelo.
- **Probabilidade estimada pelo modelo**: saída do Dixon-Coles
  (`football-v1`), calculada inteiramente a partir de histórico de gols —
  estruturalmente incapaz de ser `1/odd` disfarçado (as funções do modelo
  nem recebem a odd como parâmetro). **Nunca é exibida como garantia de
  resultado.**

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

- **Estimador não é MLE completo**: força de ataque/defesa vem de médias
  ponderadas, e ρ (correlação de placar baixo) é fixo — não ajustado aos
  seus dados. `football-v2` deveria reestimar isso via otimização numérica
  quando houver histórico real suficiente.
- **Sem fonte de odds históricas**: o backtest só simula ROI/EV contra
  odds sintéticas (modo demo). Para medir performance real, é preciso
  integrar um provedor de odds históricas (não avaliado nesta etapa).
- **Brasileirão sem cobertura real**: football-data.org (grátis) não inclui
  o Brasileirão; precisaria de API-Football ou SportMonks (pagos/limitados).
- **Casamento de nomes de times** entre provedores é best-effort
  (normalização simples) — pode falhar silenciosamente para grafias muito
  diferentes, resultando em NO BET por "não foi possível casar times"
  (comportamento seguro, mas não é 100% robusto).
- **Calibração ainda sem evidência real**: `MIN_SAMPLES_FOR_CALIBRATION_CLAIM = 100`
  amostras reais não foi atingido nesta etapa — por isso a confiança nunca
  chega a "alta" fora de testes sintéticos controlados.
- Sem gráficos ainda (evolução de banca, curva de calibração visual).
- Sem suporte a múltiplos esportes (V1 é só futebol).
- Filtros avançados (por campeonato, por horário) ficam para V2.
- Conexão real do adapter Postgres com o Supabase provisionado foi
  validada nesta sessão via sandbox de teste (CRUD completo funcionando em
  produção) — ver histórico do projeto para detalhes.
