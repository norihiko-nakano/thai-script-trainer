# Thai Vocabulary Trainer Ver5.0

## English

### Overview

Ver5.0 adds a personal review notebook on top of the progressive 10-level learning system.

The application now treats vocabulary and sentence difficulty separately:

- Word questions use vocabulary from the selected level.
- A Level X sentence may contain vocabulary from Level 1 through Level X.
- The level of a sentence is determined by the highest-level word used in that sentence.
- Sentence choices continue to use the Ver3.1 candidate/choice-group system so that incorrect choices remain similar to the correct answer.

### Ver5.0 changes

- Added **復習帳φ(`･ω･´ )🍣 (Personal Review Notebook)** below the local learning-history panel.
- Incorrect **word** questions are automatically added to the review notebook. Sentence questions are not auto-added.
- Each review item shows the Thai word, Japanese meaning, reading, level, and number of wrong answers.
- Each word has a freely editable mnemonic text box.
- Mnemonic notes are auto-saved while typing.
- Review notebook data is stored only in the browser using `localStorage`.
- Review notes are not sent to Supabase or GitHub.
- Added search, individual deletion, and full-clear controls for the review notebook.
- No database migration is required from Ver4.0 to Ver5.0.

### Ver4.0 changes

- Expanded the UI from Level 1-3 to Level 1-10.
- Unlocked Level 2 with 100 vocabulary items.
- Added 10 Level 2 sentence questions.
- Level 2 sentences use only Level 1-2 vocabulary.
- Added a database rule that rejects a sentence-word link when the word level is higher than the sentence level.
- Word questions are now loaded from the Supabase `words` table through the REST API.
- `questions.json` remains as a fallback when the Supabase word request is unavailable.
- Sentence replacement candidates are cumulative. For a Level X sentence, replacement words may come from the same `choice_group_id` at Levels 1-X.
- Levels 3-10 are already shown in the UI and automatically become available when enough words are assigned to those levels.

### Setup

1. Run `setup_v4_0.sql` in the Supabase SQL Editor.
2. Replace the GitHub Pages `index.html` with the Ver4.0 `index.html`.
3. Keep the existing `supabase-config.js`. Do not replace it.
4. Wait for GitHub Pages deployment to finish.
5. Reload the app with a hard refresh.

After setup, the difficulty screen should show approximately:

- Level 1: existing Level 1 words and sentences
- Level 2: 100 words + 10 sentences
- Level 3-10: Preparing

### Level rule

```text
Level 1 sentence -> Level 1 words only
Level 2 sentence -> Level 1-2 words
Level 3 sentence -> Level 1-3 words
...
Level X sentence -> Level 1-X words
```

Example:

```text
L1 + L1 + L2 + L1 -> Sentence Level 2
```

### Version history

#### Ver0.x - Thai Script Trainer
- Practiced converting Japanese sounds into Thai script.
- Example: 🦛 `kaba` -> Thai-script input.

#### Ver1.x - Thai Vocabulary Quiz
- Moved to actual Thai vocabulary.
- Added Thai -> Japanese four-choice questions.

#### Ver2.x - Difficulty and Learning History
- Added vocabulary difficulty levels.
- Defined the first 100 basic words as Level 1.
- Added Thai typing, learning history, CSV export, and Roman-letter reading attempts.

#### Ver3.0 - Sentence Questions and Supabase
- Added sentence questions.
- Introduced Supabase `sentences` and `sentence_words`.
- Enabled mixed word + sentence quizzes.

#### Ver3.1 - Similar Sentence Choices
- Added `candidate1_word_id` and `candidate2_word_id`.
- Added `choice_group` and `words.choice_group_id`.
- Generated similar four-choice answers by replacing selected words.

#### Ver3.1.x - REST Connection Stabilization
- Added connection diagnostics.
- Moved sentence retrieval to direct Supabase REST access.

#### Ver4.0 - 10-Level Progressive Learning
- Expanded levels to 1-10.
- Unlocked Level 2.
- Added cumulative sentence vocabulary rules.
- Made vocabulary content database-driven.

#### Ver5.0 - Personal Review Notebook
- Added a browser-local review notebook for incorrect vocabulary.
- Added freely editable mnemonic notes with automatic local saving.

---

## 日本語

### 概要

Ver4.0では、難易度をLevel 1〜10まで拡張し、段階的に学習できる仕組みを導入しました。

単語問題と文章問題では、Levelの扱いを次のように分けます。

- 単語問題は、選択したLevelの単語を出題します。
- Level Xの文章では、Level 1〜Xの単語を使用できます。
- 文章のLevelは、その文章で使われている最も高いLevelの単語によって決まります。
- 文章の4択はVer3.1のcandidate / choice_group方式を引き継ぎ、正解と似た選択肢を生成します。

### Ver5.0の変更点

- 「📊 この端末の学習履歴」の下に **復習帳φ(`･ω･´ )🍣** を追加。
- 不正解になった**単語問題**を復習帳へ自動登録。文章問題は自動登録しない。
- タイ語、意味、読み、Level、不正解回数を一覧表示。
- 各単語に自由編集できる「覚え方メモ」テキストボックスを追加。
- 覚え方メモは入力中に自動保存。
- 復習帳と個人メモはブラウザの `localStorage` のみに保存。
- SupabaseやGitHubには個人メモを送信しない。
- 復習帳の検索、個別削除、全消去に対応。
- Ver4.0からVer5.0へのDB変更・SQL実行は不要。

### Ver4.0の変更点

- 難易度画面をLevel 1〜10へ拡張。
- Level 2を100語で正式解禁。
- Level 2文章を10文追加。
- Level 2文章はLevel 1〜2の単語だけで構成。
- sentence_words登録時に、文章Levelより高い単語を登録できないDBルールを追加。
- 単語問題もSupabaseの`words`テーブルからREST API経由で取得。
- Supabaseから単語を取得できない場合は`questions.json`をフォールバックとして利用。
- Level X文章のcandidate差し替え語は、同じ`choice_group_id`のLevel 1〜Xから選択可能。
- Level 3〜10も画面に表示し、DBに十分な単語を登録すると自動的に解禁される構造に変更。

### 導入手順

1. SupabaseのSQL Editorで`setup_v4_0.sql`を実行します。
2. GitHub Pagesの`index.html`をVer4.0版へ交換します。
3. 現在使用している`supabase-config.js`はそのまま残します。
4. GitHub Pagesのdeploy完了を待ちます。
5. アプリを強制再読み込みします。

導入後の難易度画面は、おおむね次の状態になります。

- Level 1：現在のLevel 1単語・文章
- Level 2：100語 + 10文
- Level 3〜10：準備中

### Levelルール

```text
Level 1文章 -> Level 1単語のみ
Level 2文章 -> Level 1〜2単語
Level 3文章 -> Level 1〜3単語
...
Level X文章 -> Level 1〜X単語
```

例：

```text
L1 + L1 + L2 + L1 -> 文章Level 2
```

### バージョン履歴

#### Ver0.x - Thai Script Trainer
- 日本語の音をタイ文字で入力する練習。
- 例：🦛 `kaba` -> タイ文字入力。

#### Ver1.x - タイ語語彙クイズ
- 実際のタイ語単語を使う学習へ移行。
- タイ語 -> 日本語4択を追加。

#### Ver2.x - 難易度と学習履歴
- 単語に難易度を設定。
- 最初の基礎100語をLevel 1に設定。
- タイ語入力、学習履歴、CSV出力、ローマ字での読み入力を追加。

#### Ver3.0 - 文章問題とSupabase
- 文章問題を追加。
- Supabaseの`sentences`と`sentence_words`を導入。
- 単語 + 文章の混合出題に対応。

#### Ver3.1 - 類似した文章4択
- `candidate1_word_id` / `candidate2_word_id`を追加。
- `choice_group`と`words.choice_group_id`を追加。
- candidate単語を差し替えて、似た4択を自動生成。

#### Ver3.1.x - REST接続の安定化
- Supabase接続診断を追加。
- 文章取得をSupabase REST API直接接続へ変更。

#### Ver4.0 - Level 1〜10段階学習
- 難易度を1〜10へ拡張。
- Level 2を解禁。
- Level X文章 = Level 1〜X単語という累積ルールを導入。
- 単語データもDB駆動型へ移行。
