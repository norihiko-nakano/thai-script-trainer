#!/usr/bin/env python3
"""Stage 1: fetch Thai PBS news and save a raw snapshot to data/news_raw.json."""
from __future__ import annotations

import html
import json
import os
import re
import sys
from datetime import datetime, timedelta
from urllib.parse import urljoin, urlparse
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

from news_common import RAW_FILE, now_jst, write_json_atomic

BASE = "https://www.thaipbs.or.th"
BKK = ZoneInfo("Asia/Bangkok")
DAYS = int(os.getenv("THAI_NEWS_DISCOVERY_DAYS", "3"))
MAX_LINKS = int(os.getenv("THAI_NEWS_MAX_LINKS", "40"))
MAX_ARTICLES = int(os.getenv("THAI_NEWS_MAX_ARTICLES", "12"))
MIN_ARTICLES = int(os.getenv("THAI_NEWS_MIN_ARTICLES", "5"))
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 Chrome/151 Safari/537.36"
    ),
    "Accept-Language": "th-TH,th;q=0.9,en;q=0.7",
}


def canonical_article_url(value: str):
    value = html.unescape(value or "").replace("\\/", "/")
    value = re.sub(r"\\u0*02[fF]", "/", value)
    value = urljoin(BASE, value)
    parsed = urlparse(value)
    match = re.fullmatch(r"/news/content/(\d+)/?", parsed.path)
    if match and parsed.netloc in {"thaipbs.or.th", "www.thaipbs.or.th"}:
        return f"{BASE}/news/content/{match.group(1)}"
    return None


def extract_article_links(source: str):
    found = []

    def add(value):
        url = canonical_article_url(value)
        if url and url not in found:
            found.append(url)

    soup = BeautifulSoup(source, "html.parser")
    for tag in soup.find_all("a", href=True):
        add(tag["href"])

    # Thai PBS/Next.js can embed article paths in serialized JSON rather than <a>.
    raw = html.unescape(source).replace("\\/", "/")
    raw = re.sub(r"\\u0*02[fF]", "/", raw)
    for value in re.findall(
        r"(?:https?://(?:www\.)?thaipbs\.or\.th)?/news/content/\d+",
        raw,
    ):
        add(value)
    return found


def discover_links(session):
    today = datetime.now(BKK).date()
    pages = [
        BASE + "/news",
        BASE + "/news/archive",
        BASE + "/news/archive?page=1",
    ]
    pages.extend(
        f"{BASE}/news/archive/{(today - timedelta(days=i)).isoformat()}"
        for i in range(max(1, DAYS))
    )

    links = []
    print(f"FETCH: scanning {len(pages)} discovery pages over {DAYS} day(s)")
    for page in dict.fromkeys(pages):
        try:
            response = session.get(page, timeout=30)
            response.raise_for_status()
            page_links = extract_article_links(response.text)
            print(
                f"FETCH: {page} -> {len(page_links)} links "
                f"({len(response.text):,} bytes)"
            )
            for url in page_links:
                if url not in links:
                    links.append(url)
                if len(links) >= MAX_LINKS:
                    break
        except Exception as exc:
            print(f"FETCH warning: {page}: {exc}")
        if len(links) >= MAX_LINKS:
            break

    print(f"FETCH: {len(links)} unique article links")
    if not links:
        raise RuntimeError("No Thai PBS article links found")
    return links


def fetch_article(session, url: str):
    response = session.get(url, timeout=30)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    def meta(key):
        tag = (
            soup.find("meta", attrs={"property": key})
            or soup.find("meta", attrs={"name": key})
        )
        return (tag.get("content") or "").strip() if tag else ""

    title = meta("og:title")
    if not title:
        heading = soup.find("h1") or soup.find("title")
        title = heading.get_text(" ", strip=True) if heading else url
    published_at = meta("article:published_time")[:10]
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
                published_at = published_at or str(item.get("datePublished") or "")[:10]
                category = category or str(item.get("articleSection") or "")
                body = body or str(item.get("articleBody") or "")
            stack.extend(
                value for value in item.values()
                if isinstance(value, (dict, list))
            )

    if not body:
        root = soup.find("article") or soup
        paragraphs = [
            p.get_text(" ", strip=True)
            for p in root.find_all("p")
            if len(p.get_text(" ", strip=True)) >= 20
        ]
        body = " ".join(paragraphs)

    body = re.sub(r"\s+", " ", body).strip()
    return {
        "source_name": "Thai PBS",
        "source_title": title[:300],
        "source_url": url,
        "published_at": published_at,
        "category": category[:80],
        "body": body[:8000],
    }


def main():
    try:
        session = requests.Session()
        session.headers.update(HEADERS)
        links = discover_links(session)

        articles = []
        for url in links:
            try:
                article = fetch_article(session, url)
                if len(article["body"]) < 250:
                    print(f"FETCH skip short article: {url}")
                    continue
                articles.append(article)
                print(
                    "FETCH article OK: "
                    f"{article['category'] or 'unknown'} | "
                    f"{article['source_title'][:90]}"
                )
            except Exception as exc:
                print(f"FETCH article warning: {url}: {exc}")
            if len(articles) >= MAX_ARTICLES:
                break

        print(f"FETCH: usable articles = {len(articles)}")
        if len(articles) < MIN_ARTICLES:
            raise RuntimeError(
                f"Only {len(articles)} usable articles; need at least {MIN_ARTICLES}"
            )

        snapshot = {
            "schema_version": 1,
            "fetched_at": now_jst(),
            "source_name": "Thai PBS",
            "discovery_days": DAYS,
            "article_count": len(articles),
            "articles": articles,
        }
        write_json_atomic(RAW_FILE, snapshot)
        print(f"FETCH DONE: wrote {RAW_FILE} ({len(articles)} articles)")
        return 0
    except Exception as exc:
        print(f"FETCH FAILED: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
