#!/usr/bin/env python3
"""復習帳から重複しない3語をランダムに表示する学習用スクリプト。

使い方:
    python scripts/review_drill.py
    python scripts/review_drill.py ~/Downloads/review_book_export.json

復習帳はChromeのlocalStorageにあるため、先にアプリの
「復習帳をJSON保存🐍」ボタンで書き出してください。
このプログラムはデータを読み取るだけで、削除・変更しません。
"""

import json
import random
import sys
from pathlib import Path

# GitHubリポジトリ直下へ保存した場合の既定のファイル名
DEFAULT_FILE = Path(__file__).resolve().parent.parent / "review_book_export.json"


def pick_random_words(review_book, count=3):
    """タイ語が重複しないように、最大count語をランダムに選ぶ。"""
    unique_words = []
    seen_thai = set()

    for word in review_book:
        if not isinstance(word, dict):
            continue
        thai = str(word.get("thai") or "").strip()
        if not thai or thai in seen_thai:
            continue
        seen_thai.add(thai)
        unique_words.append(word)

    # sample() は元のリストを変更せず、同じ要素を二度選ばない
    return random.sample(unique_words, min(count, len(unique_words)))


def main():
    # 引数があればそのJSONファイルを読み込む。なければ既定の場所を使う
    file_path = Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else DEFAULT_FILE

    try:
        review_book = json.loads(file_path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError:
        print(f"復習帳ファイルが見つかりません: {file_path}")
        print("Trainerの「復習帳をJSON保存🐍」から書き出してください。")
        return 1
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        print(f"復習帳を読み込めませんでした: {error}")
        return 1

    if not isinstance(review_book, list):
        print("復習帳のJSON形式が違います。単語の配列が必要です。")
        return 1

    words = pick_random_words(review_book, count=3)

    if not words:
        print("復習帳には出題できる単語がありません。")
        return 0
    if len(words) < 3:
        print(f"復習帳に有効な単語が{len(words)}語しかないため、ある分だけ表示します。")

    for number, word in enumerate(words, start=1):
        print(f"{number}. タイ語: {word['thai']}")
        print(f"   意味: {word.get('japanese') or '未登録'}")
        print(f"   読み: {word.get('reading') or '未登録'}")

    print(f"\n{len(words)}語を表示しました。復習帳のデータは変更していません。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
