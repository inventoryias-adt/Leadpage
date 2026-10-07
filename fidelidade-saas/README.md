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

## Várias unidades

- A **marca** (`Restaurant`) é a conta: assinatura, login, regras de pontos, prêmios, desafios, check-in/indicação, logo e carteiras dos clientes. A **unidade** (`Unit`) tem nome, endereço, horário por dia, localização (GPS) e link de avaliação do Google próprios.
- Pontos valem em qualquer unidade: o cliente ganha em uma e resgata em outra.
- O **caixa** escolhe no topo do painel em qual unidade aquele aparelho está operando (cookie `fz_unit`); compras (`Claim.unitId`), check-ins (`CheckIn.unitId`) e entregas de prêmio (`Redemption.usedUnitId`) registram a unidade. "Pontos emitidos" mostra o total por unidade.
- Cliente: em **Lugares** cada marca mostra a unidade mais perto (e "N unidades"); a página do lugar tem abas por unidade (`?unidade=`); o check-in vale na unidade mais próxima dentro de 200 m; o QR Code e a carteira mostram horário e endereço das unidades.
- Unidade com histórico não é apagada (só desativada) e a marca nunca fica sem unidade ativa. Os campos antigos `address`, `openingSchedule`, `latitude`, `longitude` e `googleReviewUrl` em `Restaurant` são legado (migrados para a primeira unidade) e não são mais usados.

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

## Avisos do cliente

O cliente recebe avisos dentro do app (aba **Avisos**, com bolinha de não lidos no menu): pontos recebidos
(compra, check-in, desafio, indicação) já com a meta do próximo prêmio ("Faltam 50 pontos para Sobremesa" ou
"Agora você já pode resgatar…") e confirmação de resgate. Ficam na tabela `Notification` (migração `0005_avisos`);
abrir a tela marca tudo como lido. Notificação push com o app fechado ainda não existe.

## Endereço da unidade

Cada unidade tem CEP, rua, número, complemento, bairro, cidade e UF (migração `0006_endereco`). O CEP preenche o
resto pelo ViaCEP e "Localizar pelo endereço" define as coordenadas (aproximadas) pelo OpenStreetMap; as duas
consultas são feitas no navegador do dono. O texto exibido ao cliente é montado a partir das partes
(`src/lib/address.ts`). O GPS continua disponível e é mais preciso para o check-in.

## Campanhas de pontos e guia inicial

O dono cria campanhas em **Regras → Campanhas de pontos** (tabela `Promotion`, migração `0007_campanhas_guia`):
multiplicador ("2x") ou pontos extras, com valor mínimo da compra, dias da semana, horário e período (horário de
Brasília). O caixa aplica as campanhas valendo agora só sobre a parte da conta (não sobre interações): vale o maior
multiplicador e os pontos extras somam (`src/lib/promos.ts`). Elas aparecem como cards em "Lugares" e na página do lugar.

Depois do pagamento, um passo a passo em janelas (`OwnerGuide`) abre sozinho no painel até ser concluído ou dispensado
(`Restaurant.guideDoneAt`); o botão "Guia" do topo reabre quando quiser.

## Público das campanhas, relatório e telas vazias

Campanhas podem ser para **todos**, só na **primeira compra** do cliente ou para **quem não compra há N dias**
(`Promotion.audience`, migração `0008_publico_relatorio`). Como só sabemos quem é o cliente quando ele lê o QR Code,
as campanhas por público são aplicadas em `creditClaim` (o caixa grava `Claim.billPoints`, a parte da conta que as
campanhas multiplicam). Cada campanha aplicada vira uma linha em `PromotionUse`, que alimenta o relatório
"Campanhas no mês" em **Pontos** (compras, clientes, pontos extras e vendas por campanha). As telas vazias do painel
usam ilustrações isométricas (`IsoIllustration`, `EmptyState`).

## Painel do estabelecimento e campos sem histórico

O **Início** do painel mostra, para 7/30/90 dias: vendas, ticket médio, pontos emitidos, resgates, clientes novos,
taxa de retorno e pontos em circulação (com variação sobre o período anterior), vendas por dia, mapa de dias e horários
de pico, melhores clientes, prêmios mais resgatados, "Quase lá" e "Para reconquistar" (com atalho de WhatsApp) e ideias
escolhidas pelos números (`src/lib/insights.ts`). **Clientes** tem grupos (Novos, Fiéis, Quase lá, Sumidos) e há
planilhas CSV de clientes e lançamentos (`/dashboard/exportar/[tipo]`, CPF mascarado).

`NoAutofill` (no layout raiz) desliga o histórico de digitação do navegador em todos os campos, inclusive nos que abrem
depois; só senha e o e-mail do login ficam com preenchimento para o gerenciador de senhas.

## Administração da plataforma (`/admin`)

Perfil de administrador separado dos assinantes e dos clientes (tabelas `AdminUser` e `AdminLog`, migração `0009_admin`,
sessão própria `ad_session` de 12 h, conferida no banco a cada requisição). Mostra receita e contas por status, lista e
busca de assinantes, e na ficha de cada um: mudar o status da assinatura (ex.: liberar por Pix ou cortesia), editar dados
e regras, gerar senha temporária, reabrir o guia, anotação interna e "entrar como este assinante" (suporte, 2 h, com faixa
de aviso). Toda ação fica em **Registro**. Não existe cadastro público de administrador: cria-se por convite,
`npm run admin:invite -- email@dominio.com "Nome"` (com `DATABASE_URL` e `APP_URL`), que imprime um link de 48 h e uso
único (só o hash do token fica no banco).

**Novo assinante, cancelar e conta de teste** (migração `0010_conta_teste`): em `/admin/assinantes` o botão
**+ Novo assinante** cria a conta com uma senha temporária mostrada uma única vez. No topo da ficha ficam os botões
**Suspender acesso / Cancelar assinatura / Reativar**, cada um com confirmação e motivo no registro. A opção **Conta de
teste** deixa a conta fora da receita e dos números de assinantes; ela aparece em "Contas de teste" na visão geral, com
atalho **Entrar**, para validar novidades antes de liberar aos clientes. O dono troca a própria senha em
Regras → Minha conta.
