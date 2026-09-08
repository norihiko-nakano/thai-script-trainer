#!/usr/bin/env python3
"""Ver7.0: localize and independently review news, with dictionary-only readings."""
from __future__ import annotations

import json
import os
import sys
import time

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


def validate_short_localization(result, token_count):
    problems = []
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
            "japanese": vocab_by_thai.get(token, {}).get("japanese", ""),
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
- Do NOT generate pronunciations or katakana. Readings are taken verbatim from the user dictionary.
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
                "読みや発音を生成しないでください。"
                "タイ語を日本語解説内で引用することは許可されています。"
            ),
            prompt=prompt,
        )
        ok, problems = validate_short_localization(result, len(tokens))
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
    readings = []
    for token in candidate["thai_tokens"]:
        row = vocab_by_thai.get(token, {})
        if not row.get("reading") or not 1 <= int(row.get("level") or 0) <= int(candidate["level"]):
            raise ValueError(f"Missing or out-of-level dictionary reading: {token}")
        readings.append(row["reading"])
    breakdown = []

    for token, reading in zip(candidate["thai_tokens"], readings):
        row = vocab_by_thai.get(token, {})
        breakdown.append(
            {
                "thai": token,
                "reading": reading,
                "japanese": row.get("japanese", ""),
            }
        )

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
            "japanese": dictionary.get(thai, {}).get("japanese") or localized["note_localizations"][i]["japanese"],
            "reading": dictionary.get(thai, {}).get("reading") or "",
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

        vocab = load_vocab()
        vocab_by_thai = vocab_map(vocab)

        short_candidates = candidates.get("short_candidates") or []
        passage_candidates = candidates.get("reading_passages") or []

        if len(short_candidates) != 5:
            raise RuntimeError(
                "news_candidates.json must contain exactly 5 short candidates"
            )
        if len(passage_candidates) != 2:
            raise RuntimeError("Ver7.0 requires two Level 3 passages")

        from openai import OpenAI

        client = OpenAI()
        short_news = []

        for candidate in short_candidates:
            article = source_map.get(candidate["source_url"])
            if not article:
                raise RuntimeError(
                    f"Raw source missing for {candidate['source_url']}"
                )
            localized = localize_short(
                client, candidate, article, vocab_by_thai
            )
            candidate["source_review"] = verify_source(client, candidate["thai"], article, localized)
            short_news.append(build_short(candidate, localized, vocab_by_thai))

        dictionary = vocab_map(load_vocab(include_unassigned=True))
        passages = []
        for candidate in passage_candidates:
            article = source_map[candidate["source_url"]]
            localized = localize_passage(client, candidate, article)
            candidate["source_review"] = verify_source(client, candidate["body_thai"], article, localized)
            passages.append(build_passage(candidate, localized, dictionary))

        final = {
            "schema_version": 2,
            "generated_at": now_jst(),
            "target_level": LEVEL,
            "generation_method": (
                f"Ver7.0 staged pipeline: raw Thai PBS snapshot -> "
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
