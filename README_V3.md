# Thai Vocabulary Trainer Ver3.0

## Ver3.0 の追加機能
- 「日本語を選ぶ」モードで、単語問題と文章問題を混ぜて出題
- 初期設定は 単語3問 + 文章2問
- 文章問題はタイ語文 → 日本語4択
- Level 1 の文章は Supabase の `sentences` テーブルから取得
- Supabase未設定・取得失敗時は `sentences.json` の11文を予備データとして使用
- 学習履歴に `questionType`（word / sentence）を保存
- 苦手単語ランキングには文章問題を混ぜない

## GitHub Pages に置くファイル
- index.html
- questions.json
- sentences.json
- supabase-config.js

`make_questions_json.py` は単語データ再生成用なので、GitHub上に置いても置かなくても動作には影響しません。

## Supabase 接続
1. `setup_supabase_read.sql` を Supabase SQL Editor で1回実行
2. `supabase-config.js` の `url` と `publishableKey` を自分の値へ変更
3. secret key / service_role key はブラウザ側に絶対に置かない
4. GitHub Pagesへアップロード

Supabase接続に成功すると画面に `文章データ：Supabase` と表示されます。
未設定の場合は `文章データ：ローカル予備データ` と表示されます。

## 出題仕様
- 「日本語を選ぶ」: 初期値 単語3 + 文章2
- 「タイ語を書く」: 単語のみ、初期値5問
- 文章問題でも読みのアルファベット入力は採点せず履歴に保存
