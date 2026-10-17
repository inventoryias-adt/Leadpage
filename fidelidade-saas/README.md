# Fidelize — SaaS de pontos para restaurantes

Next.js 15 (App Router) · React 19 · Tailwind 3 · Prisma 6 · PostgreSQL · Stripe (assinatura de R$ 69,90/mês).
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
Para produção use `PAYMENT_PROVIDER=stripe`, crie um preço recorrente de R$ 69,90 e aponte o
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
- Cliente: em **Lugares** cada marca mostra a unidade mais perto (e "N unidades"); a página do lugar tem abas por unidade (`?unidade=`); o check-in vale na unidade mais próxima, só estando dentro da loja (10 m do ponto marcado); o QR Code e a carteira mostram horário e endereço das unidades.
- Unidade com histórico não é apagada (só desativada) e a marca nunca fica sem unidade ativa. Os campos antigos `address`, `openingSchedule`, `latitude`, `longitude` e `googleReviewUrl` em `Restaurant` são legado (migrados para a primeira unidade) e não são mais usados.

## Clube: desafios, check-in e indicação

- **Desafios da casa** (`Challenge`): "N compras (com valor mínimo) por semana/mês" ou "N check-ins". O bônus é concedido na própria transação que credita a compra/check-in e só uma vez por cliente em cada período (`ChallengeCompletion` único por desafio + cliente + período).
- **Check-in**: o navegador envia a localização e o servidor confere se a pessoa está dentro da loja (raio de **10 m** por padrão do ponto da unidade; **cada estabelecimento escolhe o seu** em Regras → "Check-in e indicação de amigos", num **controle deslizante** de 10 a 500 m (10, 20, 30, 50, 75, 100, 150, 200, 300, 400, 500): coluna `Restaurant.checkInRadiusM`, escala em `CHECKIN_RADIUS_OPTIONS` em `src/lib/geo.ts`, migration `0025_raio_do_checkin`), 1 por dia. **O app nunca mostra o raio nem a distância**: a recusa diz só "não foi possível confirmar que você está no estabelecimento", para ninguém ir calibrando a posição até a borda. O botão acompanha o GPS por até 10 s (para antes se a leitura já está boa ou para de melhorar por 4 s), usa a melhor leitura e **manda também a margem de erro dela; quem decide se ela basta é o servidor** (`maxAcceptedAccuracyM`): a margem aceita é no mínimo 50 m e acompanha o raio escolhido (num raio de 200 m aceita até ±200 m). Antes o botão recusava qualquer leitura pior que 50 m, e um computador (que acha a posição pelo Wi-Fi, com centenas de metros de margem) nunca conseguia fazer check-in, mesmo com raio grande. Leitura boa demais para o raio mas fora dele = "não foi possível confirmar"; dentro do raio mas imprecisa demais = "sinal de GPS fraco" (sem números). O ponto da unidade em Regras precisa ser exato. Localização enviada pelo cliente pode ser simulada por quem sabe mexer no navegador; o risco é limitado (poucos pontos, 1 por dia) e ajustável pelo dono (0 desliga).
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

## Stripe (assinatura de R$ 69,90/mês)

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
- **Pop-up para adicionar à tela inicial**: na **primeira visita** de cada aparelho (celular, app ainda não instalado) abre um pop-up no meio da tela ("Adicione o Fidelize à tela inicial do seu celular") com um toque para
  adicionar. Se a pessoa recusar, o pop-up não volta e fica o cartão no topo (em todas as telas do cliente, via `src/app/(cliente)/layout.tsx`, e em `/entrar`); o "Agora não" do cartão o esconde por 14 dias.
- O pop-up da primeira visita **ignora** o "Agora não" antigo do cartão (só o app instalado o impede). Para reabri-lo num aparelho (teste ou ajudar alguém), acrescente `?instalar` ao endereço,
  ex.: `https://fidelize-nu.vercel.app/entrar?instalar`.

## App do cliente: Início, Perfil e pontos compartilhados

- **Cartão de instalação fixo**: "Agora não" não esconde nada, só **comprime** o cartão numa tira fina com uma seta para baixo (`COLLAPSE_KEY`); tocar na tira abre o cartão de novo e o botão
  "Adicionar à tela inicial" instala (Android) ou abre o guia (iPhone). Só some quando o app está instalado.
- **Início** (`/carteira`): Olá → **Suas carteiras** (carrossel horizontal, escala para muitos lugares, com total de pontos) → dicas de uso ("Já usou seus pontos hoje?", "Falta pouco" com o
  prêmio mais próximo, "Veja o que te espera em Lugares") → **Prêmios para retirar** (3 e "Ver todos") → **Você pode resgatar agora** (carrossel e "Ver todos"). As consultas ficam em `src/lib/customer-rewards.ts`.
- **Perfil** (`/perfil`): gráfico de pontos e dois atalhos — **Histórico de pontos** (`/perfil/pontos`, filtro por lugar, 100 mais recentes) e **Meus prêmios** (`/perfil/premios`, abas
  *Para retirar*, *Posso resgatar* e *Já resgatados*, com lugar, unidade e data da entrega).
- **Pontos compartilhados** (migration `0015_pontos_compartilhados`): em Regras → "Pontos compartilhados" cada estabelecimento liga/desliga `pointsShareOut` ("meus pontos valem em outros
  lugares") e `pointsAcceptIn` ("aceito pontos de outros lugares"), ambos desligados por padrão. No Perfil o cliente vê cada carteira como *Compartilhada* ou *Individual* e a lista de lugares
  que aceitam pontos de outros. **A troca de pontos entre lugares ainda não está ativa**: falta definir a regra de conversão e de quem arca com o prêmio.

## Piloto: suporte, e-mail, termos e Stripe real

- **Suporte**: o **e-mail é o canal principal** (`SUPPORT_EMAIL`) e o WhatsApp (`SUPPORT_WHATSAPP`) complementa. Aparecem juntos nos avisos de erro (assinatura, categoria), nos Termos e na Privacidade,
  sempre com assunto e mensagem prontos (`src/lib/support.ts`, `src/components/SupportLinks.tsx`). Trocar para um e-mail com domínio próprio é só mudar a variável.
- **E-mail de recuperação de senha** (`src/lib/mailer.ts`): **SMTP** (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`) tem prioridade e **não exige domínio** (Gmail com "senha de app":
  `smtp.gmail.com`, porta 465); sem SMTP usa o **Resend** (`RESEND_API_KEY`), que sem domínio verificado só entrega para o e-mail dono da conta. Com domínio próprio, verifique-o no Resend e troque `EMAIL_FROM`.
- **Termos de Uso e Política de Privacidade**: páginas `/termos` e `/privacidade` (texto em `src/app/termos` e `src/app/privacidade`; versão em `src/lib/legal.ts`). Os cadastros (dono, cliente e criação de
  acesso do cliente antigo) exigem a caixa "Li e concordo" e gravam `termsAcceptedAt` e `termsVersion` (migration `0016_aceite_termos`). **Ao mudar os textos, mude `TERMS_VERSION`.** `LEGAL_NAME` e
  `LEGAL_CNPJ` (opcionais) passam a aparecer nos documentos. Os textos são um modelo para o piloto: peça revisão a um advogado antes de escalar.
- **Pedido de exclusão de dados (LGPD)**: hoje por e-mail/WhatsApp ao suporte (descrito na Política); a exclusão é feita pelo administrador.
- **Virada para o Stripe real** (hoje tudo está em modo de teste; contas de teste/piloto são ativadas pelo painel de administração, sem cobrança):
  1. Ativar a conta no Stripe (dados do negócio e conta bancária).
  2. Autorizar a conta real na sessão do assistente (Stripe MCP) para recriar produto, preço (R$ 69,90/mês), portal do cliente e webhook em modo real.
  3. Criar a chave secreta real e colocá-la no Vercel (`STRIPE_SECRET_KEY`, Sensitive); atualizar `STRIPE_PRICE_ID` e `STRIPE_WEBHOOK_SECRET` com os valores reais.
  4. Redeploy e **uma compra real de teste** (R$ 197, depois cancelar e pedir o reembolso pelo painel do Stripe).
  Contas antigas com cliente do Stripe de teste (ex.: "Teste Test") mostram o aviso amigável ao abrir o portal: limpe `paymentCustomerId` delas se necessário.

## Roadmap: o Fidelize como ecossistema (visão do dono, ainda não construído)

Objetivo: clientes e estabelecimentos (restaurantes, barbearias, clínicas de estética, serviços…) resolvem tudo na plataforma e o ponto vira o fio condutor, no lugar de várias ferramentas soltas.

1. **Agendamento e reservas**: serviços com duração e preço por estabelecimento, agenda por profissional/unidade, o cliente marca pelo app (restaurantes/bares: reserva e encomenda para dia e hora). Pontos creditados
   automaticamente quando o atendimento é concluído, ou ao pagar pela plataforma.
2. **Pontos como desconto no serviço/produto**: o estabelecimento marca quais itens aceitam desconto em pontos; ao escolher o item, o cliente soma os pontos e vê o valor final já com desconto.
3. **Pagamento antecipado pela plataforma (Pix/cartão)**: o dono habilita o recebimento, o cliente paga adiantado, o ponto cai na hora; no balcão, quem pagou pela plataforma tem o "check" para o dono conferir e dar o ok.
   Fora da plataforma (maquininha/Pix direto) segue o QR Code ou o CPF no caixa.
4. **Pontos compartilhados entre lugares** (flags já existem; falta a regra de conversão e de quem arca com o prêmio).

Decisões em aberto: modelo de recebimento (Stripe Connect com Pix e repasse a cada estabelecimento, taxas e quem assume estorno), conciliação/nota fiscal, política de cancelamento e no-show por estabelecimento, e a ordem de entrega (sugestão: 1 → 2 → 3).

## Agenda e reservas (fase 1 do ecossistema)

- **Cadastro** (Regras → "Agenda e serviços"): serviços (nome, duração, preço, "é reserva de mesa"), **equipe e vagas** (profissional, cadeira ou mesas; "ao mesmo tempo" = capacidade) e regras
  (confirmar automaticamente ou manualmente, antecedência mínima, até quantos dias à frente, até quantas horas antes o cliente cancela). Ao cadastrar o 1º serviço cria a vaga "Atendimento".
  O horário de funcionamento de **cada unidade** (seção Unidades) define quando dá para marcar. Modelos: `Service`, `Resource`, `Booking` (migration `0017_agenda_e_reservas`).
- **Cliente**: na página do lugar, botão **Agendar** → serviço → unidade → dia → horário → confirmar (`/lugar/[id]/agendar`). Reserva de mesa pergunta o número de pessoas. Os horários livres vêm de
  `src/lib/booking.ts` (puro e testado: expediente, madrugada, capacidade, antecedência, escolha do profissional com menos carga). A reserva usa um **cadeado por estabelecimento** no banco, então
  dois clientes nunca pegam o mesmo horário (testado com pedidos simultâneos). **Meus agendamentos** (`/perfil/agendamentos`) lista próximos e anteriores e cancela dentro do prazo; o início mostra o próximo horário.
- **Dono** (`/dashboard/agenda`, aba "Agenda" só aparece com serviços cadastrados, com bolinha de pedidos aguardando): agenda por dia, **Confirmar**, **Concluir**, **Faltou** e **Cancelar** (avisa o cliente).
  **Concluir credita os pontos sozinho** (valor do serviço × pontos por real) reaproveitando o crédito do caixa (`creditClaimWith`): campanhas, indicação e desafios valem igual, a venda entra nos números do
  painel, e fechar duas vezes não credita duas vezes. Serviço sem preço conclui sem pontos.
- Fuso: tudo em Brasília (UTC−3). Pagamento no local por enquanto; **próximas fases**: pontos como desconto no serviço e pagamento antecipado pela plataforma.

## Pontos como desconto no serviço (fase 2 do ecossistema)

- **Regra do estabelecimento** (Regras → Agenda e serviços): "Pontos que valem R$ 1,00 de desconto" (`Restaurant.pointsPerRealOff`, padrão 100 = 1 ponto vale 1 centavo) com a dica de quanto volta
  (ganha X pontos por real ÷ taxa de desconto, ex.: 10 ÷ 100 = 10%). **Por serviço**: "Aceita pontos como desconto" até 10/20/30/50/100% do preço (`Service.pointsDiscountMaxPct`, 0 = não aceita; serviço sem preço não aceita).
- **Cliente**: ao confirmar o horário aparece "Usar meus pontos como desconto" com controle deslizante, "Usar o máximo" e o resumo "Valor do serviço − desconto = A pagar no local".
  Os pontos saem da carteira **na hora** (movimentação "Desconto no agendamento") e o desconto fica no agendamento (`pointsUsed`, `discountCents`). O servidor refaz toda a conta com o saldo travado
  (`src/lib/points-discount.ts`, testado): pedir mais do que o permitido é recusado.
- **Cancelar** (cliente ou dono) **devolve os pontos**, uma única vez (testado com cancelamentos simultâneos). **Faltou** não devolve. Concluir credita os pontos ganhos **sobre o valor realmente pago** (preço − desconto)
  e a venda registrada é o valor pago. O dono vê "a cobrar R$ X (desconto de R$ Y com Z pontos)" na agenda. Migration `0018_pontos_como_desconto`.

## Equipe, agenda por profissional e lembrete (migrations `0019_equipe` e `0020_lembrete`)

- **Equipe** (Regras → Agenda e serviços → "Adicionar profissional ou vaga"): **foto**, nome, **e-mail** e **WhatsApp** do profissional, **dias e horários** próprios (ou "segue o horário da unidade"),
  **quais serviços faz e em quantos minutos** (ex.: corte 45 min com o Lucas, 60 min com a Ana; `ResourceService`). Quem não tem horário próprio segue a unidade.
- **Cliente**: depois de escolher serviço e unidade aparece **"Com quem?"** (foto e nome de quem faz o serviço, ou "qualquer um"). Dias e horários mostram só o que aquele profissional atende, com a duração dele.
- **Aviso à equipe**: cada novo agendamento manda e-mail ao profissional (se tiver e-mail) e ao e-mail padrão do estabelecimento (`Restaurant.bookingNotifyEmail`, senão o e-mail da conta).
- **Agenda por profissional** (`/dashboard/agenda`): filtro por **profissional** e por **período** (Dia, Semana, Mês, Mês passado; setas navegam). Semana e mês aparecem agrupados por dia.
  **Enviar pelo WhatsApp** abre o WhatsApp do profissional (ou a escolha de contato, se ele não tem número) com o texto pronto da agenda do período, sem os cancelados. **Baixar planilha (CSV)**
  (`/dashboard/agenda/exportar`, só dono logado; separador `;`, UTF-8 com BOM para o Excel; células que começam com `=`, `+`, `-` ou `@` são neutralizadas contra injeção de fórmula).
  O envio automático por WhatsApp exige a API oficial (paga); por isso é um clique do gerente com o texto já pronto.
- **Lembrete "está tudo certo?"**: entre 5 e 30 minutos antes de um agendamento **confirmado** o cliente recebe um aviso no app (e e-mail, se tiver) com **"Sim, estarei lá"** e **"Não vou poder ir"**
  (cartão em Meus agendamentos). **Não** cancela e libera o horário (os pontos usados voltam; a equipe é avisada por e-mail). **Sem resposta** mantém o horário e a agenda do dono mostra
  "lembrete enviado, o cliente ainda não respondeu". Quem marca em cima da hora (menos de 30 min) não recebe lembrete. Cada agendamento é lembrado uma única vez, mesmo com chamadas simultâneas.
- **Como roda**: a rota `POST /api/cron/lembretes` (exige `Authorization: Bearer <CRON_SECRET>`) é chamada a cada 5 minutos pelo GitHub Actions (`.github/workflows/lembretes.yml`), porque o cron da Vercel Hobby é só diário.
  **Configuração (uma vez)**: gere um segredo longo, cadastre-o na Vercel como `CRON_SECRET` (Sensitive) e no GitHub em Settings → Secrets and variables → Actions → `CRON_SECRET`; faça redeploy.
  Sem o segredo a rota responde 503 e o workflow acusa erro. Para outro domínio, crie a variável `APP_URL` no GitHub. Observação: o GitHub pode atrasar execuções agendadas em horários de pico; a janela de 5 a 30 minutos absorve isso.
- Ainda não feito: notificação do sistema (push; no iPhone só com o app instalado), pagamento antecipado e reembolso ao cancelar/reagendar.

## Pontos compartilhados em uso (fase 4 do ecossistema, migration `0021_pontos_compartilhados_uso`)

- **Chaves** (Regras → Pontos compartilhados): "pontos daqui valem em outros lugares" (`pointsShareOut`) e "aceito pontos de outros lugares" (`pointsAcceptIn`). Valem para prêmios; desconto em serviço continua só com os pontos do próprio lugar.
- **Como o cliente usa**: na sacola de prêmios de um lugar que aceita (`/lugar/[id]/premios`) aparece **"Completar com pontos de outros lugares (+X pts)"**, com o valor de cada carteira convertido. Só é usado o que faltar,
  começando pelas carteiras que mais rendem. O resgate registra o custo cheio do prêmio; o extrato mostra "Usados em …" (saída na origem) e "Pontos vindos de …" (entrada no destino).
- **Conversão pelo valor** (`src/lib/shared-points.ts`, testado): um ponto vale 1/`pointsPerReal` reais de consumo no lugar. 100 pontos de quem dá 10 por real (R$ 10) valem 50 pontos de quem dá 5 por real. Arredondamento a favor do cliente (alguns pontos no máximo).
- **Sem acerto entre lugares**: o Fidelize não move dinheiro; quem entrega o prêmio arca com ele. Fica como decisão futura se for necessário compensar (ex.: crédito entre lugares).
- **Segurança**: tudo é recalculado no servidor, na mesma transação, com **todas as carteiras do cliente travadas em ordem de id** (resgates simultâneos nunca gastam duas vezes nem se travam entre si; testado com 6 pedidos ao mesmo tempo).
  Só entram carteiras de lugares ativos com a chave ligada; lugar que não aceita ignora a opção.
- **Números do dono**: as conversões são movimentações próprias (`SHARED_OUT` / `SHARED_IN`), por isso **não** entram em "pontos emitidos" nem em "resgatados" (só `EARN` e `REDEEM`).

## Localização do cliente: "Onde está?" (migration `0022_enderecos_do_cliente`)

- **Faixa "Onde está?"** no topo da vitrine (`/lugares`) abre o seletor `LocationPicker` (tela cheia no celular): **Minha localização** (GPS), **Marcar no mapa** e a lista de **endereços salvos** (Casa, Trabalho, Outro). A vitrine ordena do mais perto ao mais longe e mostra a distância de cada lugar.
- **Marcar no mapa**: o pino fica fixo no centro e o cliente arrasta o mapa; a cada parada mostramos a rua e o bairro. **Usar CEP** (ViaCEP + Nominatim) recentraliza o mapa. Depois, **Qual o número?**: rua, número (ou "Sem número" = S/N), complemento e o tipo (Casa, Trabalho, Outro).
  **Salvar endereço** grava na conta (`CustomerAddress`, até 6; Casa e Trabalho têm um só, salvar de novo troca); **Usar sem salvar** vale só neste aparelho. Quem não tem conta usa GPS ou mapa e é convidado a entrar para salvar.
- A escolha fica no aparelho (`localStorage` `fz_loc_v1`, lida com validação: coordenadas fora do Brasil e dados adulterados são descartados). Endereço salvo que foi apagado em outro aparelho deixa de valer. Se o cliente já liberou o GPS e não escolheu nada, a vitrine usa o GPS sozinha. Se ele ignorar o pedido de permissão, o botão libera em 15 s.
- **Servidor**: `saveMyAddress` valida tudo de novo (zod, ponto dentro do Brasil, limite por conta, limite de pedidos); `deleteMyAddress` só apaga o do próprio cliente. Lógica pura e testada em `src/lib/customer-location.ts`.
- **Mapa** (Leaflet): por padrão usa os azulejos públicos do OpenStreetMap, ok para o piloto. **Em produção com muito acesso, use um provedor próprio** (MapTiler, Stadia, Mapbox…) definindo `NEXT_PUBLIC_MAP_TILES` com a URL no formato `https://.../{z}/{x}/{y}.png` (a política do OSM proíbe uso intenso).
  A busca de endereço (reverso e por CEP) usa o Nominatim a partir do navegador do cliente, com a mesma ressalva de uso moderado; para escalar, trocar por um geocodificador pago.
- A vitrine também ganhou o filtro **Em promoção** (lugares com promoção ativa).

## Início e Lugares mais limpos, campanhas do app (migration `0023_campanhas_do_app`)

- **Início** (`/carteira`): só o essencial. "Olá" com o total de pontos, o próximo horário (se houver), o carrossel de **campanhas do app**, **"Seus pontos por lugar"** (um cartão por estabelecimento com selos "N para retirar" e "Pode resgatar"; tocar abre a página do lugar com os códigos e os prêmios)
  e um atalho para explorar lugares. A lista de códigos, o "Você pode resgatar agora" e as dicas saíram do Início.
- **Lugares**: título sozinho (sem frase), faixa "Onde está?", busca que **abre em tela própria** (campo já com o cursor, categorias e resultados; "Ver na lista" aplica a busca), filtros em pílula (incluindo **Em promoção**), categorias **antes** das campanhas e
  **campanhas por lugar**: cada cartão mostra o estabelecimento e quantas campanhas ele tem; tocar abre a janela com as campanhas daquele lugar. Cada lugar da lista também mostra "N campanhas". Chips, filtros e busca ovais.
- **Carrosséis que mostram que deslizam** (`Carousel`): o próximo cartão aparece cortado, uma sombra esmaece a borda, setinha redonda (também no celular, balançando até a primeira rolagem), barrinha de posição e o aviso "Deslize para ver mais" até a primeira rolagem.
- **Campanhas do app**: a plataforma propõe e cada estabelecimento adota ou não.
  - **Administração** (`/admin/campanhas`): cria e edita (nome, descrição, multiplicador ou pontos extras, dias da semana, horário, período, valor mínimo), liga e desliga, e vê quantos estabelecimentos adotaram.
  - **Estabelecimento** (Regras → Campanhas → "Campanhas do app"): **Participar** cria uma promoção dele ligada à campanha (`Promotion.appCampaignId`), então caixa, QR Code, relatórios e cartões da vitrine funcionam como qualquer campanha. **Sair** apaga a promoção.
    Quando o administrador edita, as promoções de quem adotou acompanham; ligar/desligar a campanha liga/desliga as promoções, mas editar **não reativa** o que o dono pausou.
  - **Cliente**: o carrossel do Início só mostra campanhas ativas, dentro do prazo e adotadas por ao menos um lugar da vitrine; tocar abre `/campanhas/[id]` com a descrição, quando vale e a lista de quem participa.

## Preço, CPF no caixa, dois termos, Regras em 6 etapas, landing e logo (migration: nenhuma)

- **Preço R$ 69,90/mês**: constante única em `src/lib/plan.ts` (landing, pagamento, termos). O valor cobrado vem do Stripe (`STRIPE_PRICE_ID`): foi criado um novo Price de R$ 69,90 no mesmo produto (modo de teste) e a variável da Vercel foi trocada. Preços do Stripe não mudam de valor: o antigo (R$ 197) deve ser arquivado depois do deploy.
  **Na virada para o Stripe real, crie o Price de R$ 69,90 na conta real.**
- **Lançar pontos pelo CPF** (Caixa): campo "CPF do cliente". Com 11 dígitos válidos, o caixa vê se já existe conta (nome abreviado, ex.: "Lucas S."). Se existe, "Lançar na conta" credita na hora (`creditByCpf`, mesma regra do QR: campanhas, indicação e desafios valem; o cliente recebe aviso no app).
  Se não existe, o fluxo de QR Code/WhatsApp continua igual. Proteções: consulta limitada por estabelecimento (60 a cada 10 min), lançamentos limitados, e o mesmo lançamento (mesmo cliente e valor) não repete em 20 s.
- **Dois termos de uso**: `/termos/estabelecimento` (quem contrata: assinatura, prêmios, dados dos clientes, lançar por CPF, campanhas do app e pontos compartilhados) e `/termos/cliente` (quem ganha pontos: conta, pontos, resgates, compartilhados, agenda, localização); `/termos` é o índice.
  Cada cadastro aceita o termo certo e cada tela mostra o termo de quem está nela. Versão em `TERMS_VERSION` (`src/lib/legal.ts`): **mude ao alterar os textos**. Os textos são um modelo: peça revisão a um advogado antes de escalar.
- **Regras em 6 etapas** (antes 12): Seu negócio, Ganhar pontos, Prêmios, Agenda, Rede de lugares, Minha conta. Blocos opcionais (check-in e indicação, interações, desafios, campanhas, agenda) abrem sozinhos quando já têm algo configurado; `?abrir=tudo` abre todos.
  "Comece por aqui" mostra o que falta do essencial (logo e categoria, endereço e horário, ao menos um prêmio).
- **Landing**: passo a passo em 4 etapas (inclui lançar por CPF ou QR Code), exemplo numérico, o que o cliente e o dono ganham e dados de fidelização **com fonte e link** (HBR 2014, Bain, McKinsey, ABEMF/TSI 2025, Sebrae). São estudos de terceiros e a página avisa que não são promessa de resultado.
  Confira os links e os números antes de divulgar, e atualize quando saírem pesquisas novas.
- **Logo novo**: "F" marinho geométrico com um ponto final que é uma **moeda azul com cifrão** (o "ponto" do clube), sobre fundo lima. Fontes em `public/logo.svg` e `src/app/icon.svg`; ícones PNG, favicon, ícone mascarável e imagem de compartilhamento regerados. O nome passa a ser escrito em minúsculas ("fidelize").

## Moeda no logo, abertura animada, entradas por rolagem e lima nos pontos-chave (migration: nenhuma)

- **Moeda**: o ponto final do logo é uma moeda azul com um cifrão ($) branco e os dois riscos verticais do cifrão em lima (`LogoMark` e `Coin` em `src/components/Brand.tsx`; mesmo desenho em `public/logo.svg`, `src/app/icon.svg` e `src/app/opengraph-image.tsx`; ícones PNG e favicon regerados).
- **Abertura do app** (`Splash.tsx` + keyframes `splash-*` em `globals.css`, ~2,6 s): fundo marinho com um degradê leve, o símbolo **inteiro** surge no centro da tela com um fade, cresce devagar (zoom suave no logo todo, sem foco na moeda) e o fundo se dissolve para mostrar o app. O símbolo é desenhado 4× maior e reduzido a 25% para o zoom ficar nítido. Toca uma vez por sessão (`sessionStorage fz_splash`) e **não** na landing, nos termos/privacidade e no admin. É pulada com "reduzir movimento" e em navegador automatizado (`navigator.webdriver`, o que protege testes e capturas); `?splash=1` força para testar. A decisão sai de `src/lib/splash-gate.ts`, um script no `<head>` que marca `<html data-splash="off">` antes da primeira pintura. Nunca bloqueia cliques (`pointer-events: none`).
- **Entradas por rolagem** (`Reveal.tsx` + `.rv-*` em `globals.css`): cada bloco entra de um lado (`top`, `bottom`, `left`, `right`, `zoom`, `flip`) quando aparece na tela, escalonado por `delay`. Na landing: o topo cai de cima e o cadastro vem da direita; passos alternam esquerda/direita; fontes em zoom; benefícios do cliente caem e os do dono sobem; a moeda do preço gira. No app do cliente: Início, Lugares e Perfil. Com "reduzir movimento" ou sem JavaScript tudo aparece direto.
- **Lima (`#C6F432`) só em pontos-chave** (cor `lima` no Tailwind, nunca em fundos grandes): botão principal do Caixa e "Montar sacola" (`.glass-button-lime`, `SubmitButton variant="lime"`), aba ativa das barras do celular (`.nav-tab-lime`), selo "Pode resgatar", marca-texto atrás de "N pontos" no Início e de "indica amigos" na landing (`.mark-lime`), saldo em lima no cartão marinho da carteira do lugar, e preço, ícones e botão da seção de preço da landing.
- **"Adicionar à tela inicial"**: em todo o app o convite para pôr o app na tela do celular usa "Adicionar à tela inicial" (não "Instalar"); o guia só cita "Instalar app" como o nome que alguns navegadores dão ao mesmo botão.
- Teste: `e2e30` (abertura, tipos de entrada, reduzir movimento, sem JS, app sem rolagem lateral).

## Categoria salva na hora (migration: nenhuma)

- Em Regras → Identidade da marca, escolher a **categoria** agora salva na hora (`saveCategory` em `src/app/actions/restaurant.ts`), com o aviso "Salvando…" / "✓ Categoria salva" logo abaixo do campo. Em "Outros", o texto do tipo de negócio salva ao sair do campo. O botão "Salvar identidade" continua valendo para logo, capa, Instagram e "Aparecer em Lugares".
- Corrigido: depois de "Salvar identidade" o React 19 reiniciava o formulário e a categoria voltava a "Selecione…" na tela (embora estivesse salva). O formulário agora devolve aos campos o que o dono escolheu depois de cada resposta do servidor.
- Teste: `e2e31`.

## Categoria libera a Agenda (migration: nenhuma)

- A aba **Agenda** do painel passa a aparecer também para categorias que atendem com hora marcada (`suggestsBooking` em `src/lib/categories.ts`: barbearia, estética e saúde, pet shop, serviços, academia), mesmo antes de cadastrar o primeiro serviço. Antes ela só aparecia depois de haver serviços, e trocar a categoria não mudava nada.
- Ao escolher uma dessas categorias em Regras → Identidade da marca, aparece na hora um aviso ao lado do campo com o link "Configurar a agenda" (`?abrir=agenda#agenda`), a seção "Agenda e serviços" vem aberta e marcada como **Recomendado**, e a página da Agenda orienta cadastrar o primeiro serviço.
- Quem tem outra categoria (ex.: restaurante, para reservas de mesa) continua configurando pela seção "Agenda e serviços", que segue como "Opcional".
- Teste: `e2e32`. O `e2e18` passou a achar o botão de remover pelo `aria-label` (o botão virou ícone no PR #44).
- **Sem funcionários cadastrados = um atendente só**: se o estabelecimento não tem nenhum profissional/vaga ativo (nunca cadastrou, ou removeu a vaga padrão), o agendamento cria sozinho a vaga única "Atendimento" (`ensureDefaultStaff` em `src/lib/booking-db.ts`, com cadeado por estabelecimento) e o cliente agenda normalmente, sem escolher ninguém. Com um atendente só, o horário ocupado some para os outros. Teste: `e2e33`.
- **Serviço padrão para quem atende com hora marcada**: se a categoria é barbearia, estética e saúde, pet shop, serviços ou academia e ainda não há nenhum serviço, o sistema cria o serviço **"Atendimento"** (30 min, sem preço) (`ensureDefaultService` em `src/lib/booking-db.ts`). Isso acontece quando o dono escolhe/salva a categoria e, para quem já tinha a categoria, na primeira vez que um cliente abre a página do lugar ou a tela de agendar. Assim o botão **Agendar** aparece e o cliente agenda sem o dono cadastrar nada (e sem funcionários, com a vaga única). O dono troca ou apaga o serviço padrão em Regras → Agenda e serviços quando cadastrar os serviços de verdade; só volta a ser criado se ficar sem nenhum serviço. Teste: `e2e34`.

## Onda 1 da revisão geral: segurança, erros e cobrança (migration: nenhuma)

- **Cabeçalhos de segurança** (`next.config.mjs`): `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security` e `Permissions-Policy` (GPS e câmera só para o próprio app). Sem CSP por enquanto (estilos inline e mapa de terceiros quebrariam); fica para depois do provedor de mapas definitivo.
- **Proteção central de rotas** (`src/middleware.ts`): `/dashboard`, `/admin`, `/carteira`, `/perfil` e `/avisos` exigem uma sessão assinada do tipo certo antes de a página rodar (cookie ausente, falso, vencido ou de outro tipo vai para o login; `/admin/entrar` e `/admin/convite` seguem abertos). As páginas continuam conferindo a sessão no banco: o middleware é a segunda barreira.
- **Erros**: `error.tsx`, `global-error.tsx` e `not-found.tsx` com a marca e o código do erro (`digest`) para o suporte. `src/instrumentation.ts` registra toda falha do servidor como uma linha JSON (`src/lib/log.ts`: `log`, `alertError`) e, se `ALERT_WEBHOOK_URL` estiver definida (Slack, Discord…), manda um aviso. O workflow `lembretes` também avisa nesse endereço (segredo `ALERT_WEBHOOK_URL` do GitHub) quando falha.
- **Webhook do Stripe**: cada `event.id` é processado uma única vez (guardado em `RateLimit` com a chave `stripe-event:<id>` por 35 dias, sem migração); se o processamento falha, o id é liberado para o Stripe reenviar.
- Teste: `e2e35` (cabeçalhos, redirecionamentos, cookie falso, token de outro tipo e 404).

- **Testes de tela dentro do repositório** (`tests/e2e/`): `e2e.mjs` (cria os dados) e `e2e2` a `e2e35`, em Playwright. Rodam contra um app em `http://localhost:3000` e o Postgres local `fidelidade` com `tests/e2e/run.sh` (todos, nessa ordem) ou `tests/e2e/run.sh e2e12 e2e31` (só alguns, depois do `e2e.mjs`). Variáveis: `CHROMIUM_PATH` (navegador), `DEV_MAIL_FILE` (onde o app grava os e-mails de teste). Prints e logs saem em `tests/e2e/out/` (fora do git). Use `next dev`: os pagamentos de mentira só existem fora de produção.
- **CI** (`.github/workflows/ci.yml`, em todo PR e push na `main`): job `qualidade` (instala, `tsc`, testes unitários e `next build`) e job `telas` (Postgres 16, migrations, servidor de desenvolvimento e `tests/e2e/run.sh`; guarda os prints se falhar). Ao mudar uma tela, ajuste o teste dela no mesmo PR.

## Prévia do link e ícone da aba (migration: nenhuma)

- **Prévia ao compartilhar o link** (WhatsApp etc.): título "Fidelize — Clube de pontos para o seu comércio" e descrição voltada a comércios (`src/app/layout.tsx`). A imagem (`src/app/opengraph-image.tsx`) mostra só o logo grande e o nome: o WhatsApp exibe o quadrado central (630 × 630) da imagem, então o logo ocupa quase todo esse quadrado e a frase fica no texto ao lado, não dentro da imagem. A imagem muda de endereço (`?hash`) quando o desenho muda, então a prévia se atualiza; links já enviados mantêm a prévia antiga no WhatsApp até ele recarregar.
- **Ícone da aba / Google**: `favicon.ico` foi para `public/` e todos os ícones usam `?v=5`. Para o navegador e o Google baixarem o ícone novo, basta aumentar esse número quando o logo mudar. O Google leva dias para atualizar o ícone nos resultados de busca.
- Textos: "restaurantes" saiu do título, da descrição e da frase de cima da landing ("Clube de pontos para o seu comércio") e do login ("Acesso do estabelecimento").

## Foto de perfil do cliente (migration `0024_foto_do_cliente`)

- No **Perfil**, o avatar tem uma câmera: toque nele (ou em "Adicionar foto" / "Trocar foto"), escolha a foto e ela é reduzida no próprio celular (`shrinkImage`, lado máximo 480 px) e enviada sozinha (`saveProfilePhoto` em `src/app/actions/customer.ts`). "Remover" volta para a inicial do nome. Componente: `src/components/ProfilePhoto.tsx`.
- A foto fica na tabela própria `CustomerPhoto` (uma por cliente, apagada junto com a conta), para não pesar a consulta da sessão. A validação é a mesma das fotos de lugares (`parseImageDataUrl` em `src/lib/images.ts`: confere o tipo real pelos bytes, aceita JPG/PNG/WebP, até ~450 KB) e há limite de 20 trocas por hora.
- **É dado pessoal, então não é pública**: `/api/perfil/foto` só entrega a foto ao próprio cliente logado (401 sem login, 404 sem foto). O endereço leva `?v=` com a hora da troca, então o navegador guarda a foto e baixa de novo ao trocar. Por enquanto só o próprio cliente a vê (no Perfil); se um dia o estabelecimento for mostrar a foto do cliente, isso é uma decisão nova de privacidade (e de texto na Política de Privacidade).
- **Deploy**: a migração é só uma tabela nova, mas precisa estar no banco de produção **antes** do deploy do código.
- Teste: `e2e36` (sem foto, escolher, recarregar, trocar, não pública, arquivo que não é imagem, remover).
- **Permissões em produção (migration `0026_foto_do_cliente_permissoes`)**: no Supabase de produção as tabelas pertencem ao papel `fidelize_app` (o do app) e têm RLS ligado sem políticas. Uma tabela criada pelo SQL do painel/MCP nasce com dono `postgres` e o app recebe `permission denied` (foi o erro na tela "Algo deu errado" do Perfil logo após o deploy do PR #51). **Toda migração nova aplicada em produção deve terminar com** `ALTER TABLE "X" OWNER TO fidelize_app; ALTER TABLE "X" ENABLE ROW LEVEL SECURITY; REVOKE ALL ON TABLE "X" FROM anon, authenticated, service_role;` e conferir com `set local role fidelize_app; select count(*) from "X";`.

## Copiar o Instagram do lugar (migration: nenhuma)

- Na página do lugar, a ação "Foto no Instagram marcando o…" ganhou o botão **"Copiar @perfil"** (`src/components/CopyButton.tsx`): copia o @ do lugar para o cliente colar e marcar na foto, e avisa "Copiado! Cole na sua foto". O botão "Abrir Instagram" continua ao lado. Sem Instagram cadastrado em Regras, a ação aparece sem botões. Teste: `e2e37`.

## Pedidos com retirada (migration `0027_pedidos_com_retirada`)

- **O que é**: o cliente escolhe do cardápio, monta a sacola, escolhe onde retira e confirma; **paga no balcão** ao retirar (não há cobrança online; isso continua sendo a "Fase 3"). O pedido chega ao painel do dono com um código de 6 letras e o dono leva até "Retirado e pago", quando os **pontos entram** na carteira do cliente.
- **Cliente**: botão "Fazer pedido" na página do lugar (só aparece com pedidos ligados e ao menos um item) → `/lugar/[id]/pedido` (`src/components/OrderMenu.tsx`: destaque da casa, categorias, preço promocional com o cheio riscado, barra "Total com retirada", folha "Sua sacola" com "Você ganha nesse pedido +N pts", escolha da retirada "grátis · pronto em X min", confirmação com o código). A sacola fica guardada no navegador (para sobreviver a um "Entrar" no meio) e é limpa ao enviar. **Meus pedidos** em `/perfil/pedidos` (aparece no Perfil depois do primeiro pedido); o cliente cancela enquanto o lugar ainda não começou a preparar.
- **Dono**: `/dashboard/cardapio` (liga/desliga os pedidos, tempo de preparo, produtos com foto, preço, promoção, categoria e "destaque da casa"; produto já pedido só é pausado, nunca apagado) e `/dashboard/pedidos` (fila que atualiza sozinha a cada 15 s: Novo → Em preparo → Pronto → Retirado e pago, ou Cancelar; e-mail a cada pedido novo para o e-mail de avisos da agenda ou o da conta). A aba **Pedidos** do menu aparece com os pedidos ligados (ou se já houve pedido) e mostra uma bolinha com os novos. Entrada pelo painel: Regras → Prêmios → "Pedidos pelo app".
- **Regras no servidor** (`src/lib/orders.ts` puro e testado, `src/lib/orders-db.ts`): o navegador só manda "quais itens e quantos"; preço, promoção, total, tempo de preparo e pontos são sempre recalculados no servidor. Máximo de 20 por item, 30 itens por pedido e **3 pedidos em aberto** por cliente em cada lugar. Mudança de status com condição no status de origem (dois cliques seguidos mudam uma vez só e creditam os pontos uma vez só). Os pontos reaproveitam o crédito do caixa (`creditClaimWith`): campanhas, indicação e desafios valem do mesmo jeito.
- **Menu x Prêmios**: `MenuItem` é o que se vende em R$; `Reward` continua sendo o que o cliente troca por pontos.
- **Deploy**: a migração só adiciona; aplique no banco de produção **antes** do deploy. Ela já cria as tabelas com dono `fidelize_app` e RLS ligado (veja "Permissões em produção" acima). Depois de aplicar, confira com `set local role fidelize_app; select count(*) from "MenuItem";` (e `"Order"`, `"OrderItem"`).
- Testes: `src/lib/orders.test.ts` (carrinho, preços, pontos, transições) e `e2e39` (dono monta o cardápio e liga; cliente pede; dono prepara, marca pronto e retirado com os pontos; cancelar; limite de pedidos em aberto; pedidos desligados).


## Interações que dão pontos editáveis (migration: nenhuma)

- Em Regras → "Interações que dão pontos", cada interação tem o botão de edição (engrenagem): muda a **descrição** e os **pontos** no mesmo registro, sem apagar e criar de novo (`updateInteraction` em `src/app/actions/restaurant.ts`, componente `InteractionRow`). Vale daqui para frente; o que o cliente já ganhou não muda. A página do lugar usa a descrição para escolher o ícone e os botões (Google, Instagram), então editar o texto também muda isso. Teste: `e2e41`.

## Ofertas, "% de volta" e ícones em Lugares; aniversário (migration `0028_ofertas_e_aniversario`)

- **Oferta com prazo e estoque** (`MenuItem.offerEndsAt`, `offerStock`, `offerStockTotal`, `spotlight`): no cardápio do dono (`/dashboard/cardapio`), um produto com preço promocional pode ter "Termina em" (horário de Brasília), "Unidades na oferta" e "Mostrar como oferta na lista de Lugares" (uma por lugar). O preço promocional **vale só dentro do prazo e com estoque** (`promoActive` em `src/lib/orders.ts`); passou o prazo ou acabou o estoque, o produto volta sozinho ao preço normal no cardápio e no pedido, e o cartão sai de Lugares. O estoque **baixa na hora do pedido** (condição no próprio UPDATE: dois pedidos ao mesmo tempo não passam do estoque; o pedido que pede mais que o restante é recusado com "restam só N") e **volta ao cancelar** (sem passar do total da oferta).
- **Lugares** (`PlacesExplorer`): cartão de oferta logo abaixo do lugar (preço promocional com o normal riscado, "até 19 out · 23h59", anel de progresso com "restam N" e botão "Pedir", que abre o cardápio já com 1 unidade na sacola); selo **"N% de volta"** (`cashbackPct(pointsPerReal, pointsPerRealOff)`: quanto do gasto volta em pontos, na regra de desconto por pontos do lugar; sem valor calculável mostra "N pts por R$ 1"); e **ícones do que o lugar oferece** (avaliação no Google, Instagram, prêmios, desafios). A distância em km já existia (usa a localização do cliente).
- **Aniversário** (`Customer.birthDay`/`birthMonth`, só dia e mês, sem o ano): cartão "Informar aniversário · para a gente lembrar do seu dia" na página do lugar (some depois de informado) e no Perfil (alterar ou remover a qualquer momento). O dono liga o **presente de aniversário** em Regras → Engajamento ("Presente de aniversário (pontos)", `Restaurant.birthdayPoints`, 0 desliga). O crédito é feito pelo cron já existente (`/api/cron/lembretes`, a cada 5 min no GitHub Actions) em `giveBirthdayGifts` (`src/lib/birthday-db.ts`): só para quem tem carteira no lugar, na data de Brasília, **uma vez por cliente, lugar e ano** (`BirthdayGift` com chave única: rodar o cron várias vezes no dia não repete). Quem faz 29/02 recebe em 28/02 nos anos não bissextos.
- **Privacidade**: o aniversário entrou na lista de dados da Política de Privacidade (item 2), como opcional e removível. Vale a revisão jurídica junto com o restante; a versão dos termos não foi alterada (não força novo aceite).
- **Deploy**: a migração só adiciona colunas e a tabela `BirthdayGift`, já com dono `fidelize_app` e RLS (veja "Permissões em produção"). Aplique no banco de produção **antes** do deploy e confira com `set local role fidelize_app; select count(*) from "BirthdayGift";`.
- Testes: `src/lib/orders.test.ts` (regras de oferta e prazo), `src/lib/birthday.test.ts` e `e2e40` (dono cria a oferta, validações, cartão em Lugares, estoque e preço, cancelamento devolve estoque, estoque que mudou no meio, prazo vencido, "% de volta" e ícones, aniversário, cron com presente sem repetir).

## Visual novo, cores por campanha e profissional, cupom e agenda em grade (migration `0029_cores`)

- **Identidade** (`globals.css`, `tailwind.config.js`): cantos mais arredondados (`rounded-2xl` = 22 px), chips em pílula (`glass-chip`, `chip-lima` para pontos, `chip-verde` para status), ladrilho de ícone (`icon-tile`) e botão azul-marinho (`glass-button-navy`) para a ação principal; cartões em azul-marinho com número em lima (saldo, oferta, destaque da casa, cupom, ID da conta).
- **Cores** (`src/lib/palette.ts`): paleta fixa de 6 cores (`azul, verde, laranja, roxo, rosa, turquesa`); o banco guarda só a **chave** (`Promotion.color`, `Resource.color`). Campanha sem cor usa a do público (todos = azul, novos = verde, quem sumiu = laranja); desafio = roxo, check-in = turquesa, indicação = rosa. O dono escolhe a cor ao criar a campanha e troca nas bolinhas da lista (Regras → Campanhas) e a cor do profissional no cadastro da equipe (sem escolha, o profissional novo pega a primeira cor livre). Mesma cor no cartão do cliente (`CampaignTile`), no Agendar e na agenda.
- **Cliente**: Início com cartões de carteira (barra de progresso e "Faltam X para <prêmio>") e **próximo horário** com "Sim, estarei lá / Liberar horário" (`NextBookingCard`, também em Avisos, que agora têm ícone e cor por tipo, `src/lib/notice-kind.ts`); Lugares com "N% de volta" em lima e oferta em azul-marinho; página do lugar com saldo em azul-marinho, prêmios com progresso e campanhas coloridas; cardápio com destaque da casa e barra da sacola; Agendar com dias, horários, profissionais coloridos e o cartão **"usar meus pontos como desconto"** com barra deslizante.
- **Cupom do prêmio** (`VoucherTicket`): bilhete com o prêmio, picote e o código grande; usado na carteira do lugar, em Meus prêmios e ao resgatar. Tela própria em **`/cupom/[id]`** (só o dono do cupom) com "Como retirar" e o horário do lugar.
- **Dono**: **Agenda em grade** (`AgendaGrid`, visão do dia): uma coluna por profissional (cor e foto), eixo de horas, linha do "agora" e bloco por atendimento com o selo da situação (aguardando, confirmado, concluído, faltou); as visões de semana e mês e os botões de ação seguem na lista abaixo. **Clientes** em tabela: nome, saldo, última visita e grupo.
- **Deploy**: a migração só adiciona duas colunas (`Promotion.color`, `Resource.color`). Aplique no banco de produção antes do deploy.
- Testes: `src/lib/palette.test.ts`, `notice-kind.test.ts` e os `e2e` existentes (textos de cupom e desconto mantidos).

## ID da conta (migration `0030_id_da_conta`)

- Todo cliente tem um **ID da conta** (`Customer.accountCode`, formato `FZ-XXXXXX`, sem 0/O/1/I), criado no cadastro e, para quem já existia, pela migração. Aparece no **Perfil** com botão de copiar ("informe no caixa no lugar do CPF"). Contas criadas fora do cadastro ganham o ID na primeira visita ao Perfil (`ensureAccountCode`).
- **Caixa**: o campo agora é "CPF ou ID da conta". Letras = ID (aceita `fz-7k3q9x`, `FZ 7K3Q9X`, `7k3q9x`); só números = CPF. Mostra o nome abreviado, e "Lançar na conta de…" funciona igual para os dois. A consulta tem o mesmo limite do CPF (`cpflookup`). **Clientes** do dono também busca pelo ID.
- Testes: `src/lib/account-code.test.ts` e `e2e42`.

## "Já fiz": confirmar Google/Instagram com aprovação (migration `0031_ja_fiz`)

- Cada interação (Regras → Interações) tem **"Como confirmar"**: **só no balcão** (como sempre foi, o caixa marca), **eu aprovo** (o cliente toca "Já fiz" e o dono aprova ou recusa no Caixa) ou **automático em 24 h** (os pontos entram sozinhos, a menos que o dono recuse antes). Padrão das interações existentes: só no balcão (nada muda até o dono escolher).
- O pedido vira `InteractionClaim` (pendente, com o prazo `autoAt` no modo automático). **Aprovar** credita na carteira (extrato com a descrição e aviso ao cliente) e **recusar** avisa o cliente; as duas decisões usam condição `status = PENDING` no UPDATE, então duas decisões ao mesmo tempo creditam **uma vez só**. Cada interação vale **uma vez a cada 30 dias por cliente** (pendente ou aprovada bloqueia; recusada pode tentar de novo). Limite de 12 pedidos por hora por cliente.
- Dono: o Caixa mostra "Pedidos de pontos" (quem, o quê, há quanto tempo, "libera em N h") e o menu **Caixa** ganha a bolinha com a quantidade. Cliente: na página do lugar cada interação mostra "Em análise", "Pontos recebidos" ou o botão "Já fiz".
- **Liberação automática**: o cron `/api/cron/lembretes` (a cada 5 min) chama `settleDueInteractions`, e o Caixa e a página do lugar também liberam os vencidos ao abrir. Sem o `CRON_SECRET` no GitHub só a liberação "ao abrir a tela" funciona.
- **Deploy**: a migração adiciona `InteractionRule.approval` e a tabela `InteractionClaim` com o tipo `InteractionClaimStatus`, já com dono `fidelize_app` e RLS (veja "Permissões em produção"). Aplique antes do deploy e confira com `set local role fidelize_app; select count(*) from "InteractionClaim";`.
- Testes: `src/lib/interaction-approval.test.ts` e `e2e43` (manual, automático no prazo, recusa, 30 dias, dupla aprovação, mudança de modo).

## Assistente (em breve) (migration: nenhuma)

- Botão redondo no canto das telas do cliente e do dono (`AssistantFab`) que abre um aviso **"Em breve"** com exemplos de perguntas de cada lado (cliente: lugar aberto mais perto, pontos por lugar, o que já pode resgatar; dono: clientes que sumiram, ticket médio, agendamentos por profissional, resgates a entregar, relatório da semana). Ainda não conversa: serve para deixar claro que vai existir. Some na tela do pedido (a barra da sacola ocupa o canto). Teste: `e2e44`.
- Planejamento do assistente real: só leitura (consulta o banco do próprio cliente ou estabelecimento por ferramentas fixas, sem inventar números e sem alterar nada), modelo pequeno para o dia a dia e modelo maior só para o relatório semanal. Custo estimado de cerca de R$ 5 por mil interações; a oferta como serviço adicional será definida com a margem (taxas e impostos) quando houver clientes.

## Início e Avisos do cliente reorganizados (migration: nenhuma)

- **Início** (`/carteira`): na ordem do PDF. Saudação, **resumo** (saldo total em azul-marinho com "+N no mês" e dois atalhos: prêmios ao alcance e cupons a retirar), **Suas carteiras** (logo, categoria · "aberto agora"/"fechado agora", saldo, barra de progresso e "Faltam X para <prêmio>", selos "Pode resgatar" e "N para retirar"), **próximo horário** (com "Sim, estarei lá / Liberar horário"), **Prêmios ao seu alcance** (até 3), **Campanhas do app** e **Atividade recente** (4 últimas movimentações em todos os lugares). Os rótulos "Prêmios para retirar", "Você pode resgatar agora" e "Vantagens de usar" continuam fora do Início (teste `e2e16`).
- **Avisos** (`/avisos`): uma única rolagem **agrupada por dia** (Hoje, Ontem, "Seg, 12/10"; `src/lib/notice-groups.ts`) e **filtro por estabelecimento** (chips com a quantidade de novos; `?lugar=<id>`, só aceita lugar que tem aviso do cliente). Cada aviso mostra o ícone/cor do tipo, o horário e o nome do lugar. Abrir um lugar marca como lido só os avisos dele (`markNotificationsRead(restaurantId)`); "Todos" marca o resto. Os lembretes de horário pendentes ficam no topo, com os botões.
- Testes: `src/lib/notice-groups.test.ts` e `e2e45`.

## App do gestor separado do app do cliente (migration: nenhuma)

- **Problema**: havia um único manifesto de instalação (`start_url: /carteira`), então o gestor que adicionava o painel à tela inicial recebia o app do **cliente**.
- **Agora são dois apps**, com nome, ícone e manifesto próprios:
  - **Cliente**: `/manifest.webmanifest` (`id` e `start_url` = `/carteira`, ícone lima). Vale para `/entrar`, a carteira, Lugares, Avisos e Perfil.
  - **Gestor**: `/gestor.webmanifest` (`id` e `start_url` = `/dashboard`, nome "Fidelize Gestor", ícone azul-marinho com o F em lima, atalhos para Caixa, Agenda e Pedidos). Vale para `/dashboard` e para `/login` (o convite de instalar aparece no celular, nas duas telas). Os metadados (`GESTOR_METADATA` em `src/lib/gestor-app.ts`) trocam também o ícone de iPhone e o título "Fidelize Gestor".
  - O `id` diferente faz o Android e o iPhone tratarem os dois como apps distintos; o mesmo celular pode ter os dois.
- O manifesto do cliente virou rota (`src/app/manifest.webmanifest/route.ts`) porque o arquivo especial `manifest.ts` tem prioridade e impediria a troca no painel.
- **Convite no painel** (`InstallApp variant="gestor"`): cartão "Tenha o Fidelize Gestor na tela inicial" no celular (sem o pop-up central, para não competir com o guia inicial); "agora não" e "já instalei" são guardados à parte do app do cliente.
- **Quem já instalou o app errado** precisa remover o ícone e adicionar de novo pelo painel (o sistema não troca o manifesto de um app já instalado).
- O painel já tem barra de abas no celular; o teste confere que as 8 telas principais não têm rolagem lateral em 390 px. Teste: `e2e46`.
