# Thai Vocabulary Trainer · Ver9.0

**Live application:** https://norihiko-nakano.github.io/thai-script-trainer/

Thai Vocabulary Trainer is a browser-based Thai-learning application originally designed for **Japanese speakers studying Thai**. Version 9.0 adds a bilingual **interface and feature overview** so visitors, including international recruiters, can understand the product without reading Japanese.

## How to explore the application

Select **English** in the interface switcher near the app title. On browsers whose language is not Japanese, the English interface is selected automatically unless a preference was previously saved.

The home screen describes each feature before you try it:

| Feature | What it does |
|---|---|
| Write Thai 🐮 | Uses a built-in Thai keyboard to answer written vocabulary exercises |
| Read Thai 🐨 | Multiple-choice Thai reading exercises, with pronunciation notes |
| Thai news reading 📰🐘 | News-based reading and comprehension exercises, prepared through an AI-supported content pipeline |
| Review notebook 🍣 | Automatically saves missed words; allows personal mnemonic notes |
| Panda Review Drill 🐼 | Tests up to three words from the notebook, removing known words and retaining words marked "Not yet" |
| Learning history 📊 | Records answered questions and accuracy on the current browser, with CSV export |
| Weak-word priority 🐙 | Prioritizes words missed three or more times when the latest attempt was incorrect |
| Thai script guide 📕🐨 | Reference on Thai consonants, vowels, tone marks, final consonants and numbers |

**Important scope:** Version 9.0 translates the *interface, navigation, feature explanations and key user guidance*, **not the Japanese vocabulary meanings or news passages**. Japanese meanings are deliberately preserved as learning content. This is not an English-to-Thai vocabulary course.

## Implementation

- **Frontend:** plain HTML, CSS and JavaScript (no framework required)
- **Vocabulary source:** a bundled JSON snapshot; when configured, the app can read updated words from Supabase
- **User data:** review notebook and learning history in browser `localStorage`, not automatically shared with GitHub or Supabase
- **News materials:** a Python pipeline for fetching, assembling and checking lessons; the pipeline uses AI for educational content generation
- **Deployment:** GitHub Pages
- **Internationalization in Ver9.0:** `interface-v9.js` applies English interface strings over the existing Japanese app without altering question data, grading rules, or browser storage keys

This approach keeps the existing Japanese application backward-compatible while allowing international visitors to navigate the UI and understand its functionality.

## Notes

The English switcher changes interface language only. Existing Japanese learning materials, stored review notebook entries and question-answer validation are unchanged. Some extended reading-reference descriptions and learning content remain in Japanese.

For development setup and earlier changes, see [README_V7.0.md](README_V7.0.md) and [README.md](README.md).
