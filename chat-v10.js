/* Thai Vocabulary Trainer Ver10.6: 会話 (chat with Mali) add-on.
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

  // Hand-checked readings and meanings for the basic conversation words that are
  // not in the dictionary (the same list the Edge Function allows).
  // The dictionary wins when it has the word. Readings never come from the AI.
  const BASIC_WORDS = {
    "สวัสดี": ["サワッディー", "こんにちは"], "ขอบคุณ": ["コップクン", "ありがとう"],
    "ขอโทษ": ["コートート", "ごめんなさい"], "ไม่เป็นไร": ["マイペンライ", "大丈夫・気にしないで"],
    "ยินดี": ["インディー", "うれしい"], "รู้จัก": ["ルーチャック", "知り合う・知っている"],
    "ลาก่อน": ["ラーコーン", "さようなら"], "โชคดี": ["チョークディー", "幸運を・がんばって"],
    "ค่ะ": ["カ", "（女性の丁寧な語尾）"], "คะ": ["カ", "（女性の丁寧な語尾・疑問）"],
    "ครับ": ["クラップ", "（男性の丁寧な語尾）"], "นะ": ["ナ", "〜ね"], "จ้ะ": ["チャ", "（親しい語尾）"],
    "จ้า": ["チャー", "（親しい語尾）"], "ไหม": ["マイ", "〜か？"], "มั้ย": ["マイ", "〜か？（話し言葉）"],
    "หรือ": ["ルー", "または・〜か？"], "เหรอ": ["ロー", "〜なの？"], "หรอ": ["ロー", "〜なの？"],
    "ใช่": ["チャイ", "はい・そうです"], "ไม่": ["マイ", "〜ない"], "ไม่ใช่": ["マイチャイ", "ちがう"],
    "โอเค": ["オーケー", "オーケー"], "ได้": ["ダイ", "できる・いいよ"],
    "ฉัน": ["チャン", "私"], "ผม": ["ポム", "僕（男性）"], "คุณ": ["クン", "あなた・〜さん"],
    "เขา": ["カオ", "彼・彼女"], "เรา": ["ラオ", "私たち"], "คน": ["コン", "人"],
    "อะไร": ["アライ", "何"], "ใคร": ["クライ", "だれ"], "ที่ไหน": ["ティーナイ", "どこ"],
    "ไหน": ["ナイ", "どれ・どこ"], "เมื่อไร": ["ムアライ", "いつ"], "ทำไม": ["タムマイ", "なぜ"],
    "อย่างไร": ["ヤーンライ", "どのように"], "ยังไง": ["ヤンガイ", "どう（話し言葉）"],
    "กี่": ["キー", "いくつ"], "เท่าไร": ["タオライ", "いくら"],
    "เป็น": ["ペン", "〜である"], "คือ": ["クー", "〜は（つまり）"], "มี": ["ミー", "ある・持っている"],
    "อยู่": ["ユー", "いる・住んでいる"], "ไป": ["パイ", "行く"], "มา": ["マー", "来る"], "ทำ": ["タム", "する・作る"],
    "ชอบ": ["チョープ", "好き"], "อยาก": ["ヤーク", "〜したい"], "จะ": ["チャ", "〜するつもり"],
    "แล้ว": ["レーオ", "もう・〜した"], "ยัง": ["ヤン", "まだ"], "ก็": ["コー", "〜も"],
    "ด้วย": ["ドゥアイ", "〜も・一緒に"], "และ": ["レ", "そして"], "แต่": ["テー", "でも"],
    "กับ": ["カップ", "〜と"], "ที่": ["ティー", "〜で・〜する所"], "ของ": ["コーン", "〜の"],
    "กัน": ["カン", "お互いに・一緒に"], "เจอ": ["チュー", "会う"], "สบาย": ["サバーイ", "気楽・快適"],
    "สบายดี": ["サバーイディー", "元気"], "ดี": ["ディー", "良い"], "มาก": ["マーク", "とても"],
    "นิดหน่อย": ["ニットノイ", "少し"], "จริง": ["チン", "本当"], "นี่": ["ニー", "これ"],
    "นี้": ["ニー", "この"], "นั่น": ["ナン", "それ"], "นั้น": ["ナン", "その"], "วัน": ["ワン", "日"],
    "ชื่อ": ["チュー", "名前"], "ไทย": ["タイ", "タイ"], "ญี่ปุ่น": ["イープン", "日本"],
    "กรุงเทพ": ["クルンテープ", "バンコク"], "ประเทศ": ["プラテート", "国"],
    "มะลิ": ["マリ", "マリ（名前・ジャスミン）"]
  };
  let lexicon = null;
  let lexiconMaxLen = 1;

  // ---------- Mali's profile (data/mali_profile.txt, written in Notepad) ----------
  // Lines starting with ・ (or -, *, •) are facts about Mali; # lines are notes.
  // Thai in brackets becomes a usable word, and ・katakana after it is its reading:
  //   ・マリは最近ジム（ยิม・イム）に行っている
  const PROFILE_FILE = "data/mali_profile.txt";
  const profile = { loaded: false, lines: [], words: [] };

  function parseProfile(text) {
    const lines = [];
    const words = [];
    for (const raw of String(text || "").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const fact = line.replace(/^[・\-*•]\s*/, "").trim();
      if (!fact) continue;
      lines.push(fact.slice(0, 200));
      for (const m of fact.matchAll(/[（(]\s*([\u0E00-\u0E7F]+)\s*(?:[・･\/／、,]\s*([\u30A0-\u30FF\s]+?))?\s*[）)]/g)) {
        words.push({ thai: m[1], reading: (m[2] || "").replace(/\s+/g, "") });
      }
    }
    return { lines: lines.slice(0, 30), words };
  }

  async function loadProfile() {
    if (profile.loaded) return profile;
    try {
      const response = await fetch(`${PROFILE_FILE}?v=10.5`, { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      Object.assign(profile, parseProfile(await response.text()));
    } catch (error) {
      console.warn("マリのプロフィールを読み込めませんでした。設定なしで続けます。", error);
    }
    profile.loaded = true;
    lexicon = null; // rebuild so profile words get their readings
    return profile;
  }

  // thai -> { reading, japanese, source: "dictionary" | "basic" }
  function buildLexicon() {
    const map = new Map();
    for (const [thai, [reading, japanese]] of Object.entries(BASIC_WORDS)) map.set(thai, { reading, japanese, source: "basic" });
    for (const w of dictionaryWords()) {
      for (const t of [w.thai, ...(Array.isArray(w.acceptedThai) ? w.acceptedThai : [])]) {
        if (!t) continue;
        const prev = map.get(t);
        if (prev?.source === "dictionary" && Number(prev.difficulty) >= 1 && !(Number(w.difficulty) >= 1)) continue;
        map.set(t, { reading: w.reading || prev?.reading || "", japanese: w.japanese || prev?.japanese || "", source: "dictionary", difficulty: w.difficulty, entry: w });
      }
    }
    for (const w of profile.words) {
      if (!map.has(w.thai)) map.set(w.thai, { reading: w.reading, japanese: "", source: "profile" });
    }
    lexicon = map;
    lexiconMaxLen = Math.max(1, ...[...map.keys()].map(k => k.length));
  }

  // Splits text into tokens: {text, thai:true, info|null} for Thai words and
  // {text, thai:false} for spaces and punctuation. Known words come from the
  // dictionary, the basic list, and the AI's key words for this line (extra).
  // Unknown characters are grouped into one token.
  function tokenize(text, extra) {
    if (!lexicon) buildLexicon();
    const extraMap = new Map((extra || []).filter(w => w && w.thai).map(w => [String(w.thai).trim(), w]));
    const maxLen = Math.max(lexiconMaxLen, ...[...extraMap.keys()].map(k => k.length), 1);
    const known = piece => lexicon.has(piece) || extraMap.has(piece);
    const tokens = [];
    const source = String(text || "");
    let last = 0;
    for (const m of source.matchAll(/[฀-๿]+/g)) {
      if (m.index > last) tokens.push({ text: source.slice(last, m.index), thai: false });
      const run = m[0];
      const n = run.length;
      const best = Array(n + 1).fill(null);
      best[0] = { cost: 0, words: 0, prev: -1, known: false };
      for (let i = 0; i < n; i++) {
        if (!best[i]) continue;
        const step = (j, ok) => {
          const cost = best[i].cost + (ok ? 0 : j - i);
          const words = best[i].words + 1;
          const cur = best[j];
          if (!cur || cost < cur.cost || (cost === cur.cost && words < cur.words)) best[j] = { cost, words, prev: i, known: ok };
        };
        step(i + 1, known(run[i]));
        for (let len = 2; len <= maxLen && i + len <= n; len++) {
          if (known(run.slice(i, i + len))) step(i + len, true);
        }
      }
      const parts = [];
      for (let j = n; j > 0; j = best[j].prev) parts.unshift({ text: run.slice(best[j].prev, j), known: best[j].known });
      for (const part of parts) {
        const prev = tokens[tokens.length - 1];
        if (!part.known && prev && prev.thai && !prev.info && !prev.extra) { prev.text += part.text; continue; }
        const info = part.known ? lexicon.get(part.text) || null : null;
        tokens.push({ text: part.text, thai: true, info, extra: extraMap.get(part.text) || null });
      }
      last = m.index + run.length;
    }
    if (last < source.length) tokens.push({ text: source.slice(last), thai: false });
    return tokens;
  }

  // Each Thai word as a small block with its katakana reading on top.
  function rubyLine(text, extra) {
    const frag = document.createDocumentFragment();
    for (const t of tokenize(text, extra)) {
      if (!t.thai) continue; // spacing comes from the gap between blocks
      const word = document.createElement("span");
      word.className = "chat-ruby";
      const rt = document.createElement("span");
      rt.className = "chat-ruby-rt";
      rt.textContent = t.info?.reading || "？";
      const base = document.createElement("span");
      base.className = "chat-ruby-base";
      base.lang = "th";
      base.textContent = t.text;
      word.append(rt, base);
      frag.append(word);
    }
    return frag;
  }
  const LEVELS = [
    { level: 1, title: "Level 1 · 基礎", note: "とても短い文で、ゆっくり話してくれます" },
    { level: 2, title: "Level 2 · 基礎＋", note: "短くてやさしい文で話します" },
    { level: 3, title: "Level 3 · 初級", note: "日常会話くらいの自然な文で話します" }
  ];

  const q = id => document.getElementById(id);
  const MOODS = ["normal", "happy", "surprised"];
  const MOOD_IMAGE = {
    normal: "images/mali-normal.webp?v=10.6",
    happy: "images/mali-smile.webp?v=10.6",
    surprised: "images/mali-surprise.webp?v=10.6"
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
    /* Ver10.6: visual-novel layout — Mali standing on the left, chat on the right */
    body.chat-wide .app-shell{width:min(1180px,calc(100% - 24px))}
    .chat-room{display:grid;grid-template-columns:minmax(260px,36%) 1fr;gap:18px;align-items:start}
    .chat-main{min-width:0}
    .chat-legend{margin:0;font-size:.85rem}
    .chat-stage{position:sticky;top:12px;height:calc(100vh - 24px);min-height:520px;max-height:900px;border-radius:24px;overflow:hidden;
      background:radial-gradient(120% 70% at 50% 100%,#ffd6e4 0%,#fff3f7 45%,#fffaf5 100%);border:1px solid #f2d3dd}
    .chat-stage::after{content:"";position:absolute;left:12%;right:12%;bottom:14px;height:22px;border-radius:50%;background:rgba(200,120,150,.18);filter:blur(4px)}
    .chat-stage-img{position:absolute;left:50%;bottom:18px;height:calc(100% - 70px);width:auto;transform:translateX(-50%);z-index:1;
      filter:drop-shadow(0 6px 10px rgba(180,90,120,.25));transition:opacity .18s ease}
    .chat-stage-img.fading{opacity:.15}
    .chat-stage-img.pop{animation:chat-stage-pop .35s ease-out}
    @keyframes chat-stage-pop{0%{transform:translateX(-50%) scale(.97)}60%{transform:translateX(-50%) scale(1.02)}100%{transform:translateX(-50%) scale(1)}}
    .chat-stage.talking .chat-stage-img{animation:chat-stage-bob 1s ease-in-out infinite}
    @keyframes chat-stage-bob{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-5px)}}
    .chat-nameplate{position:absolute;left:12px;top:12px;z-index:2;display:flex;gap:6px;align-items:baseline;flex-wrap:wrap;max-width:70%;
      background:rgba(255,255,255,.88);border-radius:999px;padding:6px 14px;box-shadow:0 2px 6px rgba(0,0,0,.06)}
    .chat-nameplate span{font-size:.85rem;color:#8a7a6a}
    .chat-moods{position:absolute;right:10px;top:12px;z-index:2;display:flex;gap:4px}
    .chat-moods span{background:rgba(255,255,255,.85);border-radius:999px;padding:3px 7px;font-size:.85rem;opacity:.6}
    .chat-moods span.on{background:#ff8fab;opacity:1}
    @media (min-width:761px){
      /* keep the whole conversation beside Mali within one screen */
      .chat-room .chat-log{max-height:calc(100vh - 430px);min-height:220px}
    }
    @media (max-width:760px){
      .chat-room{grid-template-columns:1fr;gap:10px}
      .chat-stage{top:0;z-index:5;height:34vh;min-height:220px}
      .chat-stage-img{height:auto;width:62%;bottom:auto;top:44px}
      .chat-stage::after{display:none}
    }
    @media (prefers-reduced-motion:reduce){.chat-stage-img,.chat-stage.talking .chat-stage-img{animation:none!important;transition:none}}
    .chat-row{display:flex;gap:8px;align-items:flex-end;justify-self:start;max-width:94%}
    .chat-row .chat-bubble{max-width:100%}
    @keyframes chat-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
    .chat-log{display:grid;gap:12px;max-height:56vh;overflow-y:auto;padding:6px 2px}
    .chat-bubble{max-width:88%;padding:12px 14px;border-radius:18px;line-height:1.6;word-break:break-word}
    .chat-bubble.mali{justify-self:start;background:#fff;border:1px solid var(--border);border-top-left-radius:6px}
    .chat-bubble.me{justify-self:end;background:#fde7d3;border-top-right-radius:6px}
    .chat-thai{font:700 1.35rem/1.6 Tahoma,sans-serif}
    .chat-voice{padding:10px 14px;border-radius:14px;background:#fff0f5;border:1px solid #f6c6d6}
    .chat-profile-list{margin:8px 0;padding-left:1.2em;line-height:1.7}
    .chat-voice summary{cursor:pointer;font-weight:700}
    .chat-voice-row{display:flex;gap:10px;align-items:center;margin:8px 0}
    .chat-voice-row label{min-width:3em}
    .chat-voice select{font:inherit;padding:6px 8px;border-radius:10px;border:1px solid var(--border);background:#fff}
    .chat-thai .news-word{font:inherit;padding:0 1px}
    .chat-thai .news-word.selected{background:#dbeafe;color:#172554}
    .chat-thai .chat-unknown{border-bottom:1px dotted #c9a0a0}
    .chat-word-hint{margin-top:10px;padding:10px;border-radius:10px;background:#eff6ff;color:#172554;font-size:.98rem;line-height:1.6}
    .chat-word-hint .chat-hint-word{font:700 1.1rem Tahoma,sans-serif}
    .chat-word-hint .chat-hint-reading{font-size:1.1rem;font-weight:700;color:#7a4a00}
    .chat-word-hint .chat-hint-more{color:#6b7280;font-size:.9rem}
    .chat-word-add{font:inherit;font-size:.85rem;margin-left:6px;padding:3px 9px;border-radius:999px;border:1px dashed #c98d5c;background:#fff;cursor:pointer}
    .chat-word-add.added{background:var(--success-bg);color:var(--success);border:1px solid transparent;cursor:default}
    .chat-choice.with-ruby .chat-choice-thai{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:flex-end}
    .chat-ruby{display:inline-flex;flex-direction:column;align-items:center}
    .chat-ruby-rt{font:600 .72rem/1.2 system-ui,sans-serif;color:#8a6a2a;white-space:nowrap}
    .chat-ruby-base{line-height:1.4}
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
    '<span class="mode-icon" aria-hidden="true"><img src="images/mali-smile.webp?v=10.6" alt="" style="height:120px;width:auto;display:block;margin:0 auto;filter:drop-shadow(0 4px 8px rgba(255,143,171,.35))"></span>' +
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
          <img class="chat-avatar" src="images/mali-normal.webp?v=10.6" alt="" aria-hidden="true">
          <div><strong>มะลิ（マリ）</strong><br><span class="muted">バンコクの大学そばのカフェで働く25歳。タイ語の会話相手になってくれます。</span></div>
        </div>
        <div id="chatPasscodeBox" class="chat-passcode hidden">
          <label for="chatPasscode"><strong>🔑 合言葉</strong>（Supabaseに登録した <code>TVT_CHAT_PASSCODE</code>）</label>
          <input id="chatPasscode" type="password" autocomplete="off" placeholder="合言葉を入力">
          <span class="muted">このブラウザにだけ保存します。最初の1回だけでOKです。</span>
        </div>
        <p class="muted" style="margin:0">レベルを選ぶと、そのレベルまでの単語を中心に、マリが話し方を合わせてくれます🍆</p>
        <div id="chatLevelGrid" class="chat-level-grid"></div>
        <details id="chatProfileBox" class="chat-voice">
          <summary id="chatProfileSummary">📝 マリの設定</summary>
          <ul id="chatProfileList" class="chat-profile-list"></ul>
          <span class="muted">data/mali_profile.txt をメモ帳で書きかえると変わります。</span>
        </details>
        <details id="chatVoiceBox" class="chat-voice">
          <summary>🎀 マリの声の設定</summary>
          <div class="chat-voice-row"><label for="chatVoice">声</label><select id="chatVoice"></select></div>
          <div class="chat-voice-row"><label for="chatPitch">高さ</label><select id="chatPitch"></select></div>
          <button id="chatVoiceTest" class="small-button" type="button">🔊 試しに聞く</button>
          <span class="muted">このブラウザに保存されます。</span>
        </details>
        <button id="chatForgetPasscode" class="small-button hidden" type="button">合言葉を入れ直す</button>
      </section>

      <section id="chatRoom" class="chat-room hidden">
        <aside class="chat-stage" aria-label="マリ">
          <div class="chat-nameplate"><strong>มะลิ（マリ）</strong><span id="chatLevelLabel"></span></div>
          <div class="chat-moods" aria-hidden="true">
            <span data-mood="normal">😊</span><span data-mood="happy">😆</span><span data-mood="surprised">😲</span>
          </div>
          <img id="chatStageImage" class="chat-stage-img" src="images/mali-full-normal.webp?v=10.6" alt="マリ（ふつうの表情）">
        </aside>
        <div class="chat-card chat-main">
        <p class="muted chat-legend">単語をタップ→読み方、もう一度→意味。復習帳にも入れられます🍣<br>📘辞書の単語　🔰基本語　📝マリの設定の単語　⭐辞書にない単語</p>
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
  // Audio is cached per text, level and voice, so replaying a line costs nothing.
  const VOICE_KEY = "thaiTrainerChatVoiceV10";
  const VOICES = [
    { id: "nova", label: "ノヴァ（明るく元気）" },
    { id: "shimmer", label: "シマー（やわらか）" },
    { id: "coral", label: "コーラル（落ち着き）" },
    { id: "sage", label: "セージ（ささやき系）" }
  ];
  const PITCHES = [
    { rate: 1, label: "ふつう" },
    { rate: 1.08, label: "少し高め" },
    { rate: 1.15, label: "高め（アニメ声）" }
  ];
  function loadVoiceSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(VOICE_KEY) || "{}");
      return {
        voice: VOICES.some(v => v.id === saved.voice) ? saved.voice : "nova",
        rate: PITCHES.some(p => p.rate === saved.rate) ? saved.rate : 1.08
      };
    } catch (_) {
      return { voice: "nova", rate: 1.08 };
    }
  }
  const voiceSettings = loadVoiceSettings();
  function saveVoiceSettings() {
    try { localStorage.setItem(VOICE_KEY, JSON.stringify(voiceSettings)); } catch (_) { /* ignore */ }
  }
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
    const key = `${chat.level}\u0000${voiceSettings.voice}\u0000${text}`;
    if (audioCache.has(key)) return audioCache.get(key);
    const config = window.THAI_TRAINER_SUPABASE || {};
    const response = await fetch(functionUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": config.publishableKey || "",
        "x-tvt-passcode": passcode()
      },
      body: JSON.stringify({ action: "speak", level: chat.level, voice: voiceSettings.voice, text }),
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
      // Playing a little faster without keeping the pitch makes the voice higher and younger.
      audio.preservesPitch = false;
      audio.mozPreservesPitch = false;
      audio.webkitPreservesPitch = false;
      audio.playbackRate = voiceSettings.rate;
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
    row.append(bubble);

    // Like the news reader: each word is tappable.
    // 1st tap → reading, 2nd tap on the same word → meaning (+ review book).
    const tokens = tokenize(message.content, message.words);
    const sel = message.sel || null; // { i, stage }
    const thai = document.createElement("div");
    thai.className = "chat-thai";
    thai.lang = "th";
    tokens.forEach((t, i) => {
      if (!t.thai) { thai.append(t.text); return; }
      const b = document.createElement("button");
      b.type = "button";
      b.className = "news-word" + (t.info || t.extra ? "" : " chat-unknown") + (sel?.i === i ? " selected" : "");
      b.textContent = t.text;
      b.setAttribute("aria-label", `${t.text} の読み方を表示`);
      b.addEventListener("click", () => {
        message.sel = sel?.i === i ? { i, stage: Math.min(sel.stage + 1, 2) } : { i, stage: 1 };
        renderLog({ keepScroll: true });
      });
      thai.append(b);
    });

    const hint = document.createElement("div");
    hint.className = "chat-word-hint";
    hint.setAttribute("role", "status");
    hint.setAttribute("aria-live", "polite");
    const token = sel ? tokens[sel.i] : null;
    if (!token) {
      hint.textContent = "👆 わからない単語をタップすると読み方、もう一度タップすると意味が出ます";
    } else {
      const reading = token.info?.reading || "";
      const meaning = token.extra?.japanese || token.info?.japanese || "";
      const source = { dictionary: "📘", basic: "🔰", profile: "📝" }[token.info?.source] || "⭐";
      const word = document.createElement("span");
      word.className = "chat-hint-word";
      word.lang = "th";
      word.textContent = `${source} ${token.text}`;
      const read = document.createElement("span");
      read.className = "chat-hint-reading";
      read.textContent = reading || "読み未登録";
      hint.append(word, "：🔤 ", read);
      if (sel.stage >= 2) {
        hint.append(` ／ ${meaning || "意味未登録"}`);
        const add = document.createElement("button");
        add.type = "button";
        add.className = "chat-word-add";
        const entry = token.info?.entry || dictionaryEntry(token.text);
        const markAdded = () => {
          add.textContent = "✓ 復習帳";
          add.disabled = true;
          add.classList.add("added");
        };
        add.textContent = "🍣＋復習帳";
        if (isInReviewBook(entry, token.text)) markAdded();
        add.addEventListener("click", () => {
          if (addWordToReviewBook({ thai: token.text, japanese: meaning })) {
            markAdded();
            status(`「${token.text}」を復習帳に入れました🍣`);
          }
        });
        hint.append(add);
      } else {
        const more = document.createElement("span");
        more.className = "chat-hint-more";
        more.textContent = "（もう一度タップで意味）";
        hint.append(" ", more);
      }
    }

    const tools = document.createElement("div");
    tools.className = "chat-tools";
    const listen = document.createElement("button");
    listen.type = "button";
    listen.className = "small-button";
    listen.textContent = "🔊 聞く";
    listen.addEventListener("click", () => speakThai(message.content, listen));
    const whole = document.createElement("button");
    whole.type = "button";
    whole.className = "small-button";
    whole.textContent = message.showJapanese ? "🇯🇵 文の訳をかくす" : "🇯🇵 文の訳（最後の手段）";
    whole.addEventListener("click", () => {
      message.showJapanese = !message.showJapanese;
      renderLog({ keepScroll: true });
    });
    tools.append(listen, whole);

    bubble.append(thai, hint, tools);
    if (message.showJapanese) {
      const japanese = document.createElement("div");
      japanese.className = "chat-japanese";
      japanese.textContent = message.japanese || "（訳がありません）";
      bubble.append(japanese);
    }
    return row;
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
      typing.append(dots);
      log.append(typing);
    }
    log.scrollTop = keepScroll ?? log.scrollHeight;
    renderChoices();
    updateBigAvatar();
  }

  // The large picture in the room header follows Mali's latest mood.
  const MOOD_FULL = {
    normal: "images/mali-full-normal.webp?v=10.6",
    happy: "images/mali-full-smile.webp?v=10.6",
    surprised: "images/mali-full-surprise.webp?v=10.6"
  };
  const MOOD_ALT = { normal: "ふつうの表情", happy: "笑顔", surprised: "おどろいた顔" };
  // Preload so switching expressions is instant.
  Object.values(MOOD_FULL).forEach(src => { const img = new Image(); img.src = src; });

  // The standing picture on the left follows Mali's latest mood.
  function updateBigAvatar() {
    const img = q("chatStageImage");
    if (!img) return;
    const last = [...chat.messages].reverse().find(m => m.role === "assistant");
    const mood = MOODS.includes(last?.mood) ? last.mood : "normal";
    document.querySelectorAll(".chat-moods span").forEach(el => el.classList.toggle("on", el.dataset.mood === mood));
    q("chatRoom").querySelector(".chat-stage").classList.toggle("talking", Boolean(chat.sending));
    const src = MOOD_FULL[mood];
    if (img.getAttribute("src") === src) return;
    img.classList.add("fading");
    setTimeout(() => {
      img.src = src;
      img.alt = `マリ（${MOOD_ALT[mood]}）`;
      img.classList.remove("fading", "pop");
      void img.offsetWidth; // restart the animation
      img.classList.add("pop");
    }, 120);
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
      if (choiceStage >= 1) {
        // Reading sits right above each word, so it is clear which goes with which.
        thai.replaceChildren(rubyLine(choice.thai));
        b.classList.add("with-ruby");
      }
      b.append(thai);
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
    document.body.classList.remove("chat-wide");
    q("chatSetup").classList.remove("hidden");
    const hasPasscode = Boolean(passcode());
    q("chatPasscodeBox").classList.toggle("hidden", hasPasscode);
    q("chatForgetPasscode").classList.toggle("hidden", !hasPasscode);
    q("chatPasscode").value = "";
    renderLevels();
    loadProfile().then(renderProfile);
  }

  function renderProfile() {
    const list = q("chatProfileList");
    list.replaceChildren(...profile.lines.map(line => {
      const li = document.createElement("li");
      li.textContent = line;
      return li;
    }));
    q("chatProfileSummary").textContent = profile.lines.length
      ? `📝 マリの設定（${profile.lines.length}こ）`
      : "📝 マリの設定（なし）";
  }

  function showRoom() {
    q("chatSetup").classList.add("hidden");
    q("chatRoom").classList.remove("hidden");
    document.body.classList.add("chat-wide");
    // Bring the room to the top so Mali is shown from head to toe.
    requestAnimationFrame(() => q("chatRoom").scrollIntoView({ block: "start", behavior: "smooth" }));
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
    await loadProfile();
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
          profile: profile.lines,
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
    if (name !== "chat") document.body.classList.remove("chat-wide");
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
    const voiceSelect = q("chatVoice");
    const pitchSelect = q("chatPitch");
    VOICES.forEach(v => voiceSelect.append(new Option(v.label, v.id, false, v.id === voiceSettings.voice)));
    PITCHES.forEach(p => pitchSelect.append(new Option(p.label, String(p.rate), false, p.rate === voiceSettings.rate)));
    voiceSelect.addEventListener("change", () => { voiceSettings.voice = voiceSelect.value; saveVoiceSettings(); });
    pitchSelect.addEventListener("change", () => { voiceSettings.rate = Number(pitchSelect.value); saveVoiceSettings(); });
    q("chatVoiceTest").addEventListener("click", () => {
      const typed = q("chatPasscode").value.trim();
      if (typed) writePasscode(typed);
      if (!passcode()) {
        status("先に合言葉を入れてくだされ🔑", true);
        return;
      }
      speakThai("สวัสดีค่ะ ชื่อมะลิค่ะ ยินดีที่ได้รู้จักนะคะ", q("chatVoiceTest"));
    });
    q("chatForgetPasscode").addEventListener("click", () => {
      writePasscode("");
      showSetup();
    });
  });

  // Exposed for tests.
  window.__tvtChat = { chat, levelVocab, tokenize, dictionaryEntry, functionUrl, addWordToReviewBook };
})();
