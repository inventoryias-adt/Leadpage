from __future__ import annotations

import json


def complete(prompt: str, model: str, max_tokens: int = 8000) -> str:
    import anthropic

    msg = anthropic.Anthropic().messages.create(
        model=model, max_tokens=max_tokens, messages=[{"role": "user", "content": prompt}]
    )
    return "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")


def extract_json(raw: str) -> dict:
    return json.loads(raw[raw.index("{"): raw.rindex("}") + 1])


def complete_json(prompt: str, model: str, max_tokens: int = 8000) -> dict:
    return extract_json(complete(prompt, model, max_tokens))
