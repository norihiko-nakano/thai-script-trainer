#!/usr/bin/env python3
"""Source-verified natural news with contextual clickable vocabulary."""
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
    verify_source,
)

SHORT_POOL_SIZE = 8
SHORT_FINAL_SIZE = 5
PASSAGE_COUNT = 2
SHORT_ATTEMPTS = 3
PASSAGE_ATTEMPTS_PER_ARTICLE = 3


def short_schema(allowed, source_urls):
    string = {"type": "string"}
    source_enum = {"type": "string", "enum": source_urls}
    # Validate vocabulary in Python so constrained decoding does not force nonsense.
    allowed_enum = {"type": "string"}
    item = {
        "type": "object",
        "properties": {
            "source_url": source_enum,
            "source_fact_th": string,
            "thai": string,
            "thai_tokens": {
                "type": "array",
                "minItems": 4,
                "maxItems": 14,
                "items": allowed_enum,
            },
        },
        "required": ["source_url", "source_fact_th", "thai", "thai_tokens"],
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


def select_short_candidates(pool, count=SHORT_FINAL_SIZE, min_sources=3):
    """Select 5 while forcing at least 3 sources and at most 2 per source."""
    by_source = {}
    for item in pool:
        by_source.setdefault(item["source_url"], []).append(item)

    if len(by_source) < min_sources:
        return None

    selected = []
    counts = {}

    for source_url in list(by_source)[:min_sources]:
        selected.append(by_source[source_url][0])
        counts[source_url] = 1

    for item in pool:
        if len(selected) >= count:
            break
        if any(item is chosen for chosen in selected):
            continue
        source_url = item["source_url"]
        if counts.get(source_url, 0) >= 2:
            continue
        selected.append(item)
        counts[source_url] = counts.get(source_url, 0) + 1

    return selected if len(selected) == count else None


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

    return not problems, problems, notes


def enrich_short(item, source_map, index):
    source = source_map[item["source_url"]]
    return {
        "id": f"sn-l{item.get('level', LEVEL)}-{index}",
        "source_review": item["source_review"],
        "level": item.get("level", LEVEL),
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
        "id": f"rp-l3-{index}",
        "source_review": item["source_review"],
        "level": item.get("level", LEVEL),
        "source_fact_th": item["source_fact_th"],
        "body_thai": "\n".join(body_lines),
        "lines": normalized_lines,
        "note_words": list(dict.fromkeys(t["thai"] for line in normalized_lines for t in line["tokens"])),
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


def align_tokens_to_sentence(sentence, tokens):
    """Restore source whitespace deterministically without changing any text."""
    if not isinstance(sentence, str) or not sentence.strip() or not isinstance(tokens, list):
        raise ValueError("Missing sentence or token list")
    if any(not isinstance(token, str) for token in tokens):
        raise ValueError("Tokens must be strings")
    compact = lambda text: "".join(char for char in text if not char.isspace())
    pieces = [compact(token) for token in tokens]
    if not pieces or any(not piece for piece in pieces):
        raise ValueError("Empty token")
    if "".join(pieces) != compact(sentence):
        raise ValueError("Token characters differ from sentence (not just whitespace)")
    positions = [i for i, char in enumerate(sentence) if not char.isspace()]
    aligned, start, consumed = [], 0, 0
    for piece in pieces:
        consumed += len(piece)
        end = positions[consumed] if consumed < len(positions) else len(sentence)
        aligned.append(sentence[start:end])
        start = end
    return aligned


def generate_shorts(client, articles, allowed, allowed_text, count=5, min_sources=3):
    source_urls = [a["source_url"] for a in articles]
    schema = short_schema(allowed, source_urls)
    retry_note = ""
    news_text = news_snapshot_text(articles)
    verified = []
    seen = set()
    source_map = {article["source_url"]: article for article in articles}

    for attempt in range(1, SHORT_ATTEMPTS + 1):
        print(f"SHORTS: AI attempt {attempt}/{SHORT_ATTEMPTS} using {MODEL}")
        prompt = f'''Create Thai-learning SHORT NEWS candidates from the supplied Thai PBS snapshot.

Return exactly {SHORT_POOL_SIZE} short candidates. This call creates NO long passages.

RULES:
- Vocabulary is unrestricted. Prefer simple natural Thai, but retain necessary news terms.
- Write thai as a complete naturally spaced sentence FIRST, including spaces around numbers and abbreviations where appropriate.
- Split thai_tokens into meaningful words or short lexical phrases, in the SAME order as thai, without omitting or changing any non-whitespace character. Spaces may be omitted from tokens; code restores them from thai. Do not emit standalone whitespace tokens.
- Use 4-14 tokens and make a natural complete Thai sentence.
- Every sentence must express a concrete fact genuinely supported by its source article.
- Choose facts that can be stated clearly in one sentence. Do not distort facts to simplify words.
- Create candidates from several sources. We need {count} final items from at least {min_sources} sources, max 2 per source.
- Start with a source-supported natural sentence, then segment it without changing the text.
- Never substitute an unrelated word to fit the dictionary. Words outside it are welcome.
- Do not add "today" unless the source explicitly supports that time reference.
- Avoid already accepted sentences: {list(seen)}
- Do not create Japanese, readings, explanations, or four-choice answers here.
- source_fact_th briefly states the factual connection to the source.

OPTIONAL FAMILIAR VOCABULARY (not a restriction):
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
                "learner's level where practical, without a vocabulary ceiling. Skip unsuitable articles rather "
                "than inventing a weak connection."
            ),
            prompt=prompt,
        )
        pool = draft["short_pool"]
        problems = []
        for item in pool:
            tokens = item.get("thai_tokens") or []
            thai = item.get("thai", "")
            try:
                tokens = align_tokens_to_sentence(thai, tokens)
            except ValueError as exc:
                problems.append(f"Token alignment failed: {exc}")
                continue
            item["thai_tokens"] = tokens
            if item.get("source_url") not in source_map or not 4 <= len(tokens) <= 14:
                problems.append(f"Invalid source or token count: {thai}")
                continue
            if any(not isinstance(token, str) or not token.strip() for token in tokens):
                problems.append("Empty or invalid token")
                continue
            if thai in seen:
                continue
            try:
                item["source_review"] = verify_source(client, thai, source_map[item["source_url"]])
                verified.append(item)
                seen.add(thai)
            except ValueError as exc:
                problems.append(f"{thai}: {exc}")
        selected = select_short_candidates(verified, count, min_sources)
        ok = selected is not None
        if not ok:
            problems.append(f"Only {len(verified)} verified candidates accumulated; need {count} from {min_sources} sources.")
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
- 3-5 SHORT lines. Preserve natural spacing around numbers and abbreviations inside or at the edges of tokens; never remove spaces when segmenting. No standalone whitespace tokens.
- Preserve one coherent factual story from the article.
- Write clear Thai for learners without forcing a vocabulary level.
- Use natural Thai with no vocabulary or difficulty ceiling. Prefer clear short sentences.
- Every token must be marked:
  kind="known" if thai is in the optional familiar vocabulary.
  kind="note" for any other word or short lexical phrase. Both kinds are permitted.
- There is no limit on new vocabulary; all words receive contextual Japanese meanings later.
- If the source contains difficult names, exact official titles, technical terms,
  detailed numbers, omit only nonessential details. Keep facts and actors accurate.
- Do not preserve difficult wording merely because it appears in the source.
  Keep necessary names and news terms when needed to preserve the meaning.
- source_fact_th briefly states the source fact represented by the passage.
- Do not write Japanese content.

OPTIONAL FAMILIAR VOCABULARY:
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
                "learner. Vocabulary is unrestricted and contextual translations will be supplied. "
                "Use clear natural sentences, and omit source details "
                "that are not essential to the simplified factual story."
            ),
            prompt=article_passage_prompt(article, allowed_text, retry_note),
        )
        passage = draft["passage"]
        ok, problems, notes = validate_passage(passage, allowed)

        if ok:
            try:
                passage["source_review"] = verify_source(client,
                    "\n".join("".join(t["thai"] for t in line["tokens"]) for line in passage["lines"]), article)
            except ValueError as exc:
                ok = False
                problems.append(str(exc))
        if ok:
            print(
                f"PASSAGE ACCEPTED: {len(notes)} new word(s) | "
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
        "PASSAGE SKIP ARTICLE: source/naturalness validation failed after "
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
        "Could not find 2 source-verified natural passages. "
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
        if LEVEL != 3:
            raise ValueError("Ver7.0 weekly curriculum requires THAI_NEWS_LEVEL=3")
        vocab = load_vocab()
        allowed = [row["thai"] for row in vocab]
        allowed_text = "\n".join(
            f"{row['thai']} = {row.get('japanese', '')}" for row in vocab
        )

        from openai import OpenAI

        client = OpenAI()

        # Level 3 is the news menu placement, not a vocabulary restriction.
        # Do not require a separate Level 2 batch: it forces unnatural paraphrases.
        selected_shorts = [
            {**item, "level": LEVEL}
            for item in generate_shorts(
                client, articles, allowed, allowed_text,
                count=SHORT_FINAL_SIZE, min_sources=3,
            )
        ]
        passages = generate_passages(client, articles, allowed, allowed_text, [item["source_url"] for item in selected_shorts])

        final = {
            "schema_version": 1,
            "generated_at": now_jst(),
            "target_level": LEVEL,
            "generator_version": "8.4-context-vocabulary",
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
            f"{len(final['short_candidates'])} short + {len(passages)} passages to {CANDIDATES_FILE}"
        )
        return 0

    except Exception as exc:
        print(f"CANDIDATES FAILED: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

