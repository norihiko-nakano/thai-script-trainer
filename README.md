# Thai Vocabulary Trainer Ver10.5

日本人向けのタイ語学習アプリです。単語・文章・ニュースの読解、タイ語入力、発話練習、復習帳を備えています。

**[アプリを開く](https://norihiko-nakano.github.io/thai-script-trainer/)** · **[変更履歴 Ver0.0〜10.5](CHANGELOG.md)** · **[English guide](docs/versions/README_V9.0.md)**

## 復習するときの読む順番 🐼

| 順番 | ファイル | 学べること |
|---|---|---|
| 1 | [scripts/review_drill.py](scripts/review_drill.py) | 復習帳のJSONを読み、ランダムに3語を選ぶPython処理 |
| 2 | [notebooks/review_drill_colab.ipynb](notebooks/review_drill_colab.ipynb) | Colabでの復習ドリル練習 |
| 3 | [index.html](index.html) | 画面・ボタン・採点・復習帳・履歴を動かすHTML/CSS/JavaScript |
| 4 | [scripts/fetch_news.py](scripts/fetch_news.py) | ニュース記事の取得と保存 |
| 5 | [scripts/generate_news.py](scripts/generate_news.py) | 保存した記事からAIでタイ語の問題候補を作る |
| 6 | [scripts/build_news_content.py](scripts/build_news_content.py) | 日本語の選択肢・解説を作り、検証して配信用JSONに保存 |
| 補助 | [scripts/news_common.py](scripts/news_common.py) | JSON入出力、辞書取得、AI呼出し、原文との照合 |

Webの復習ドリルは `index.html` のJavaScriptで動きます。`review_drill.py` とColabノートはPython学習用で、GitHub Pages上でPythonを直接実行する構成ではありません。

## 現在の機能

- 「読む」：単語・文章セット・ニュース短文の意味を選ぶ。
- 「書く」：日本語を見てタイ語を入力する。
- 「話す」：お手本音声と発話練習。音声認識の対応状況はブラウザによります。
- 「会話」💬🌺：タイ人の女の子マリとタイ語でチャット。レベル1〜3を選ぶと、そのレベルまでの単語を中心に話し方を合わせます。日本語訳・読み上げ・マイク入力つき。単語をタップすると復習帳へ入ります（読みは辞書にある語だけ表示）。
- 復習帳・復習ドリル：「分かった」で復習帳から削除し、「分からん」で残す。
- 学習履歴・覚え方メモ：ブラウザのlocalStorageに保存。
- 日本語 / English：画面の言語を切り替え。学習用の日本語訳そのものは英訳しません。
- **長文読解は冬眠中🐻🧊🗿**：生成・日本語化・検証・起動を停止。再開用コードは残しています。

## ファイルの置き場所

| 場所 | 役割 |
|---|---|
| `index.html` | メイン画面と学習処理 |
| `interface-v9.js` / `speaking-v8.js` | 英語UI・発話練習 |
| `chat-v10.js` / `images/mali-*.webp` | 会話画面（マリとのチャット）とマリの表情イラスト（通常・笑顔・驚き） |
| `supabase/functions/thai-chat/` | 会話用のSupabase Edge Function。OpenAIのキーはSupabaseのSecretsだけに置く |
| `supabase-config.js` | 公開用の辞書接続設定 |
| `questions.json` / `news_content.json` | アプリが読み込む単語・ニュース教材 |
| `scripts/` | ニュース更新、復習練習、ODS変換のPython |
| `notebooks/` | Colab学習教材 |
| `data/` | 元ニュース・候補・語彙のスナップショット。更新処理やテストで使用 |
| `tests/` | Python・JavaScriptの検証コード |
| `sql/` | DBの読取権限やLevel割当の設定資料 |
| `docs/` | 語彙確認資料・過去版の説明・全コミット索引 |
| `.github/workflows/` | ニュースの自動更新設定 |

## 会話機能の設定（Supabase）

1. Supabase の Edge Functions → Secrets に `OPENAI_API_KEY`（会話用キー）と `TVT_CHAT_PASSCODE`（自分で決める合言葉）を登録する。任意で `OPENAI_CHAT_MODEL`（既定 `gpt-5.4-mini`）、`OPENAI_TTS_VOICE`（既定 `nova`。アプリの「マリの声の設定」で選んだ声が優先）。
2. Edge Functions に `thai-chat` という名前で `supabase/functions/thai-chat/index.ts` をデプロイし、JWTの確認（Verify JWT）をオフにする。
3. アプリの「会話」で合言葉を1回入力する（このブラウザのlocalStorageにだけ保存）。

ブラウザにはOpenAIのキーを置きません。Supabaseの無料プランが一時停止中のときは会話できないので、ダッシュボードで再開してください。

## マリの行動パターン（シナリオファイル）

`data/mali_scenarios.json` を書き換えると、コードを触らずにマリを変えられます。

- `profile`：マリの設定（年齢・仕事・好きなもの）。会話で矛盾しないようにAIへ渡す
- `mood_rules`：表情（normal / happy / surprised）の選び方
- `scenarios`：会話の流れ。`title` / `description` / `emoji` は画面の日本語、`situation` / `role` / `goal` / `steps` はAIへの指示（英語推奨）。`steps` は1回の返事で1つずつ進み、最後まで行くと「🎉 クリア」。`levels` に入っているレベルのときだけ選べる

読み込めなかったときはフリートークで動きます。

## ニュース更新の流れ

1. `scripts/fetch_news.py` → `data/news_raw.json`
2. `scripts/generate_news.py` → `data/news_candidates.json`
3. `scripts/build_news_content.py` → `news_content.json`

毎週日曜08:10（日本時間）予定で、ニュース短文5問を更新します。問題にできない記事は検証済み予備候補に切り替え、必要数を満たせない場合は以前の配信教材を維持します。長文は現在生成しません。

ローカルで実行する場合は、リポジトリ直下から次を実行します。APIキーは環境変数 `OPENAI_API_KEY` に設定してください。

```bash
python -m pip install -r requirements-news.txt
python scripts/update_news.py
```

GitHub Actionsも同じ3段階のスクリプトを使用します。

## 画面をローカルで開く

リポジトリ直下で `python -m http.server 8000` を実行し、ブラウザで http://localhost:8000 を開きます。履歴や個人メモはサイトURLごとの保存なので、公開アプリとlocalhostでは別になります。

## その他の資料・補助ツール

- [過去版の説明書](docs/versions/)：当時の仕様を保存。現在の仕様とは異なる場合があります。
- [Ver9.0までの全147コミット索引](docs/COMMIT_HISTORY_THROUGH_V9.md)：細かな更新も含む原記録。
- [語彙の確認資料](docs/VOCABULARY_REVIEW_V7.md)：Level 3選抜・追加候補など。
- [DB設定SQL](sql/)：手動設定用。ファイルを置くだけでDBが変更されることはありません。
- [ODS→JSON変換](scripts/make_questions_json.py)：旧語彙取り込み用。既定出力は `questions.json` なので、学習時は別の出力名を指定してください。旧Level割当の変換処理で、現在のLevel 3割当を再構築するものではありません。

```bash
python scripts/make_questions_json.py --input "Thai language.ods" --output sample_questions.json
```

2026-11-07に未使用の初期CSV・旧文章JSON・重複した更新入口を削除し、資料と補助コードをフォルダ別に整理しました。過去の内容はGit履歴から参照できます。
