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
import ipywidgets as widgets
from IPython.display import HTML, display

# GitHubリポジトリ直下へ保存した場合の既定のファイル名
DEFAULT_FILE = Path(__file__).resolve().parent.parent / "review_book_export.json"


def pick_random_words(review_book, count=3):
    """復習帳から最大count語をランダムに選ぶ（元データは変更しない）。"""
    return random.sample(review_book, min(count, len(review_book)))


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

    html = "<h2>復習ドリル🐼</h2>"
    html += f"<p>{i+1}問目/{len(words)}問</p>"
    html += f"<p>{words[i]['thai']}</p>"
    
    display(HTML(html))
    button = widgets.Button(description="答えを見る🐼")
    answer_area = widgets.Output()
    
    def show_answer(b):
        with answer_area:
            answer_area.clear_output()
            html = f"<h2>正解：{words[i]['japanese']}</h2>"
            display(HTML(html))
    
    button.on_click(show_answer)
    display(button, answer_area)
    print(f"\n{len(words)}語を表示しました。復習帳のデータは変更していません。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
