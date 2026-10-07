# Fidelize — SaaS de pontos para restaurantes

Next.js 15 (App Router) · React 19 · Tailwind 3 · Prisma 6 · PostgreSQL · Stripe (assinatura de R$ 197,00/mês).
Design **Liquid Glass** azul/branco (`src/app/globals.css`, `tailwind.config.js`).

## Rodando localmente

```bash
cd fidelidade-saas
cp .env.example .env        # preencha DATABASE_URL e SESSION_SECRET
npm install
npx prisma db push          # cria as tabelas
npm run dev                 # http://localhost:3000
npm test                    # CPF, telefone, dinheiro e cálculo de pontos
```

Com `PAYMENT_PROVIDER=mock` (apenas dev) o checkout é simulado em `/pagamento/simulado`.
Para produção use `PAYMENT_PROVIDER=stripe`, crie um preço recorrente de R$ 197,00 e aponte o
webhook para `/api/webhooks/stripe` (eventos `checkout.session.completed`,
`customer.subscription.updated`, `customer.subscription.deleted`).

## Deploy (Vercel + Supabase)

- **Vercel**: projeto `fidelize` (diretório raiz `fidelidade-saas`, framework Next.js). Variáveis: `DATABASE_URL`, `SESSION_SECRET` (produção e preview) e `PAYMENT_PROVIDER=mock` (**somente preview**). Em produção o pagamento simulado é bloqueado pelo código; defina `PAYMENT_PROVIDER=stripe` + chaves do Stripe antes de publicar.
- **Banco**: projeto Supabase `fidelize` (sa-east-1). O app usa o usuário `fidelize_app` (dono das tabelas) pelo pooler em modo transação (`:6543`, `?pgbouncer=true&connection_limit=1`). As tabelas têm RLS ligado e sem acesso para `anon`/`authenticated`, então a API pública do Supabase não expõe nada.
- **Migrations**: `prisma/migrations/0001_init` já foi aplicada no banco. Para usar `prisma migrate deploy` a partir de uma máquina com acesso ao banco, registre a baseline uma vez: `npx prisma migrate resolve --applied 0001_init`.

## Telas

| Rota | Quem | O que faz |
| --- | --- | --- |
| `/` | Restaurante | Landing + cadastro (nome, e-mail, telefone, senha) → pagamento |
| `/dashboard/configuracoes` | Restaurante | Onboarding: dados, conversão, limite/CPF, interações, produtos |
| `/dashboard/caixa` | Restaurante | Valor + interações → pontos → QR Code, WhatsApp e link |
| `/dashboard/clientes` | Restaurante | Lista de clientes (busca por nome/CPF/telefone) e, por cliente, saldo, pontos recebidos/usados, produtos resgatados e histórico com dia e horário |
| `/dashboard/pontos` | Restaurante | Pontos emitidos por mês: quem recebeu, quanto, quando e por quê |
| `/dashboard/resgates` | Restaurante | Valida o código do prêmio no balcão; histórico de resgates do mês |
| `/lugares` | Cliente | Vitrine de restaurantes: busca, filtros (onde tenho pontos, abertos agora, com desafios), categorias e ordenação por distância usando a localização do aparelho |
| `/lugar/[id]` | Cliente | Página do restaurante: ações que dão pontos (check-in por GPS, story, avaliação no Google, indicação), prêmios com progresso, desafios da casa, horários e "como chegar" |
| `/lugar/[id]/premios` | Cliente | Sacola de prêmios: monta o resgate com o saldo e retira no balcão |
| `/perfil` | Cliente | Dados, links de convite por restaurante e histórico de pontos |
| `/convite/[id]/[codigo]` | Cliente | Cadastro pelo link de um amigo (o amigo ganha pontos na 1ª compra de quem entrou) |
| `/r/[token]` | Cliente | Lê o QR, entra com CPF + telefone e recebe os pontos |
| `/carteira`, `/carteira/[id]` | Cliente (PWA) | Saldo, histórico, vouchers e catálogo de prêmios |

## Clube: desafios, check-in e indicação

- **Desafios da casa** (`Challenge`): "N compras (com valor mínimo) por semana/mês" ou "N check-ins". O bônus é concedido na própria transação que credita a compra/check-in e só uma vez por cliente em cada período (`ChallengeCompletion` único por desafio + cliente + período).
- **Check-in**: o navegador envia a localização e o servidor confere a distância até o restaurante (raio de 200 m), 1 por dia. Localização enviada pelo cliente pode ser simulada por quem sabe mexer no navegador; o risco é limitado (poucos pontos, 1 por dia) e ajustável pelo dono (0 desliga).
- **Indicação**: o amigo se cadastra pelo link; quem indicou só recebe na **primeira compra real** (valor > 0) do amigo. Quem já é cliente não gera indicação.
- **Fotos** (logo, capa, prêmios): reduzidas no navegador (≈100 KB) e guardadas no banco (`Image`), servidas por `/api/imagem/[id]` com cache imutável.
- **Google**: o dono cola o link de avaliação do Google Meu Negócio (ou o Place ID) e a localização é capturada pelo GPS do aparelho. Busca de endereço/Place automática exigiria uma chave da Google Maps Platform (ainda não configurada).

## Decisões de segurança / regras de negócio

- Pontos são **calculados no servidor** com as regras do banco e gravados no `Claim`; o QR só carrega um token aleatório (192 bits). A prévia no caixa é só visual.
- QR de **uso único** (update condicional atômico) e validade de 24h. A página `/r/[token]` apenas lê; o crédito é um POST explícito, para que pré-visualizadores de link não consumam o QR.
- Resgate trava a carteira (`SELECT … FOR UPDATE`) e verifica saldo e limite mensal por CPF (mês em America/Sao_Paulo) na mesma transação.
- Senhas com bcrypt; sessões em cookie `httpOnly` assinado (JWT HS256).
- **Rate limit** (tabela `RateLimit`, sem infraestrutura extra): login do restaurante (30/15min por IP, 8/15min por e-mail), login do cliente (30/15min por IP, 8/15min por CPF) e cadastro (10/h por IP).
- ⚠️ Login do cliente por **CPF + telefone** é fraco como autenticação (quem sabe os dois acessa a carteira). Foi mantido por exigência do produto; o rate limit reduz o risco de força bruta, mas antes de produção considere um OTP por WhatsApp/SMS.

## PWA

Manifesto, ícones PNG (`public/`) e service worker (`public/sw.js`, registrado só em produção). O service worker não faz cache de páginas — só mostra uma tela offline —, para o saldo nunca ficar desatualizado.

## Próximos passos sugeridos

OTP por WhatsApp/SMS no login do cliente, e-mail de recuperação de senha, relatórios por período e notificação ao cliente via WhatsApp API.
