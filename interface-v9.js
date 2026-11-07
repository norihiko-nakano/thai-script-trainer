/* Thai Vocabulary Trainer Ver9.0: interface localization only.
 * Learning data, Japanese translations, grading, and saved review notes are unchanged.
 */
(function () {
  "use strict";
  const KEY = "thaiTrainerInterfaceLanguageV9";
  const $ = (selector) => document.querySelector(selector);
  const FIXED = [
    ["#loadingScreen .subtitle", "Loading Thai vocabulary and reading materials... 🐘"],
    ["#errorScreen h2", "Could not load the learning data"],
    ["#menuScreen > .subtitle", "Practice Thai reading and writing with interactive lessons. 🐘"],
    ['[data-mode="writing"] .mode-title', "Write Thai 🐮"],
    ['[data-mode="writing"] .mode-description', "See a Japanese clue, then type Thai using the on-screen keyboard."],
    ['[data-mode="choice"] .mode-title', "Read Thai 🐨"],
    ['[data-mode="choice"] .mode-description', "Read Thai words and select their Japanese meanings. Includes news and sentences."],
    ['[data-mode="longreading"] .mode-title', "News Reading 📰🐘"],
    ['[data-mode="longreading"] .mode-description', "Read longer Thai news passages and answer comprehension questions (Level 3)."],
    ["#historyHeading", "📊 Your learning progress"],
    ["#menuScreen .review-book-launch > p.history-note", "Missed words are automatically added to your personal notebook. Write and save your own memory cues."],
    ["#menuScreen .reading-memo-launch > p.history-note", "A Thai script reference: consonants, vowels, tone marks, final consonants and Thai digits."],
    ["#menuScreen .history-stats .history-stat:nth-child(1) span", "Total answers"],
    ["#menuScreen .history-stats .history-stat:nth-child(2) span", "Accuracy"],
    ["#menuScreen .history-stats .history-stat:nth-child(3) span", "Answered today"],
    ["#viewHistoryButton", "View progress"],
    ["#exportHistoryButton", "Export history as CSV"],
    ["#clearHistoryButton", "Clear history"],
    ["#openReviewBookButton", "Open review notebook"],
    ["#openReviewDrillButton", "Panda review drill 🐼"],
    ["#exportReviewBookButton", "Export review notebook as JSON 🐍"],
    ["#openReadingMemoButton", "Open Thai reading guide"],
    ["#difficultyScreen .difficulty-header h2", "Choose a difficulty level 🎚️"],
    ["#difficultyScreen > p.muted.center", "Levels 1–2 contain 100 words each; Level 3 contains 200. Higher levels are being developed. Japanese meanings are used because this app teaches Thai to Japanese speakers."],
    ["#difficultyBackButton", "← Back"],
    ["#compositionHeading", "Question mix 🧩"],
    ['label[for="wordQuestionCount"]', "Vocabulary 🐟"],
    ['label[for="sentenceQuestionCount"]', "Sentence practice 🐬"],
    ['label[for="newsQuestionCount"]', "News questions 📰"],
    ['[data-difficulty="1"] .difficulty-title', "Level 1 · Basics"],
    ['[data-difficulty="2"] .difficulty-title', "Level 2 · Foundation+"],
    ['[data-difficulty="3"] .difficulty-title', "Level 3 · Beginner"],
    ['[data-difficulty="1"] .difficulty-description', "Level 1 vocabulary + news reading"],
    ['[data-difficulty="2"] .difficulty-description', "Level 2 vocabulary + approximately 20% review + news"],
    ['[data-difficulty="3"] .difficulty-description', "Level 3 vocabulary + approximately 20% review + news"],
    ["#historyScreen .history-page-header h2", "Learning history 📊"],
    ["#historyScreen > p.muted.center", "Review your answers recorded in this browser."],
    ["#historyScreen #weakWordsHeading + p.history-note", "Words missed three or more times and most recently answered incorrectly are prioritized in practice."],
    ["#historyBackButton", "← Back"],
    ["#historyScreen .history-overview-item:nth-child(1) span", "Total answers"],
    ["#historyScreen .history-overview-item:nth-child(2) span", "Accuracy"],
    ["#historyScreen .history-overview-item:nth-child(3) span", "Study days"],
    ["#historyScreen .history-overview-item:nth-child(4) span", "Avg. response time"],
    ['label[for="historyModeFilter"]', "Practice mode"],
    ['label[for="historyResultFilter"]', "Result"],
    ['label[for="historySortOrder"]', "Sort by"],
    ['label[for="historySearchInput"]', "Find a word or answer"],
    ["#weakWordsHeading", "🐙 Words to focus on"],
    ["#historyListHeading", "Answer log"],
    ["#historyLoadMoreButton", "Show 50 more"],
    ["#historyPageExportButton", "Export CSV"],
    ["#historyPageClearButton", "Clear history"],
    ["#reviewBookScreen .history-page-header h2", "Review notebook 🍣"],
    ["#reviewBookScreen > p.muted.center", "This notebook is stored in your browser, not on GitHub or Supabase."],
    ["#reviewBookScreen .history-note", "Columns: Thai / meaning / pronunciation / level and errors / personal memory cue."],
    ["#reviewBookBackButton", "← Back"],
    ['label[for="reviewBookSearchInput"]', "Search words, meanings and notes"],
    ["#clearReviewBookButton", "Clear notebook"],
    ["#reviewDrillScreen .history-page-header h2", "Panda Review Drill 🐼"],
    ["#reviewDrillScreen .history-note.center", "Review up to three randomly chosen notebook words. After revealing the answer, Got it removes the word; Not yet keeps it. Both continue to the next word. Export your notebook to JSON before clearing important notes."],
    ["#reviewDrillBackButton", "← Back"],
    ["#reviewDrillRevealButton", "Reveal answer 🐼"],
    ["#reviewDrillKnownButton", "Got it! ⚡"],
    ["#reviewDrillUnknownButton", "Not yet ☁️"],
    ["#reviewDrillAgainButton", "Review 3 more words 🐼"],
    ["#readingMemoScreen .history-page-header h2", "Thai Script Guide 📕🐨"],
    ["#readingMemoBackButton", "← Back"],
    ["#clearReadingMemoButton", "Clear my personal notes"],
    ["#readingMemoScreen .reading-memo-footer + p.history-note", "Personal notes are stored only in this browser, not on GitHub or Supabase."],
    ["#quitButton", "← Back"],
    ["#writingArea label[for='answerInput']", "Your Thai answer"],
    [".keyboard-toolbar span:nth-child(1)", "Thai on-screen keyboard"],
    [".keyboard-toolbar span:nth-child(2)", "A physical keyboard also works"],
    ["#readingArea .reading-help", "Pronunciation is not graded. You can compare your romanization with the stored reading after answering."],
    ["#submitButton", "Check answer"],
    ["#resultScreen h2", "Your results 🎉"],
    ["#retryWrongButton", "Practice missed questions"],
    ["#restartButton", "Try this mode again"],
    ["#menuButton", "Back to main menu"],
    ["#readingMemoScreen .reading-memo-footer .history-note", "Personal notes stay in this browser."]
  ];
  const JAPANESE_TO_ENGLISH = new Map([
    ["すべて", "All"], ["正解のみ", "Correct only"], ["不正解のみ", "Incorrect only"],
    ["新しい順", "Newest first"], ["古い順", "Oldest first"],
    ["0問", "0 questions"], ["1問", "1 question"], ["2問", "2 questions"],
    ["3問", "3 questions"], ["5問", "5 questions"], ["10問", "10 questions"],
    ["20問", "20 questions"], ["100問", "100 questions"],
    ["0セット", "0 sets"], ["1セット（3問）", "1 set (3 questions)"],
    ["2セット（6問）", "2 sets (6 questions)"], ["3セット（9問）", "3 sets (9 questions)"],
    ["準備中", "Coming soon"], ["読み込み中", "Loading"],
    ["🐨 読む📕🐨", "🐨 Read Thai"], ["🐮 書くφ(" + String.fromCharCode(96) + "･ω･´ )🐮", "🐮 Write Thai"],
    ["📰 長文読解📰🐘", "📰 News Reading"],
    ["書くφ(" + String.fromCharCode(96) + "･ω･´ )🐮", "Write Thai 🐮"],
    ["読む📕🐨", "Read Thai 🐨"], ["長文読解📰🐘", "News Reading 📰🐘"],
    ["戻る", "Back"], ["答えを見る🐼", "Reveal answer 🐼"], ["回答する", "Check answer"],
    ["次の問題へ", "Next question"], ["結果を見る", "See results"],
    ["この日本語をタイ語で入力してください", "Type the Thai word for this Japanese meaning"],
    ["🐙 苦手単語：この日本語をタイ語で入力してください", "🐙 Focus word: type the Thai translation"],
    ["このタイ語の意味を選んでください", "Choose the Japanese meaning of this Thai word"],
    ["🐙 苦手単語：このタイ語の意味を選んでください", "🐙 Focus word: choose its Japanese meaning"],
    ["このタイ語の文章の意味を選んでください", "Choose the Japanese meaning of this Thai sentence"],
    ["📰 ニュース読解の意味を選んでください", "Choose the Japanese meaning of this Thai news sentence"],
    ["本文を読んで答えてください", "Read the Thai passage and answer"],
    ["このタイ語をどう読んだか、アルファベットで入力", "Type your pronunciation in Latin letters (or ? if unsure)"],
    ["この文章をどう読んだか、アルファベットで入力", "Type how you read this sentence in Latin letters"],
    ["✅ 正解！ ดีมาก!", "✅ Correct! ดีมาก!"],
    ["❌ 不正解。ここで覚えれば勝ちですじゃ", "❌ Not correct. Review the answer below."],
    ["意味", "Japanese meaning"], ["正しい読み", "Pronunciation (Japanese)"],
    ["あなたの読み（採点なし）", "Your pronunciation (not graded)"],
    ["あなたの回答", "Your answer"], ["解説", "Explanation"],
    ["使い方メモ", "Usage note"], ["語順メモ", "Word order note"],
    ["単語 🐟️", "Vocabulary 🐟"], ["文章読解 🐬", "Sentence practice 🐬"],
    ["長文", "Long reading"], ["正解", "Correct answer"],
    ["未回答", "No answer"], ["未入力", "Not entered"], ["未登録", "Not available"],
    ["単語問題 🐟️・文章読解 🐬・ニュース読解 📰から選んで練習", "Choose vocabulary questions, sentences or news practice."],
    ["タイの実ニュースをAIで学習用に調整。数個の難語は※日本語注釈で読む", "AI-supported Thai news lessons with Japanese vocabulary notes."],
    ["日本語を見て、タイ語を画面キーボードで入力（単語問題のみ）", "See Japanese clues and type Thai with the on-screen keyboard."],
    ["復習する問題", "Questions to review"], ["削除", "Delete"],
    ["まだ回答履歴はありません。", "No answers yet."],
    ["まだ復習帳は空です。不正解になった単語が自動で追加されます。", "The notebook is empty. Missed words are added automatically."],
    ["間違えた単語がここに集まりますぞφ(" + String.fromCharCode(96) + "･ω･´ )🍣", "Words you miss will appear here 🍣"],
    ["検索条件に合う単語がありません。", "No matching words."],
    ["回答一覧", "Answer history"],
    ["回答履歴を読み込んでいます…", "Loading answer history..."],
    ["満点ですぞ！タイ文字部隊、完全整列(σﾟ∀ﾟ)σ🇹🇭", "Perfect score! Great job! 🇹🇭"],
    ["かなり良いですじゃ。あと少しで🦛級です。", "Great progress! 🦛"],
    ["土台はできています。間違えた語をもう一周しましょう。", "Good foundation. Try reviewing missed words."],
    ["ここから語彙が育ちますぞ。復習ボタンで再出撃です🐙", "Vocabulary grows with practice. Review your missed words! 🐙"]
  ]);
  const original = new WeakMap();
  const translated = new WeakMap();
  let language = "ja";
  let scheduled = false;
  let observer = null;

  function isEnglish() { return language === "en"; }
  function setFixed(element, english) {
    if (!element) return;
    if (!original.has(element)) original.set(element, element.textContent);
    const wanted = isEnglish() ? english : original.get(element);
    if (element.textContent !== wanted) element.textContent = wanted;
  }
  function translateExact(element) {
    if (!element) return;
    const current = element.textContent;
    const last = translated.get(element);
    if (isEnglish()) {
      if (last && current === last.en) return;
      let english = JAPANESE_TO_ENGLISH.get(current);
      if (!english && /^問題 (\d+) \/ (\d+) ／ L(\d+)/.test(current)) {
        english = current.replace(/^問題 (\d+) \/ (\d+) ／ L(\d+)/, "Question $1 of $2 · Level $3").replace("復習🐙","review 🐙");
      }
      if (!english && /^合計：(\d+)問$/.test(current)) english = current.replace(/^合計：(\d+)問$/, "Total: $1 questions");
      if (!english && /^(\d+)語$/.test(current)) english = current.replace(/^(\d+)語$/, "$1 words");
      if (!english && /^問題 (\d+) \/ (\d+)/.test(current)) english = current.replace(/^問題 (\d+) \/ (\d+)/, "Question $1 of $2");
      if (!english && /^(.+)語を表示（復習帳 全(.+)語）$/.test(current))
        english = current.replace(/^(.+)語を表示（復習帳 全(.+)語）$/, "Showing $1 of $2 words in the review notebook");
      if (!english && /^(\d+)問目 \/ (\d+)問（復習帳 残り(\d+)語）$/.test(current))
        english = current.replace(/^(\d+)問目 \/ (\d+)問（復習帳 残り(\d+)語）$/, "Word $1 of $2 · $3 left in notebook");
      if (!english && /^さらに50件表示$/.test(current)) english = "Show 50 more";
      if (!english && /^(\d+)件を表示対象にしています（全(\d+)件）$/.test(current))
        english = current.replace(/^(\d+)件を表示対象にしています（全(\d+)件）$/, "Showing $1 of $2 records");
      if (!english) return;
      translated.set(element, {ja:current, en:english});
      if (current !== english) element.textContent = english;
    } else if (last && current === last.en) {
      if (current !== last.ja) element.textContent = last.ja;
      translated.delete(element);
    } else {
      translated.delete(element);
    }
  }
  function dynamicUi() {
    const targets = [
      "#promptLabel","#progressText","#compositionTotal","#nextButton","#submitButton",
      "#scoreMessage","#reviewBookSummary","#reviewBookCount","#reviewDrillStatus",
      "#historyLastStudy","#readingArea label","#reviewDrillDoneMessage",
      "#feedback .feedback-title", "#feedback dt",
      "#wrongList h3","#wrongList .muted", "#reviewBookList .review-book-remove",
      "#reviewDrillAnswer", "#historyList .history-row.header > div",
      "#historyModeFilter option", "#historyResultFilter option", "#historySortOrder option",
      "#wordQuestionCount option", "#sentenceQuestionCount option", "#newsQuestionCount option",
      "#selectedModeCard strong", "#selectedModeCard span"
    ];
    targets.forEach((selector) => document.querySelectorAll(selector).forEach(translateExact));
  }
  function applyLanguage() {
    document.documentElement.lang = language;
    document.documentElement.dataset.interfaceLanguage = language;
    const quizTip = $("#englishQuizNotice");
    const difficultyTip = $("#englishDifficultyNotice");
    if (quizTip) quizTip.hidden = !isEnglish();
    if (difficultyTip) difficultyTip.hidden = !isEnglish();
    FIXED.forEach(([selector, english]) => document.querySelectorAll(selector).forEach(el => setFixed(el, english)));
    const englishPanel = $("#englishFeatureOverview");
    const japanesePanel = $("#japaneseFeatureOverview");
    if (englishPanel) englishPanel.hidden = !isEnglish();
    if (japanesePanel) japanesePanel.hidden = isEnglish();
    const guideJa = $("#japaneseScriptIntro");
    const guideEn = $("#englishScriptIntro");
    if (guideJa) guideJa.hidden = isEnglish();
    if (guideEn) guideEn.hidden = !isEnglish();
    const selector = $("#interfaceLanguageSelect");
    if (selector && selector.value !== language) selector.value = language;
    for (const node of document.querySelectorAll("#historyModeFilter option, #historyResultFilter option, #historySortOrder option")) translateExact(node);
    for (const node of document.querySelectorAll("#reviewBookScreen .review-note-status, #reviewBookList .review-book-remove")) translateExact(node);
    dynamicUi();
    // Translate placeholders only. Never alter input values or actual quiz answers.
    const placeholders = [
      ["#answerInput", "Type Thai here"],
      ["#readingInput", "e.g. phan (or ? if unsure)"],
      ["#historySearchInput", "Search Thai words or answers"],
      ["#reviewBookSearchInput", "Search words or notes"]
    ];
    placeholders.forEach(([sel, en]) => {
      const el = $(sel);
      if (!el) return;
      if (el.dataset.japanesePlaceholder === undefined) el.dataset.japanesePlaceholder = el.placeholder;
      const wanted = isEnglish() ? en : el.dataset.japanesePlaceholder;
      if (el.placeholder !== wanted) el.placeholder = wanted;
    });
  }
  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyLanguage();
    });
  }
  function setupLanguageSwitcher() {
    const brand = $(".brand");
    if (!brand) return;
    const picker = document.createElement("div");
    picker.className = "interface-lang-picker";
    picker.innerHTML = '<label for="interfaceLanguageSelect">🌐 Interface / 表示言語</label>' +
      '<select id="interfaceLanguageSelect" aria-label="Choose interface language">' +
      '<option value="ja">🇯🇵 日本語</option><option value="en">🇬🇧 English</option></select>';
    brand.insertAdjacentElement("afterend", picker);
    $("#interfaceLanguageSelect").addEventListener("change", function (event) {
      language = event.target.value === "en" ? "en" : "ja";
      try { localStorage.setItem(KEY, language); } catch (_) {}
      applyLanguage();
    });
  }
  function setupOverview() {
    const menu = $("#menuScreen");
    const modeGrid = menu && menu.querySelector(".mode-grid");
    if (!modeGrid) return;
    const wrapper = document.createElement("div");
    wrapper.className = "interface-project-overview";
    // English is an interface/explanation layer. The learning content remains designed for Japanese speakers.
    wrapper.innerHTML =
      '<section id="englishFeatureOverview" aria-label="About Thai Vocabulary Trainer">' +
      '<h2>Thai Vocabulary Trainer · What this app does</h2>' +
      '<p>A browser-based Thai language learning app for Japanese speakers. It combines interactive reading and writing practice with a personal review workflow and AI-assisted news learning.</p>' +
      '<div class="interface-feature-grid">' +
      '<div><strong>🐮 Write Thai</strong><span>Type Thai words with a built-in Thai keyboard.</span></div>' +
      '<div><strong>🐨 Read Thai</strong><span>Read Thai and answer meaning questions with pronunciation notes.</span></div>' +
      '<div><strong>📰 News reading</strong><span>Practice with Thai news adapted into learning materials using an AI-supported pipeline.</span></div>' +
      '<div><strong>🍣 Review notebook</strong><span>Save missed words and write your own memory cues.</span></div>' +
      '<div><strong>🐼 Panda Review Drill</strong><span>Review up to three saved words. Remove words you know; keep words to practice again.</span></div>' +
      '<div><strong>📊 Progress tracking</strong><span>View answer history, accuracy, focus words, and export your learning data.</span></div>' +
      '</div>' +
      '<p class="interface-disclaimer">This English setting translates the interface and feature descriptions. Japanese translations remain part of the learning exercises because the app is designed for Japanese learners of Thai.</p>' +
      '<p><a href="https://github.com/norihiko-nakano/thai-script-trainer" target="_blank" rel="noopener noreferrer">View project source on GitHub</a></p>' +
      '</section>' +
      '<section id="japaneseFeatureOverview" aria-label="アプリの紹介" hidden>' +
      '<h2>Thai Vocabulary Trainer · このアプリでできること</h2>' +
      '<p>日本人向けのタイ語学習アプリ。タイ文字の読み書き、AI支援ニュース教材、苦手単語の復習、学習履歴の記録に対応しています。</p>' +
      '<p>🇬🇧 Englishに切り替えると、海外の採用担当者も各機能を英語で確認できます。</p>' +
      '</section>';
    modeGrid.insertAdjacentElement("beforebegin", wrapper);
  }
  function setupQuizHints() {
    const quiz = $("#quizScreen");
    const passage = $("#passagePanel");
    if (quiz && passage) {
      const tip = document.createElement("p");
      tip.id = "englishQuizNotice";
      tip.className = "interface-inline-tip";
      tip.textContent = "Demo note: the app teaches Thai to Japanese speakers. Japanese meanings are intentionally preserved as exercise content.";
      passage.insertAdjacentElement("beforebegin", tip);
    }
    const grid = $("#difficultyScreen .difficulty-grid");
    if (grid) {
      const tip = document.createElement("p");
      tip.id = "englishDifficultyNotice";
      tip.className = "interface-inline-tip";
      tip.textContent = "Choose an available level. Japanese exercise prompts remain part of the learning content.";
      grid.insertAdjacentElement("beforebegin", tip);
    }
  }
  function setupScriptGuideEnglish() {
    const ja = $("#readingMemoScreen .reading-memo-intro");
    if (!ja) return;
    ja.id = "japaneseScriptIntro";
    const en = document.createElement("p");
    en.className = ja.className;
    en.id = "englishScriptIntro";
    en.textContent = "A Thai writing-system reference covering 44 consonants, vowel patterns, tone marks, ending consonants, and Thai numerals. Examples use romanization as a learning aid. Tone depends on consonant class, vowel length, final consonant, and tone marks. You can add personal notes, which are saved only in this browser. Reference descriptions below are in Japanese.";
    ja.insertAdjacentElement("afterend", en);
  }
  document.addEventListener("DOMContentLoaded", function () {
    try {
      language = localStorage.getItem(KEY) || (/^ja\b/i.test(navigator.language || "") ? "ja" : "en");
    } catch (_) {
      language = /^ja\b/i.test(navigator.language || "") ? "ja" : "en";
    }
    if (language !== "en") language = "ja";
    setupLanguageSwitcher();
    setupOverview();
    setupScriptGuideEnglish();
    setupQuizHints();
    applyLanguage();
    const app = $("main.app-shell");
    if (app) {
      observer = new MutationObserver(scheduleApply);
      observer.observe(app, {subtree:true, childList:true, characterData:true});
    }
  });
})();