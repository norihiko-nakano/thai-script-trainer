/* Thai Vocabulary Trainer Ver10.2: 会話 (chat with Mali) add-on.
 *
 * Flow: browser -> Supabase Edge Function "thai-chat" -> OpenAI.
 * The OpenAI key lives only in Supabase secrets. This file only knows the public
 * Supabase URL (supabase-config.js) and the passcode the learner types once.
 *
 * Readings shown here come only from the dictionary (questions.json / Supabase),
 * never from the AI, matching the rest of the app.
 */
(function () {
  "use strict";

  const FUNCTION_NAME = "thai-chat";
  const PASSCODE_KEY = "thaiTrainerChatPasscodeV10";
  const LEVEL_KEY = "thaiTrainerChatLevelV10";
  const MAX_VOCAB = 600; // all dictionary words up to the level (Level 3 has about 400)

  // Hand-checked readings for the basic conversation words that are not in the
  // dictionary (the same list the Edge Function allows). Dictionary readings win.
  // Readings are never taken from the AI.
  const BASIC_READINGS = {
    "สวัสดี": "サワッディー", "ขอบคุณ": "コップクン", "ขอโทษ": "コートート", "ไม่เป็นไร": "マイペンライ",
    "ยินดี": "インディー", "รู้จัก": "ルーチャック", "ลาก่อน": "ラーコーン", "โชคดี": "チョークディー",
    "ค่ะ": "カ", "คะ": "カ", "ครับ": "クラップ", "นะ": "ナ", "จ้ะ": "チャ", "จ้า": "チャー",
    "ไหม": "マイ", "มั้ย": "マイ", "หรือ": "ルー", "เหรอ": "ロー", "หรอ": "ロー",
    "ใช่": "チャイ", "ไม่": "マイ", "ไม่ใช่": "マイチャイ", "โอเค": "オーケー", "ได้": "ダイ",
    "ฉัน": "チャン", "ผม": "ポム", "คุณ": "クン", "เขา": "カオ", "เรา": "ラオ", "คน": "コン",
    "อะไร": "アライ", "ใคร": "クライ", "ที่ไหน": "ティーナイ", "ไหน": "ナイ", "เมื่อไร": "ムアライ",
    "ทำไม": "タムマイ", "อย่างไร": "ヤーンライ", "ยังไง": "ヤンガイ", "กี่": "キー", "เท่าไร": "タオライ",
    "เป็น": "ペン", "คือ": "クー", "มี": "ミー", "อยู่": "ユー", "ไป": "パイ", "มา": "マー", "ทำ": "タム",
    "ชอบ": "チョープ", "อยาก": "ヤーク", "จะ": "チャ", "แล้ว": "レーオ", "ยัง": "ヤン", "ก็": "コー",
    "ด้วย": "ドゥアイ", "และ": "レ", "แต่": "テー", "กับ": "カップ", "ที่": "ティー", "ของ": "コーン",
    "กัน": "カン", "เจอ": "チュー", "สบาย": "サバーイ", "สบายดี": "サバーイディー", "ดี": "ディー",
    "มาก": "マーク", "นิดหน่อย": "ニットノイ", "จริง": "チン", "นี่": "ニー", "นี้": "ニー",
    "นั่น": "ナン", "นั้น": "ナン", "วัน": "ワン", "ชื่อ": "チュー", "ไทย": "タイ", "ญี่ปุ่น": "イープン",
    "กรุงเทพ": "クルンテープ", "ประเทศ": "プラテート"
  };
  let readingTable = null;
  let readingMaxLen = 1;

  function buildReadingTable() {
    const table = new Map(Object.entries(BASIC_READINGS));
    for (const w of dictionaryWords()) {
      if (!w.reading) continue;
      for (const t of [w.thai, ...(Array.isArray(w.acceptedThai) ? w.acceptedThai : [])]) {
        if (t) table.set(t, w.reading);
      }
    }
    readingTable = table;
    readingMaxLen = Math.max(1, ...[...table.keys()].map(k => k.length));
  }

  // Katakana reading of a Thai sentence, built word by word from the dictionary
  // and BASIC_READINGS. Parts with no known reading are shown as ［Thai］.
  function thaiReading(text) {
    if (!readingTable) buildReadingTable();
    return String(text || "").replace(/[\u0E00-\u0E7F]+/g, run => {
      const n = run.length;
      const best = Array(n + 1).fill(null);
      best[0] = { cost: 0, words: 0, prev: -1, known: false };
      for (let i = 0; i < n; i++) {
        if (!best[i]) continue;
        const step = (j, known) => {
          const cost = best[i].cost + (known ? 0 : j - i);
          const words = best[i].words + 1;
          const cur = best[j];
          if (!cur || cost < cur.cost || (cost === cur.cost && words < cur.words)) best[j] = { cost, words, prev: i, known };
        };
        step(i + 1, false);
        for (let len = 2; len <= readingMaxLen && i + len <= n; len++) {
          if (readingTable.has(run.slice(i, i + len))) step(i + len, true);
        }
        if (readingTable.has(run[i])) step(i + 1, true);
      }
      const parts = [];
      for (let j = n; j > 0; j = best[j].prev) {
        const piece = run.slice(best[j].prev, j);
        parts.unshift({ piece, known: best[j].known });
      }
      // Join neighbouring unknown characters into one bracket.
      const out = [];
      for (const part of parts) {
        if (part.known) out.push(readingTable.get(part.piece));
        else if (out.length && out[out.length - 1].startsWith("［")) out[out.length - 1] = out[out.length - 1].slice(0, -1) + part.piece + "］";
        else out.push(`［${part.piece}］`);
      }
      return out.join(" ");
    });
  }
  const LEVELS = [
    { level: 1, title: "Level 1 · 基礎", note: "とても短い文で、ゆっくり話してくれます" },
    { level: 2, title: "Level 2 · 基礎＋", note: "短くてやさしい文で話します" },
    { level: 3, title: "Level 3 · 初級", note: "日常会話くらいの自然な文で話します" }
  ];

  const q = id => document.getElementById(id);
  const MOODS = ["normal", "happy", "surprised"];
  const MOOD_IMAGE = {
    normal: "images/mali-normal.webp?v=10.2",
    happy: "images/mali-smile.webp?v=10.2",
    surprised: "images/mali-surprise.webp?v=10.2"
  };
  const moodImage = mood => MOOD_IMAGE[MOODS.includes(mood) ? mood : "normal"];
  const moodFace = mood => moodImage(mood).replace(".webp", "-face.webp");
  const chat = {
    level: 1,
    messages: [],   // {role:"user"|"assistant", content:string, japanese?, words?}
    sending: false,
    recognition: null
  };

  // ---------- Styles ----------
  const css = document.createElement("style");
  css.textContent = `
    .chat-setup{display:grid;gap:14px}
    .chat-level-grid{display:grid;gap:10px}
    .chat-level-button{display:grid;gap:4px;text-align:left;padding:14px 16px;border:1px solid var(--border);border-radius:16px;background:#fff;cursor:pointer;font:inherit}
    .chat-level-button:hover,.chat-level-button:focus-visible{border-color:#c98d5c;background:#fffaf3}
    .chat-level-button[disabled]{opacity:.5;cursor:not-allowed}
    .chat-level-button strong{font-size:1.05rem}
    .chat-passcode{display:grid;gap:8px;padding:14px;border-radius:14px;background:#f7efe5}
    .chat-passcode input,.chat-input-row textarea{font:inherit;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:#fff}
    .chat-card{display:grid;gap:12px}
    .chat-profile{display:flex;gap:12px;align-items:center;padding:12px 14px;border-radius:16px;background:#fffaf3;border:1px solid var(--border)}
    .chat-avatar{width:108px;height:144px;flex:none;object-fit:contain;object-position:50% 100%;filter:drop-shadow(0 4px 8px rgba(255,143,171,.35));transition:transform .2s}
    .chat-avatar.pop{animation:chat-pop .35s ease-out}
    @keyframes chat-pop{0%{transform:scale(.94)}60%{transform:scale(1.04)}100%{transform:scale(1)}}
    .chat-row{display:flex;gap:8px;align-items:flex-end;justify-self:start;max-width:94%}
    .chat-row .chat-bubble{max-width:100%}
    .chat-mini{width:48px;height:48px;flex:none;filter:drop-shadow(0 2px 4px rgba(255,143,171,.4))}
    .chat-typing .chat-mini,.chat-room-talking .chat-avatar{animation:chat-bob 1s ease-in-out infinite}
    @keyframes chat-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
    @media (prefers-reduced-motion:reduce){.chat-typing .chat-mini,.chat-room-talking .chat-avatar{animation:none}}
    .chat-log{display:grid;gap:12px;max-height:56vh;overflow-y:auto;padding:6px 2px}
    .chat-bubble{max-width:88%;padding:12px 14px;border-radius:18px;line-height:1.6;word-break:break-word}
    .chat-bubble.mali{justify-self:start;background:#fff;border:1px solid var(--border);border-top-left-radius:6px}
    .chat-bubble.me{justify-self:end;background:#fde7d3;border-top-right-radius:6px}
    .chat-thai{font:700 1.35rem/1.6 Tahoma,sans-serif}
    .chat-reading{margin-top:6px;padding:6px 10px;border-radius:10px;background:#fff7d6;font-size:1rem;letter-spacing:.02em}
    .chat-reading::before{content:"🔤 ";}
    .chat-hint[disabled]{opacity:.55;cursor:default}
    .chat-choice .chat-choice-reading{font-size:.9rem;color:#8a6a2a}
    .chat-japanese{margin-top:6px;padding:8px 10px;border-radius:10px;background:#f7efe5;font-size:.95rem}
    .chat-tools{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
    .chat-words{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
    .chat-word{font:inherit;font-size:.9rem;padding:5px 9px;border-radius:999px;border:1px solid var(--border);background:#fff;cursor:pointer}
    .chat-word.open{background:#fffaf3;border-color:#c98d5c}
    .chat-word small{color:#8a7a6a;margin-left:6px}
    .chat-word-wrap{display:inline-flex;gap:4px;align-items:center}
    .chat-word-add{font:inherit;font-size:.8rem;padding:4px 8px;border-radius:999px;border:1px dashed #c98d5c;background:#fff;cursor:pointer}
    .chat-word-add.added{background:var(--success-bg);color:var(--success);border:1px solid transparent;cursor:default}
    .chat-input-row{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:end}
    .chat-input-row textarea{resize:vertical;min-height:52px;font-family:Tahoma,sans-serif;font-size:1.1rem}
    .chat-status{min-height:1.4em;padding:0 4px;font-size:.95rem}
    .chat-status.error{color:var(--danger)}
    .chat-choices{display:grid;gap:8px;padding:12px;border-radius:16px;background:#f7efe5}
    .chat-choices-head{display:flex;justify-content:space-between;align-items:center;gap:8px}
    .chat-choice-list{display:grid;gap:8px}
    .chat-choice{display:grid;gap:2px;text-align:left;font:inherit;padding:12px 14px;border-radius:14px;border:1px solid var(--border);background:#fff;cursor:pointer}
    .chat-choice:hover,.chat-choice:focus-visible{border-color:#c98d5c;background:#fffaf3}
    .chat-choice .chat-choice-thai{font:700 1.2rem/1.5 Tahoma,sans-serif}
    .chat-choice .chat-choice-ja{font-size:.9rem;color:#6f5f50}
    #chatTypeToggle{justify-self:start}
    .chat-typing{justify-self:start;align-items:center;color:#8a7a6a;font-size:.95rem}
    @media (max-width:560px){.chat-input-row{grid-template-columns:1fr 1fr}.chat-input-row textarea{grid-column:1/-1}}
  `;
  document.head.append(css);

  // ---------- Menu button (5th mode) ----------
  const button = document.createElement("button");
  button.className = "mode-button";
  button.type = "button";
  button.dataset.mode = "chat";
  button.innerHTML =
    '<span class="mode-icon" aria-hidden="true"><img src="images/mali-smile.webp?v=10.2" alt="" style="height:120px;width:auto;display:block;margin:0 auto;filter:drop-shadow(0 4px 8px rgba(255,143,171,.35))"></span>' +
    '<span class="mode-title">会話💬🌺</span>' +
    '<span class="mode-description">タイ人の女の子マリとタイ語でチャットする</span>';
  const grid = document.querySelector(".mode-grid");
  const frozen = grid.querySelector('[data-mode="longreading"]');
  grid.insertBefore(button, frozen);

  // ---------- Screen ----------
  q("quizScreen").insertAdjacentHTML("afterend", `
    <div id="chatScreen" class="hidden">
      <div class="quiz-header">
        <button id="chatBack" class="icon-button" type="button">← 戻る</button>
        <h2 style="margin:0">会話💬🌺</h2>
      </div>

      <section id="chatSetup" class="chat-setup">
        <div class="chat-profile">
          <img class="chat-avatar" src="images/mali-normal.webp?v=10.2" alt="" aria-hidden="true">
          <div><strong>มะลิ（マリ）</strong><br><span class="muted">バンコクの大学そばのカフェで働く25歳。タイ語の会話相手になってくれます。</span></div>
        </div>
        <div id="chatPasscodeBox" class="chat-passcode hidden">
          <label for="chatPasscode"><strong>🔑 合言葉</strong>（Supabaseに登録した <code>TVT_CHAT_PASSCODE</code>）</label>
          <input id="chatPasscode" type="password" autocomplete="off" placeholder="合言葉を入力">
          <span class="muted">このブラウザにだけ保存します。最初の1回だけでOKです。</span>
        </div>
        <p class="muted" style="margin:0">レベルを選ぶと、そのレベルまでの単語を中心に、マリが話し方を合わせてくれます🍆</p>
        <div id="chatLevelGrid" class="chat-level-grid"></div>
        <button id="chatForgetPasscode" class="small-button hidden" type="button">合言葉を入れ直す</button>
      </section>

      <section id="chatRoom" class="chat-card hidden">
        <div class="chat-profile">
          <img class="chat-avatar" src="images/mali-normal.webp?v=10.2" alt="" aria-hidden="true">
          <div><strong>มะลิ（マリ）</strong> <span id="chatLevelLabel" class="muted"></span><br>
          <span class="muted">単語をタップすると意味が出て、復習帳にも入れられます🍣<br>📘辞書の単語　🔰基本語　⭐辞書にない単語</span></div>
        </div>
        <div id="chatLog" class="chat-log" aria-live="polite"></div>
        <div id="chatStatus" class="chat-status" role="status"></div>
        <div id="chatChoices" class="chat-choices hidden">
          <div class="chat-choices-head">
            <strong>👉 返事をえらんでね</strong>
            <button id="chatChoicesTranslate" class="small-button chat-hint" type="button">ヒント⚡ 読み</button>
          </div>
          <div id="chatChoiceList" class="chat-choice-list"></div>
        </div>
        <button id="chatTypeToggle" class="small-button" type="button">✏️ 自分で入力する</button>
        <div id="chatInputRow" class="chat-input-row hidden">
          <textarea id="chatInput" rows="2" placeholder="タイ語で返事してみよう（日本語でもOK）" lang="th"></textarea>
          <button id="chatMic" class="small-button" type="button" title="タイ語で話して入力">🎤 話す</button>
          <button id="chatSend" class="button primary" type="button">送信</button>
        </div>
        <div class="chat-tools">
          <button id="chatNew" class="small-button" type="button">🌱 新しい会話</button>
          <button id="chatChangeLevel" class="small-button" type="button">🎚️ レベルを変える</button>
        </div>
      </section>
    </div>`);

  // ---------- Helpers ----------
  function readPasscode() {
    try { return localStorage.getItem(PASSCODE_KEY) || ""; } catch (_) { return ""; }
  }
  function writePasscode(value) {
    try {
      if (value) localStorage.setItem(PASSCODE_KEY, value);
      else localStorage.removeItem(PASSCODE_KEY);
    } catch (_) { /* storage unavailable: keep in memory only */ }
    chat.memoryPasscode = value;
  }
  function passcode() {
    return chat.memoryPasscode || readPasscode();
  }

  function dictionaryWords() {
    return Array.isArray(state.allQuestions) ? state.allQuestions : [];
  }
  function wordsUpTo(level) {
    return dictionaryWords().filter(w => Number(w.difficulty) >= 1 && Number(w.difficulty) <= level && w.thai);
  }
  function dictionaryEntry(thai) {
    const target = String(thai || "").trim();
    return dictionaryWords().find(w => w.thai === target || (Array.isArray(w.acceptedThai) && w.acceptedThai.includes(target)));
  }
  function levelVocab(level) {
    const words = new Set();
    for (const w of wordsUpTo(level)) {
      words.add(w.thai);
      if (Array.isArray(w.acceptedThai)) w.acceptedThai.forEach(t => t && words.add(t));
    }
    return [...words].slice(0, MAX_VOCAB);
  }

  function status(text, isError) {
    const el = q("chatStatus");
    el.textContent = text || "";
    el.classList.toggle("error", Boolean(isError));
  }

  // Female Thai voices seen on Windows/Edge, Chrome, macOS and iOS; male ones are avoided.
  const FEMALE_VOICE_HINTS = ["premwadee", "achara", "kanya", "narisa", "google", "female", "woman"];
  const MALE_VOICE_HINTS = ["pattara", "niwat", "male", "man"];

  function thaiVoices() {
    if (!window.speechSynthesis) return [];
    return speechSynthesis.getVoices().filter(v => /^th(-|_|$)/i.test(v.lang || ""));
  }
  function pickFemaleVoice() {
    const voices = thaiVoices();
    const name = v => (v.name || "").toLowerCase();
    const isMale = v => MALE_VOICE_HINTS.some(h => new RegExp(`(^|[^a-z])${h}([^a-z]|$)`).test(name(v)));
    for (const hint of FEMALE_VOICE_HINTS) {
      const found = voices.find(v => name(v).includes(hint) && !isMale(v));
      if (found) return found;
    }
    return voices.find(v => !isMale(v)) || null;
  }
  if (window.speechSynthesis) {
    // Voices load asynchronously in Chrome/Edge.
    speechSynthesis.getVoices();
    speechSynthesis.addEventListener?.("voiceschanged", () => { chat.voice = pickFemaleVoice(); });
  }

  function speakWithBrowser(text) {
    if (!window.speechSynthesis || !text) {
      status("このブラウザはタイ語の読み上げに対応していません。", true);
      return;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "th-TH";
    const voice = chat.voice || pickFemaleVoice();
    if (voice) {
      u.voice = voice;
      u.pitch = 1.1;
    } else {
      // Only a male Thai voice (or none) is installed: raise the pitch as a fallback.
      u.pitch = 1.5;
      if (thaiVoices().length && !chat.voiceNoticeShown) {
        chat.voiceNoticeShown = true;
        status("この端末には女性のタイ語音声が入っていないため、声を高めにしています🐙");
      }
    }
    u.rate = chat.level === 1 ? 0.75 : chat.level === 2 ? 0.85 : 0.95;
    speechSynthesis.speak(u);
  }

  // Mali's own voice: OpenAI text-to-speech through the Edge Function.
  // Audio is cached per text and level, so replaying a line costs nothing.
  const audioCache = new Map();
  let currentAudio = null;

  function stopAudio() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    if (window.speechSynthesis) speechSynthesis.cancel();
  }

  async function fetchMaliVoice(text) {
    const key = `${chat.level}\u0000${text}`;
    if (audioCache.has(key)) return audioCache.get(key);
    const config = window.THAI_TRAINER_SUPABASE || {};
    const response = await fetch(functionUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": config.publishableKey || "",
        "x-tvt-passcode": passcode()
      },
      body: JSON.stringify({ action: "speak", level: chat.level, text }),
      signal: AbortSignal.timeout ? AbortSignal.timeout(30000) : undefined
    });
    if (!response.ok) throw new Error(`tts ${response.status}`);
    const url = URL.createObjectURL(await response.blob());
    audioCache.set(key, url);
    return url;
  }

  async function speakThai(text, button) {
    if (!text) return;
    stopAudio();
    const label = button?.textContent;
    if (button) {
      button.disabled = true;
      button.textContent = "🎀 準備中…";
    }
    try {
      const audio = new Audio(await fetchMaliVoice(text));
      currentAudio = audio;
      await audio.play();
    } catch (error) {
      console.warn("マリの声を再生できませんでした。ブラウザの声に切り替えます。", error);
      status("マリの声を取得できなかったので、ブラウザの声で読みます🐙");
      speakWithBrowser(text);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = label;
      }
    }
  }

  function isInReviewBook(entry, thai) {
    if (!Array.isArray(state.reviewBook)) return false;
    if (entry) return state.reviewBook.some(item => item.key === reviewBookKey(entry));
    return state.reviewBook.some(item => item.thai === thai);
  }

  function addWordToReviewBook(word) {
    const entry = dictionaryEntry(word.thai);
    const question = entry
      ? { ...entry, questionType: "word" }
      // Not in the dictionary: keep the meaning from the chat, leave the reading empty
      // (readings must come from the dictionary).
      : { questionType: "word", thai: word.thai, japanese: word.japanese, reading: "", difficulty: chat.level };
    return addWrongWordToReviewBook(question);
  }

  // ---------- Rendering ----------
  function renderLevels() {
    const box = q("chatLevelGrid");
    box.replaceChildren();
    for (const item of LEVELS) {
      const count = wordsUpTo(item.level).length;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chat-level-button";
      b.disabled = count === 0;
      b.innerHTML = `<strong></strong><span class="muted"></span>`;
      b.querySelector("strong").textContent = `${item.title}（${count}語まで）`;
      b.querySelector("span").textContent = item.note;
      b.addEventListener("click", () => startChat(item.level));
      box.append(b);
    }
  }

  function wordChip(word, startOpen) {
    const entry = dictionaryEntry(word.thai);
    const wrap = document.createElement("span");
    wrap.className = "chat-word-wrap";

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chat-word";
    chip.lang = "th";
    const source = entry ? "dictionary" : word.source === "basic" ? "basic" : "new";
    const mark = { dictionary: "📘", basic: "🔰", new: "⭐" }[source];
    chip.textContent = `${mark} ${word.thai}`;
    chip.title = {
      dictionary: "TVTの辞書の単語（タップで意味）",
      basic: "会話の基本語（タップで意味）",
      new: "辞書にない新しい単語（タップで意味）"
    }[source];

    const meaning = document.createElement("span");
    meaning.className = "chat-word-meaning hidden";
    meaning.textContent = ` = ${word.japanese}`;
    if (entry?.reading) {
      const small = document.createElement("small");
      small.textContent = entry.reading;
      meaning.append(small);
    }

    const add = document.createElement("button");
    add.type = "button";
    add.className = "chat-word-add hidden";
    add.textContent = "🍣＋復習帳";
    const markAdded = () => {
      add.textContent = "✓ 復習帳";
      add.disabled = true;
      add.classList.add("added");
    };
    if (isInReviewBook(entry, word.thai)) markAdded();

    chip.addEventListener("click", () => {
      const open = meaning.classList.toggle("hidden") === false;
      add.classList.toggle("hidden", !open);
      chip.classList.toggle("open", open);
    });
    add.addEventListener("click", () => {
      if (addWordToReviewBook(word)) {
        markAdded();
        status(`「${word.thai}」を復習帳に入れました🍣`);
      }
    });

    chip.append(meaning);
    wrap.append(chip, add);
    if (startOpen) chip.click();
    return wrap;
  }

  function renderMessage(message) {
    const bubble = document.createElement("div");
    if (message.role === "user") {
      bubble.className = "chat-bubble me";
      const text = document.createElement("div");
      text.className = "chat-thai";
      text.textContent = message.content;
      bubble.append(text);
      return bubble;
    }

    bubble.className = "chat-bubble mali";
    const row = document.createElement("div");
    row.className = "chat-row";
    row.append(miniAvatar(message.mood), bubble);
    const thai = document.createElement("div");
    thai.className = "chat-thai";
    thai.lang = "th";
    thai.textContent = message.content;

    // Hints open step by step: ⚡ reading → ⚡⚡ word meanings → ⚡⚡⚡ full translation.
    // First try to read the Thai yourself.
    const hasWords = Array.isArray(message.words) && message.words.length > 0;
    const steps = hasWords ? ["reading", "words", "japanese"] : ["reading", "japanese"];
    const stage = message.hint || 0;
    const shown = steps.slice(0, stage);

    const tools = document.createElement("div");
    tools.className = "chat-tools";
    const listen = document.createElement("button");
    listen.type = "button";
    listen.className = "small-button";
    listen.textContent = "🔊 聞く";
    listen.addEventListener("click", () => speakThai(message.content, listen));
    const hint = document.createElement("button");
    hint.type = "button";
    hint.className = "small-button chat-hint";
    const label = { reading: "読み方", words: "単語の意味", japanese: "日本語訳" };
    if (stage >= steps.length) {
      hint.textContent = "💡 ヒント全部オープン";
      hint.disabled = true;
    } else {
      hint.textContent = `ヒント${"⚡".repeat(stage + 1)}（${label[steps[stage]]}）`;
      hint.addEventListener("click", () => {
        message.hint = stage + 1;
        renderLog({ keepScroll: true });
      });
    }
    tools.append(listen, hint);
    bubble.append(thai, tools);

    if (shown.includes("reading")) {
      const reading = document.createElement("div");
      reading.className = "chat-reading";
      reading.textContent = thaiReading(message.content);
      bubble.append(reading);
    }
    if (hasWords) {
      const words = document.createElement("div");
      words.className = "chat-words";
      message.words.forEach(word => words.append(wordChip(word, shown.includes("words"))));
      bubble.append(words);
    }
    if (shown.includes("japanese")) {
      const japanese = document.createElement("div");
      japanese.className = "chat-japanese";
      japanese.textContent = message.japanese || "（訳がありません）";
      bubble.append(japanese);
    }
    return row;
  }

  function miniAvatar(mood) {
    const img = document.createElement("img");
    img.className = "chat-mini";
    img.src = moodFace(mood);
    img.alt = "";
    img.setAttribute("aria-hidden", "true");
    return img;
  }

  function renderLog(options = {}) {
    const log = q("chatLog");
    const keepScroll = options.keepScroll ? log.scrollTop : null;
    log.replaceChildren(...chat.messages.map(renderMessage));
    if (chat.sending) {
      const typing = document.createElement("div");
      typing.className = "chat-typing chat-row";
      const dots = document.createElement("span");
      dots.textContent = "マリが入力中… ✍️";
      typing.append(miniAvatar("normal"), dots);
      log.append(typing);
    }
    log.scrollTop = keepScroll ?? log.scrollHeight;
    renderChoices();
    updateBigAvatar();
  }

  // The large picture in the room header follows Mali's latest mood.
  function updateBigAvatar() {
    const img = document.querySelector("#chatRoom .chat-avatar");
    if (!img) return;
    const last = [...chat.messages].reverse().find(m => m.role === "assistant");
    const src = moodImage(last?.mood);
    if (!img.src.endsWith(src)) {
      img.src = src;
      img.classList.remove("pop");
      void img.offsetWidth; // restart the animation
      img.classList.add("pop");
    }
  }

  function renderChoices() {
    const box = q("chatChoices");
    const list = q("chatChoiceList");
    const last = chat.messages[chat.messages.length - 1];
    const choices = !chat.sending && last?.role === "assistant" ? last.choices || [] : [];
    list.replaceChildren();
    box.classList.toggle("hidden", choices.length === 0);
    const choiceStage = last?.choiceHint || 0;
    const hintButton = q("chatChoicesTranslate");
    hintButton.disabled = choiceStage >= 2;
    hintButton.textContent = ["ヒント⚡ 読み", "ヒント⚡⚡ 訳", "💡 全部オープン"][Math.min(choiceStage, 2)];
    for (const choice of choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chat-choice";
      const thai = document.createElement("span");
      thai.className = "chat-choice-thai";
      thai.lang = "th";
      thai.textContent = choice.thai;
      b.append(thai);
      if (choiceStage >= 1) {
        const reading = document.createElement("span");
        reading.className = "chat-choice-reading";
        reading.textContent = `🔤 ${thaiReading(choice.thai)}`;
        b.append(reading);
      }
      if (choiceStage >= 2) {
        const ja = document.createElement("span");
        ja.className = "chat-choice-ja";
        ja.textContent = choice.japanese || "";
        b.append(ja);
      }
      b.addEventListener("click", () => sendText(choice.thai));
      list.append(b);
    }
    // No choices came back (or the reply failed): let the learner type instead.
    if (!chat.sending && last?.role === "assistant" && choices.length === 0) showTyping(true);
  }

  function showTyping(open) {
    q("chatInputRow").classList.toggle("hidden", !open);
    q("chatTypeToggle").textContent = open ? "✖ 入力をとじる" : "✏️ 自分で入力する";
  }

  function showSetup() {
    q("chatRoom").classList.add("hidden");
    q("chatSetup").classList.remove("hidden");
    const hasPasscode = Boolean(passcode());
    q("chatPasscodeBox").classList.toggle("hidden", hasPasscode);
    q("chatForgetPasscode").classList.toggle("hidden", !hasPasscode);
    q("chatPasscode").value = "";
    renderLevels();
  }

  function showRoom() {
    q("chatSetup").classList.add("hidden");
    q("chatRoom").classList.remove("hidden");
    const item = LEVELS.find(l => l.level === chat.level);
    q("chatLevelLabel").textContent = item ? `／${item.title}` : "";
    renderLog();
  }

  // ---------- Talking to the Edge Function ----------
  function functionUrl() {
    const config = window.THAI_TRAINER_SUPABASE || {};
    if (!config.url) return "";
    return `${String(config.url).replace(/\/+$/, "")}/functions/v1/${FUNCTION_NAME}`;
  }

  async function askMali() {
    const url = functionUrl();
    if (!url) {
      status("Supabaseの設定（supabase-config.js）が見つかりません。", true);
      return;
    }
    chat.sending = true;
    q("chatSend").disabled = true;
    status("");
    renderLog();

    try {
      const config = window.THAI_TRAINER_SUPABASE || {};
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": config.publishableKey || "",
          "x-tvt-passcode": passcode()
        },
        body: JSON.stringify({
          level: chat.level,
          vocab: levelVocab(chat.level),
          messages: chat.messages.map(m => ({ role: m.role, content: m.content }))
        }),
        signal: AbortSignal.timeout ? AbortSignal.timeout(45000) : undefined
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        writePasscode("");
        status("合言葉が違うようです🔑 もう一度入れてくだされ。", true);
        showSetup();
        return;
      }
      if (!response.ok || !data.reply?.thai) {
        const reason = data.error === "server_not_configured"
          ? "Supabaseの Secrets（OPENAI_API_KEY / TVT_CHAT_PASSCODE）が未設定です。"
          : data.error === "openai_error"
            ? "OpenAIの呼び出しに失敗しました。キーや残高を確認してください。"
            : "マリから返事が来ませんでした。";
        status(`${reason}（${response.status}）`, true);
        return;
      }

      const reply = data.reply;
      chat.messages.push({
        role: "assistant",
        content: String(reply.thai),
        japanese: String(reply.japanese || ""),
        mood: MOODS.includes(reply.mood) ? reply.mood : "normal",
        words: Array.isArray(reply.words) ? reply.words.filter(w => w && w.thai) : [],
        choices: Array.isArray(reply.choices) ? reply.choices.filter(c => c && c.thai).slice(0, 3) : []
      });
    } catch (error) {
      console.warn("会話の送信に失敗しました。", error);
      status("つながりませんでした🐙 Supabaseが一時停止中（無料プランの自動停止）かもしれません。ダッシュボードで起こしてから、もう一度送ってくだされ。", true);
    } finally {
      chat.sending = false;
      q("chatSend").disabled = false;
      renderLog();
    }
  }

  function startChat(level) {
    const typed = q("chatPasscode").value.trim();
    if (typed) writePasscode(typed);
    if (!passcode()) {
      q("chatPasscodeBox").classList.remove("hidden");
      status("");
      q("chatPasscode").focus();
      window.alert("先に合言葉を入れてくだされ🔑");
      return;
    }
    chat.level = level;
    try { localStorage.setItem(LEVEL_KEY, String(level)); } catch (_) { /* ignore */ }
    chat.messages = [];
    showTyping(false);
    showRoom();
    askMali(); // Mali greets first.
  }

  function sendText(text) {
    if (chat.sending) return;
    const value = String(text || "").trim();
    if (!value) return;
    chat.messages.push({ role: "user", content: value.slice(0, 400) });
    askMali();
  }

  function sendMessage() {
    const input = q("chatInput");
    const text = input.value.trim();
    if (!text || chat.sending) return;
    input.value = "";
    sendText(text);
  }

  function toggleMic() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      status("このブラウザはタイ語の音声入力に対応していません。キーボードで入力してくだされ。", true);
      return;
    }
    if (chat.recognition) {
      chat.recognition.stop();
      return;
    }
    const rec = new Recognition();
    chat.recognition = rec;
    rec.lang = "th-TH";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    q("chatMic").textContent = "⏹ 止める";
    status("🎤 聞いています…");
    rec.onresult = event => {
      const heard = event.results[0]?.[0]?.transcript?.trim() || "";
      if (heard) {
        const input = q("chatInput");
        input.value = input.value ? `${input.value} ${heard}` : heard;
        status("🎤 入力しました。確認して「送信」を押してくだされ。");
      }
    };
    rec.onerror = () => status("聞き取れませんでした。もう一度どうぞ。", true);
    rec.onend = () => {
      chat.recognition = null;
      q("chatMic").textContent = "🎤 話す";
    };
    try { rec.start(); } catch (_) { rec.onend(); }
  }

  // ---------- Hook into the app ----------
  const oldShow = showScreen;
  const oldOpen = openDifficultyScreen;
  const oldLabel = modeDisplayLabel;

  showScreen = name => {
    oldShow(name);
    q("chatScreen").classList.toggle("hidden", name !== "chat");
    if (name !== "chat") {
      if (chat.recognition) chat.recognition.stop();
      stopAudio();
    }
  };
  modeDisplayLabel = mode => (mode === "chat" ? "会話💬🌺" : oldLabel(mode));
  openDifficultyScreen = mode => {
    if (mode !== "chat") return oldOpen(mode);
    state.mode = "chat";
    status("");
    showSetup();
    showScreen("chat");
  };

  document.addEventListener("DOMContentLoaded", () => {
    try { chat.level = Number(localStorage.getItem(LEVEL_KEY)) || 1; } catch (_) { /* ignore */ }
    q("chatBack").addEventListener("click", () => {
      if (!q("chatRoom").classList.contains("hidden") && chat.messages.length) {
        if (!window.confirm("会話を終えてメニューに戻りますか？（会話の中身は保存されません）")) return;
      }
      showScreen("menu");
    });
    q("chatSend").addEventListener("click", sendMessage);
    q("chatInput").addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        sendMessage();
      }
    });
    q("chatMic").addEventListener("click", toggleMic);
    q("chatTypeToggle").addEventListener("click", () => {
      showTyping(q("chatInputRow").classList.contains("hidden"));
      if (!q("chatInputRow").classList.contains("hidden")) q("chatInput").focus();
    });
    q("chatChoicesTranslate").addEventListener("click", () => {
      const last = chat.messages[chat.messages.length - 1];
      if (!last || last.role !== "assistant") return;
      last.choiceHint = Math.min((last.choiceHint || 0) + 1, 2);
      renderChoices();
    });
    q("chatNew").addEventListener("click", () => {
      if (chat.messages.length && !window.confirm("今の会話を消して、新しく始めますか？")) return;
      startChat(chat.level);
    });
    q("chatChangeLevel").addEventListener("click", showSetup);
    q("chatForgetPasscode").addEventListener("click", () => {
      writePasscode("");
      showSetup();
    });
  });

  // Exposed for tests.
  window.__tvtChat = { chat, levelVocab, thaiReading, dictionaryEntry, functionUrl, addWordToReviewBook };
})();
