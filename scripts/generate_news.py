#!/usr/bin/env python3
"""Stage 2: read data/news_raw.json and create Thai-only learning candidates."""
from __future__ import annotations

import json
import os
import sys
import time

from news_common import (
    CANDIDATES_FILE,
    LEVEL,
    MODEL,
    RAW_FILE,
    load_json,
    load_vocab,
    now_jst,
    structured_response,
    write_json_atomic,
)

SHORT_POOL_SIZE = 8
SHORT_FINAL_SIZE = 5
PASSAGE_COUNT = 2
MAX_NOTES_PER_PASSAGE = 7


def candidate_schema(allowed, source_urls):
    string = {"type": "string"}
    source_enum = {"type": "string", "enum": source_urls}
    allowed_enum = {"type": "string", "enum": sorted(set(allowed))}

    short_item = {
        "type": "object",
        "properties": {
            "source_url": source_enum,
            "source_fact_th": string,
            "thai_tokens": {
                "type": "array",
                "minItems": 4,
                "maxItems": 14,
                "items": allowed_enum,
            },
        },
        "required": ["source_url", "source_fact_th", "thai_tokens"],
        "additionalProperties": False,
    }

    passage_token = {
        "type": "object",
        "properties": {
            "thai": string,
            "kind": {"type": "string", "enum": ["known", "note"]},
        },
        "required": ["thai", "kind"],
        "additionalProperties": False,
    }
    passage_line = {
        "type": "object",
        "properties": {
            "tokens": {
                "type": "array",
                "minItems": 3,
                "maxItems": 24,
                "items": passage_token,
            }
        },
        "required": ["tokens"],
        "additionalProperties": False,
    }
    passage_item = {
        "type": "object",
        "properties": {
            "source_url": source_enum,
            "source_fact_th": string,
            "lines": {
                "type": "array",
                "minItems": 3,
                "maxItems": 5,
                "items": passage_line,
            },
        },
        "required": ["source_url", "source_fact_th", "lines"],
        "additionalProperties": False,
    }

    return {
        "type": "object",
        "properties": {
            "short_pool": {
                "type": "array",
                "minItems": SHORT_POOL_SIZE,
                "maxItems": SHORT_POOL_SIZE,
                "items": short_item,
            },
            "reading_passages": {
                "type": "array",
                "minItems": PASSAGE_COUNT,
                "maxItems": PASSAGE_COUNT,
                "items": passage_item,
            },
        },
        "required": ["short_pool", "reading_passages"],
        "additionalProperties": False,
    }


def select_short_candidates(pool):
    """Select 5 while forcing at least 3 sources and at most 2 per source."""
    by_source = {}
    for item in pool:
        by_source.setdefault(item["source_url"], []).append(item)

    if len(by_source) < 3:
        return None

    selected = []
    counts = {}

    # First take one from three distinct sources.
    for source_url in list(by_source)[:3]:
        selected.append(by_source[source_url][0])
        counts[source_url] = 1

    # Then fill from original model order, max 2/source.
    for item in pool:
        if len(selected) >= SHORT_FINAL_SIZE:
            break
        if any(item is chosen for chosen in selected):
            continue
        source_url = item["source_url"]
        if counts.get(source_url, 0) >= 2:
            continue
        selected.append(item)
        counts[source_url] = counts.get(source_url, 0) + 1

    return selected if len(selected) == SHORT_FINAL_SIZE else None


def validate_draft(draft, allowed, source_urls):
    problems = []
    allowed = set(allowed)
    source_urls = set(source_urls)

    pool = draft.get("short_pool") or []
    passages = draft.get("reading_passages") or []

    if len(pool) != SHORT_POOL_SIZE:
        problems.append(f"need exactly {SHORT_POOL_SIZE} short candidates")
    if len(passages) != PASSAGE_COUNT:
        problems.append(f"need exactly {PASSAGE_COUNT} reading passages")

    for i, item in enumerate(pool):
        if item.get("source_url") not in source_urls:
            problems.append(f"short_pool[{i}] source_url is not in raw news")
        tokens = item.get("thai_tokens") or []
        if len(tokens) < 4:
            problems.append(f"short_pool[{i}] is too short")
        bad = [token for token in tokens if token not in allowed]
        if bad:
            problems.append(
                f"short_pool[{i}] has non-vocabulary tokens: {', '.join(bad[:8])}"
            )

    selected = select_short_candidates(pool)
    if selected is None:
        problems.append("short candidates cannot satisfy 3-source diversity / max 2 per source")

    passage_sources = []
    for i, passage in enumerate(passages):
        source_url = passage.get("source_url")
        if source_url not in source_urls:
            problems.append(f"passage[{i}] source_url is not in raw news")
        else:
            passage_sources.append(source_url)

        notes = []
        known_violations = []
        for line in passage.get("lines") or []:
            for token in line.get("tokens") or []:
                thai = token.get("thai") or ""
                kind = token.get("kind")
                if kind == "known" and thai not in allowed:
                    known_violations.append(thai)
                if kind == "note" and thai and thai not in notes:
                    notes.append(thai)

        if known_violations:
            problems.append(
                f"passage[{i}] labels unknown words as known: "
                + ", ".join(known_violations[:10])
            )
        if not notes:
            problems.append(f"passage[{i}] should contain at least 1 annotated difficult word")
        if len(notes) > MAX_NOTES_PER_PASSAGE:
            problems.append(
                f"passage[{i}] has {len(notes)} note words; max {MAX_NOTES_PER_PASSAGE}"
            )

    if len(set(passage_sources)) < PASSAGE_COUNT:
        problems.append("the two long passages must use different source articles")

    return not problems, problems, selected


def enrich_short(item, source_map, index):
    source = source_map[item["source_url"]]
    return {
        "id": f"sn{index}",
        "level": LEVEL,
        "source_fact_th": item["source_fact_th"],
        "thai_tokens": item["thai_tokens"],
        "thai": "".join(item["thai_tokens"]),
        "source_name": source["source_name"],
        "source_title": source["source_title"],
        "source_url": source["source_url"],
        "published_at": source["published_at"],
        "category": source.get("category", ""),
    }


def enrich_passage(item, source_map, index):
    source = source_map[item["source_url"]]
    note_words = []
    body_lines = []
    normalized_lines = []

    for line in item["lines"]:
        parts = []
        normalized_tokens = []
        for token in line["tokens"]:
            thai = token["thai"]
            kind = token["kind"]
            parts.append(thai)
            normalized_tokens.append({"thai": thai, "kind": kind})
            if kind == "note" and thai not in note_words:
                note_words.append(thai)
        body_lines.append("".join(parts))
        normalized_lines.append({"tokens": normalized_tokens})

    return {
        "id": f"rp{index}",
        "level": LEVEL,
        "source_fact_th": item["source_fact_th"],
        "body_thai": "\n".join(body_lines),
        "lines": normalized_lines,
        "note_words": note_words,
        "source_name": source["source_name"],
        "source_title": source["source_title"],
        "source_url": source["source_url"],
        "published_at": source["published_at"],
        "category": source.get("category", ""),
    }


def main():
    try:
        if not os.getenv("OPENAI_API_KEY"):
            raise RuntimeError("OPENAI_API_KEY is not set")
        if not RAW_FILE.exists():
            raise RuntimeError(f"Raw news file does not exist: {RAW_FILE}")

        raw = load_json(RAW_FILE)
        articles = raw.get("articles") or []
        if len(articles) < 5:
            raise RuntimeError("data/news_raw.json has fewer than 5 articles")

        source_map = {article["source_url"]: article for article in articles}
        source_urls = list(source_map)
        vocab = load_vocab()
        allowed = [row["thai"] for row in vocab]
        allowed_text = "\n".join(
            f"{row['thai']} = {row.get('japanese', '')}"
            for row in vocab
        )
        news_text = "\n\n".join(
            f"SOURCE {i+1}\n"
            f"URL: {article['source_url']}\n"
            f"TITLE: {article['source_title']}\n"
            f"DATE: {article['published_at']}\n"
            f"CATEGORY: {article.get('category', '')}\n"
            f"BODY: {article['body']}"
            for i, article in enumerate(articles)
        )

        from openai import OpenAI

        client = OpenAI()
        schema = candidate_schema(allowed, source_urls)
        retry_note = ""

        for attempt in range(1, 4):
            print(f"CANDIDATES: AI attempt {attempt}/3 using {MODEL}")
            prompt = f'''Create Thai-learning CONTENT CANDIDATES from the supplied Thai PBS raw news snapshot.

This stage creates THAI CONTENT ONLY. Do not create Japanese questions, Japanese explanations, readings, or four-choice answers here.

SHORT CANDIDATES:
- Return exactly {SHORT_POOL_SIZE} candidates so the program can select the best {SHORT_FINAL_SIZE}.
- thai_tokens may use ONLY entries from ALLOWED VOCABULARY and must form a natural complete Thai sentence of 4-14 tokens.
- The sentence must communicate a concrete fact that is genuinely supported by its selected source article.
- If an article cannot be represented naturally with allowed vocabulary, skip that article. Never make an unrelated generic sentence.
- Across the pool, use several different source URLs. Do not focus on airports/aviation.
- source_fact_th is a concise Thai description of the source fact that the candidate represents.

LONG READING CANDIDATES:
- Return exactly {PASSAGE_COUNT} passages from DIFFERENT source articles and preferably different categories/themes.
- Each passage has 3-5 short lines.
- Break every line into token objects.
- kind="known" only when thai exactly equals one ALLOWED VOCABULARY entry.
- kind="note" for useful difficult words/phrases outside the learner vocabulary.
- Use 1-{MAX_NOTES_PER_PASSAGE} distinct note words per passage.
- Keep the passage faithful to the source. Do not invent facts.

ALLOWED VOCABULARY (Level 1-{LEVEL}):
{allowed_text}

RAW NEWS SNAPSHOT (read only this material):
{news_text}

{retry_note}'''

            draft = structured_response(
                client,
                name="thai_news_candidates_v63",
                schema=schema,
                instructions=(
                    "You are selecting and simplifying real Thai news for a Thai-language learner. "
                    "Faithfulness to the supplied articles is more important than forcing every article into the exercise set."
                ),
                prompt=prompt,
            )
            ok, problems, selected = validate_draft(
                draft, allowed, source_urls
            )
            if ok:
                final = {
                    "schema_version": 1,
                    "generated_at": now_jst(),
                    "target_level": LEVEL,
                    "raw_source_file": "data/news_raw.json",
                    "raw_fetched_at": raw.get("fetched_at"),
                    "short_candidates": [
                        enrich_short(item, source_map, i + 1)
                        for i, item in enumerate(selected)
                    ],
                    "reading_passages": [
                        enrich_passage(item, source_map, i + 1)
                        for i, item in enumerate(draft["reading_passages"])
                    ],
                }
                write_json_atomic(CANDIDATES_FILE, final)
                print(
                    "CANDIDATES DONE: wrote "
                    f"{len(final['short_candidates'])} short + "
                    f"{len(final['reading_passages'])} passages to {CANDIDATES_FILE}"
                )
                return 0

            retry_note = (
                "Previous candidate draft failed program validation. Fix these problems:\n- "
                + "\n- ".join(problems)
            )
            print("CANDIDATES validation failed:\n- " + "\n- ".join(problems))
            time.sleep(1)

        raise RuntimeError("Candidate generation failed after 3 attempts")

    except Exception as exc:
        print(f"CANDIDATES FAILED: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
