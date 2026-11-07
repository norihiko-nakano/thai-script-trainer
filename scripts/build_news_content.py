#!/usr/bin/env python3
"""Ver7.0: localize and independently review news, with dictionary-only readings."""
from __future__ import annotations

import json
import os
import re
import sys
import time
import unicodedata
from decimal import Decimal, InvalidOperation

from news_common import (
    CANDIDATES_FILE,
    CONTENT_FILE,
    LEVEL,
    MODEL,
    RAW_FILE,
    load_json,
    load_vocab,
    looks_japanese,
    looks_katakana,
    now_jst,
    structured_response,
    vocab_map,
    write_json_atomic,
    verify_source,
)


def short_schema(token_count: int):
    string = {"type": "string"}
    return {
        "type": "object",
        "properties": {
            "token_meanings": {
                "type": "array", "minItems": token_count, "maxItems": token_count,
                "items": string,
            },
            "title_ja": string,
            "choices": {
                "type": "array",
                "minItems": 4,
                "maxItems": 4,
                "items": string,
            },
            "correct_index": {"type": "integer", "enum": [0, 1, 2, 3]},
            "explanation": string,
            "grammar_note": string,
            "reading_tip": string,
            "choice_explanations": {
                "type": "array",
                "minItems": 4,
                "maxItems": 4,
                "items": string,
            },
        },
        "required": [
            "token_meanings",
            "title_ja",
            "choices",
            "correct_index",
            "explanation",
            "grammar_note",
            "reading_tip",
            "choice_explanations",
        ],
        "additionalProperties": False,
    }


def passage_schema(note_count: int):
    string = {"type": "string"}
    note_item = {
        "type": "object",
        "properties": {"japanese": string},
        "required": ["japanese"],
        "additionalProperties": False,
    }
    question = {
        "type": "object",
        "properties": {
            "prompt": string,
            "choices": {
                "type": "array",
                "minItems": 4,
                "maxItems": 4,
                "items": string,
            },
            "answer_index": {"type": "integer", "enum": [0, 1, 2, 3]},
            "explanation": string,
        },
        "required": ["prompt", "choices", "answer_index", "explanation"],
        "additionalProperties": False,
    }
    return {
        "type": "object",
        "properties": {
            "title_ja": string,
            "note_localizations": {
                "type": "array",
                "minItems": note_count,
                "maxItems": note_count,
                "items": note_item,
            },
            "questions": {
                "type": "array",
                "minItems": 3,
                "maxItems": 3,
                "items": question,
            },
        },
        "required": ["title_ja", "note_localizations", "questions"],
        "additionalProperties": False,
    }


def numeric_value(value):
    """Read a standalone numeral without accepting units, words, or partial numbers."""
    if not isinstance(value, str):
        return None
    normalized = unicodedata.normalize("NFKC", value.strip()).translate(
        str.maketrans("๐๑๒๓๔๕๖๗๘๙", "0123456789")
    )
    if not re.fullmatch(r"[+-]?(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)(?:\.[0-9]+)?", normalized):
        return None
    try:
        return Decimal(normalized.replace(",", ""))
    except InvalidOperation:
        return None


def valid_numeric_token_meaning(token, meaning):
    """Allow a numeral-only gloss only when it matches the original Thai token."""
    original = numeric_value(token)
    translated = numeric_value(meaning)
    return original is not None and translated is not None and original == translated


def valid_japanese_token_meaning(meaning):
    """Accept Japanese glosses, including katakana names and Thai/Japanese mixed labels.

    Keep this more permissive check scoped to token meanings; news titles,
    choices and explanations retain their existing Japanese semantic checks.
    """
    if not isinstance(meaning, str) or not meaning.strip():
        return False
    japanese_chars = re.findall(r"[\u3040-\u30ff\u3400-\u9fff]", meaning)
    thai_chars = re.findall(r"[\u0e00-\u0e7f]", meaning)
    if not japanese_chars:
        return False
    # Thai quotations are okay only if accompanied by a substantive Japanese gloss.
    return len(japanese_chars) >= (2 if thai_chars else 1)


def validate_short_localization(result, token_count, tokens=None):
    problems = []
    meanings = result.get("token_meanings") or []
    if len(meanings) != token_count:
        problems.append(
            f"token_meanings count mismatch: expected {token_count} item(s), "
            f"got {len(meanings)}"
        )
    for index in range(max(token_count, len(meanings))):
        thai_token = tokens[index] if tokens is not None and index < len(tokens) else None
        meaning = meanings[index] if index < len(meanings) else None
        if valid_japanese_token_meaning(meaning):
            continue
        if thai_token is not None and valid_numeric_token_meaning(thai_token, meaning):
            continue
        problems.append(
            f"token_meanings[{index}] invalid: "
            f"Thai token={thai_token!r}, Japanese meaning={meaning!r}; "
            "requires a contextual Japanese meaning or the matching numeral"
        )
    if not looks_japanese(result.get("title_ja", "")):
        problems.append("title_ja is not Japanese")
    choices = result.get("choices") or []
    if len(choices) != 4:
        problems.append("choices length is not 4")
    if len(set(choices)) != 4:
        problems.append("choices must be distinct")
    if result.get("correct_index") not in range(4):
        problems.append("correct_index out of range")
    for i, choice in enumerate(choices):
        if not looks_japanese(choice):
            problems.append(f"choices[{i}] is not semantic Japanese: {choice}")

    for key in ("explanation", "grammar_note", "reading_tip"):
        if not looks_japanese(result.get(key, "")):
            problems.append(f"{key} is not Japanese")

    reasons = result.get("choice_explanations") or []
    if len(reasons) != 4:
        problems.append("choice_explanations length is not 4")
    for i, reason in enumerate(reasons):
        if not looks_japanese(reason):
            problems.append(f"choice_explanations[{i}] is not Japanese")

    return not problems, problems


def validate_passage_localization(result, note_count):
    problems = []
    if not looks_japanese(result.get("title_ja", "")):
        problems.append("title_ja is not Japanese")

    notes = result.get("note_localizations") or []
    if len(notes) != note_count:
        problems.append("note_localizations length mismatch")
    for i, note in enumerate(notes):
        if not looks_japanese(note.get("japanese", "")):
            problems.append(f"note[{i}].japanese is not Japanese")

    questions = result.get("questions") or []
    if len(questions) != 3:
        problems.append("questions length is not 3")
    for i, question in enumerate(questions):
        if not looks_japanese(question.get("prompt", "")):
            problems.append(f"question[{i}].prompt is not Japanese")
        choices = question.get("choices") or []
        if len(choices) != 4 or len(set(choices)) != 4:
            problems.append(f"question[{i}].choices must contain four distinct values")
        if question.get("answer_index") not in range(4):
            problems.append(f"question[{i}].answer_index out of range")
        for j, choice in enumerate(choices):
            if not looks_japanese(choice):
                problems.append(
                    f"question[{i}].choices[{j}] is not Japanese"
                )
        if not looks_japanese(question.get("explanation", "")):
            problems.append(f"question[{i}].explanation is not Japanese")

    return not problems, problems


def localize_short(client, candidate, article, vocab_by_thai):
    tokens = candidate["thai_tokens"]
    known = [
        {
            "thai": token,
            "japanese": vocab_by_thai.get(token.strip(), {}).get("japanese", ""),
        }
        for token in tokens
    ]
    retry_note = ""

    for attempt in range(1, 4):
        print(
            f"BUILD short {candidate['id']}: Japanese pass {attempt}/3"
        )
        prompt = f'''Create the Japanese learner-facing material for ONE fixed Thai news sentence.

The Thai sentence and source are already fixed. Do not rewrite the Thai sentence.

THAI SENTENCE:
{candidate['thai']}

TOKENS + KNOWN DATABASE MEANINGS:
{json.dumps(known, ensure_ascii=False)}

SOURCE FACT SELECTED BY STAGE 2:
{candidate['source_fact_th']}

SOURCE ARTICLE TITLE:
{article['source_title']}

SOURCE ARTICLE BODY:
{article['body'][:5000]}

OUTPUT RULES:
- title_ja: short natural Japanese news-style title.
- token_meanings: one Japanese meaning for EVERY token, in EXACT token order, using this sentence context. Dictionary meanings are hints, not a substitute for contextual meaning.
- For a standalone numeric token (for example 815 or 80), it is valid to use the exact matching numeric value as its meaning (815 or 80). Do not change its value or introduce units.
- Japanese proper names may correctly use katakana alone, e.g. タイ for ประเทศไทย or ワット・カオポートーン for a temple name. This is a Japanese meaning, not a pronunciation note.
- You may quote a Thai word followed by its Japanese meaning in the same token gloss, but ALWAYS supply a meaningful Japanese translation.
- Do NOT generate Thai pronunciations or katakana phonetic reading guides. Dictionary readings are supplied separately, verbatim.
- choices: four JAPANESE MEANING choices. They must not be pronunciation choices.
- correct_index: index of the choice that accurately translates the fixed Thai sentence.
- explanation: Japanese explanation of why the sentence has that meaning. Thai words may be quoted inside Japanese prose.
- grammar_note: Japanese sentence-pattern/grammar explanation useful to the learner.
- reading_tip: Japanese practical tip explaining where/how to split/read this exact Thai sentence.
- choice_explanations: four Japanese reasons in exactly the same order as choices.
- Keep all explanations grounded in the fixed sentence and source article.

{retry_note}'''
        result = structured_response(
            client,
            name=f"thai_news_short_{candidate['id']}_v63",
            schema=short_schema(len(tokens)),
            instructions=(
                "あなたは日本人向けタイ語教材の編集者です。"
                "意味・選択肢・解説・文法・読み方の説明は自然な日本語で書きます。"
                "タイ語の読みや発音を生成しないでください。"
                "ただし、日本語の固有名詞・地名の訳としてのカタカナは使用できます。"
                "タイ語を日本語解説内で引用することは許可されています。"
            ),
            prompt=prompt,
        )
        ok, problems = validate_short_localization(result, len(tokens), tokens=tokens)
        if ok:
            return result
        retry_note = "Previous output problems:\n- " + "\n- ".join(problems)
        print("BUILD short validation failed:\n- " + "\n- ".join(problems))
        time.sleep(1)

    raise RuntimeError(f"Short localization failed: {candidate['id']}")


def localize_passage(client, candidate, article):
    note_words = candidate["note_words"]
    retry_note = ""

    for attempt in range(1, 4):
        print(
            f"BUILD passage {candidate['id']}: Japanese pass {attempt}/3"
        )
        prompt = f'''Create Japanese annotations and comprehension questions for ONE fixed Thai news passage.

FIXED THAI PASSAGE:
{candidate['body_thai']}

DIFFICULT WORDS, IN THIS EXACT ORDER:
{json.dumps(note_words, ensure_ascii=False)}

SOURCE FACT SELECTED BY STAGE 2:
{candidate['source_fact_th']}

SOURCE ARTICLE TITLE:
{article['source_title']}

SOURCE ARTICLE BODY:
{article['body'][:6000]}

OUTPUT RULES:
- title_ja: concise Japanese title.
- note_localizations: exactly one entry per difficult word, in the SAME ORDER. japanese is the Japanese meaning. Do NOT generate readings; those are supplied by the dictionary, or omitted if unregistered.
- questions: exactly three comprehension questions in Japanese.
- Each question has four Japanese meaning choices, answer_index, and a Japanese explanation.
- Questions must test understanding of the fixed Thai passage, not trivia outside it.
- Do not rewrite the Thai passage.

{retry_note}'''
        result = structured_response(
            client,
            name=f"thai_news_passage_{candidate['id']}_v63",
            schema=passage_schema(len(note_words)),
            instructions=(
                "あなたは日本人向けタイ語長文読解教材の編集者です。"
                "設問・選択肢・解説・注釈の意味は自然な日本語で書き、読みは生成しません。"
                "タイ語を日本語の説明内で引用しても構いません。"
            ),
            prompt=prompt,
        )
        ok, problems = validate_passage_localization(
            result, len(note_words)
        )
        if ok:
            return result
        retry_note = "Previous output problems:\n- " + "\n- ".join(problems)
        print("BUILD passage validation failed:\n- " + "\n- ".join(problems))
        time.sleep(1)

    raise RuntimeError(f"Passage localization failed: {candidate['id']}")


def build_short(candidate, localized, vocab_by_thai):
    choices = localized["choices"]
    correct_index = localized["correct_index"]
    meanings = localized["token_meanings"]
    if len(meanings) != len(candidate["thai_tokens"]):
        raise ValueError("Token meaning count mismatch")
    breakdown = [
        {"thai": token, "reading": vocab_by_thai.get(token.strip(), {}).get("reading") or "",
         "japanese": meanings[i]}
        for i, token in enumerate(candidate["thai_tokens"])
    ]
    readings = [row["reading"] or f"〔{row['thai']}：読み未登録〕" for row in breakdown]

    return {
        "id": candidate["id"],
        "level": candidate["level"],
        "source_verified": True,
        "source_review": candidate["source_review"],
        "title": localized["title_ja"],
        "thai": candidate["thai"],
        "thai_tokens": candidate["thai_tokens"],
        "japanese": choices[correct_index],
        "reading": " ".join(readings),
        "choices": choices,
        "source_type": "news",
        "source_name": candidate["source_name"],
        "source_title": candidate["source_title"],
        "source_url": candidate["source_url"],
        "published_at": candidate["published_at"],
        "ai_simplified": True,
        "explanation": localized["explanation"],
        "breakdown": breakdown,
        "grammar_note": localized["grammar_note"],
        "reading_tip": localized["reading_tip"],
        "choice_explanations": {
            choice: localized["choice_explanations"][i]
            for i, choice in enumerate(choices)
        },
    }


def build_passage(candidate, localized, dictionary):
    annotations = [
        {
            "thai": thai,
            "japanese": localized["note_localizations"][i]["japanese"],
            "reading": dictionary.get(thai.strip(), {}).get("reading") or "",
        }
        for i, thai in enumerate(candidate["note_words"])
    ]
    questions = []
    for question in localized["questions"]:
        choices = question["choices"]
        questions.append(
            {
                "prompt": question["prompt"],
                "choices": choices,
                "answer": choices[question["answer_index"]],
                "explanation": question["explanation"],
            }
        )

    return {
        "id": candidate["id"],
        "level": candidate["level"],
        "source_verified": True,
        "source_review": candidate["source_review"],
        "title": localized["title_ja"],
        "body_thai": candidate["body_thai"],
        "annotations": annotations,
        "questions": questions,
        "source_type": "news",
        "source_name": candidate["source_name"],
        "source_title": candidate["source_title"],
        "source_url": candidate["source_url"],
        "published_at": candidate["published_at"],
        "ai_simplified": True,
    }


def build_shorts_with_fallback(client, primary, backups, source_map, vocab_by_thai):
    """Skip rejected news and use an independently verified article instead.

    If fewer than five safe questions survive, do not publish incomplete content.
    The 3-source diversity and max-2-per-source rules are preserved.
    """
    accepted = []
    source_counts = {}
    rejected_sources = set()
    seen_sentences = set()
    for candidate in [*primary, *backups]:
        if len(accepted) == 5:
            break
        url = candidate["source_url"]
        if url in rejected_sources:
            print(f"SKIP short {candidate['id']}: source article was already rejected")
            continue
        if source_counts.get(url, 0) >= 2:
            continue
        if len(accepted) == 4 and len(source_counts) < 3 and url in source_counts:
            # Do not fill the final slot before reaching three distinct articles.
            continue
        thai = candidate["thai"]
        if thai in seen_sentences:
            continue
        seen_sentences.add(thai)
        article = source_map.get(url)
        if article is None:
            raise RuntimeError(f"Raw source missing for {url}")
        try:
            localized = localize_short(client, candidate, article, vocab_by_thai)
            review = verify_source(client, thai, article, localized)
        except (ValueError, RuntimeError) as exc:
            rejected_sources.add(url)
            print(
                f"REJECT short {candidate['id']} from {url}: {exc}. "
                "Looking for a different verified news article."
            )
            continue
        candidate["source_review"] = review
        finished = build_short(candidate, localized, vocab_by_thai)
        finished["id"] = f"sn-l{candidate['level']}-{len(accepted) + 1}"
        accepted.append(finished)
        source_counts[url] = source_counts.get(url, 0) + 1

    if len(accepted) != 5 or len(source_counts) < 3:
        raise RuntimeError(
            "Only "
            f"{len(accepted)}/5 source-verified short-news questions from "
            f"{len(source_counts)}/3 required articles survived; "
            "no safe replacements remain. Published news was not changed."
        )
    print(
        f"SHORTS VERIFIED: {len(accepted)} published from "
        f"{len(source_counts)} source articles; "
        f"{len(rejected_sources)} rejected article(s) skipped"
    )
    return accepted


def main():
    try:
        if not os.getenv("OPENAI_API_KEY"):
            raise RuntimeError("OPENAI_API_KEY is not set")
        if not CANDIDATES_FILE.exists():
            raise RuntimeError(
                f"Candidate file does not exist: {CANDIDATES_FILE}"
            )
        if not RAW_FILE.exists():
            raise RuntimeError(f"Raw file does not exist: {RAW_FILE}")

        candidates = load_json(CANDIDATES_FILE)
        raw = load_json(RAW_FILE)

        if candidates.get("raw_fetched_at") != raw.get("fetched_at"):
            raise RuntimeError(
                "Candidate snapshot does not match current raw snapshot. "
                "Run generate_news.py again."
            )

        if int(candidates.get("target_level") or -1) != LEVEL:
            raise RuntimeError(
                f"Candidate target level {candidates.get('target_level')} "
                f"does not match THAI_NEWS_LEVEL={LEVEL}"
            )

        source_map = {
            article["source_url"]: article
            for article in raw.get("articles") or []
        }

        vocab = load_vocab(include_unassigned=True)
        vocab_by_thai = vocab_map(vocab)

        short_candidates = candidates.get("short_candidates") or []
        backup_short_candidates = candidates.get("backup_short_candidates") or []
        passage_candidates = candidates.get("reading_passages") or []

        if len(short_candidates) != 5:
            raise RuntimeError(
                "news_candidates.json must contain exactly 5 short candidates"
            )
        if len(passage_candidates) != 2:
            raise RuntimeError("Ver7.0 requires two Level 3 passages")

        from openai import OpenAI

        client = OpenAI()
        short_news = build_shorts_with_fallback(
            client, short_candidates, backup_short_candidates,
            source_map, vocab_by_thai,
        )

        dictionary = vocab_map(load_vocab(include_unassigned=True))
        passages = []
        for candidate in passage_candidates:
            article = source_map[candidate["source_url"]]
            localized = localize_passage(client, candidate, article)
            candidate["source_review"] = verify_source(client, candidate["body_thai"], article, localized)
            passages.append(build_passage(candidate, localized, dictionary))

        final = {
            "schema_version": 3,
            "generated_at": now_jst(),
            "target_level": LEVEL,
            "generation_method": (
                f"Ver8.4 unrestricted vocabulary: raw Thai PBS snapshot -> "
                f"5 Thai short candidates -> Japanese short-news content "
                f"with independent source review by {MODEL}; dictionary readings; Level 3 passages."
            ),
            "raw_source_file": "data/news_raw.json",
            "candidate_source_file": "data/news_candidates.json",
            "long_reading_status": "available_from_level_3",
            "short_news": short_news,
            "reading_passages": passages,
        }

        write_json_atomic(CONTENT_FILE, final)
        print(
            f"BUILD DONE: wrote {len(short_news)} short-news questions "
            f"+ {len(passages)} long passages to {CONTENT_FILE}"
        )

        return 0

    except Exception as exc:
        print(f"BUILD FAILED: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
