#!/usr/bin/env python3
"""Thai PBS -> AI Thai learning content. Ver6.2.6."""
from __future__ import annotations

import html
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import urljoin, urlparse
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "news_content.json"
FALLBACK = ROOT / "data" / "allowed_vocab_l2.json"
BASE = "https://www.thaipbs.or.th"
BKK = ZoneInfo("Asia/Bangkok")
JST = ZoneInfo("Asia/Tokyo")
MODEL = os.getenv("OPENAI_NEWS_MODEL", "gpt-5.4-mini")
LEVEL = int(os.getenv("THAI_NEWS_LEVEL", "2"))
DAYS = int(os.getenv("THAI_NEWS_DISCOVERY_DAYS", "3"))
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",
    "Accept-Language": "th-TH,th;q=0.9,en;q=0.7",
}


def load_vocab():
    config = ROOT / "supabase-config.js"
    if config.exists():
        text = config.read_text(encoding="utf-8", errors="ignore")
        url_m = re.search(r'url\s*:\s*["\']([^"\']+)', text)
        key_m = re.search(r'publishableKey\s*:\s*["\']([^"\']+)', text)
        if url_m and key_m:
            try:
                r = requests.get(
                    url_m.group(1).rstrip("/") + "/rest/v1/words",
                    params={"select": "thai,japanese,reading,level", "level": f"lte.{LEVEL}", "order": "level.asc,id.asc"},
                    headers={"apikey": key_m.group(1)},
                    timeout=25,
                )
                r.raise_for_status()
                data = [x for x in r.json() if x.get("thai") and x.get("level")]
                if len(data) >= 50:
                    print(f"Vocabulary: Supabase {len(data)} words")
                    return data
            except Exception as exc:
                print(f"Vocabulary fallback: {exc}")
    data = json.loads(FALLBACK.read_text(encoding="utf-8"))
    print(f"Vocabulary: fallback {len(data)} words")
    return data


def canonical_article_url(value):
    value = html.unescape(value or "").replace("\\/", "/")
    value = re.sub(r"\\u0*02[fF]", "/", value)
    value = urljoin(BASE, value)
    parsed = urlparse(value)
    match = re.fullmatch(r"/news/content/(\d+)/?", parsed.path)
    if match and parsed.netloc in {"thaipbs.or.th", "www.thaipbs.or.th"}:
        return f"{BASE}/news/content/{match.group(1)}"
    return None


def links_from_html(source):
    found = []

    def add(value):
        url = canonical_article_url(value)
        if url and url not in found:
            found.append(url)

    soup = BeautifulSoup(source, "html.parser")
    for tag in soup.find_all("a", href=True):
        add(tag["href"])

    # Thai PBS also embeds article URLs in Next.js/JSON payloads.
    raw = html.unescape(source).replace("\\/", "/")
    raw = re.sub(r"\\u0*02[fF]", "/", raw)
    for value in re.findall(r"(?:https?://(?:www\.)?thaipbs\.or\.th)?/news/content/\d+", raw):
        add(value)
    return found


def discover_article_links(session, limit=30):
    today = datetime.now(BKK).date()
    pages = [BASE + "/news", BASE + "/news/archive", BASE + "/news/archive?page=1"]
    pages.extend(f"{BASE}/news/archive/{(today - timedelta(days=i)).isoformat()}" for i in range(max(1, DAYS)))

    out = []
    print(f"Discovery: scanning {len(pages)} pages over {DAYS} day(s)")
    for page in dict.fromkeys(pages):
        try:
            r = session.get(page, timeout=30)
            r.raise_for_status()
            links = links_from_html(r.text)
            print(f"Discovery: {page} -> {len(links)} links ({len(r.text):,} bytes)")
            for url in links:
                if url not in out:
                    out.append(url)
                if len(out) >= limit:
                    break
        except Exception as exc:
            print(f"Discovery warning: {page}: {exc}")
        if len(out) >= limit:
            break

    print(f"Discovery: {len(out)} unique article links")
    if not out:
        raise RuntimeError("No Thai PBS article links found after multi-page discovery")
    return out


def fetch_article(session, url):
    r = session.get(url, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    def meta(key):
        tag = soup.find("meta", attrs={"property": key}) or soup.find("meta", attrs={"name": key})
        return (tag.get("content") or "").strip() if tag else ""

    title = meta("og:title")
    if not title:
        h1 = soup.find("h1") or soup.find("title")
        title = h1.get_text(" ", strip=True) if h1 else url
    published = meta("article:published_time")[:10]
    category = meta("article:section")
    body = ""

    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(tag.string or tag.get_text())
        except Exception:
            continue
        stack = data if isinstance(data, list) else [data]
        while stack:
            item = stack.pop()
            if isinstance(item, list):
                stack.extend(item)
                continue
            if not isinstance(item, dict):
                continue
            typ = item.get("@type")
            types = set(typ if isinstance(typ, list) else [typ])
            if types & {"NewsArticle", "Article", "ReportageNewsArticle"}:
                title = title or str(item.get("headline") or "")
                published = published or str(item.get("datePublished") or "")[:10]
                category = category or str(item.get("articleSection") or "")
                body = body or str(item.get("articleBody") or "")
            stack.extend(v for v in item.values() if isinstance(v, (dict, list)))

    if not body:
        root = soup.find("article") or soup
        body = " ".join(p.get_text(" ", strip=True) for p in root.find_all("p") if len(p.get_text(" ", strip=True)) >= 20)

    body = re.sub(r"\s+", " ", body).strip()
    return {
        "source_name": "Thai PBS",
        "source_title": title[:300],
        "source_url": url,
        "published_at": published,
        "category": category[:80],
        "text": body[:6000],
    }


def clean_thai(text):
    return re.sub(r"[\s\d๐-๙%.,!?;:'\"()\[\]{}\-–—/\\]+", "", text or "")


def segmentable(text, lexicon):
    source = clean_thai(text)
    if not source:
        return True
    words = sorted(set(filter(None, lexicon)), key=len, reverse=True)
    dp = [False] * (len(source) + 1)
    dp[0] = True
    for i in range(len(source)):
        if not dp[i]:
            continue
        for word in words:
            if source.startswith(word, i):
                dp[i + len(word)] = True
    return dp[-1]




def build_output_schema(allowed, source_urls):
    string = {"type": "string"}
    jp_meaning = {
        "type": "string",
        "description": "Natural Japanese semantic meaning/translation. Do NOT write pronunciation or transliteration. Use Japanese kanji/hiragana where natural."
    }
    jp_explanation = {
        "type": "string",
        "description": "Explanation written in Japanese for a Japanese learner. Do NOT write Thai prose."
    }
    katakana_reading = {
        "type": "string",
        "description": "Thai pronunciation written in Japanese katakana, e.g. サナームビン. Do NOT use romaji."
    }
    allowed_enum = {"type": "string", "enum": sorted(set(allowed))}
    source_enum = {"type": "string", "enum": source_urls}

    breakdown_item = {
        "type": "object",
        "properties": {"thai": string, "reading": katakana_reading, "japanese": jp_meaning},
        "required": ["thai", "reading", "japanese"],
        "additionalProperties": False,
    }
    choice_explanation_item = {
        "type": "object",
        "properties": {"choice": jp_meaning, "explanation": jp_explanation},
        "required": ["choice", "explanation"],
        "additionalProperties": False,
    }
    short_item = {
        "type": "object",
        "properties": {
            "id": string,
            "level": {"type": "integer", "enum": [LEVEL]},
            "title": string,
            "thai_tokens": {
                "type": "array", "minItems": 4, "maxItems": 14,
                "items": allowed_enum,
            },
            "reading": katakana_reading,
            "choices": {
                "type": "array", "minItems": 4, "maxItems": 4,
                "items": jp_meaning,
            },
            "correct_index": {"type": "integer", "enum": [0, 1, 2, 3]},
            "explanation": jp_explanation,
            "breakdown": {
                "type": "array", "minItems": 2, "maxItems": 8,
                "items": breakdown_item,
            },
            "grammar_note": jp_explanation,
            "reading_tip": jp_explanation,
            "choice_explanations": {
                "type": "array", "minItems": 4, "maxItems": 4,
                "items": jp_explanation,
            },
            "source_type": {"type": "string", "enum": ["news"]},
            "source_name": {"type": "string", "enum": ["Thai PBS"]},
            "source_title": string,
            "source_url": source_enum,
            "published_at": string,
            "ai_simplified": {"type": "boolean", "enum": [True]},
        },
        "required": [
            "id", "level", "title", "thai_tokens", "reading",
            "choices", "correct_index", "explanation", "breakdown", "grammar_note",
            "reading_tip", "choice_explanations", "source_type",
            "source_name", "source_title", "source_url", "published_at",
            "ai_simplified",
        ],
        "additionalProperties": False,
    }

    passage_token = {
        "type": "object",
        "properties": {
            "thai": string,
            "reading": katakana_reading,
            "japanese": jp_meaning,
            "kind": {"type": "string", "enum": ["known", "note"]},
        },
        "required": ["thai", "reading", "japanese", "kind"],
        "additionalProperties": False,
    }
    passage_line = {
        "type": "object",
        "properties": {
            "tokens": {
                "type": "array", "minItems": 2, "maxItems": 24,
                "items": passage_token,
            }
        },
        "required": ["tokens"],
        "additionalProperties": False,
    }
    question_item = {
        "type": "object",
        "properties": {
            "prompt": jp_meaning,
            "choices": {
                "type": "array", "minItems": 4, "maxItems": 4,
                "items": jp_meaning,
            },
            "answer_index": {"type": "integer", "enum": [0, 1, 2, 3]},
            "explanation": jp_explanation,
        },
        "required": ["prompt", "choices", "answer_index", "explanation"],
        "additionalProperties": False,
    }
    passage_item = {
        "type": "object",
        "properties": {
            "id": string,
            "level": {"type": "integer", "enum": [LEVEL]},
            "title": string,
            "lines": {
                "type": "array", "minItems": 3, "maxItems": 5,
                "items": passage_line,
            },
            "questions": {
                "type": "array", "minItems": 3, "maxItems": 3,
                "items": question_item,
            },
            "source_type": {"type": "string", "enum": ["news"]},
            "source_name": {"type": "string", "enum": ["Thai PBS"]},
            "source_title": string,
            "source_url": source_enum,
            "published_at": string,
            "ai_simplified": {"type": "boolean", "enum": [True]},
        },
        "required": [
            "id", "level", "title", "lines", "questions", "source_type",
            "source_name", "source_title", "source_url", "published_at",
            "ai_simplified",
        ],
        "additionalProperties": False,
    }

    return {
        "type": "object",
        "properties": {
            "schema_version": {"type": "integer", "enum": [1]},
            "target_level": {"type": "integer", "enum": [LEVEL]},
            "short_news": {
                "type": "array", "minItems": 5, "maxItems": 5,
                "items": short_item,
            },
            "reading_passages": {
                "type": "array", "minItems": 2, "maxItems": 2,
                "items": passage_item,
            },
        },
        "required": [
            "schema_version", "target_level", "short_news",
            "reading_passages",
        ],
        "additionalProperties": False,
    }


def normalize_structured_draft(draft, allowed):
    allowed = set(allowed)
    data = {
        "schema_version": 1,
        "target_level": LEVEL,
        "short_news": [],
        "reading_passages": [],
    }

    for item in draft["short_news"]:
        obj = dict(item)
        tokens = obj.pop("thai_tokens")
        obj["thai"] = "".join(tokens)
        choices = obj["choices"]
        correct_index = obj.pop("correct_index")
        obj["japanese"] = choices[correct_index]
        explanations = obj.get("choice_explanations", [])
        obj["choice_explanations"] = {
            choice: explanations[i] for i, choice in enumerate(choices)
        }
        data["short_news"].append(obj)

    for passage in draft["reading_passages"]:
        obj = dict(passage)
        lines = obj.pop("lines")
        line_texts = []
        annotations = {}
        known_violations = []
        for line in lines:
            parts = []
            for token in line["tokens"]:
                thai = token["thai"]
                parts.append(thai)
                if token["kind"] == "known":
                    if thai not in allowed:
                        known_violations.append(thai)
                else:
                    annotations.setdefault(
                        thai,
                        {
                            "thai": thai,
                            "japanese": token["japanese"],
                            "reading": token["reading"],
                        },
                    )
            line_texts.append("".join(parts))
        obj["body_thai"] = "\n".join(line_texts)
        obj["annotations"] = list(annotations.values())
        obj["_known_violations"] = known_violations
        normalized_questions = []
        for q in obj["questions"]:
            q = dict(q)
            answer_index = q.pop("answer_index")
            q["answer"] = q["choices"][answer_index]
            normalized_questions.append(q)
        obj["questions"] = normalized_questions
        data["reading_passages"].append(obj)

    return data



JP_SEMANTIC_RE = re.compile(r"[\u3040-\u309f\u4e00-\u9fff]")
KATAKANA_RE = re.compile(r"[\u30a0-\u30ff]")
THAI_RE = re.compile(r"[\u0e00-\u0e7f]")


def is_japanese_semantic(text):
    """Meaning/explanation should be Japanese, not a katakana transliteration or Thai prose."""
    return (
        isinstance(text, str)
        and bool(text.strip())
        and not THAI_RE.search(text)
        and bool(JP_SEMANTIC_RE.search(text))
    )


def is_katakana_reading(text):
    return (
        isinstance(text, str)
        and bool(text.strip())
        and not THAI_RE.search(text)
        and bool(KATAKANA_RE.search(text))
    )


def validate_structured_data(data, source_urls):
    problems = []
    source_urls = set(source_urls)
    used_short_sources = set()

    for i, item in enumerate(data["short_news"]):
        if not is_japanese_semantic(item["japanese"]):
            problems.append(
                f"short_news[{i}].japanese must be a Japanese MEANING, not pronunciation: {item['japanese']}"
            )
        if not is_katakana_reading(item["reading"]):
            problems.append(
                f"short_news[{i}].reading must be katakana pronunciation: {item['reading']}"
            )
        for j, choice in enumerate(item["choices"]):
            if not is_japanese_semantic(choice):
                problems.append(
                    f"short_news[{i}].choices[{j}] must be a Japanese meaning sentence: {choice}"
                )
        if not is_japanese_semantic(item["explanation"]):
            problems.append(f"short_news[{i}].explanation must be Japanese")
        if not is_japanese_semantic(item["grammar_note"]):
            problems.append(f"short_news[{i}].grammar_note must be Japanese")
        if not is_japanese_semantic(item["reading_tip"]):
            problems.append(f"short_news[{i}].reading_tip must be Japanese")
        for choice, explanation in item["choice_explanations"].items():
            if not is_japanese_semantic(explanation):
                problems.append(
                    f"short_news[{i}] choice explanation must be Japanese: {choice}"
                )
        for j, chunk in enumerate(item["breakdown"]):
            if not is_katakana_reading(chunk["reading"]):
                problems.append(
                    f"short_news[{i}].breakdown[{j}].reading must be katakana"
                )
            if not is_japanese_semantic(chunk["japanese"]):
                problems.append(
                    f"short_news[{i}].breakdown[{j}].japanese must be Japanese meaning"
                )

        if item["source_url"] not in source_urls:
            problems.append(f"short_news[{i}] source_url is not supplied")
        else:
            used_short_sources.add(item["source_url"])

    required_diversity = min(3, len(source_urls), len(data["short_news"]))
    if len(used_short_sources) < required_diversity:
        problems.append(
            f"short_news needs at least {required_diversity} distinct sources"
        )

    passage_sources = []
    for i, passage in enumerate(data["reading_passages"]):
        violations = passage.pop("_known_violations", [])
        if violations:
            problems.append(
                f"passage[{i}] marks non-vocabulary words as known: "
                + ", ".join(sorted(set(violations))[:12])
            )
        if len(passage["annotations"]) > 7:
            problems.append(
                f"passage[{i}] has {len(passage['annotations'])} difficult words; max 7"
            )
        for j, annotation in enumerate(passage["annotations"]):
            if not is_katakana_reading(annotation["reading"]):
                problems.append(
                    f"passage[{i}].annotations[{j}].reading must be katakana"
                )
            if not is_japanese_semantic(annotation["japanese"]):
                problems.append(
                    f"passage[{i}].annotations[{j}].japanese must be Japanese meaning"
                )

        for j, q in enumerate(passage["questions"]):
            if not is_japanese_semantic(q["prompt"]):
                problems.append(
                    f"passage[{i}] question[{j}].prompt must be Japanese"
                )
            for k, choice in enumerate(q["choices"]):
                if not is_japanese_semantic(choice):
                    problems.append(
                        f"passage[{i}] question[{j}].choices[{k}] must be Japanese"
                    )
            if not is_japanese_semantic(q["answer"]):
                problems.append(
                    f"passage[{i}] question[{j}].answer must be Japanese"
                )
            if not is_japanese_semantic(q["explanation"]):
                problems.append(
                    f"passage[{i}] question[{j}].explanation must be Japanese"
                )
        if passage["source_url"] not in source_urls:
            problems.append(f"passage[{i}] source_url is not supplied")
        else:
            passage_sources.append(passage["source_url"])

    if len(source_urls) >= 2 and len(set(passage_sources)) < 2:
        problems.append("the 2 passages must use different news sources")

    return not problems, problems



def validate_content_before_localization(data, source_urls):
    """Validate facts/shape/source diversity before Japanese localization.

    The first AI pass is allowed to return Thai explanations. Japanese language
    quality is checked only after a dedicated second localization pass.
    """
    problems = []
    source_urls = set(source_urls)
    used_short_sources = set()

    for i, item in enumerate(data["short_news"]):
        if item["source_url"] not in source_urls:
            problems.append(f"short_news[{i}] source_url is not supplied")
        else:
            used_short_sources.add(item["source_url"])

        if len(item.get("choices", [])) != 4:
            problems.append(f"short_news[{i}] needs 4 choices")
        if len(item.get("choice_explanations", {})) != 4:
            problems.append(f"short_news[{i}] needs 4 choice explanations")
        if len(item.get("breakdown", [])) < 2:
            problems.append(f"short_news[{i}] needs breakdown")

    required_diversity = min(3, len(source_urls), len(data["short_news"]))
    if len(used_short_sources) < required_diversity:
        problems.append(
            f"short_news needs at least {required_diversity} distinct sources"
        )

    passage_sources = []
    for i, passage in enumerate(data["reading_passages"]):
        violations = passage.get("_known_violations", [])
        if violations:
            problems.append(
                f"passage[{i}] marks non-vocabulary words as known: "
                + ", ".join(sorted(set(violations))[:12])
            )
        if len(passage.get("annotations", [])) > 7:
            problems.append(
                f"passage[{i}] has {len(passage['annotations'])} difficult words; max 7"
            )
        if len(passage.get("questions", [])) != 3:
            problems.append(f"passage[{i}] needs 3 questions")
        if passage["source_url"] not in source_urls:
            problems.append(f"passage[{i}] source_url is not supplied")
        else:
            passage_sources.append(passage["source_url"])

    if len(source_urls) >= 2 and len(set(passage_sources)) < 2:
        problems.append("the 2 passages must use different news sources")

    return not problems, problems


def build_localization_tasks(data):
    """Flatten all learner-facing text into small translation/pronunciation tasks."""
    tasks = []

    def add(key, kind, source_text, context=""):
        tasks.append({
            "key": key,
            "kind": kind,
            "source_text": str(source_text or ""),
            "context": str(context or ""),
        })

    for i, item in enumerate(data["short_news"]):
        thai = item["thai"]
        add(f"s.{i}.reading", "katakana", thai, "タイ語短文全体の読み")
        for j, choice in enumerate(item["choices"]):
            add(
                f"s.{i}.choice.{j}", "japanese",
                choice,
                f"タイ語本文: {thai}。これは4択の意味選択肢。発音ではなく意味にする。",
            )
        add(
            f"s.{i}.explanation", "japanese", item["explanation"],
            f"タイ語本文: {thai}。日本人学習者向けの意味解説。",
        )
        add(
            f"s.{i}.grammar", "japanese", item["grammar_note"],
            f"タイ語本文: {thai}。日本人学習者向けの文型説明。",
        )
        add(
            f"s.{i}.reading_tip", "japanese", item["reading_tip"],
            f"タイ語本文: {thai}。日本人向け読み方のコツ。",
        )
        explanations = list(item["choice_explanations"].values())
        for j, explanation in enumerate(explanations):
            add(
                f"s.{i}.choice_exp.{j}", "japanese", explanation,
                f"本文: {thai}。選択肢: {item['choices'][j]}。なぜ正しい/誤りかを日本語で説明。",
            )
        for j, chunk in enumerate(item["breakdown"]):
            add(
                f"s.{i}.break.{j}.reading", "katakana", chunk["thai"],
                "このタイ語語句の読みをカタカナで。",
            )
            add(
                f"s.{i}.break.{j}.meaning", "japanese", chunk["japanese"],
                f"タイ語語句: {chunk['thai']}。日本語の意味。",
            )

    for i, passage in enumerate(data["reading_passages"]):
        body = passage["body_thai"]
        for j, ann in enumerate(passage["annotations"]):
            add(
                f"p.{i}.ann.{j}.reading", "katakana", ann["thai"],
                "長文中の難語の読みをカタカナで。",
            )
            add(
                f"p.{i}.ann.{j}.meaning", "japanese", ann["japanese"],
                f"難語: {ann['thai']}。日本語の意味。",
            )
        for j, q in enumerate(passage["questions"]):
            add(
                f"p.{i}.q.{j}.prompt", "japanese", q["prompt"],
                f"タイ語長文: {body}。内容理解を問う日本語の設問。",
            )
            for k, choice in enumerate(q["choices"]):
                add(
                    f"p.{i}.q.{j}.choice.{k}", "japanese", choice,
                    f"設問: {q['prompt']}。日本語の意味選択肢。",
                )
            add(
                f"p.{i}.q.{j}.explanation", "japanese", q["explanation"],
                f"長文: {body}。設問: {q['prompt']}。正解理由を日本語で。",
            )

    return tasks


def localize_to_japanese(client, data):
    """Second AI pass dedicated only to Japanese localization.

    This prevents the content-generation model's Thai explanations from leaking
    into the Japanese learner UI.
    """
    tasks = build_localization_tasks(data)
    valid_keys = [task["key"] for task in tasks]

    schema = {
        "type": "object",
        "properties": {
            "items": {
                "type": "array",
                "minItems": len(tasks),
                "maxItems": len(tasks),
                "items": {
                    "type": "object",
                    "properties": {
                        "key": {"type": "string", "enum": valid_keys},
                        "text": {"type": "string"},
                    },
                    "required": ["key", "text"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["items"],
        "additionalProperties": False,
    }

    compact = json.dumps(tasks, ensure_ascii=False)
    last_problems = []

    for attempt in range(1, 4):
        print(f"Japanese localization attempt {attempt}/3")
        retry = ""
        if last_problems:
            retry = "\n前回の問題:\n- " + "\n- ".join(last_problems)

        prompt = f"""以下の教材テキストを、日本人学習者向けにローカライズしてください。

絶対ルール:
- kind=japanese は自然な日本語にする。タイ語の説明文を残さない。
- kind=katakana は source_text のタイ語発音をカタカナで書く。
- 4択の意味は発音表記ではなく、日本語の意味にする。
- 意味や解説を勝手に別内容へ変えない。
- keyは変更しない。
- 全タスクを1件も省略しない。

TASKS:
{compact}
{retry}
"""

        response = client.responses.create(
            model=MODEL,
            instructions="""日本語ローカライズ専用工程です。
kind=japanese の出力は日本語、kind=katakana の出力はカタカナ以外を認めません。
タイ語で説明してはいけません。""",
            input=prompt,
            text={
                "format": {
                    "type": "json_schema",
                    "name": "thai_news_japanese_localization_v626",
                    "strict": True,
                    "schema": schema,
                }
            },
        )
        result = json.loads(response.output_text)
        by_key = {}
        duplicates = set()
        for row in result["items"]:
            if row["key"] in by_key:
                duplicates.add(row["key"])
            by_key[row["key"]] = row["text"]

        problems = []
        if duplicates:
            problems.append("duplicate keys: " + ", ".join(sorted(duplicates)[:10]))
        missing = set(valid_keys) - set(by_key)
        extra = set(by_key) - set(valid_keys)
        if missing:
            problems.append("missing keys: " + ", ".join(sorted(missing)[:10]))
        if extra:
            problems.append("unexpected keys: " + ", ".join(sorted(extra)[:10]))

        task_map = {task["key"]: task for task in tasks}
        for key in valid_keys:
            if key not in by_key:
                continue
            value = by_key[key]
            kind = task_map[key]["kind"]
            if kind == "japanese" and not is_japanese_semantic(value):
                problems.append(f"{key} is not Japanese: {value}")
            if kind == "katakana" and not is_katakana_reading(value):
                problems.append(f"{key} is not katakana: {value}")

        if problems:
            last_problems = problems
            print("Localization validation failed:\n- " + "\n- ".join(problems[:30]))
            time.sleep(1)
            continue

        # Preserve answer indexes before overwriting the choice text.
        short_correct_indexes = [
            item["choices"].index(item["japanese"])
            for item in data["short_news"]
        ]
        passage_answer_indexes = [
            [q["choices"].index(q["answer"]) for q in passage["questions"]]
            for passage in data["reading_passages"]
        ]

        for i, item in enumerate(data["short_news"]):
            item["reading"] = by_key[f"s.{i}.reading"]
            item["choices"] = [
                by_key[f"s.{i}.choice.{j}"] for j in range(4)
            ]
            item["japanese"] = item["choices"][short_correct_indexes[i]]
            item["explanation"] = by_key[f"s.{i}.explanation"]
            item["grammar_note"] = by_key[f"s.{i}.grammar"]
            item["reading_tip"] = by_key[f"s.{i}.reading_tip"]
            item["choice_explanations"] = {
                item["choices"][j]: by_key[f"s.{i}.choice_exp.{j}"]
                for j in range(4)
            }
            for j, chunk in enumerate(item["breakdown"]):
                chunk["reading"] = by_key[f"s.{i}.break.{j}.reading"]
                chunk["japanese"] = by_key[f"s.{i}.break.{j}.meaning"]

        for i, passage in enumerate(data["reading_passages"]):
            for j, ann in enumerate(passage["annotations"]):
                ann["reading"] = by_key[f"p.{i}.ann.{j}.reading"]
                ann["japanese"] = by_key[f"p.{i}.ann.{j}.meaning"]
            for j, q in enumerate(passage["questions"]):
                q["prompt"] = by_key[f"p.{i}.q.{j}.prompt"]
                q["choices"] = [
                    by_key[f"p.{i}.q.{j}.choice.{k}"] for k in range(4)
                ]
                q["answer"] = q["choices"][passage_answer_indexes[i][j]]
                q["explanation"] = by_key[f"p.{i}.q.{j}.explanation"]

        return data

    raise RuntimeError(
        "Japanese localization failed after 3 attempts: "
        + "; ".join(last_problems[:10])
    )


def generate(client, articles, vocab, retry_note=""):
    allowed = [
        x["thai"] for x in vocab
        if int(x.get("level") or 99) <= LEVEL
    ]
    compact_vocab = "\n".join(
        f"{x['thai']} = {x.get('japanese', '')}"
        for x in vocab
        if int(x.get("level") or 99) <= LEVEL
    )
    sources = "\n\n".join(
        f"SOURCE {i+1}\n"
        f"URL: {a['source_url']}\n"
        f"TITLE: {a['source_title']}\n"
        f"DATE: {a['published_at']}\n"
        f"CATEGORY: {a['category']}\n"
        f"TEXT: {a['text']}"
        for i, a in enumerate(articles)
    )

    prompt = f'''Create Thai news-based exercises for a Japanese learner at Level {LEVEL}.

IMPORTANT:
- The JSON structure is enforced by a strict schema.
- ALL learner-facing meaning/explanation fields MUST be Japanese. Never write Thai explanations.
- Every item in `choices` is a SEMANTIC JAPANESE TRANSLATION. It is NOT a pronunciation choice.
  GOOD: "先生を助けます。" / "米の価格が上がります。"
  BAD: "シュウワイ クルー" / "プライサー エン".
- `correct_index` is the 0-based index of the correct Japanese meaning in choices.
- `reading` and every breakdown/token `reading` MUST be Japanese KATAKANA pronunciation, never romaji.
- For short_news, thai_tokens ARE the Thai sentence.
- Every short-news token comes from ALLOWED VOCABULARY. Arrange them into a NATURAL COMPLETE THAI SENTENCE of at least 4 tokens.
- The sentence MUST communicate a concrete fact from its source article. Do not create a generic or unrelated phrase merely because the words are allowed.
  INVALID examples: "อร่อยที่นั่น" for a flood article, "ราคาเงิน" as a non-sentence.
- If one article cannot be faithfully expressed with allowed vocabulary, choose ANOTHER supplied article. Never invent a connection.
- `choice_explanations` contains 4 JAPANESE reasons in the SAME ORDER as choices.
- Do not repeat the choice strings inside choice_explanations.
- Use at least 3 different source URLs across 5 short_news items when possible.
- Use no more than 2 short_news items from one source.

LONG READING:
- Each passage has 3-5 lines represented as token objects.
- kind="known": thai MUST be exactly one entry from ALLOWED VOCABULARY.
- kind="note": use only for a useful difficult source word; max 7 distinct note words per passage.
- The 2 passages MUST use different source URLs and different themes.
- Avoid making both passages about airports/aviation.
- Each question uses answer_index (0-3) to identify the correct choice.
- Preserve source facts. Do not invent facts.

TEACHING:
- Every short_news needs explanation, breakdown, grammar_note, reading_tip,
  and explanations for all 4 choices.
- explanation, grammar_note, reading_tip, choice explanations, Japanese meanings,
  comprehension questions, answers, and annotations MUST all be written in JAPANESE.
- Readings are Japanese katakana approximations.
- breakdown.japanese is the Japanese MEANING of that Thai word/chunk, never the Thai word repeated.

ALLOWED VOCABULARY:
{compact_vocab}

NEWS SOURCES:
{sources}

{retry_note}'''

    schema = build_output_schema(
        allowed,
        [a["source_url"] for a in articles],
    )
    response = client.responses.create(
        model=MODEL,
        instructions="""あなたは日本人向けタイ語教材の編集者です。
最優先ルール:
- 意味、設問、選択肢、解説、文法説明、誤答理由、注釈の意味は必ず自然な日本語で書く。
- reading欄は必ずカタカナで書く。ローマ字やタイ文字は禁止。
- タイ語はthai_tokens、token.thai、source_title/titleなどタイ語が必要な欄だけに書く。
- 4択は発音ではなく意味を問う日本語にする。
- 許可語彙でニュース内容を自然に表現できない記事は使わず、別の記事を選ぶ。
""",
        input=prompt,
        text={
            "format": {
                "type": "json_schema",
                "name": "thai_news_learning_v623",
                "strict": True,
                "schema": schema,
            }
        },
    )
    draft = json.loads(response.output_text)
    data = normalize_structured_draft(draft, allowed)
    return data, set(allowed)



def main():
    try:
        if not os.getenv("OPENAI_API_KEY"):
            raise RuntimeError("OPENAI_API_KEY is not set")

        vocab = load_vocab()
        session = requests.Session()
        session.headers.update(HEADERS)
        links = discover_article_links(session)

        articles = []
        for url in links:
            try:
                article = fetch_article(session, url)
                if len(article["text"]) > 250:
                    articles.append(article)
                    print(f"Article OK: {article['category'] or 'unknown'} | {article['source_title'][:90]}")
            except Exception as exc:
                print(f"Article skipped: {url}: {exc}")
            if len(articles) >= 10:
                break

        print(f"Usable articles: {len(articles)}")
        if len(articles) < 2:
            raise RuntimeError("Need at least 2 usable Thai PBS articles")

        from openai import OpenAI

        client = OpenAI()
        retry_note = ""
        source_urls = [a["source_url"] for a in articles]
        data = None

        for attempt in range(1, 4):
            print(f"AI content generation attempt {attempt}/3 using {MODEL}")
            candidate, allowed = generate(client, articles, vocab, retry_note)
            ok, problems = validate_content_before_localization(
                candidate, source_urls
            )
            if ok:
                data = candidate
                break

            retry_note = (
                "Previous content draft failed validation. Fix ALL:\n- "
                + "\n- ".join(problems)
            )
            print(retry_note)
            time.sleep(1)

        if data is None:
            raise RuntimeError("Content generation failed after 3 attempts")

        # Translate/explain in a separate, much simpler AI pass.
        data = localize_to_japanese(client, data)

        # Final strict learner-facing validation.
        ok, problems = validate_structured_data(data, source_urls)
        if not ok:
            raise RuntimeError(
                "Final localized data failed validation: "
                + "; ".join(problems[:20])
            )

        # Internal helper data must never leak into news_content.json.
        for passage in data["reading_passages"]:
            passage.pop("_known_violations", None)

        data["generated_at"] = datetime.now(JST).isoformat(timespec="seconds")
        data["generation_method"] = (
            f"Thai PBS discovery + {MODEL}; Level {LEVEL} constraint; "
            "dedicated Japanese localization pass."
        )
        data["source_article_count"] = len(articles)
        OUT.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(
            f"Updated news_content.json: "
            f"{len(data['short_news'])} short + "
            f"{len(data['reading_passages'])} passages"
        )
        return 0

    except Exception as exc:
        print(f"NEWS UPDATE FAILED: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
