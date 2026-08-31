# Thai Vocabulary Trainer Ver6.4

Ver6.4ではニュース長文生成をいったんフリーズします 🧊🐘。

毎週日曜日に更新するのは **ニュース短文5問だけ** です。

```text
Thai PBS
  ↓
data/news_raw.json
  ↓
AIがニュース短文候補を生成
  ↓
data/news_candidates.json
  ↓
5問を日本人向け教材化
  ↓
news_content.json
    short_news: 5
    reading_passages: []
```

- ニュース長文生成は停止
- アプリの長文読解ボタンもフリーズ表示
- Level 3以降で長文機能を再検討
- 日曜08:10 JSTの自動更新は維持
- 手動 Run workflow も使用可能
- Supabase SQL、通常単語問題、復習帳、🐙苦手単語、学習履歴は変更なし
