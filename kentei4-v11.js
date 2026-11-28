/* Thai Vocabulary Trainer Ver11.0: 4級問題モード📝🐘
 *
 * Practice in the style of 実用タイ語検定 4級: Thai script only, no readings while answering.
 *   大問1 語彙の穴埋め / 大問2 会話の応答 / 大問3 語順の並べ替え : kentei4_questions.json (original questions)
 *   大問4 単語の意味 : dictionary words (Level 2–3) from questions.json / Supabase
 * Readings appear only after answering, and only from the dictionary (same rule as the rest of the app).
 * Wrong 大問4 words go to the review book; attempts are kept in this browser's localStorage.
 */
(function () {
  "use strict";

  const DATA_URL = "kentei4_questions.json?v=11.0";
  const STATS_KEY = "thaiTrainerKentei4V11";
  const SETTINGS_KEY = "thaiTrainerKentei4SettingsV11";
  const SECONDS_PER_QUESTION = 40;
  const SECTIONS = [
    { key: "vocab", title: "大問1 語彙の穴埋め", icon: "🐟" },
    { key: "dialogue", title: "大問2 会話の応答", icon: "🐙" },
    { key: "order", title: "大問3 語順の並べ替え", icon: "🦑" },
    { key: "word", title: "大問4 単語の意味", icon: "🐮" }
  ];
  const q = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const shuffle = list => {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const k4 = { data: null, items: [], index: 0, answers: [], timer: null, deadline: 0, picked: [], answered: false, running: false };

  // ---------- Data ----------
  async function loadData() {
    if (k4.data) return k4.data;
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    k4.data = await res.json();
    return k4.data;
  }
  function wordPool() {
    const all = Array.isArray(state.allQuestions) ? state.allQuestions : [];
    return all.filter(w => [2, 3].includes(Number(w.difficulty)) && w.thai && w.japanese);
  }
  function meaning(w) {
    try { if (typeof japaneseDisplay === "function") return japaneseDisplay(w) || w.japanese; } catch (_) { /* fall through */ }
    return w.japanese;
  }

  // Build one test-shaped item from a source question.
  function makeItem(section, src) {
    if (section === "order") {
      return { section, src, kind: "order", pool: shuffle(src.tokens.map((t, i) => ({ t, i }))) };
    }
    if (section === "word") {
      const pool = wordPool();
      const right = meaning(src);
      const wrong = shuffle(pool.filter(w => meaning(w) !== right)).reduce((acc, w) => {
        const m = meaning(w);
        if (acc.length < 3 && !acc.includes(m)) acc.push(m);
        return acc;
      }, []);
      const options = shuffle([right, ...wrong]);
      return { section, src, kind: "choice", options, answer: options.indexOf(right) };
    }
    const order = shuffle(src.options.map((_, i) => i));
    return { section, src, kind: "choice", options: order.map(i => src.options[i]), answer: order.indexOf(src.answer) };
  }

  // Spread the questions over the chosen sections, then keep the test order (大問1 → 4).
  function buildTest(sectionKeys, count) {
    const pools = {};
    for (const key of sectionKeys) {
      pools[key] = shuffle(key === "word" ? wordPool() : (k4.data[key] || []));
    }
    const picked = Object.fromEntries(sectionKeys.map(k => [k, []]));
    let left = count;
    while (left > 0 && sectionKeys.some(k => pools[k].length)) {
      for (const key of sectionKeys) {
        if (left > 0 && pools[key].length) {
          picked[key].push(pools[key].pop());
          left--;
        }
      }
    }
    return SECTIONS.filter(s => sectionKeys.includes(s.key))
      .flatMap(s => picked[s.key].map(src => makeItem(s.key, src)));
  }

  // ---------- Stats ----------
  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (_) { return fallback; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* storage may be unavailable */ }
  }
  function attempts() {
    const list = readJson(STATS_KEY, []);
    return Array.isArray(list) ? list : [];
  }
  function renderStats() {
    const list = attempts();
    if (!list.length) {
      q("k4Stats").textContent = "まだ挑戦の記録はありません。最初の一歩じゃ (｀･∀･´)🔥";
      return;
    }
    const pct = a => Math.round((a.correct / Math.max(1, a.total)) * 100);
    const best = Math.max(...list.map(pct));
    const recent = list.slice(-5).map(a => `${pct(a)}%`).join(" → ");
    q("k4Stats").innerHTML = `挑戦 <strong>${list.length}</strong>回 ／ 最高 <strong>${best}%</strong> ／ 直近：${esc(recent)}`;
  }

  // ---------- Rendering ----------
  function sectionInfo(key) { return SECTIONS.find(s => s.key === key); }

  function readingChips(text) {
    const api = window.__tvtChat;
    if (!api || typeof api.tokenize !== "function") return "";
    const seen = new Set();
    const chips = api.tokenize(text)
      .filter(t => t.thai && t.info && t.info.reading && !seen.has(t.text) && seen.add(t.text))
      .map(t => `<span class="k4-chip"><b lang="th">${esc(t.text)}</b>${esc(t.info.reading)}<small>${esc(t.info.japanese)}</small></span>`);
    return chips.length ? `<div class="k4-chips"><span class="muted">辞書にある単語の読み：</span>${chips.join("")}</div>` : "";
  }

  function promptHtml(item) {
    const s = item.src;
    if (item.section === "vocab") {
      return `<p class="k4-instr">（　）に入る最も適切な語を選びなさい。</p><p class="k4-thai" lang="th">${esc(s.thai)}</p>`;
    }
    if (item.section === "dialogue") {
      return `<p class="k4-instr">会話が自然になるように、（　）に入る文を選びなさい。</p>
        <p class="k4-thai" lang="th"><span class="k4-who">A：</span>${esc(s.a)}</p>
        <p class="k4-thai" lang="th"><span class="k4-who">B：</span>${esc(s.b)}</p>`;
    }
    if (item.section === "order") {
      return `<p class="k4-instr">日本語の意味になるように、単語を正しい順に並べなさい。</p><p class="k4-ja">${esc(s.japanese)}</p>`;
    }
    return `<p class="k4-instr">次のタイ語の意味を選びなさい。（読みは答えた後に出ます）</p><p class="k4-thai k4-big" lang="th">${esc(s.thai)}</p>`;
  }

  function renderItem() {
    const item = k4.items[k4.index];
    const info = sectionInfo(item.section);
    k4.answered = false;
    k4.picked = [];
    state.questionStartedAt = Date.now();
    q("k4Progress").textContent = `${k4.index + 1} / ${k4.items.length}問`;
    q("k4Section").textContent = `${info.icon} ${info.title}`;
    q("k4Prompt").innerHTML = promptHtml(item);
    q("k4Feedback").className = "k4-feedback hidden";
    q("k4Feedback").innerHTML = "";
    q("k4Next").classList.add("hidden");
    q("k4Next").textContent = k4.index + 1 < k4.items.length ? "次の問題へ →" : "結果を見る 🏁";
    const box = q("k4Options");
    box.replaceChildren();
    q("k4OrderTools").classList.toggle("hidden", item.kind !== "order");
    document.querySelectorAll(".k4-order-only").forEach(b => b.classList.toggle("hidden", item.kind !== "order"));
    if (item.kind === "choice") {
      item.options.forEach((text, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "k4-option";
        if (item.section !== "word") b.lang = "th";
        b.innerHTML = `<span class="k4-num">${i + 1}</span><span>${esc(text)}</span>`;
        b.addEventListener("click", () => answerChoice(i));
        box.append(b);
      });
    } else {
      renderOrder();
    }
  }

  function renderOrder() {
    const item = k4.items[k4.index];
    const line = k4.picked.map(p => p.t).join(" ");
    q("k4OrderLine").textContent = line || "ここに並びます";
    q("k4OrderLine").classList.toggle("empty", !line);
    const box = q("k4Options");
    box.replaceChildren();
    item.pool.forEach(p => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "k4-token";
      b.lang = "th";
      b.textContent = p.t;
      b.disabled = k4.answered || k4.picked.includes(p);
      b.addEventListener("click", () => {
        if (k4.answered) return;
        k4.picked.push(p);
        renderOrder();
      });
      box.append(b);
    });
    q("k4OrderCheck").disabled = k4.answered || k4.picked.length !== item.pool.length;
    q("k4OrderUndo").disabled = k4.answered || !k4.picked.length;
  }

  function correctThai(item) {
    const s = item.src;
    if (item.section === "vocab") return s.thai.replace("（　）", s.options[s.answer]);
    if (item.section === "dialogue") return `${s.a.replace("（　）", s.options[s.answer])} ${s.b.replace("（　）", s.options[s.answer])}`;
    if (item.section === "order") return s.accepted[0].join("");
    return s.thai;
  }

  function showFeedback(item, ok, userText) {
    const s = item.src;
    let body = "";
    if (item.section === "word") {
      body = `<p><b lang="th">${esc(s.thai)}</b>　読み：${esc(s.reading || "（辞書に読みなし）")}　意味：${esc(meaning(s))}</p>`;
    } else if (item.section === "order") {
      body = `<p>正しい順：<b lang="th">${esc(s.accepted.map(a => a.join(" ")).join("　／　"))}</b></p><p class="muted">${esc(s.explain)}</p>`;
    } else {
      body = `<p>正解：<b lang="th">${item.answer + 1}. ${esc(item.options[item.answer])}</b></p>
        <p>${esc(s.japanese)}</p><p class="muted">💡 ${esc(s.explain)}</p>`;
    }
    const fb = q("k4Feedback");
    fb.className = `k4-feedback ${ok ? "ok" : "ng"}`;
    fb.innerHTML = `<strong>${ok ? "⭕ 正解！ (σﾟ∀ﾟ)σ" : `❌ 残念… (´・ω・｀)${userText ? `　あなたの答え：<span lang="th">${esc(userText)}</span>` : ""}`}</strong>${body}${item.section === "word" ? "" : readingChips(correctThai(item))}`;
    q("k4Next").classList.remove("hidden");
    q("k4Next").focus();
  }

  function record(item, ok, userText) {
    k4.answers[k4.index] = { ok, userText };
    if (item.section !== "word") return;
    const word = { ...item.src, questionType: "word" };
    try { if (typeof recordAnswer === "function") recordAnswer(word, userText, ok); } catch (_) { /* history is optional here */ }
    if (!ok) {
      try { if (typeof addWrongWordToReviewBook === "function") addWrongWordToReviewBook(word); } catch (_) { /* ignore */ }
    }
  }

  function answerChoice(i) {
    if (k4.answered) return;
    const item = k4.items[k4.index];
    k4.answered = true;
    const ok = i === item.answer;
    [...q("k4Options").children].forEach((b, j) => {
      b.disabled = true;
      b.classList.toggle("right", j === item.answer);
      b.classList.toggle("wrong", j === i && !ok);
    });
    record(item, ok, item.options[i]);
    showFeedback(item, ok, ok ? "" : item.options[i]);
  }

  function checkOrder() {
    const item = k4.items[k4.index];
    if (k4.answered || k4.picked.length !== item.pool.length) return;
    k4.answered = true;
    const tokens = k4.picked.map(p => p.t);
    const ok = item.src.accepted.some(a => a.join("\u0000") === tokens.join("\u0000"));
    record(item, ok, tokens.join(" "));
    renderOrder();
    showFeedback(item, ok, ok ? "" : tokens.join(" "));
  }

  // ---------- Timer (本番モード) ----------
  function stopTimer() {
    if (k4.timer) clearInterval(k4.timer);
    k4.timer = null;
  }
  function tick() {
    const left = Math.max(0, Math.ceil((k4.deadline - Date.now()) / 1000));
    q("k4Timer").textContent = `⏱️ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
    q("k4Timer").classList.toggle("hurry", left <= 60);
    if (left <= 0) {
      stopTimer();
      window.alert("時間切れじゃ！ ⏰ ここまでで採点します。");
      finish();
    }
  }

  // ---------- Flow ----------
  function panel(name) {
    ["k4Setup", "k4Quiz", "k4Result"].forEach(id => q(id).classList.toggle("hidden", id !== name));
  }

  async function startTest() {
    const keys = SECTIONS.map(s => s.key).filter(k => q(`k4Sec-${k}`).checked);
    const count = Number(q("k4Count").value) || 20;
    const exam = q("k4Exam").checked;
    writeJson(SETTINGS_KEY, { keys, count, exam });
    q("k4SetupMsg").textContent = "";
    if (!keys.length) {
      q("k4SetupMsg").textContent = "大問を1つ以上選んでくだされ🐙";
      return;
    }
    try {
      await loadData();
    } catch (error) {
      q("k4SetupMsg").textContent = `問題を読み込めませんでした（${error.message}）`;
      return;
    }
    k4.items = buildTest(keys, count);
    if (!k4.items.length) {
      q("k4SetupMsg").textContent = "出せる問題がありません。単語データの読み込みを待ってから、もう一度どうぞ。";
      return;
    }
    k4.index = 0;
    k4.answers = [];
    k4.running = true;
    state.mode = "kentei4";
    stopTimer();
    q("k4Timer").classList.toggle("hidden", !exam);
    if (exam) {
      k4.deadline = Date.now() + k4.items.length * SECONDS_PER_QUESTION * 1000;
      tick();
      k4.timer = setInterval(tick, 500);
    }
    panel("k4Quiz");
    renderItem();
  }

  function next() {
    if (!k4.answered) return;
    if (k4.index + 1 >= k4.items.length) return finish();
    k4.index++;
    renderItem();
  }

  function finish() {
    stopTimer();
    k4.running = false;
    const total = k4.items.length;
    const correct = k4.answers.filter(a => a && a.ok).length;
    const pct = Math.round((correct / Math.max(1, total)) * 100);
    const bySection = SECTIONS.map(s => {
      const idx = k4.items.map((it, i) => (it.section === s.key ? i : -1)).filter(i => i >= 0);
      return { ...s, total: idx.length, correct: idx.filter(i => k4.answers[i]?.ok).length };
    }).filter(s => s.total);
    const list = attempts();
    list.push({ at: new Date().toISOString(), correct, total, exam: !q("k4Timer").classList.contains("hidden"),
      sections: Object.fromEntries(bySection.map(s => [s.key, [s.correct, s.total]])) });
    writeJson(STATS_KEY, list.slice(-200));

    const face = pct >= 80 ? "(｀･∀･´)🦛✨ 合格が見えてきたぞい！" : pct >= 60 ? "( ＾∀＾)🐮 いい調子じゃ！" : "(・´ｪ`・)🐙 0点からの復讐は始まったばかり！";
    q("k4Score").innerHTML = `<strong>${correct} / ${total}</strong>（${pct}%）<br>${face}`;
    q("k4Breakdown").innerHTML = bySection.map(s => {
      const p = Math.round((s.correct / s.total) * 100);
      return `<div class="k4-bar"><span>${s.icon} ${esc(s.title)}</span><span class="k4-bar-track"><i style="width:${p}%"></i></span><b>${s.correct}/${s.total}</b></div>`;
    }).join("");
    const misses = k4.items.map((it, i) => ({ it, a: k4.answers[i] })).filter(x => !x.a || !x.a.ok);
    k4.misses = misses.map(x => x.it);
    q("k4ToRead").disabled = !misses.length;
    q("k4Misses").innerHTML = misses.length
      ? `<h3>まちがえた問題（${misses.length}問）</h3>` + misses.map(({ it, a }) => {
          const s = it.src;
          const right = it.section === "order" ? s.accepted[0].join(" ") : it.section === "word" ? `${s.thai} ＝ ${meaning(s)}（${s.reading || "読みなし"}）` : it.options[it.answer];
          const head = it.section === "word" ? "単語" : it.section === "order" ? s.japanese : (s.thai || `${s.a} / ${s.b}`);
          return `<div class="k4-miss"><small>${esc(sectionInfo(it.section).title)}</small><div lang="th">${esc(head)}</div>
            <div>正解：<b lang="th">${esc(right)}</b>${a ? "" : "　（時間切れで未回答）"}</div></div>`;
        }).join("") + `<p class="muted">大問4でまちがえた単語は復習帳に入りました🍣</p>`
      : "<p>全問正解！ 完璧じゃ (σﾟ∀ﾟ)σ🎉</p>";
    renderStats();
    panel("k4Result");
  }

  // ---------- 間違えた問題を「読む🐨」で復習 ----------
  // Sentence items become 読む-mode sentence questions (Thai → Japanese 4択) with a word breakdown;
  // readings in the breakdown come only from the dictionary.
  function breakdownOf(text) {
    const api = window.__tvtChat;
    if (!api || typeof api.tokenize !== "function") return [];
    return api.tokenize(text).filter(t => t.thai).map(t => ({
      thai: t.text,
      japanese: t.info?.japanese || "（辞書になし）",
      reading: t.info?.reading || ""
    }));
  }
  function sentenceText(item) {
    const s = item.src;
    if (item.section === "vocab") return s.thai.replace("（　）", s.options[s.answer]);
    if (item.section === "dialogue") {
      const fill = t => t.replace("（　）", s.options[s.answer]);
      return `A：${fill(s.a)}\nB：${fill(s.b)}`;
    }
    return s.accepted[0].join("");
  }
  function reviewQuestions(items) {
    return items.map(item => {
      if (item.section === "word") return { ...item.src, questionType: "word" };
      const s = item.src;
      const others = shuffle((k4.data[item.section] || []).filter(o => o.id !== s.id).map(o => o.japanese))
        .filter((t, i, a) => t !== s.japanese && a.indexOf(t) === i).slice(0, 3);
      const thai = sentenceText(item);
      const info = sectionInfo(item.section);
      return {
        id: `k4-${s.id}`, questionType: "sentence", setId: "kentei4", difficulty: 3,
        studyTitle: `📝 4級の復習：${info.icon} ${info.title}`,
        thai, japanese: s.japanese, choices: [s.japanese, ...others], reading: "",
        breakdown: breakdownOf(thai), explanation: s.explain,
        acceptedThai: [thai], acceptedJapanese: [s.japanese]
      };
    }).filter(qn => qn.questionType === "word" || qn.choices.length === 4);
  }
  function reviewInReading() {
    const list = reviewQuestions(k4.misses || []);
    if (!list.length) return;
    stopTimer();
    startQuiz("choice", list, 3);
  }

  function openSetup() {
    stopTimer();
    k4.running = false;
    const saved = readJson(SETTINGS_KEY, {});
    SECTIONS.forEach(s => { q(`k4Sec-${s.key}`).checked = !Array.isArray(saved.keys) || saved.keys.includes(s.key); });
    if (saved.count) q("k4Count").value = String(saved.count);
    q("k4Exam").checked = Boolean(saved.exam);
    q("k4SetupMsg").textContent = "";
    renderStats();
    panel("k4Setup");
  }

  // ---------- Styles ----------
  const css = document.createElement("style");
  css.textContent = `
    .k4-setup{display:grid;gap:14px}
    .k4-hero{padding:14px 16px;border-radius:16px;background:linear-gradient(135deg,#fff4e6,#fde7d6);border:1px solid var(--border)}
    .k4-sections{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px}
    .k4-sections label,.k4-row label{display:flex;gap:8px;align-items:center;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:#fff;cursor:pointer}
    .k4-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
    .k4-row select{font:inherit;padding:8px;border-radius:10px;border:1px solid var(--border)}
    .k4-start{font:700 1.1rem/1.2 inherit;padding:14px;border:0;border-radius:14px;background:var(--primary);color:#fff;cursor:pointer}
    .k4-start:hover{background:var(--primary-dark)}
    .k4-msg{color:var(--danger);min-height:1.2em;margin:0}
    .k4-top{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
    .k4-sec{font-weight:700;color:var(--primary-dark)}
    #k4Timer{font-weight:700;padding:4px 10px;border-radius:999px;background:var(--secondary)}
    #k4Timer.hurry{background:var(--danger-bg);color:var(--danger)}
    .k4-instr{margin:.2em 0;color:var(--muted);font-size:.95rem}
    .k4-thai{font:400 1.45rem/1.7 Tahoma,"Noto Sans Thai",sans-serif;margin:.3em 0}
    .k4-big{font-size:2.2rem;text-align:center}
    .k4-who{font-family:inherit;font-size:1rem;color:var(--muted)}
    .k4-ja{font-size:1.2rem;font-weight:700}
    .k4-options{display:grid;gap:8px;margin:12px 0}
    .k4-option{display:flex;gap:10px;align-items:center;text-align:left;font:1.15rem/1.5 Tahoma,"Noto Sans Thai",sans-serif;padding:12px 14px;border-radius:14px;border:1px solid var(--border);background:#fff;cursor:pointer}
    .k4-option:not(:disabled):hover{border-color:#c98d5c;background:#fffaf3}
    .k4-option.right{border-color:var(--success);background:var(--success-bg)}
    .k4-option.wrong{border-color:var(--danger);background:var(--danger-bg)}
    .k4-num{flex:0 0 28px;height:28px;border-radius:50%;display:grid;place-items:center;background:var(--secondary);font:700 .9rem/1 sans-serif}
    #k4Options:has(.k4-token){display:flex;flex-wrap:wrap}
    .k4-token{font:1.25rem/1.4 Tahoma,"Noto Sans Thai",sans-serif;padding:10px 14px;border-radius:12px;border:1px solid var(--border);background:#fff;cursor:pointer}
    .k4-token:disabled{opacity:.35;cursor:default}
    .k4-order-line{min-height:2.4em;padding:10px 14px;border-radius:12px;border:2px dashed var(--border);font:1.35rem/1.5 Tahoma,"Noto Sans Thai",sans-serif;background:#fffdf8}
    .k4-order-line.empty{color:var(--muted);font:1rem/2 inherit}
    .k4-tools{display:flex;gap:8px;flex-wrap:wrap}
    .k4-feedback{padding:12px 14px;border-radius:14px;margin:8px 0}
    .k4-feedback.ok{background:var(--success-bg);border:1px solid var(--success)}
    .k4-feedback.ng{background:var(--danger-bg);border:1px solid var(--danger)}
    .k4-feedback p{margin:.35em 0}
    .k4-feedback b[lang=th]{font-family:Tahoma,"Noto Sans Thai",sans-serif;font-size:1.1em}
    .k4-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px}
    .k4-chip{display:inline-grid;padding:4px 8px;border-radius:10px;background:#fff;border:1px solid var(--border);font-size:.85rem;line-height:1.3}
    .k4-chip b{font:1rem Tahoma,"Noto Sans Thai",sans-serif}
    .k4-chip small{color:var(--muted)}
    .k4-score{font-size:1.4rem;text-align:center;margin:8px 0 14px}
    .k4-bar{display:grid;grid-template-columns:minmax(150px,auto) 1fr auto;gap:10px;align-items:center;margin:6px 0}
    .k4-bar-track{height:12px;border-radius:99px;background:var(--secondary);overflow:hidden}
    .k4-bar-track i{display:block;height:100%;background:var(--primary)}
    .k4-miss{padding:8px 12px;border-left:4px solid var(--danger);background:#fff;border-radius:8px;margin:6px 0}
    .k4-miss [lang=th],.k4-miss b{font-family:Tahoma,"Noto Sans Thai",sans-serif}
    @media (max-width:560px){.k4-bar{grid-template-columns:1fr auto}.k4-bar-track{grid-column:1/-1;grid-row:2}}
  `;
  document.head.append(css);

  // ---------- Menu button ----------
  const button = document.createElement("button");
  button.className = "mode-button";
  button.type = "button";
  button.dataset.mode = "kentei4";
  button.innerHTML =
    '<span class="mode-icon" aria-hidden="true">📝🐘</span>' +
    '<span class="mode-title">4級問題📝🐘</span>' +
    '<span class="mode-description">実用タイ語検定4級の形で解く。読み仮名なし・本番モードあり</span>';
  const grid = document.querySelector(".mode-grid");
  grid.insertBefore(button, grid.querySelector('[data-mode="longreading"]'));

  // ---------- Screen ----------
  q("quizScreen").insertAdjacentHTML("afterend", `
    <div id="k4Screen" class="hidden">
      <div class="quiz-header">
        <button id="k4Back" class="icon-button" type="button">← 戻る</button>
        <h2 style="margin:0">4級問題📝🐘</h2>
      </div>

      <section id="k4Setup" class="k4-setup">
        <div class="k4-hero">
          <strong>問題を解いて身を引き締めるのじゃ (｀･∀･´)🔥</strong><br>
          <span class="muted">4級の形をまねたオリジナル問題です（過去問ではありません）。答えるまでは読み仮名を出しません。</span>
        </div>
        <div class="k4-sections">
          ${SECTIONS.map(s => `<label><input type="checkbox" id="k4Sec-${s.key}" checked> ${s.icon} ${s.title}</label>`).join("")}
        </div>
        <div class="k4-row">
          <label for="k4Count">問題数
            <select id="k4Count"><option value="10">10問</option><option value="20" selected>20問</option><option value="30">30問</option><option value="40">40問</option></select>
          </label>
          <label><input type="checkbox" id="k4Exam"> ⏱️ 本番モード（1問${SECONDS_PER_QUESTION}秒の制限時間）</label>
        </div>
        <button id="k4Start" class="k4-start" type="button">試験開始！ 🐘⚔️</button>
        <p id="k4SetupMsg" class="k4-msg" role="alert"></p>
        <p id="k4Stats" class="muted"></p>
      </section>

      <section id="k4Quiz" class="hidden">
        <div class="k4-top">
          <span id="k4Section" class="k4-sec"></span>
          <span id="k4Progress" class="muted"></span>
          <span id="k4Timer" class="hidden"></span>
        </div>
        <div id="k4Prompt"></div>
        <div id="k4OrderTools" class="hidden">
          <div id="k4OrderLine" class="k4-order-line" lang="th"></div>
        </div>
        <div id="k4Options" class="k4-options"></div>
        <div class="k4-tools">
          <button id="k4OrderUndo" class="small-button k4-order-only" type="button">↩ 1つ戻す</button>
          <button id="k4OrderCheck" class="small-button k4-order-only" type="button">答え合わせ ✅</button>
        </div>
        <div id="k4Feedback" class="k4-feedback hidden" aria-live="polite"></div>
        <button id="k4Next" class="k4-start hidden" type="button">次の問題へ →</button>
      </section>

      <section id="k4Result" class="hidden">
        <h2 style="text-align:center">結果発表 🏁</h2>
        <div id="k4Score" class="k4-score"></div>
        <div id="k4Breakdown"></div>
        <div id="k4Misses"></div>
        <div class="k4-tools" style="margin-top:12px">
          <button id="k4ToRead" class="small-button" type="button">まちがえた問題を読む🐨で復習</button>
          <button id="k4Again" class="small-button" type="button">もう一回！ 🔥</button>
          <button id="k4ToSetup" class="small-button" type="button">設定を変える</button>
          <button id="k4ToMenu" class="small-button" type="button">メニューへ</button>
        </div>
      </section>
    </div>`);

  // ---------- Hook into the app ----------
  const oldShow = showScreen;
  const oldOpen = openDifficultyScreen;
  const oldLabel = modeDisplayLabel;
  showScreen = name => {
    oldShow(name);
    q("k4Screen").classList.toggle("hidden", name !== "kentei4");
    if (name !== "kentei4") stopTimer();
  };
  modeDisplayLabel = mode => (mode === "kentei4" ? "4級問題📝🐘" : oldLabel(mode));
  openDifficultyScreen = mode => {
    if (mode !== "kentei4") return oldOpen(mode);
    state.mode = "kentei4";
    openSetup();
    showScreen("kentei4");
  };

  document.addEventListener("DOMContentLoaded", () => {
    q("k4Back").addEventListener("click", () => {
      if (k4.running && !window.confirm("試験を中断してメニューに戻りますか？（この回は記録されません）")) return;
      stopTimer();
      k4.running = false;
      showScreen("menu");
    });
    q("k4Start").addEventListener("click", startTest);
    q("k4Next").addEventListener("click", next);
    q("k4OrderCheck").addEventListener("click", checkOrder);
    q("k4OrderUndo").addEventListener("click", () => {
      if (k4.answered) return;
      k4.picked.pop();
      renderOrder();
    });
    q("k4Again").addEventListener("click", startTest);
    q("k4ToRead").addEventListener("click", reviewInReading);
    q("k4ToSetup").addEventListener("click", openSetup);
    q("k4ToMenu").addEventListener("click", () => showScreen("menu"));
    document.addEventListener("keydown", event => {
      if (q("k4Screen").classList.contains("hidden") || q("k4Quiz").classList.contains("hidden")) return;
      const item = k4.items[k4.index];
      if (!item) return;
      if (event.key === "Enter" && k4.answered) { event.preventDefault(); next(); return; }
      if (item.kind === "choice" && !k4.answered && /^[1-4]$/.test(event.key)) answerChoice(Number(event.key) - 1);
    });
  });

  // Exposed for tests.
  window.__tvtKentei4 = { k4, loadData, reviewQuestions, buildTest, makeItem, wordPool, correctThai, attempts };
})();
