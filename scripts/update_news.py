#!/usr/bin/env python3
"""Thai PBS -> AI Thai learning content. Ver6.2.1."""
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



def validate(data, allowed, source_urls):
    """Validate AI JSON without crashing on malformed field types.

    Any dict/list that appears where a string is expected becomes a validation
    message that is fed back to the next AI retry instead of causing
    `TypeError: unhashable type: 'dict'`.
    """
    problems = []

    if not isinstance(data, dict):
        return False, ["top-level JSON must be an object"]

    shorts = data.get("short_news")
    passages = data.get("reading_passages")
    if not isinstance(shorts, list):
        problems.append("short_news must be an array")
        shorts = []
    if not isinstance(passages, list):
        problems.append("reading_passages must be an array")
        passages = []

    source_urls = {u for u in source_urls if isinstance(u, str)}

    if len(shorts) < 3:
        problems.append("need >=3 short_news")
    if len(passages) != 2:
        problems.append("need exactly 2 reading_passages")

    used_short_sources = set()

    for i, item in enumerate(shorts):
        if not isinstance(item, dict):
            problems.append(f"short_news[{i}] must be an object")
            continue

        thai = item.get("thai")
        japanese = item.get("japanese")
        choices = item.get("choices")
        source_url = item.get("source_url")

        if not isinstance(thai, str):
            problems.append(f"short_news[{i}].thai must be a string")
        elif not segmentable(thai, allowed):
            problems.append(f"short_news[{i}] contains out-of-level Thai")

        if not isinstance(japanese, str):
            problems.append(f"short_news[{i}].japanese must be a string")

        if not isinstance(choices, list):
            problems.append(f"short_news[{i}].choices must be an array")
            choices = []
        elif not all(isinstance(choice, str) for choice in choices):
            problems.append(f"short_news[{i}].choices must contain strings only")
            choices = [choice for choice in choices if isinstance(choice, str)]

        if len(choices) != 4:
            problems.append(f"short_news[{i}] needs exactly 4 choices")
        if isinstance(japanese, str) and japanese not in choices:
            problems.append(f"short_news[{i}] correct answer missing")

        if not isinstance(item.get("explanation"), str) or not item.get("explanation"):
            problems.append(f"short_news[{i}] needs explanation")

        breakdown = item.get("breakdown")
        if not isinstance(breakdown, list) or len(breakdown) < 2:
            problems.append(f"short_news[{i}] needs word breakdown")
        else:
            for j, chunk in enumerate(breakdown):
                if not isinstance(chunk, dict):
                    problems.append(f"short_news[{i}].breakdown[{j}] must be an object")
                    continue
                for key in ("thai", "reading", "japanese"):
                    if not isinstance(chunk.get(key), str):
                        problems.append(
                            f"short_news[{i}].breakdown[{j}].{key} must be a string"
                        )

        if not isinstance(item.get("grammar_note"), str) or not item.get("grammar_note"):
            problems.append(f"short_news[{i}] needs grammar_note")
        if not isinstance(item.get("reading_tip"), str) or not item.get("reading_tip"):
            problems.append(f"short_news[{i}] needs reading_tip")

        hints = item.get("choice_explanations")
        if not isinstance(hints, dict):
            problems.append(f"short_news[{i}].choice_explanations must be an object")
            hints = {}
        for choice in choices:
            if choice not in hints or not isinstance(hints.get(choice), str):
                problems.append(
                    f"short_news[{i}] missing string choice explanation: {choice}"
                )

        if not isinstance(source_url, str):
            problems.append(f"short_news[{i}].source_url must be a string")
        elif source_url not in source_urls:
            problems.append(f"short_news[{i}] has unknown source_url")
        else:
            used_short_sources.add(source_url)

    required_diversity = min(3, len(source_urls), len(shorts))
    if len(used_short_sources) < required_diversity:
        problems.append(
            f"short_news needs at least {required_diversity} distinct sources"
        )

    passage_sources = []
    for i, passage in enumerate(passages):
        if not isinstance(passage, dict):
            problems.append(f"passage[{i}] must be an object")
            continue

        body_thai = passage.get("body_thai")
        if not isinstance(body_thai, str):
            problems.append(f"passage[{i}].body_thai must be a string")
            body_thai = ""

        raw_annotations = passage.get("annotations")
        if not isinstance(raw_annotations, list):
            problems.append(f"passage[{i}].annotations must be an array")
            raw_annotations = []

        annotations = set()
        for j, ann in enumerate(raw_annotations):
            if not isinstance(ann, dict):
                problems.append(f"passage[{i}].annotations[{j}] must be an object")
                continue
            thai = ann.get("thai")
            if not isinstance(thai, str):
                problems.append(
                    f"passage[{i}].annotations[{j}].thai must be a string"
                )
            elif thai:
                annotations.add(thai)
            for key in ("japanese", "reading"):
                if not isinstance(ann.get(key), str):
                    problems.append(
                        f"passage[{i}].annotations[{j}].{key} must be a string"
                    )

        if len(annotations) > 5:
            problems.append(f"passage[{i}] has >5 difficult words")

        if body_thai and not segmentable(body_thai, set(allowed) | annotations):
            problems.append(f"passage[{i}] has unannotated difficult Thai")

        questions = passage.get("questions")
        if not isinstance(questions, list):
            problems.append(f"passage[{i}].questions must be an array")
            questions = []
        if len(questions) != 3:
            problems.append(f"passage[{i}] needs exactly 3 questions")

        for j, q in enumerate(questions):
            if not isinstance(q, dict):
                problems.append(f"passage[{i}] question[{j}] must be an object")
                continue
            q_choices = q.get("choices")
            if not isinstance(q_choices, list):
                problems.append(
                    f"passage[{i}] question[{j}].choices must be an array"
                )
                q_choices = []
            elif not all(isinstance(choice, str) for choice in q_choices):
                problems.append(
                    f"passage[{i}] question[{j}].choices must contain strings only"
                )
                q_choices = [
                    choice for choice in q_choices if isinstance(choice, str)
                ]

            if len(q_choices) != 4:
                problems.append(
                    f"passage[{i}] question[{j}] needs exactly 4 choices"
                )

            answer = q.get("answer")
            if not isinstance(answer, str):
                problems.append(
                    f"passage[{i}] question[{j}].answer must be a string"
                )
            elif answer not in q_choices:
                problems.append(
                    f"passage[{i}] question[{j}] answer missing"
                )

            if not isinstance(q.get("prompt"), str):
                problems.append(
                    f"passage[{i}] question[{j}].prompt must be a string"
                )
            if not isinstance(q.get("explanation"), str) or not q.get("explanation"):
                problems.append(
                    f"passage[{i}] question[{j}] explanation missing"
                )

        source_url = passage.get("source_url")
        if not isinstance(source_url, str):
            problems.append(f"passage[{i}].source_url must be a string")
        elif source_url not in source_urls:
            problems.append(f"passage[{i}] has unknown source_url")
        else:
            passage_sources.append(source_url)

    if len(source_urls) >= 2 and len(set(passage_sources)) < 2:
        problems.append("the 2 passages must use different news sources")

    return not problems, problems



def generate(client, articles, vocab, retry_note=""):
    allowed = [x["thai"] for x in vocab if int(x.get("level") or 99) <= LEVEL]
    compact_vocab = "\n".join(f"{x['thai']} = {x.get('japanese', '')}" for x in vocab if int(x.get("level") or 99) <= LEVEL)
    sources = "\n\n".join(
        f"SOURCE {i+1}\nURL: {a['source_url']}\nTITLE: {a['source_title']}\nDATE: {a['published_at']}\nCATEGORY: {a['category']}\nTEXT: {a['text']}"
        for i, a in enumerate(articles)
    )

    prompt = f'''Create Thai reading exercises for a Japanese learner, Level {LEVEL}.

SOURCE DIVERSITY:
- Use multiple supplied news sources.
- For 5 short_news items, use at least 3 different source URLs if at least 3 sources are available.
- Use no more than 2 short_news items from one source.
- The 2 long reading passages MUST use different source URLs and different themes.
- Avoid making both passages about airports/aviation unless no other usable topic exists.
- source_url must exactly match one supplied URL.

RULE FOR short_news:
- Create 5 items.
- Thai sentence must be segmentable using ONLY words in ALLOWED VOCABULARY below. Do not add any other Thai word, including particles or proper nouns.
- Keep the factual meaning traceable to one supplied news source.
- Each has exactly 4 Japanese choices, one equals japanese. Every choice MUST be a plain JSON string, never an object.
- Include a Japanese katakana reading approximation.
- EVERY item must teach after answering: explanation, breakdown (2-8 chunks with Thai/katakana/Japanese), grammar_note, reading_tip, and choice_explanations for ALL 4 choices.

RULE FOR reading_passages:
- Create exactly 2 passages, each 3-5 short Thai lines.
- Mostly use ALLOWED VOCABULARY.
- Up to 5 difficult Thai words per passage may be used, but EVERY such word must appear in annotations. Every annotation must be an object with plain-string fields thai, japanese, reading.
- Each passage has exactly 3 Japanese comprehension questions, each with exactly 4 choices, one answer, and an explanation.
- Preserve supplied news facts. Do not invent facts.

Return JSON only. Follow the requested field types exactly: text fields are plain strings, choices are arrays of strings, and annotation/breakdown entries are objects with string fields. Return keys schema_version, generated_at, target_level, short_news, reading_passages. Each short_news item must include id, level, title, thai, japanese, reading, choices, explanation, breakdown, grammar_note, reading_tip, choice_explanations, source_type, source_name, source_title, source_url, published_at, ai_simplified. Each passage must include id, level, title, body_thai, annotations, questions, source_type, source_name, source_title, source_url, published_at, ai_simplified.

ALLOWED VOCABULARY:
{compact_vocab}

NEWS SOURCES:
{sources}

{retry_note}'''
    response = client.responses.create(model=MODEL, input=prompt)
    raw = response.output_text.strip()
    raw = re.sub(r"^```json\s*|\s*```$", "", raw, flags=re.S)
    return json.loads(raw), set(allowed)


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
        for attempt in range(1, 4):
            print(f"AI generation attempt {attempt}/3 using {MODEL}")
            data, allowed = generate(client, articles, vocab, retry_note)
            ok, problems = validate(data, allowed, source_urls)
            if ok:
                data["generated_at"] = datetime.now(JST).isoformat(timespec="seconds")
                data["generation_method"] = f"Thai PBS multi-page recent-news discovery + {MODEL}; Level {LEVEL} vocabulary constraint."
                data["source_article_count"] = len(articles)
                OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                print(f"Updated news_content.json: {len(data['short_news'])} short + {len(data['reading_passages'])} passages")
                return 0

            retry_note = "Previous output failed validation. Fix ALL of these:\n- " + "\n- ".join(problems)
            print(retry_note)
            time.sleep(1)

        raise RuntimeError("Validation failed after 3 AI attempts")

    except Exception as exc:
        print(f"NEWS UPDATE FAILED: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
