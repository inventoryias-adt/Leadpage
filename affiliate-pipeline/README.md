# Pipeline de conteúdo de afiliados (Shopee + TikTok Shop)

Sem ter o produto: o pipeline escolhe itens com **comissão ≥ 20%**, monta um vídeo
vertical (1080×1920) com as imagens do anúncio + locução + legenda + **link de afiliado**,
e deixa tudo numa fila pronta para postar.

```
Shopee API ─┐
            ├─► filtro (≥20%, nota, vendas, preço) ─► ranking ─► sem repetir (SQLite)
CSV TikTok ─┘                     │
                                  ▼
        roteiro/legenda (Claude)  ─►  slides (Pillow)  ─►  voz pt-BR (edge-tts)  ─►  vídeo (ffmpeg)
                                  ▼
        output/queue/AAAA-MM-DD/<plataforma>_<id>/{video.mp4, cover.jpg, slides/, caption.txt, manifest.json}
        output/queue/queue.csv   +   (opcional) envio no Telegram   +   artefato do GitHub Actions
```

## Rodar agora (sem credenciais)

```bash
cd affiliate-pipeline
pip install -r requirements.txt        # precisa de ffmpeg instalado
python -m pytest -q tests
python -m pipeline.run --source mock --no-voice
```

## Ligar de verdade

1. **Shopee**: no painel de Afiliados (affiliate.shopee.com.br) → *Open API* → copie `AppId` e `Secret`.
2. **GitHub → Settings → Secrets → Actions**: `SHOPEE_APP_ID`, `SHOPEE_SECRET` e, opcionais,
   `ANTHROPIC_API_KEY` (roteiros melhores), `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` (recebe o vídeo no celular).
3. O workflow `.github/workflows/affiliate-pipeline.yml` roda todo dia 08:00 (BRT) e também sob demanda.
4. Ajuste palavras-chave, filtros e limite diário em `config.yaml`.

### TikTok Shop
Não existe API pública para listar produtos de afiliado com comissão. Preencha
`data/tiktok_products.csv` (colunas no topo de `pipeline/sources/tiktok_csv.py`) com itens do
*Marketplace de Produtos* do Affiliate Center; o mesmo filtro de 20% é aplicado.

## O que NÃO está automatizado (e por quê)
- **Postagem**: a Content Posting API do TikTok exige auditoria do app (antes disso só posta privado) e a
  Shopee Vídeo não tem API. Por isso o resultado é uma fila: você baixa o pacote (artefato/Telegram) e posta.
- **Link clicável**: legenda do TikTok não clica. Use o link da bio (Linktree etc.) ou marque o produto
  direto no TikTok Shop quando for item do programa de afiliados dele.

## Regras que o pipeline já segue
- Texto gerado usa **só dados do produto** (nome, preço, nota, vendas) — o prompt proíbe inventar
  benefícios, descontos ou depoimentos.
- Legenda leva a divulgação `#publi Link de afiliado` (`copy.disclosure`). Marque também a opção
  de **conteúdo gerado por IA** no TikTok ao postar.
- Reutilizar imagens de anúncio de terceiros tem risco de direitos autorais; prefira itens em que o
  programa de afiliados autoriza o uso de imagens.

## Limites conhecidos
- A API da Shopee devolve **uma imagem** por oferta; o vídeo reaproveita essa imagem em enquadramentos
  diferentes. Para mais variedade, adicione imagens extras no CSV (`image_urls` separadas por `|`).
- Os nomes de campos da GraphQL da Shopee (`productOfferV2`, `generateShortLink`) foram escritos a partir
  da documentação e **ainda não foram testados contra a API real** — rode com
  `python -m pipeline.run --source shopee --discover-only` assim que tiver as credenciais.
- A deduplicação entre execuções usa o cache do Actions; se ele expirar, um produto pode repetir.
