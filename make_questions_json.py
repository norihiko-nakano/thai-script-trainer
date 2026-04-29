import json
from pathlib import Path

import numpy as np
import pandas as pd


CSV_PATH = Path("questions.csv")
JSON_PATH = Path("questions.json")


def normalize_text(text):
    """
    文字列の前後の空白を削る。
    空欄やNaNが来ても安全に文字列へ変換する。
    """
    if pd.isna(text):
        return ""
    return str(text).strip()


def main():
    # CSVを読み込む
    df = pd.read_csv(CSV_PATH, encoding="utf-8-sig")

    # 必須カラム
    required_columns = [
        "id",
        "emoji",
        "japanese",
        "romaji",
        "basic_thai",
        "accepted_answers",
        "natural_thai",
        "tags",
    ]

    # カラム不足チェック
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise ValueError(f"Missing columns: {missing_columns}")

    # 空欄チェック
    if df[required_columns].isnull().any().any():
        raise ValueError("Some required cells are empty.")

    # 文字列を整える
    for col in required_columns:
        df[col] = df[col].apply(normalize_text)

    # accepted_answers をリストに変換
    df["accepted_answer_list"] = df["accepted_answers"].apply(
        lambda x: [answer.strip() for answer in x.split("|")]
    )

    # tags をリストに変換
    df["tag_list"] = df["tags"].apply(
        lambda x: [tag.strip() for tag in x.split("|")]
    )

    # NumPyで簡単な統計チェック
    answer_counts = df["accepted_answer_list"].apply(len).to_numpy()
    average_answer_count = np.mean(answer_counts)
    max_answer_count = np.max(answer_counts)
    min_answer_count = np.min(answer_counts)

    print("=== Dataset Check ===")
    print("Number of questions:", len(df))
    print("Average accepted answers:", average_answer_count)
    print("Max accepted answers:", max_answer_count)
    print("Min accepted answers:", min_answer_count)

    # JavaScriptで使いやすい形に変換
    questions = []

    for _, row in df.iterrows():
        question = {
            "id": int(row["id"]),
            "emoji": row["emoji"],
            "japanese": row["japanese"],
            "romaji": row["romaji"],
            "basicThai": row["basic_thai"],
            "acceptedAnswers": row["accepted_answer_list"],
            "naturalThai": row["natural_thai"],
            "tags": row["tag_list"],
        }

        questions.append(question)

    # JSONとして保存
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(questions, f, ensure_ascii=False, indent=2)

    print(f"Created: {JSON_PATH}")


if __name__ == "__main__":
    main()