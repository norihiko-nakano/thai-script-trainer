#!/usr/bin/env python3
"""Weekly Thai news -> Level-constrained learning content for Thai Vocabulary Trainer Ver6.0."""
from __future__ import annotations
import json, os, re, sys, time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "news_content.json"
FALLBACK_VOCAB = ROOT / "data" / "allowed_vocab_l2.json"
MODEL = os.getenv("OPENAI_NEWS_MODEL", "gpt-5.4-mini")
TARGET_LEVEL = int(os.getenv("THAI_NEWS_LEVEL", "2"))
BKK = ZoneInfo("Asia/Bangkok")
HEADERS = {"User-Agent": "ThaiVocabularyTrainer/6.0 (+educational weekly updater)"}


def load_supabase_config():
    p = ROOT / "supabase-config.js"
    if not p.exists(): return None, None
    s = p.read_text(encoding="utf-8", errors="ignore")
    url = re.search(r'url\s*:\s*["\']([^"\']+)', s)
    key = re.search(r'publishableKey\s*:\s*["\']([^"\']+)', s)
    return (url.group(1).rstrip("/") if url else None, key.group(1) if key else None)


def load_vocab():
    url, key = load_supabase_config()
    if url and key:
        try:
            r = requests.get(
                f"{url}/rest/v1/words",
                params={"select":"thai,japanese,reading,level", "level":f"lte.{TARGET_LEVEL}", "order":"level.asc,id.asc"},
                headers={"apikey": key, "Accept":"application/json"}, timeout=25)
            r.raise_for_status()
            data = [x for x in r.json() if x.get("thai") and x.get("level")]
            if len(data) >= 50: return data
        except Exception as e:
            print(f"Supabase vocabulary fallback: {e}")
    return json.loads(FALLBACK_VOCAB.read_text(encoding="utf-8"))


def get_archive_articles(limit=8):
    today = datetime.now(BKK).date().isoformat()
    archive = f"https://www.thaipbs.or.th/news/archive/{today}"
    r = requests.get(archive, headers=HEADERS, timeout=30)
    r.raise_for_status()
    links = []
    for href in re.findall(r'href=["\']([^"\']+/news/content/\d+)["\']', r.text):
        if href.startswith("/"): href = "https://www.thaipbs.or.th" + href
        if href not in links: links.append(href)
        if len(links) >= limit: break
    if not links:
        links = list(dict.fromkeys(re.findall(r'https://www\.thaipbs\.or\.th/news/content/\d+', r.text)))[:limit]
    return links


def fetch_article(url):
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    title = (soup.find("h1") or soup.find("title"))
    title = title.get_text(" ", strip=True) if title else url
    text = " ".join(p.get_text(" ", strip=True) for p in soup.find_all("p"))
    text = re.sub(r"\s+", " ", text).strip()
    date = ""
    m = re.search(r'20\d{2}-\d{2}-\d{2}', r.text)
    if m: date = m.group(0)
    return {"source_name":"Thai PBS", "source_title":title[:300], "source_url":url, "published_at":date, "text":text[:5000]}


def clean_thai(text):
    return re.sub(r"[\s\d๐-๙%.,!?;:'\"()\[\]{}\-–—/\\]+", "", text or "")


def segmentable(text, lexicon):
    s = clean_thai(text)
    if not s: return True
    words = sorted({w for w in lexicon if w}, key=len, reverse=True)
    n = len(s); dp = [False]*(n+1); dp[0] = True
    for i in range(n):
        if not dp[i]: continue
        for w in words:
            if s.startswith(w, i): dp[i+len(w)] = True
    return dp[n]


def validate(data, allowed):
    if not isinstance(data, dict): return False, ["root is not object"]
    problems=[]
    shorts=data.get("short_news") or []
    passages=data.get("reading_passages") or []
    if len(shorts)<3: problems.append("need >=3 short_news")
    if len(passages)<1: problems.append("need >=1 reading_passage")
    for i,item in enumerate(shorts):
        if not segmentable(item.get("thai",""), allowed): problems.append(f"short_news[{i}] contains out-of-level Thai")
        if len(item.get("choices") or []) < 4: problems.append(f"short_news[{i}] needs 4 choices")
        if item.get("japanese") not in (item.get("choices") or []): problems.append(f"short_news[{i}] correct answer missing from choices")
    for i,p in enumerate(passages):
        anns={a.get("thai","") for a in p.get("annotations",[]) if a.get("thai")}
        if len(anns)>5: problems.append(f"passage[{i}] has >5 difficult words")
        if not segmentable(p.get("body_thai",""), set(allowed)|anns): problems.append(f"passage[{i}] has unannotated difficult Thai")
        for j,q in enumerate(p.get("questions",[])):
            if q.get("answer") not in (q.get("choices") or []): problems.append(f"passage[{i}].question[{j}] answer missing")
    return not problems, problems


def generate(client, articles, vocab, retry_note=""):
    allowed = [x["thai"] for x in vocab if int(x.get("level") or 99) <= TARGET_LEVEL]
    compact_vocab = "\n".join(f"{x['thai']} = {x.get('japanese','')}" for x in vocab if int(x.get("level") or 99) <= TARGET_LEVEL)
    sources = "\n\n".join(
        f"SOURCE {i+1}\nURL: {a['source_url']}\nTITLE: {a['source_title']}\nDATE: {a['published_at']}\nTEXT: {a['text']}"
        for i,a in enumerate(articles)
    )
    prompt = f"""You are generating Thai reading exercises for a Japanese learner.
Target vocabulary level: Level {TARGET_LEVEL}.

STRICT RULE FOR short_news:
- Thai sentence must be segmentable using ONLY words in ALLOWED VOCABULARY below. Do not add any other Thai word, including particles or proper nouns.
- Keep the factual meaning traceable to one supplied news source.
- Create 5 short_news items. Each has exactly 4 Japanese choices, one of which equals japanese.
- Include a Japanese-katakana reading approximation.

RULE FOR reading_passages:
- Create 2 passages, each 3-5 short Thai lines.
- Mostly use ALLOWED VOCABULARY.
- Up to 5 difficult Thai words per passage may be used, but EVERY such word must appear in annotations with Japanese meaning and katakana reading.
- Create 3 Japanese comprehension questions per passage with 4 choices and answer equal to one choice.
- Preserve news facts. Simplify language, never invent new facts.

Return JSON only with this shape:
{{
  "schema_version":1,
  "generated_at":"ISO8601",
  "target_level":{TARGET_LEVEL},
  "short_news":[{{"id":"...","level":{TARGET_LEVEL},"title":"...","thai":"...","japanese":"...","reading":"...","choices":["...","...","...","..."],"source_type":"news","source_name":"Thai PBS","source_title":"...","source_url":"exact supplied URL","published_at":"YYYY-MM-DD","ai_simplified":true}}],
  "reading_passages":[{{"id":"...","level":{TARGET_LEVEL},"title":"...","body_thai":"line1\\nline2","annotations":[{{"thai":"...","japanese":"...","reading":"..."}}],"questions":[{{"prompt":"...","choices":["...","...","...","..."],"answer":"...","explanation":"..."}}],"source_type":"news","source_name":"Thai PBS","source_title":"...","source_url":"exact supplied URL","published_at":"YYYY-MM-DD","ai_simplified":true}}]
}}

ALLOWED VOCABULARY:
{compact_vocab}

NEWS SOURCES:
{sources}

{retry_note}
"""
    response = client.responses.create(model=MODEL, input=prompt)
    raw = response.output_text.strip()
    raw = re.sub(r"^```json\s*|\s*```$", "", raw, flags=re.S)
    return json.loads(raw), set(allowed)


def main():
    if not os.getenv("OPENAI_API_KEY"):
        print("OPENAI_API_KEY is not set. Keeping existing news_content.json.")
        return 0
    vocab=load_vocab()
    links=get_archive_articles()
    if not links:
        print("No Thai PBS article links found; keeping existing content.")
        return 0
    articles=[]
    for link in links:
        try:
            a=fetch_article(link)
            if len(a["text"])>200: articles.append(a)
        except Exception as e: print(f"Skip {link}: {e}")
    if len(articles)<2:
        print("Not enough articles; keeping existing content.")
        return 0
    from openai import OpenAI
    client=OpenAI()
    retry=""
    for attempt in range(3):
        data, allowed=generate(client, articles, vocab, retry)
        ok, problems=validate(data, allowed)
        if ok:
            data["generated_at"] = datetime.now(ZoneInfo("Asia/Tokyo")).isoformat(timespec="seconds")
            data["generation_method"] = f"Weekly AI simplification using {MODEL}; vocabulary constrained to Level {TARGET_LEVEL}."
            OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
            print(f"Updated {OUT}: {len(data['short_news'])} short, {len(data['reading_passages'])} passages")
            return 0
        retry = "Previous output failed validation. Fix ALL of these problems:\n- " + "\n- ".join(problems)
        print(retry)
        time.sleep(1)
    print("Validation failed after 3 attempts; keeping existing news_content.json.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
