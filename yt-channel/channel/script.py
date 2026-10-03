"""Roteiro em cenas, preso à fonte, com uma passada de verificação de fatos."""
from __future__ import annotations

from . import llm

PROMPT = """Você é roteirista de um canal de YouTube de História e Curiosidades em português do Brasil.
Escreva o roteiro de um vídeo narrado de cerca de {minutes} minutos (~{words} palavras) sobre: "{topic}".

REGRAS DE FATOS (inegociáveis)
- Use SOMENTE informações presentes na FONTE abaixo. Não acrescente datas, números, nomes, citações
  ou relações de causa que não estejam na fonte.
- Reescreva com suas próprias palavras; não copie frases da fonte.
- Onde a fonte indicar incerteza ou disputa entre historiadores, diga isso ("segundo ...", "há quem defenda ...").
- Título honesto: nada que o vídeo não entregue. Sem sensacionalismo falso.

{note_block}ESTILO
- Narração fluida e envolvente, frases curtas, tom de suspense moderado. Gancho nos primeiros 15 segundos.
- Termine com um fechamento curto e um convite natural para se inscrever no canal.
- Cerca de {n_scenes} cenas de ~{wps} palavras. Cada cena = um trecho de narração + uma imagem.

Responda APENAS com JSON:
{{"title": "título até 70 caracteres",
  "thumb_text": "2 a 4 palavras impactantes para a miniatura",
  "summary": "2 a 3 frases para a descrição do vídeo",
  "tags": ["até 10 tags"],
  "scenes": [
    {{"narration": "texto narrado da cena",
      "chapter": "título curto do capítulo OU null (marque ~5 cenas ao longo do vídeo; a primeira cena deve ter capítulo)",
      "commons_query": "2 a 4 palavras para buscar imagem/gravura/pintura histórica real no Wikimedia Commons",
      "ai_prompt": "descrição visual em inglês, estilo gravura ou pintura, sem texto e sem rosto de pessoa real"}}
  ]}}

FONTE ({source_title}):
{source}
"""

VERIFY = """Você é checador de fatos. Compare a narração de cada cena com a FONTE.
Liste as cenas com afirmações que a FONTE NÃO sustenta (datas, números, nomes, citações, causas, exageros).
Se tudo estiver sustentado, devolva lista vazia.

Responda APENAS com JSON: {{"issues": [{{"scene": 0, "problem": "o que não está na fonte"}}]}}

CENAS:
{scenes}

FONTE:
{source}
"""

FIX = """Reescreva a narração apenas das cenas abaixo usando SOMENTE a FONTE, removendo ou corrigindo o
problema apontado. Mantenha tom, estilo e tamanho parecidos.

Responda APENAS com JSON: {{"scenes": [{{"scene": 0, "narration": "texto corrigido"}}]}}

CENAS COM PROBLEMA:
{items}

FONTE:
{source}
"""


def validate(script: dict, min_scenes: int = 8) -> dict:
    for k in ("title", "thumb_text", "summary", "scenes"):
        if not script.get(k):
            raise ValueError(f"roteiro sem '{k}'")
    if len(script["scenes"]) < min_scenes:
        raise ValueError(f"roteiro curto demais: {len(script['scenes'])} cenas")
    for i, s in enumerate(script["scenes"]):
        if not s.get("narration", "").strip():
            raise ValueError(f"cena {i} sem narração")
        s.setdefault("commons_query", script["title"])
        s.setdefault("ai_prompt", s["commons_query"])
        s["chapter"] = s.get("chapter") or None
    script["scenes"][0]["chapter"] = script["scenes"][0]["chapter"] or "Introdução"
    script["title"] = script["title"].strip()[:100]
    script["tags"] = [t.strip() for t in script.get("tags", [])][:10]
    return script


def generate(topic: str, source: dict, cfg: dict, min_scenes: int = 8, note: str = "") -> dict:
    words = cfg["target_minutes"] * cfg["words_per_minute"]
    note_block = f"ORIENTAÇÃO DO CANAL PARA ESTE TEMA (siga junto com as regras de fatos):\n{note.strip()}\n\n" if note else ""
    raw = llm.complete_json(
        PROMPT.format(minutes=cfg["target_minutes"], words=words, topic=topic, note_block=note_block,
                      n_scenes=max(words // cfg["words_per_scene"], 1), wps=cfg["words_per_scene"],
                      source_title=source["title"], source=source["text"]),
        cfg["model_script"], max_tokens=14000)
    return validate(raw, min_scenes)


def verify_and_fix(script: dict, source: dict, cfg: dict) -> tuple[dict, list[dict]]:
    """Uma rodada: aponta cenas sem sustento na fonte e reescreve só elas."""
    scenes_txt = "\n".join(f"[{i}] {s['narration']}" for i, s in enumerate(script["scenes"]))
    issues = llm.complete_json(VERIFY.format(scenes=scenes_txt, source=source["text"]),
                               cfg["model_verify"], max_tokens=3000).get("issues", [])
    issues = [i for i in issues if 0 <= int(i.get("scene", -1)) < len(script["scenes"])]
    if not issues:
        return script, []
    items = "\n".join(f"[{i['scene']}] problema: {i['problem']}\ntexto: {script['scenes'][int(i['scene'])]['narration']}"
                      for i in issues)
    fixed = llm.complete_json(FIX.format(items=items, source=source["text"]), cfg["model_verify"],
                              max_tokens=6000).get("scenes", [])
    for f in fixed:
        idx = int(f["scene"])
        if 0 <= idx < len(script["scenes"]) and f.get("narration", "").strip():
            script["scenes"][idx]["narration"] = f["narration"].strip()
    return script, issues
