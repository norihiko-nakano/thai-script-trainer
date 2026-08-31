#!/usr/bin/env python3
"""Shared helpers for Thai Vocabulary Trainer Ver6.3 news pipeline."""
from __future__ import annotations

import json
import os
import re
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
RAW_FILE = DATA_DIR / "news_raw.json"
CANDIDATES_FILE = DATA_DIR / "news_candidates.json"
CONTENT_FILE = ROOT / "news_content.json"
FALLBACK_VOCAB = DATA_DIR / "allowed_vocab_l2.json"
JST = ZoneInfo("Asia/Tokyo")
LEVEL = int(os.getenv("THAI_NEWS_LEVEL", "2"))
MODEL = os.getenv("OPENAI_NEWS_MODEL", "gpt-5.4-mini")

THAI_RE = re.compile(r"[\u0e00-\u0e7f]")
HIRAGANA_KANJI_RE = re.compile(r"[\u3040-\u309f\u4e00-\u9fff]")
KATAKANA_RE = re.compile(r"[\u30a0-\u30ff]")


def now_jst() -> str:
    return datetime.now(JST).isoformat(timespec="seconds")


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json_atomic(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def load_vocab():
    """Load Level 1..LEVEL vocabulary from Supabase, with repository fallback."""
    config = ROOT / "supabase-config.js"
    if config.exists():
        text = config.read_text(encoding="utf-8", errors="ignore")
        url_m = re.search(r'url\s*:\s*["\']([^"\']+)', text)
        key_m = re.search(r'publishableKey\s*:\s*["\']([^"\']+)', text)
        if url_m and key_m:
            try:
                response = requests.get(
                    url_m.group(1).rstrip("/") + "/rest/v1/words",
                    params={
                        "select": "thai,japanese,reading,level",
                        "level": f"lte.{LEVEL}",
                        "order": "level.asc,id.asc",
                    },
                    headers={"apikey": key_m.group(1)},
                    timeout=25,
                )
                response.raise_for_status()
                rows = [
                    row for row in response.json()
                    if row.get("thai") and row.get("japanese") and row.get("level")
                ]
                if len(rows) >= 50:
                    print(f"Vocabulary: Supabase {len(rows)} words")
                    return rows
            except Exception as exc:
                print(f"Vocabulary warning: Supabase unavailable: {exc}")

    rows = load_json(FALLBACK_VOCAB)
    rows = [row for row in rows if int(row.get("level") or 99) <= LEVEL]
    print(f"Vocabulary: fallback {len(rows)} words")
    return rows


def vocab_map(vocab):
    return {row["thai"]: row for row in vocab}


def looks_japanese(text: str) -> bool:
    """Allow Thai quotations inside Japanese prose, but require Japanese semantic text."""
    if not isinstance(text, str) or not text.strip():
        return False
    jp = len(HIRAGANA_KANJI_RE.findall(text))
    thai = len(THAI_RE.findall(text))
    return jp >= 1 and jp >= max(1, thai // 2)


def looks_katakana(text: str) -> bool:
    if not isinstance(text, str) or not text.strip():
        return False
    return bool(KATAKANA_RE.search(text)) and not THAI_RE.search(text)


def structured_response(client, *, name: str, schema: dict, instructions: str, prompt: str):
    response = client.responses.create(
        model=MODEL,
        instructions=instructions,
        input=prompt,
        text={
            "format": {
                "type": "json_schema",
                "name": name,
                "strict": True,
                "schema": schema,
            }
        },
    )
    if not getattr(response, "output_text", ""):
        raise RuntimeError(f"OpenAI returned no output_text for {name}")
    return json.loads(response.output_text)
