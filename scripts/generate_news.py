#!/usr/bin/env python3
"""Stage 2 Ver6.4: build five short-news candidates; long reading is frozen.

Key change from Ver6.3:
- Short-news candidate generation is completed and validated first.
- Each long passage is generated from ONE source article at a time.
- If a passage uses >7 note words, it is regenerated with explicit feedback.
- If the same article still cannot fit the learner level after retries, skip it
  and try another article instead of throwing away the already-good short items.
"""
from __future__ import annotations

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
SHORT_ATTEMPTS = 3
PASSAGE_ATTEMPTS_PER_ARTICLE = 3


def short_schema(allowed, source_urls):
    string = {"type": "string"}
    source_enum = {"type": "string", "enum": source_urls}
    allowed_enum = {"type": "string", "enum": sorted(set(allowed))}
    item = {
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
    return {
        "type": "object",
        "properties": {
            "short_pool": {
                "type": "array",
                "minItems": SHORT_POOL_SIZE,
                "maxItems": SHORT_POOL_SIZE,
                "items": item,
            }
        },
        "required": ["short_pool"],
        "additionalProperties": False,
    }


def passage_schema(source_url):
    string = {"type": "string"}
    token = {
        "type": "object",
        "properties": {
            "thai": string,
            "kind": {"type": "string", "enum": ["known", "note"]},
        },
        "required": ["thai", "kind"],
        "additionalProperties": False,
    }
    line = {
        "type": "object",
        "properties": {
            "tokens": {
                "type": "array",
                "minItems": 3,
                "maxItems": 24,
                "items": token,
            }
        },
        "required": ["tokens"],
        "additionalProperties": False,
    }
    passage = {
        "type": "object",
        "properties": {
            "source_url": {"type": "string", "enum": [source_url]},
            "source_fact_th": string,
            "lines": {
                "type": "array",
                "minItems": 3,
                "maxItems": 5,
                "items": line,
            },
        },
        "required": ["source_url", "source_fact_th", "lines"],
        "additionalProperties": False,
    }
    return {
        "type": "object",
        "properties": {"passage": passage},
        "required": ["passage"],
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

    for source_url in list(by_source)[:3]:
        selected.append(by_source[source_url][0])
        counts[source_url] = 1

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


def validate_short_pool(pool, allowed, source_urls):
    problems = []
    allowed = set(allowed)
    source_urls = set(source_urls)

    if len(pool) != SHORT_POOL_SIZE:
        problems.append(f"need exactly {SHORT_POOL_SIZE} short candidates")

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
        problems.append(
            "short candidates cannot satisfy 3-source diversity / max 2 per source"
        )

    return not problems, problems, selected


def passage_stats(passage, allowed):
    allowed = set(allowed)
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

    return notes, known_violations


def validate_passage(passage, allowed):
    problems = []
    lines = passage.get("lines") or []
    if not 3 <= len(lines) <= 5:
        problems.append("passage must have 3-5 lines")

    notes, known_violations = passage_stats(passage, allowed)

    if known_violations:
        problems.append(
            "labels unknown words as known: "
            + ", ".join(known_violations[:10])
        )
    if not notes:
        problems.append("must contain at least 1 note word")
    if len(notes) > MAX_NOTES_PER_PASSAGE:
        problems.append(
            f"has {len(notes)} note words; max {MAX_NOTES_PER_PASSAGE}. "
            "Rewrite much more simply with known vocabulary."
        )

    return not problems, problems, notes


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


def news_snapshot_text(articles):
    return "\n\n".join(
        f"SOURCE {i+1}\n"
        f"URL: {article['source_url']}\n"
        f"TITLE: {article['source_title']}\n"
        f"DATE: {article['published_at']}\n"
        f"CATEGORY: {article.get('category', '')}\n"
        f"BODY: {article['body']}"
        for i, article in enumerate(articles)
    )


def generate_shorts(client, articles, allowed, allowed_text):
    source_urls = [a["source_url"] for a in articles]
    schema = short_schema(allowed, source_urls)
    retry_note = ""
    news_text = news_snapshot_text(articles)

    for attempt in range(1, SHORT_ATTEMPTS + 1):
        print(f"SHORTS: AI attempt {attempt}/{SHORT_ATTEMPTS} using {MODEL}")
        prompt = f'''Create Thai-learning SHORT NEWS candidates from the supplied Thai PBS snapshot.

Return exactly {SHORT_POOL_SIZE} short candidates. This call creates NO long passages.

RULES:
- thai_tokens may use ONLY entries from ALLOWED VOCABULARY.
- Use 4-14 tokens and make a natural complete Thai sentence.
- Every sentence must express a concrete fact genuinely supported by its source article.
- If one article cannot be expressed naturally with the allowed vocabulary, skip it and use another article.
- Create candidates from several sources. We later need 5 final items from at least 3 sources, max 2 per source.
- Do not create Japanese, readings, explanations, or four-choice answers here.
- source_fact_th briefly states the factual connection to the source.

ALLOWED VOCABULARY (Level 1-{LEVEL}):
{allowed_text}

RAW NEWS SNAPSHOT:
{news_text}

{retry_note}'''
        draft = structured_response(
            client,
            name="thai_news_short_candidates_v631",
            schema=schema,
            instructions=(
                "Select real-news facts that can be expressed naturally with the "
                "learner's known Thai vocabulary. Skip unsuitable articles rather "
                "than inventing a weak connection."
            ),
            prompt=prompt,
        )
        pool = draft["short_pool"]
        ok, problems, selected = validate_short_pool(pool, allowed, source_urls)
        if ok:
            print(f"SHORTS DONE: {len(selected)} final short candidates accepted")
            return selected

        print("SHORTS validation failed:\n- " + "\n- ".join(problems))
        retry_note = (
            "Previous short draft failed validation. Fix ALL:\n- "
            + "\n- ".join(problems)
        )
        time.sleep(1)

    raise RuntimeError(
        f"Short candidate generation failed after {SHORT_ATTEMPTS} attempts"
    )


def article_passage_prompt(article, allowed_text, retry_note):
    return f'''Create ONE simplified Thai long-reading candidate from this ONE Thai PBS article.

SOURCE:
URL: {article['source_url']}
TITLE: {article['source_title']}
DATE: {article['published_at']}
CATEGORY: {article.get('category', '')}
BODY: {article['body']}

TARGET:
- 3-5 SHORT lines.
- Preserve one coherent factual story from the article.
- Rewrite aggressively into easy Thai for a Level {LEVEL} learner.
- Prefer words from ALLOWED VOCABULARY.
- Every token must be marked:
  kind="known" ONLY if thai exactly equals one allowed-vocabulary entry.
  kind="note" ONLY when the word/phrase is genuinely necessary.
- HARD TARGET: 1-{MAX_NOTES_PER_PASSAGE} DISTINCT note words total.
- If the source contains difficult names, exact official titles, technical terms,
  detailed numbers, or other material that would require too many notes, OMIT
  those details and keep only an easier supported fact.
- Do not preserve difficult wording merely because it appears in the source.
  Simplify the wording while keeping the meaning true.
- source_fact_th briefly states the source fact represented by the passage.
- Do not write Japanese content.

ALLOWED VOCABULARY:
{allowed_text}

{retry_note}'''


def generate_one_passage(client, article, allowed, allowed_text):
    schema = passage_schema(article["source_url"])
    retry_note = ""

    for attempt in range(1, PASSAGE_ATTEMPTS_PER_ARTICLE + 1):
        print(
            "PASSAGE: "
            f"{article['source_title'][:55]} | "
            f"attempt {attempt}/{PASSAGE_ATTEMPTS_PER_ARTICLE}"
        )
        draft = structured_response(
            client,
            name="thai_news_one_passage_v631",
            schema=schema,
            instructions=(
                "Simplify the article heavily for a beginner/intermediate Thai "
                "learner. The seven-note ceiling is a hard usability constraint. "
                "Use known vocabulary wherever possible, and omit source details "
                "that are not essential to the simplified factual story."
            ),
            prompt=article_passage_prompt(article, allowed_text, retry_note),
        )
        passage = draft["passage"]
        ok, problems, notes = validate_passage(passage, allowed)

        if ok:
            print(
                f"PASSAGE ACCEPTED: {len(notes)} note word(s) | "
                f"{article['source_url']}"
            )
            return passage

        print("PASSAGE rejected:\n- " + "\n- ".join(problems))
        retry_note = (
            "YOUR PREVIOUS VERSION WAS REJECTED.\n"
            "Rewrite the SAME factual story in MUCH EASIER Thai.\n"
            "Do not merely relabel difficult words as known.\n"
            "Problems:\n- " + "\n- ".join(problems)
        )
        time.sleep(1)

    print(
        "PASSAGE SKIP ARTICLE: could not reach <= "
        f"{MAX_NOTES_PER_PASSAGE} note words after "
        f"{PASSAGE_ATTEMPTS_PER_ARTICLE} attempts"
    )
    return None


def article_priority(articles, avoid_urls):
    """Try diverse, everyday categories first and skip already-used sources."""
    preferred = []
    other = []
    preferred_terms = (
        "สังคม", "เศรษฐกิจ", "สิ่งแวดล้อม", "สุขภาพ", "การศึกษา",
        "ต่างประเทศ", "กีฬา", "วัฒนธรรม",
    )
    for article in articles:
        if article["source_url"] in avoid_urls:
            continue
        category = article.get("category", "")
        if any(term in category for term in preferred_terms):
            preferred.append(article)
        else:
            other.append(article)
    return preferred + other


def generate_passages(client, articles, allowed, allowed_text, short_sources):
    """Find two acceptable passages, switching articles when simplification fails."""
    accepted = []
    used_urls = set()
    short_source_set = set(short_sources)
    candidates = article_priority(articles, avoid_urls=set())

    ordered = (
        [a for a in candidates if a["source_url"] not in short_source_set]
        + [a for a in candidates if a["source_url"] in short_source_set]
    )

    for article in ordered:
        if article["source_url"] in used_urls:
            continue
        passage = generate_one_passage(client, article, allowed, allowed_text)
        if passage is None:
            continue

        accepted.append(passage)
        used_urls.add(article["source_url"])
        if len(accepted) == PASSAGE_COUNT:
            print("PASSAGES DONE: 2 passages accepted from different articles")
            return accepted

    raise RuntimeError(
        "Could not find 2 long passages with <= "
        f"{MAX_NOTES_PER_PASSAGE} note words. "
        "Short candidates were already generated successfully."
    )


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
        vocab = load_vocab()
        allowed = [row["thai"] for row in vocab]
        allowed_text = "\n".join(
            f"{row['thai']} = {row.get('japanese', '')}" for row in vocab
        )

        from openai import OpenAI

        client = OpenAI()

        selected_shorts = generate_shorts(
            client, articles, allowed, allowed_text
        )

        # Ver6.4: long-reading generation is intentionally frozen.
        passages = []
        print("LONG READING: FROZEN in Ver6.4 (planned for Level 3+)")

        final = {
            "schema_version": 1,
            "generated_at": now_jst(),
            "target_level": LEVEL,
            "generator_version": "6.4",
            "raw_source_file": "data/news_raw.json",
            "raw_fetched_at": raw.get("fetched_at"),
            "short_candidates": [
                enrich_short(item, source_map, i + 1)
                for i, item in enumerate(selected_shorts)
            ],
            "reading_passages": [
                enrich_passage(item, source_map, i + 1)
                for i, item in enumerate(passages)
            ],
        }
        write_json_atomic(CANDIDATES_FILE, final)
        print(
            "CANDIDATES DONE: wrote "
            f"{len(final['short_candidates'])} short + 0 passages to {CANDIDATES_FILE}"
        )
        return 0

    except Exception as exc:
        print(f"CANDIDATES FAILED: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
