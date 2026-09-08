# Thai Vocabulary Trainer Ver7.0

既存のVer6.4を更新したLevel 3解放版です。デザイン、タイ語キーボード、回答履歴、苦手単語、復習帳、読みメモを引き継ぎます。

## 使い始める

GitHubの変更案をmainへ取り込むか、ZIPを展開して、この一式を既存のthai-script-trainerリポジトリに反映してください。`index.html`だけでなく、`questions.json`、`news_content.json`、`data`、`scripts`、`.github/workflows/update_thai_news.yml`も必要です。

GitHub Pagesの更新後、いつものURLを再読み込みしてください。
https://norihiko-nakano.github.io/thai-script-trainer/

- 「読む📕🐨」→「Level 3」：ニュース5問を指定すると、L3が3問＋L2の復習2問。単語問題は別に設定できます。
- 「書く🐮」→「Level 3」：新しく選抜した200語を練習できます。
- 「長文読解📰🐘」→「Level 3」：2本の教材から1本を選び、3問に答えます。
- ニュースが少ないLevelでは、設定数を上限に在庫分を出題します。L1は現時点では単語のみです。

ローカルで確認する場合は、展開したフォルダで `python -m http.server 8000` を実行し、`http://localhost:8000` を開きます。HTMLのダブルクリックではデータを取得できません。

**履歴はブラウザ・サイトのURLごとの保存です。いつものGitHub Pages URLで更新すれば引き継がれますが、localhostなど別のURLには自動移行しません。** 保存キーは変更していません。

## 単語と辞書

| Level | 今回の登録語数 | 方針 |
|---|---:|---|
| 1 | 100 | 既存を維持 |
| 2 | 100 | 既存を維持 |
| 3 | 200 | 既存の未割当語から選抜 |
| 4〜8 | 未割当 | 辞書拡充後、各200語を選抜予定 |

実際のSupabase辞書は513件でした。1,400語の辞書を新規完成した版ではありません。追加候補169語と、重複・誤記の確認事項は `VOCABULARY_REVIEW_V7.md` にあります。L3選抜結果は `data/level3_words.json` に収録しています。

`questions.json`は現在のSupabaseのID・意味・読みを基にした同梱データです。通信できる場合はSupabaseの最新の読み・意味・設定済みLevelを優先し、Levelが未設定の同一ID・同一タイ語だけ同梱の割当を補います。通信に失敗した場合も同梱の400語で学習できます。既存辞書の読みをAIで修正していません。

SupabaseにもL3割当を反映する場合は `setup_ver7_level3.sql` をSQL Editorで実行します。200件のIDとタイ語を照合してからLevelのみ更新し、意味・読み・既存L1/L2・学習履歴は更新しません。二重実行可能ですが、既存データとの衝突があれば中断します。今回、本番DBへのSQL実行はしていません。

## ニュースと長文

初期教材は、リポジトリに保存されていたThai PBS記事のスナップショット（取得日：2026年9月6日）に基づきます。新たに取得した最新ニュースではありません。個別の記事日付・リンクを表示し、根拠箇所をJSONの`source_review`に保存しています。

週次更新は引き続き日曜08:10 JST予定です。GitHub Actionsの実行時刻は遅れる場合があります。

1. 元記事を取得してスナップショット保存。
2. 既知語彙でL2復習2問＋L3新規3問、L3長文2本を生成。
3. 生成とは別のAI呼出しで、原文が内容を裏付けるか、タイ語が自然かを検証。
4. 日本語の選択肢・解説を作成し、原文と翻訳・正解の一意性を再検証。
5. 短文の読み・単語意味は辞書からそのまま取得。長文の注釈の読みも辞書から取得し、未登録なら表示しません。
6. 全件合格後のみ`news_content.json`を置換。途中で失敗した場合は最後に成功した教材を維持。

AIによる意味検証は誤りを完全に排除する保証ではありません。検証で不合格になる記事は採用せず、教材不足の場合は更新が失敗して以前の教材を保持します。自動生成のモデルは既存設定の`gpt-5.4-mini`を維持しています。作業用チャットのモデル指定と、週次生成に使用するAPIモデルは別です。

GitHub Actionsには既存の `OPENAI_API_KEY` Secretが必要です。ローカル実行する場合：

```bash
python -m pip install -r requirements-news.txt
python scripts/update_news.py
```

キーは環境変数で設定し、ファイルに書き込まないでください。Ver7.0の週次生成は`THAI_NEWS_LEVEL=3`が前提です。古い`data/news_candidates.json`をStage 3だけで使い回さず、Stage 2から生成してください。旧ルートの`update_news.py`も新しい検証付きパイプラインに転送します。

## 確認したこと

- Pythonテスト10件：200語選抜、辞書の読み、根拠のない教材の拒否、生成・組立て両ステージ、途中失敗時の教材保持。
- 実際のJavaScriptをNodeで実行：100/100/200語、3対2の復習、辞書の更新優先、通信失敗時のフォールバック、未検証教材の非表示、保存済み履歴を消さないこと。
- JavaScript/Python構文と差分の空白チェック。

ブラウザでの画面操作確認、有料APIを使う実ニュース生成、本番SQLの実行、GitHub Pages本番への反映は今回の検証に含みません。

```bash
python -m unittest discover -s tests -v
node tests/test_frontend.cjs
```
