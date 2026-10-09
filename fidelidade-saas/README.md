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
| `/r/[token]` | Cliente | Lê o QR, entra (e-mail e senha) ou cria conta e recebe os pontos |
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
- ⚠️ O cliente entra com e-mail e senha, mas quem já tinha cadastro cria o acesso (ou redefine a senha) provando **CPF + telefone**, credencial fraca: quem sabe os dois consegue. O rate limit reduz o risco de força bruta; o ideal é trocar essa prova por um código enviado por e-mail ou WhatsApp/SMS.

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

## Stripe (assinatura de R$ 197/mês)

Checkout hospedado em modo assinatura, Customer Portal (trocar cartão, faturas, cancelar; botão em Regras → Minha conta) e
webhook em `/api/webhooks/stripe` (`checkout.session.completed`, `customer.subscription.updated|deleted`, `invoice.paid`,
`invoice.payment_failed`). Cobrança recusada suspende o acesso; `invoice.paid` reativa só quem estava inadimplente, sem
desfazer um cancelamento feito pela administração. Variáveis: `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`. Teste sempre com chaves `sk_test_` e o cartão `4242 4242 4242 4242`.

**Gráfico no perfil do cliente** (`/perfil`): pontos ganhos acumulados em Hoje, Ontem, Essa semana (7 dias) e Esse mês, com
pontuações, resgates, saldo e lugares, tudo calculado a partir dos lançamentos reais do cliente (`src/lib/activity.ts`).

## Acesso do cliente final (`/entrar`)

Entrada com **e-mail e senha**; quem ainda não tem conta usa a aba **Criar conta** (nome, CPF, telefone, e-mail e senha — o CPF
segue sendo a identidade, usada no limite de resgates por mês). Quem já tinha cadastro por CPF e telefone usa
**“Crie seu e-mail e senha”**, que confirma CPF + telefone e define o acesso uma única vez (migração `0011_cliente_email_senha`);
o mesmo caminho redefine uma senha esquecida. Senha guardada só como hash (scrypt), limite de tentativas por IP, e-mail e CPF.
Recuperação por e-mail ainda não existe (precisa de um serviço de envio, como o Resend).

## Fotos de produtos e QR Code impresso

- **Foto do produto num passo só** (Regras → Produtos): "Trocar foto" abre a pasta do computador e já salva ao escolher o arquivo;
  "Buscar na web" procura por **nome ou código de barras** no [Open Food Facts](https://world.openfoodfacts.org) (gratuito, sem chave;
  bom para produtos embalados e bebidas) e salva a foto escolhida. O servidor baixa a imagem só de hosts permitidos, até 450 KB
  (`src/lib/product-images.ts`); a rota `/api/imagens/buscar` exige dono logado e limita as buscas.
- **Imprimir o QR Code** (Caixa): botão **Imprimir QR Code** abre o cupom de 80 mm (preto e branco, uma página) com o nome do
  estabelecimento, QR, pontos e validade; funciona na impressora configurada no computador do caixa.

## Gráficos e categorias

- Gráfico de área padrão (`src/components/AreaChart.tsx`): perfil do cliente, início do restaurante (vendas por dia) e visão geral do admin
  (cadastros por dia), com dica imediata ao passar o mouse.
- Categorias novas: Estética e saúde, Pet shop, Farmácia, Serviços, Academia e fitness, Mercado e empório, Moda e acessórios.
  Em **Outros** o estabelecimento descreve o negócio (`categoryOther`, migração `0012_categoria_outros`); os clientes acham por esse
  texto em Lugares → Outros. O botão "Fale com o suporte" abre o WhatsApp do número definido em `SUPPORT_WHATSAPP` (só dígitos com DDI).

## Produtos com valor, fotos, recuperação de senha e cupom

- **Produto "R$ + pontos"** (Regras → Produtos): valor em R$ opcional (`Reward.cashCents`, migração `0013_premio_com_valor`). O cliente vê "R$ 8,00 + 300 pts",
  o voucher manda pagar o valor no balcão e a tela de resgates do dono mostra "Cobrar R$ …". Produtos podem ser **editados** (nome, pontos, valor, descrição);
  resgates antigos mantêm o preço da época.
- **Busca de foto**: por nome (normaliza "Coca-Cola 350 ml") ou código de barras; prefere a foto da Bluesoft (fundo branco) e cai para o Open Food Facts.
- **Recuperação de senha por e-mail** (clientes em `/entrar` e donos em `/login/esqueci`; migração `0014_redefinir_senha`): link de uso único, vale 1 hora, só o hash
  do token fica no banco, a resposta é igual exista o e-mail ou não. Envio pelo Resend: `RESEND_API_KEY` e `EMAIL_FROM`. Com e-mail configurado, quem já tem senha
  não a redefine mais só com CPF + telefone. Em desenvolvimento, `DEV_MAIL_FILE` grava as mensagens em arquivo.
- **Cupom impresso**: nome do estabelecimento, QR, pontos, cliente (opcional), data e valor da compra, centralizado na página.

## Busca de fotos (Bluesoft), horários compactos e ícone

- **Busca de foto por nome e por código**: com `COSMOS_TOKEN` (gratuito, API da [Bluesoft Cosmos](https://cosmos.bluesoft.com.br)) o nome
  vira código + foto da base brasileira (fundo branco) e o código vira nome + foto; o Open Food Facts complementa. Sem o token funciona só
  com o Open Food Facts e a foto pública da Bluesoft. O Open Food Facts limita ~10 buscas/min por IP, por isso são poucas chamadas.
  Falha de fonte **não vira "nenhum resultado"**: a tela mostra o motivo ("Open Food Facts respondeu 503…") e o servidor registra em log.
  A rota tem `maxDuration = 30` e as respostas da Bluesoft são cacheadas por 24 h (a cota depende do plano da conta Cosmos; confira na área do usuário).
- **Horário de funcionamento** (Regras → Unidades): uma linha por dia — nome, abre, fecha, "Fechado" e "Copiar p/ todos" — alinhadas em
  coluna; no celular o nome e as ações ficam numa linha e os horários na de baixo.
- **Ícone/logo**: ícone quadrado de fundo cheio (sem borda branca) em `src/app/favicon.ico`, `src/app/icon.svg` e `public/icon-48/96/192/512.png`
  (múltiplos de 48 px, o que o Google exige para mostrar o favicon nos resultados), `apple-touch-icon.png` e `src/app/opengraph-image.tsx`
  (imagem 1200×630 dos links compartilhados). `metadataBase` usa `APP_URL`. O Google e o WhatsApp guardam o ícone/prévia em cache: pode levar
  dias para atualizar (Search Console → Inspeção de URL → Solicitar indexação acelera).

## Adicionar à tela inicial (PWA)

- `InstallApp` (`src/components/InstallApp.tsx`) mostra um cartão "Tenha o Fidelize na tela inicial" **só quando o acesso é pelo celular** e o app ainda não está
  instalado. Aparece em `/entrar` e no início da carteira do cliente.
- **Um toque só**: o botão "Adicionar à tela inicial" já faz a ação. No **Android/Chrome** abre direto o instalador do sistema (evento `beforeinstallprompt`,
  guardado por um script em `layout.tsx` porque o Chrome o dispara antes de o React carregar; exige manifesto + service worker, ativos em produção).
- **iPhone/iPad** (e navegadores sem instalador): o iOS não permite instalar por código, então o mesmo toque abre na hora um guia de 3 passos
  (Compartilhar → "Adicionar à Tela de Início" → Adicionar), com seta apontando a barra do Safari. Em navegadores embutidos (Instagram, Facebook…) orienta a abrir no Safari/Chrome.
- **Ícones com versão** (`?v=2` no manifesto e nos `<link>`): quem instalou antes mantém o ícone antigo no celular até remover o atalho e adicionar de novo
  (iPhone grava a imagem na hora de adicionar; Android atualiza por conta própria em alguns dias). Ao trocar o ícone de novo, suba o `v`.
- "Agora não" esconde o cartão por 14 dias (o guia fecha em "Entendi" e o cartão continua); depois de instalado (ou se já abriu como app) nunca mais aparece. Detecção em `src/lib/install-app.ts` (testada).

## Prévia do link e pop-up de instalação (primeira visita)

- **Prévia ao compartilhar** (WhatsApp, redes): `src/app/opengraph-image.tsx` desenha o logo **centralizado** (o WhatsApp mostra miniatura quadrada com corte central, então tudo fica
  no quadrado do meio) e os textos são genéricos para qualquer estabelecimento ("Programa de pontos para o seu negócio"). O WhatsApp guarda a prévia por link: links já enviados antes
  mostram a antiga por um tempo; para testar, envie um link novo (ex.: `...vercel.app/lugares?v=2`).
- **Pop-up de instalação**: na **primeira visita** de cada aparelho (celular, app ainda não instalado) abre um pop-up no meio da tela ("Instale o Fidelize no seu celular") com um toque para
  adicionar. Se a pessoa recusar, o pop-up não volta e fica o cartão no topo (em todas as telas do cliente, via `src/app/(cliente)/layout.tsx`, e em `/entrar`); o "Agora não" do cartão o esconde por 14 dias.
- O pop-up da primeira visita **ignora** o "Agora não" antigo do cartão (só o app instalado o impede). Para reabri-lo num aparelho (teste ou ajudar alguém), acrescente `?instalar` ao endereço,
  ex.: `https://fidelize-nu.vercel.app/entrar?instalar`.
