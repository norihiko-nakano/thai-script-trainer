/* Thai Vocabulary Trainer Ver10.1: 会話 (chat with Mali) add-on.
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
  const MAX_VOCAB = 160;
  const LEVELS = [
    { level: 1, title: "Level 1 · 基礎", note: "とても短い文で、ゆっくり話してくれます" },
    { level: 2, title: "Level 2 · 基礎＋", note: "短くてやさしい文で話します" },
    { level: 3, title: "Level 3 · 初級", note: "日常会話くらいの自然な文で話します" }
  ];

  const q = id => document.getElementById(id);
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
    .chat-avatar{font-size:2.2rem;line-height:1}
    .chat-log{display:grid;gap:12px;max-height:56vh;overflow-y:auto;padding:6px 2px}
    .chat-bubble{max-width:88%;padding:12px 14px;border-radius:18px;line-height:1.6;word-break:break-word}
    .chat-bubble.mali{justify-self:start;background:#fff;border:1px solid var(--border);border-top-left-radius:6px}
    .chat-bubble.me{justify-self:end;background:#fde7d3;border-top-right-radius:6px}
    .chat-thai{font:700 1.35rem/1.6 Tahoma,sans-serif}
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
    .chat-typing{justify-self:start;color:#8a7a6a;font-size:.95rem}
    @media (max-width:560px){.chat-input-row{grid-template-columns:1fr 1fr}.chat-input-row textarea{grid-column:1/-1}}
  `;
  document.head.append(css);

  // ---------- Menu button (5th mode) ----------
  const button = document.createElement("button");
  button.className = "mode-button";
  button.type = "button";
  button.dataset.mode = "chat";
  button.innerHTML =
    '<span class="mode-icon" aria-hidden="true">💬🌺</span>' +
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
          <div class="chat-avatar" aria-hidden="true">👩🏻🌺</div>
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
          <div class="chat-avatar" aria-hidden="true">👩🏻🌺</div>
          <div><strong>มะลิ（マリ）</strong> <span id="chatLevelLabel" class="muted"></span><br>
          <span class="muted">単語をタップすると意味が出て、復習帳にも入れられます🍣</span></div>
        </div>
        <div id="chatLog" class="chat-log" aria-live="polite"></div>
        <div id="chatStatus" class="chat-status" role="status"></div>
        <div class="chat-input-row">
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
  function sampleVocab(level) {
    const words = [...new Set(wordsUpTo(level).map(w => w.thai))];
    for (let i = words.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [words[i], words[j]] = [words[j], words[i]];
    }
    return words.slice(0, MAX_VOCAB);
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

  function speakThai(text) {
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

  function wordChip(word) {
    const entry = dictionaryEntry(word.thai);
    const wrap = document.createElement("span");
    wrap.className = "chat-word-wrap";

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chat-word";
    chip.lang = "th";
    chip.textContent = word.thai;
    chip.title = "タップで意味を表示";

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
    const thai = document.createElement("div");
    thai.className = "chat-thai";
    thai.lang = "th";
    thai.textContent = message.content;

    const japanese = document.createElement("div");
    japanese.className = "chat-japanese hidden";
    japanese.textContent = message.japanese || "（訳がありません）";

    const tools = document.createElement("div");
    tools.className = "chat-tools";
    const listen = document.createElement("button");
    listen.type = "button";
    listen.className = "small-button";
    listen.textContent = "🔊 聞く";
    listen.addEventListener("click", () => speakThai(message.content));
    const translate = document.createElement("button");
    translate.type = "button";
    translate.className = "small-button";
    translate.textContent = "🇯🇵 日本語訳";
    translate.addEventListener("click", () => japanese.classList.toggle("hidden"));
    tools.append(listen, translate);

    bubble.append(thai, tools, japanese);

    if (Array.isArray(message.words) && message.words.length) {
      const words = document.createElement("div");
      words.className = "chat-words";
      message.words.forEach(word => words.append(wordChip(word)));
      bubble.append(words);
    }
    return bubble;
  }

  function renderLog() {
    const log = q("chatLog");
    log.replaceChildren(...chat.messages.map(renderMessage));
    if (chat.sending) {
      const typing = document.createElement("div");
      typing.className = "chat-typing";
      typing.textContent = "マリが入力中… ✍️";
      log.append(typing);
    }
    log.scrollTop = log.scrollHeight;
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
          vocab: sampleVocab(chat.level),
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
        words: Array.isArray(reply.words) ? reply.words.filter(w => w && w.thai) : []
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
    showRoom();
    askMali(); // Mali greets first.
  }

  function sendMessage() {
    if (chat.sending) return;
    const input = q("chatInput");
    const text = input.value.trim();
    if (!text) return;
    chat.messages.push({ role: "user", content: text.slice(0, 400) });
    input.value = "";
    askMali();
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
      if (window.speechSynthesis) speechSynthesis.cancel();
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
  window.__tvtChat = { chat, sampleVocab, dictionaryEntry, functionUrl, addWordToReviewBook };
})();
