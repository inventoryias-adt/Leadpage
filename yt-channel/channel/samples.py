"""Gera amostras de TODAS as vozes pt-BR do edge-tts para você escolher de ouvido.

  python -m channel.samples            # grava em output/voz-amostras/
Cada voz sai em duas versões: "padrão" (um bloco, como era) e "ritmo" (frase a frase, com pausas).
"""
from __future__ import annotations

import asyncio
from pathlib import Path

from . import voice
from .config import load_config

TEXT = ("Há mais de três mil anos, segundo o Livro do Êxodo, um povo escravizado atravessou o deserto rumo à liberdade. "
        "Mas o que, de fato, aconteceu? Esta é a história que a Bíblia conta... e o que dizem os historiadores sobre ela. "
        "Fique até o fim: o final desse relato muda a forma como você enxerga tudo isso!")


def pt_br_voices() -> list[str]:
    import edge_tts
    voices = asyncio.run(edge_tts.list_voices())
    return sorted(v["ShortName"] for v in voices if v.get("Locale") == "pt-BR")


def main() -> int:
    cfg = load_config()
    out = Path(cfg["output_dir"]) / "voz-amostras"
    out.mkdir(parents=True, exist_ok=True)
    rate = cfg["voice"]["rate"]
    names = pt_br_voices()
    print(f"Vozes pt-BR encontradas: {', '.join(names)}")
    for name in names:
        short = name.replace("pt-BR-", "").replace("Neural", "")
        for label, paced in (("padrao", False), ("ritmo", True)):
            path = out / f"{short}__{label}.mp3"
            try:
                if paced:
                    voice.synthesize_paced(TEXT, path, name, rate, cfg["voice"].get("pitch", "+0Hz"), cfg["voice"].get("pauses"))
                else:
                    voice.synthesize(TEXT, path, name, "+0%")
                print(f"  ✓ {path.name}")
            except Exception as e:
                print(f"  ! {path.name} falhou: {str(e)[:80]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
