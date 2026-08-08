# Thai Vocabulary Trainer Ver3.1

## 変更点
- Supabase `sentences` から `candidate1_word_id` / `candidate2_word_id` を取得
- Supabase `words` から `choice_group_id` を取得
- 文章問題は candidate 2語を同じ choice_group の別語へ差し替えて4択を生成
- 4択は「正解 / candidate1だけ変更 / candidate2だけ変更 / 両方変更」
- candidate対応文章を優先して文章問題に出題
- candidate情報がない旧文章はVer3.0方式へ自動フォールバック

## 更新方法
1. Supabase SQL Editorで `setup_v3_1_read.sql` を1回実行
2. GitHub Pagesの `index.html` をVer3.1版へ置換
3. すでに設定済みの `supabase-config.js` はそのまま残す（上書き不要）
4. `questions.json` と `sentences.json` も今のものをそのまま残す

## DB前提
- `sentences.candidate1_word_id`
- `sentences.candidate2_word_id`
- `words.choice_group_id`

候補語の日本語表記が文章の日本語訳中に見つからない場合、その文章だけ従来の「別文章から3択を取る方式」へ戻ります。
