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
em `app/api/*` (backend / Route Handlers do Next.js).

## 3. Variáveis de ambiente

| Variável            | Obrigatória | Descrição                                             |
|---------------------|-------------|--------------------------------------------------------|
| `ODDS_PROVIDER`     | não         | `demo` (padrão) ou `theoddsapi`                        |
| `THE_ODDS_API_KEY`  | só p/ API real | Chave da The Odds API                              |
| `ODDS_REGION`       | não         | Região de bookmakers (`eu`, `uk`, `us`, `au`)          |
| `DATABASE_PATH`     | não         | Caminho do arquivo SQLite (padrão `./data/sports-operator.db`) |

## 4. Execução (desenvolvimento)

```bash
npm run dev
```

Acesse `http://localhost:3000`.

## 5. Build de produção

```bash
npm run build
npm start
```

## 6. Instalação como aplicativo (PWA)

Com o app rodando (`npm run build && npm start` ou `npm run dev`), abra no
Chrome/Edge e use "Instalar aplicativo" na barra de endereço, ou o menu
"Adicionar à tela inicial" no celular. O app tem `manifest.json` e um
service worker básico (`public/sw.js`) para permitir a instalação.

## 7. Estrutura do projeto

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
    providers/odds/           Adapter de fornecedor de odds (demo + real)
    analysis/engine.ts         Motor de análise configurável
    db.ts                      Acesso ao SQLite local (better-sqlite3)
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

- Chaves de API só existem no backend (`.env.local`, nunca commitado).
- Respostas de APIs externas são validadas campo a campo antes de uso.
- Inputs de configuração são validados no backend antes de gravar no banco.
- Nenhuma credencial de casa de apostas é solicitada ou armazenada.
- Sem login: aplicação de uso pessoal e local.

## Limitações / V2 (TODO)

- Modelo de probabilidade é heurístico (odds-based), não um modelo
  estatístico treinado (Poisson/xG). Ponto de extensão já isolado em
  `lib/analysis/engine.ts`.
- Sem gráficos ainda (evolução de banca, curva de drawdown visual).
- Sem suporte a múltiplos esportes (V1 é só futebol).
- Sem sincronização em nuvem (Supabase); arquitetura já preparada para
  trocar `lib/db.ts` por um adapter Supabase/Postgres futuramente.
- Filtros avançados (por campeonato, por horário) ficam para V2.
