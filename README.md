# Thai Vocabulary Trainer

## Version History

### Ver0.x – Thai Script Trainer

The first prototype of the application.

* Developed as a tool for practicing Thai script input.
* Users converted Japanese sounds into Thai characters.
* Example: 🦛 “kaba” → input the sound using Thai script.
* The main purpose was to practice Thai character recognition and typing rather than learning actual Thai vocabulary.

**Main concept:** Japanese sound → Thai script

---

### Ver1.x – Thai Vocabulary Quiz

The application evolved from a Thai script trainer into a vocabulary learning tool.

* Replaced Japanese transliteration exercises with actual Thai vocabulary.
* Added Thai → Japanese multiple-choice questions.
* Users selected the correct Japanese meaning from four choices.
* The project shifted from script practice to practical Thai vocabulary learning.

**Main concept:** Thai word → Japanese meaning

---

### Ver2.x – Difficulty Levels and Learning History

Added difficulty management and learning records.

* Introduced difficulty levels for vocabulary.
* Defined 100 basic words as Level 1.
* Added Japanese → Thai input questions.
* Added an on-screen Thai keyboard for PC users.
* Supported both Thai → Japanese multiple-choice questions and Japanese → Thai typing questions.
* Added answer history using local storage.
* Added history viewing and CSV export.
* Added a field for entering the pronunciation of Thai words using Roman letters.
* Pronunciation input is stored for review but is not automatically graded.
* The correct Katakana pronunciation is displayed after answering.
* Later Ver2.x updates also cleaned the public dataset and removed unnecessary private development notes.

**Main concept:** Vocabulary learning + difficulty levels + learning history

---

### Ver3.0 – Sentence Questions and Supabase

Expanded the application from individual vocabulary questions to sentence comprehension.

* Introduced Supabase as the application database.
* Added a `sentences` table.
* Added Thai sentence → Japanese multiple-choice questions.
* Enabled mixed quizzes containing both vocabulary and sentence questions.
* Supported quiz configurations such as three vocabulary questions plus two sentence questions.
* Separated sentence data from the application code.
* New sentences can be added through the database without modifying the main application code.
* Added a `sentence_words` table to manage the relationship between sentences and the vocabulary used in them.

**Main concept:** Vocabulary → Sentence comprehension

---

### Ver3.1 – Similar Multiple-Choice Sentences

Improved sentence questions by making incorrect choices more similar to the correct answer.

In the previous version, choices could be very different from each other. This sometimes allowed users to find the answer by recognizing only one word.

For example:

**วันนี้ครูกินไข่ดื่มนม**

1. The teacher eats eggs and drinks milk today.
2. The teacher eats eggs and drinks coffee today.
3. The teacher eats chicken and drinks milk today.
4. The teacher eats chicken and drinks coffee today.

Main changes:

* Added `candidate1_word_id` and `candidate2_word_id` to the `sentences` table.
* Two replaceable vocabulary items can be specified for each sentence.
* Added a `choice_group` table.
* Added `choice_group_id` to the `words` table.
* Words belonging to the same semantic group can be substituted automatically.
* The application generates four similar answer choices by replacing one or both candidate words.
* Sentence questions were redesigned to generally contain at least five vocabulary items.
* The new design requires users to understand more of the sentence instead of identifying a single keyword.

Example:

`ไข่` → same choice group → `ไก่`

`นม` → same choice group → `กาแฟ`

**Main concept:** Exam-style similar choices + better sentence comprehension

---

### Ver3.1.x – Supabase Connection Improvements

Improved and debugged the connection between the application and Supabase.

* Ver3.1.1 restricted sentence questions to sentences that support the new similar-choice system.
* Ver3.1.2 introduced a diagnostic mode to display detailed Supabase connection errors.
* Ver3.1.3 changed sentence retrieval from the Supabase JavaScript SDK to direct access through the Supabase REST API.
* Confirmed successful retrieval of sentence and vocabulary data from Supabase REST.
* Database content can now be expanded without redeploying the application itself.

**Main concept:** Stable database-driven content management

---

### Ver4.0 – Multi-Level Learning System

The next major version will expand the difficulty system into a full progressive learning structure.

Planned features:

* Expand difficulty levels from Level 1 to Level 10.
* Officially unlock Level 2 vocabulary.
* Allow Levels 3–10 to be added progressively.
* Classify vocabulary according to difficulty.
* Manage sentence questions by level.

Sentence difficulty will use a cumulative vocabulary rule:

* Level 1 sentences may use Level 1 vocabulary only.
* Level 2 sentences may use vocabulary from Levels 1–2.
* Level 3 sentences may use vocabulary from Levels 1–3.
* ...
* Level X sentences may use vocabulary from Levels 1–X.

The level of a sentence is determined by the highest-level vocabulary item contained in that sentence.

Example:

`Level 1 + Level 1 + Level 2 + Level 1`

→ **Sentence Level 2**

This approach allows basic vocabulary to continue appearing while progressively introducing more difficult words.

**Main concept:** Level 1–10 progressive learning

---

## Application Evolution

**Ver0**
Thai script typing

↓

**Ver1**
Thai vocabulary learning

↓

**Ver2**
Difficulty levels + learning history

↓

**Ver3**
Sentence comprehension + database

↓

**Ver3.1**
Exam-style similar answer choices

↓

**Ver4**
Level 1–10 progressive learning

---

# 日本語版

## バージョン履歴

### Ver0.x – Thai Script Trainer

最初の試作版。

* タイ文字入力を練習するアプリとして開発。
* 日本語の音をタイ文字で表現する問題を出題。
* 例：🦛「kaba」という音をタイ文字で入力する。
* 実際のタイ語単語を覚えるというより、タイ文字の認識と入力練習を目的とした実験版。

**主なコンセプト：** 日本語の音 → タイ文字

---

### Ver1.x – タイ語語彙クイズ

タイ文字入力練習から、実際のタイ語語彙を学習するアプリへ発展。

* 実際に使われるタイ語単語を採用。
* タイ語 → 日本語の4択問題を追加。
* 表示されたタイ語について、4つの選択肢から正しい日本語の意味を選択。
* タイ文字そのものの練習から、実用的なタイ語語彙学習へ移行。

**主なコンセプト：** タイ語単語 → 日本語の意味

---

### Ver2.x – 難易度と学習履歴

単語を難易度別に管理し、学習記録を残せるようにしたバージョン。

* 単語に難易度Levelを設定。
* 基礎単語100語をLevel 1として設定。
* 日本語 → タイ語入力問題を追加。
* PC上で利用できるタイ語クリックキーボードを追加。
* タイ語 → 日本語4択と、日本語 → タイ語入力の複数モードに対応。
* Local Storageを利用して回答履歴を保存。
* 学習履歴の表示とCSV出力に対応。
* タイ語の読みをアルファベットで入力して保存する機能を追加。
* 読み入力は自動採点せず、学習記録として保存。
* 回答後に正しいカタカナ読みを表示。
* Ver2.x後半では公開用データを整理し、開発中の不要な個人用メモなども削除。

**主なコンセプト：** 語彙学習 + 難易度 + 学習履歴

---

### Ver3.0 – 文章問題とSupabase

単語問題だけでなく、タイ語文章を読む学習へ拡張。

* Supabaseをデータベースとして導入。
* `sentences`テーブルを追加。
* タイ語文章 → 日本語4択の文章問題を追加。
* 単語問題と文章問題を混合して出題できるようにした。
* 「単語3問＋文章2問」などの出題構成に対応。
* 文章データをアプリ本体のコードから分離。
* アプリのコードを変更しなくても、DBへ文章を追加することで問題数を増やせる構成へ変更。
* `sentence_words`テーブルを追加し、文章と文章中で使用されている単語の関係を管理。

**主なコンセプト：** 単語 → 文章読解

---

### Ver3.1 – 類似した4択文章問題

文章問題の不正解選択肢を、正解と似た内容になるよう改善。

以前は選択肢同士が大きく異なり、単語を1つ知っているだけでも正解できる場合があった。

例：

**วันนี้ครูกินไข่ดื่มนม**

1. 今日は先生が卵を食べて牛乳を飲みます。
2. 今日は先生が卵を食べてコーヒーを飲みます。
3. 今日は先生が鶏肉を食べて牛乳を飲みます。
4. 今日は先生が鶏肉を食べてコーヒーを飲みます。

主な変更：

* `sentences`に`candidate1_word_id`と`candidate2_word_id`を追加。
* 各文章について、選択肢生成時に差し替える2単語を指定。
* `choice_group`テーブルを追加。
* `words`テーブルに`choice_group_id`を追加。
* 同じ意味カテゴリーに属する単語同士を自動的に交換。
* candidate1、candidate2の片方または両方を変更することで、似た4択を自動生成。
* 文章問題は原則として5語以上を目標に変更。
* 1つの単語だけではなく、文章全体を読まなければ正解しにくい問題へ改善。

例：

`ไข่` → 同じchoice group → `ไก่`

`นม` → 同じchoice group → `กาแฟ`

**主なコンセプト：** 試験形式に近い類似選択肢 + 文章読解

---

### Ver3.1.x – Supabase接続の改善

Ver3.1の開発・動作確認中に、Supabaseとの接続方法を改善。

* Ver3.1.1では、類似4択に対応した文章のみを出題するよう変更。
* Ver3.1.2では、Supabaseの接続エラーを詳しく表示する診断モードを追加。
* Ver3.1.3では、Supabase JavaScript SDK経由の取得からSupabase REST APIへの直接アクセス方式へ変更。
* Supabase RESTから文章データ・単語データを正常に取得できることを確認。
* DBへ問題を追加するだけで、アプリ本体を再デプロイせず内容を増やせる構成が安定して利用可能になった。

**主なコンセプト：** DB駆動型コンテンツ管理の安定化

---

### Ver4.0 – 10段階の難易度システム

次のメジャーバージョンでは、難易度システムを本格的な段階学習方式へ拡張する。

予定している機能：

* 難易度をLevel 1〜10まで拡張。
* Level 2の単語問題を正式に解禁。
* Level 3〜10も順次追加可能な構造にする。
* 単語を難易度別に分類。
* 文章問題についてもLevel別に管理。

文章問題では、累積方式を採用する。

* Level 1文章 → Level 1単語のみ使用
* Level 2文章 → Level 1〜2単語を使用
* Level 3文章 → Level 1〜3単語を使用
* …
* Level X文章 → Level 1〜X単語を使用

文章のLevelは、その文章で使われている単語のうち、**最も高いLevelの単語**によって決定する。

例：

`Level 1 + Level 1 + Level 2 + Level 1`

→ **文章Level 2**

これにより、基礎単語を繰り返し復習しながら、新しいLevelの語彙を段階的に文章へ追加できる。

**主なコンセプト：** Level 1〜10の段階的学習

---

## アプリの進化

**Ver0**
タイ文字を書く

↓

**Ver1**
タイ語単語を覚える

↓

**Ver2**
難易度 + 学習履歴

↓

**Ver3**
文章読解 + データベース

↓

**Ver3.1**
試験形式に近い類似4択

↓

**Ver4**
Level 1〜10の段階的学習
