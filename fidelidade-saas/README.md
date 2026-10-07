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

## Telas

| Rota | Quem | O que faz |
| --- | --- | --- |
| `/` | Restaurante | Landing + cadastro (nome, e-mail, telefone, senha) → pagamento |
| `/dashboard/configuracoes` | Restaurante | Onboarding: dados, conversão, limite/CPF, interações, produtos |
| `/dashboard/caixa` | Restaurante | Valor + interações → pontos → QR Code, WhatsApp e link |
| `/dashboard/resgates` | Restaurante | Valida o código do prêmio no balcão |
| `/r/[token]` | Cliente | Lê o QR, entra com CPF + telefone e recebe os pontos |
| `/carteira`, `/carteira/[id]` | Cliente (PWA) | Saldo, histórico, vouchers e catálogo de prêmios |

## Decisões de segurança / regras de negócio

- Pontos são **calculados no servidor** com as regras do banco e gravados no `Claim`; o QR só carrega um token aleatório (192 bits). A prévia no caixa é só visual.
- QR de **uso único** (update condicional atômico) e validade de 24h. A página `/r/[token]` apenas lê; o crédito é um POST explícito, para que pré-visualizadores de link não consumam o QR.
- Resgate trava a carteira (`SELECT … FOR UPDATE`) e verifica saldo e limite mensal por CPF (mês em America/Sao_Paulo) na mesma transação.
- Senhas com bcrypt; sessões em cookie `httpOnly` assinado (JWT HS256).
- ⚠️ Login do cliente por **CPF + telefone** é fraco como autenticação (quem sabe os dois acessa a carteira). Foi mantido por exigência do produto; antes de produção considere um OTP por WhatsApp/SMS e rate limit nas rotas de login.

## Próximos passos sugeridos

Service worker/ícones PNG para instalação PWA completa, rate limit, e-mail de recuperação de senha, relatórios por período e notificação ao cliente via WhatsApp API.
