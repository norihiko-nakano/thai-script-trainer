# Thai Vocabulary Trainer Ver6.3

## English

Ver6.3 reorganizes the AI news feature into a staged, inspectable pipeline.
The key design rule is: **fetch news first, save the raw articles to a file, then let AI read that saved file to create learning candidates.**

### Pipeline

```text
Thai PBS
  ↓
scripts/fetch_news.py
  ↓
data/news_raw.json          ← raw news warehouse
  ↓
scripts/generate_news.py    ← AI reads this saved snapshot
  ↓
data/news_candidates.json   ← Thai-only candidate snapshot
  ↓
scripts/build_news_content.py
  ↓
news_content.json           ← learner-facing Japanese material
  ↓
index.html
```

### Stage 1: Raw news snapshot

`scripts/fetch_news.py` scans Thai PBS `/news`, archive pages, and embedded Next.js/JSON article links. It stores article title, URL, publication date, category, and article body in `data/news_raw.json`.

This stage does **not** call OpenAI.

The GitHub workflow commits `news_raw.json` immediately. Therefore, even if a later AI step fails, the fetched news remains available for inspection and another generation attempt.

### Stage 2: Thai learning candidates

`scripts/generate_news.py` reads `data/news_raw.json` as its news source. It does not fetch the web again.

It also loads Level 1–2 vocabulary from Supabase (repository fallback available) and creates:

- 5 final short-news candidates using only known vocabulary
- 2 long-reading candidates from different source articles
- 1–7 difficult words in each long passage, marked for later annotation

The intermediate result is stored in `data/news_candidates.json` and committed separately.

### Stage 3: Japanese learner material

`scripts/build_news_content.py` reads the saved candidates and raw snapshot. It handles each short question and long passage separately, which keeps the Japanese-generation task small and easier to validate.

For short news it creates:

- Japanese meaning choices
- correct-answer index (converted to the actual answer by Python)
- katakana readings
- word breakdown
- Japanese meaning explanation
- grammar note
- reading tip
- explanation for each of the four choices

For long reading it creates Japanese difficult-word annotations and three comprehension questions.

Only after this stage succeeds is `news_content.json` updated.

### GitHub Actions

The existing weekly schedule remains Sunday 08:10 JST. Manual `Run workflow` also remains available.

The workflow now commits three checkpoints independently:

1. `data/news_raw.json`
2. `data/news_candidates.json`
3. `news_content.json`

This makes failures easy to locate.

### Repository update

Replace/add these files:

```text
scripts/news_common.py
scripts/fetch_news.py
scripts/generate_news.py
scripts/build_news_content.py
scripts/update_news.py
.github/workflows/update_thai_news.yml
requirements-news.txt
```

`index.html` only changes the displayed version to Ver6.3. It is optional for the news pipeline itself.

Keep the existing `supabase-config.js`, `questions.json`, Supabase database, learning history, review notebook, weak-word logic, and other Ver6.2 app data unchanged.

No Supabase SQL change is required.

---

## 日本語

Ver6.3では、ニュースAI機能を一度整理して、**ニュース取得とAI教材生成を完全に分離**しました。

一番大事なルールは、

> **先にニュースを取得してファイルへ保存し、AIはその保存済みファイルを読んで教材を作る**

ことです。

### 全体構成

```text
Thai PBS
  ↓
① fetch_news.py
  ↓
data/news_raw.json          ← ニュース倉庫 📰📦
  ↓
② generate_news.py          ← AIはこのファイルを読む
  ↓
data/news_candidates.json   ← タイ語教材候補
  ↓
③ build_news_content.py
  ↓
news_content.json           ← アプリで使う完成教材
  ↓
index.html
```

### ① ニュース取得

`scripts/fetch_news.py` がThai PBSから記事を取得します。

- `/news`
- `/news/archive`
- アーカイブpage 1
- 最近3日程度のアーカイブ候補
- HTML/Next.js内に埋め込まれた記事URL

を探し、記事タイトル、URL、公開日、カテゴリ、本文を `data/news_raw.json` に保存します。

**この工程ではOpenAI APIを使いません。**

さらにGitHub Actionsでは、このrawファイルを取得直後にCommitします。後のAI処理が失敗しても、その日に取得したニュース本文はGitHubに残ります。

### ② AI教材候補

`scripts/generate_news.py` はインターネットを見に行かず、**`data/news_raw.json`だけをニュース材料として読み込みます。**

SupabaseのLevel 1〜2語彙と照合しながら、

- ニュース短文候補5本
- 長文読解候補2本
- 長文の難語1〜7語

を作り、`data/news_candidates.json` に保存します。

短文は既知語彙だけを使用します。長文2本は別の記事を使います。

### ③ 日本人向け教材化

`scripts/build_news_content.py` が候補ファイルを読みます。

短文は1問ずつ、長文も1本ずつAIへ渡すため、以前のように一度のAI呼び出しへ大量の仕事を詰め込みません。

短文では、

- 日本語4択
- 正解
- カタカナ読み
- 単語分解
- 意味解説
- 文型
- 読みポイント
- 4択それぞれの理由

を作ります。

長文では難語の日本語注釈と3問の読解問題を作ります。

全部成功した場合だけ `news_content.json` を更新します。

### GitHub Actions

日曜08:10 JSTの自動更新はそのままです。`Run workflow`による手動更新も使えます。

今回は途中ファイルもCommitするため、失敗場所が明確になります。

```text
news_raw.json が変       → ニュース取得の問題
news_raw は正常、候補が変 → AI候補生成の問題
候補は正常、完成版が変    → 日本語教材化の問題
```

### GitHubへ入れるファイル

```text
scripts/news_common.py
scripts/fetch_news.py
scripts/generate_news.py
scripts/build_news_content.py
scripts/update_news.py
.github/workflows/update_thai_news.yml
requirements-news.txt
```

`index.html`は表示をVer6.3にするだけなので、ニュース処理だけ試す場合は後回しでも構いません。

Supabase SQL変更はありません。既存の`supabase-config.js`、`questions.json`、復習帳、🐙苦手単語、学習履歴などもそのままです。
