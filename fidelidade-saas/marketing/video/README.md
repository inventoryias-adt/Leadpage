# Vídeos de divulgação (Reels, 1080x1920)

Gravados no app de verdade (celular 390x844 em 2x) com dados de demonstração e montados com ffmpeg: abertura, legendas ligadas aos passos da gravação, o app dentro de um celular e fechamento com chamada.

Prontos para postar em `mp4/`: `fidelize-video-cliente.mp4`, `-caixa`, `-agenda`, `-checkin`, `-aniversario`, `-pedido` (pedido com retirada) e `-espera` (lista de espera). Sem música (coloque uma faixa no Instagram ao postar).

## Como refazer

1. App no ar e banco de testes (ex.: porta 3001 e banco `fidelidade2`):
   `export BASE=http://localhost:3001 DB=postgresql://postgres:postgres@localhost:5432/fidelidade2`
2. Dados: `node marketing/video/seed.mjs` (Café da Esquina e a cliente Marina, com 1.240 pontos), `node marketing/video/seed-agenda.mjs` (Barbearia do Léo, com Léo e Rafa) e `node marketing/video/seed-extra.mjs` (check-in, aniversário e cardápio do café; o cliente Carlos da fila de espera).
3. Gravar: `node marketing/video/record-cliente.mjs`, `record-caixa.mjs`, `record-agenda.mjs`, `record-checkin.mjs`, `record-aniversario.mjs`, `record-pedido.mjs` ou `record-espera.mjs` (gera `out/<nome>-raw.mp4` e os marcadores de tempo).
4. Montar: `node marketing/video/compose.mjs cliente` (ou `caixa`, `agenda`, `checkin`, `aniversario`, `pedido`, `espera`). Os textos ficam em `stories.mjs`.

O fechamento mostra o preço do app: **R$ 39,90 no primeiro mês**, depois R$ 69,90 por mês (valores em `stories.mjs`, iguais a `src/lib/plan.ts`).
O vídeo do Caixa mostra os três jeitos de lançar: CPF, ID da conta e QR Code; o da agenda diz que concluir o atendimento credita os pontos.

Os nomes (Café da Esquina, Barbearia do Léo, Marina) e o `@usefidelize` do fechamento são ilustrativos/provisórios.
