# Canal dark de História e Curiosidades (YouTube)

Gera vídeos narrados de ~8 min (16:9) sem aparecer no vídeo e, opcionalmente, envia ao YouTube como **privado**.

```
data/topics.yaml ─► artigo da Wikipédia (fonte dos fatos)
        │
        ▼
Claude: roteiro em cenas (só com fatos da fonte) ─► Claude: checagem de fatos (reescreve o que a fonte não sustenta)
        │
        ▼
voz pt-BR por cena (edge-tts) ─► imagem por cena: Wikimedia Commons (licença livre) → IA (MuAPI) → cartão
        │
        ▼
ffmpeg: Ken Burns + narração + legendas queimadas + trilha opcional ─► miniatura 1280×720
        │
        ▼
output/<tema>/{video.mp4, thumbnail.jpg, subtitles.srt, metadata.json, script.json}  ─►  upload privado (opcional)
```

## Rodar localmente
```bash
cd yt-channel
pip install -r requirements.txt           # precisa de ffmpeg
export ANTHROPIC_API_KEY=... WIKI_CONTACT=seu@email
python -m channel.run --no-upload                         # próximo tema de data/topics.yaml
python -m channel.run --no-upload --topic "A Peste Negra" --wiki "Peste Negra"
```
Edite `config.yaml` (nome do canal, voz, duração) e `data/topics.yaml` (fila de temas).

## Upload no YouTube (opcional)
1. https://console.cloud.google.com → novo projeto → **APIs e serviços → Biblioteca** → ative **YouTube Data API v3**.
2. **Tela de consentimento OAuth** → Externo → adicione seu e-mail como usuário de teste → depois clique em
   **Publicar app** (em "Em teste" o refresh token expira em 7 dias).
3. **Credenciais → Criar credenciais → ID do cliente OAuth → App para computador**. Copie ID e segredo.
4. No seu computador: `python scripts/get_refresh_token.py <CLIENT_ID> <CLIENT_SECRET>` e autorize com a conta do canal.
5. Secrets do GitHub: `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN` (+ `ANTHROPIC_API_KEY`, opcional `MUAPI_API_KEY`, `WIKI_CONTACT`).

> **Atenção:** vídeos enviados pela API por um projeto Google **não auditado** ficam travados como privados e, até onde
> sei, o dono não consegue torná-los públicos no Studio. Faça um envio de teste e confira. Se travar, ou você pede a
> auditoria (https://support.google.com/youtube/contact/yt_api_form) ou usa o vídeo do artefato do Actions e sobe
> manualmente. Sem as credenciais, o pipeline só gera o pacote.

## Automação
`.github/workflows/yt-channel.yml` roda terça e sexta (ou sob demanda), gera o vídeo, envia se houver credenciais,
grava o tema em `data/published.json` (commitado de volta) e guarda a pasta `output` como artefato por 7 dias.

## Regras de qualidade e de política (importante)
- **Fatos:** o roteiro só usa a fonte; uma segunda passada do Claude reescreve trechos não sustentados. Isso reduz,
  **não elimina**, erros: a própria Wikipédia pode errar. Revise antes de publicar.
- **Conteúdo repetitivo:** desde 2025 o YouTube não monetiza conteúdo "inautêntico" produzido em massa. Slides + voz de IA
  em volume alto entram nesse risco. Mantenha ritmo baixo (2/semana), varie temas e ângulos, acrescente seu próprio
  comentário/edição e revise cada vídeo.
- **Imagens:** só licenças PD/CC0/CC BY (sem SA/NC/ND); créditos vão na descrição. Ilustrações de IA são
  rotuladas na descrição e `disclose_synthetic` marca o vídeo como conteúdo sintético.
- **Música:** use só trilhas livres em `assets/music/` (Biblioteca de Áudio do YouTube, CC0).
- **Texto da Wikipédia** é CC BY-SA: o roteiro é reescrito com as próprias palavras e a fonte é citada na descrição.

## Limites conhecidos
- Pesquisa na Wikipédia/Commons, voz (edge-tts), MuAPI e upload no YouTube **ainda não foram testados com serviços reais**
  (o ambiente de desenvolvimento não alcança esses hosts). A primeira execução real pode pedir ajustes.
- Nenhuma imagem de Commons é verificada quanto à relevância: confira se a imagem combina com a cena.
