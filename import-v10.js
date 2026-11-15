/* Thai Vocabulary Trainer Ver10.8: import the review notebook and answer history.
 *
 * TVT keeps the review notebook and history in this browser only, so moving to
 * another browser (for example Chrome -> Edge) starts empty. These buttons read
 * the files made by "復習帳をJSON保存🐍" and "履歴をCSV保存" and MERGE them into
 * this browser's data. Nothing already here is deleted or overwritten.
 */
(function () {
  "use strict";

  const q = id => document.getElementById(id);
  const HISTORY_LIMIT = 10000;

  // ---------- Buttons ----------
  function addButton(afterId, id, label, accept, onFile) {
    const anchor = q(afterId);
    if (!anchor) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.hidden = true;
    input.id = `${id}File`;
    const button = document.createElement("button");
    button.id = id;
    button.className = "small-button";
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => input.click());
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      input.value = ""; // allow choosing the same file again
      if (!file) return;
      try {
        await onFile(await file.text(), file.name);
      } catch (error) {
        console.warn("読み込みに失敗しました。", error);
        window.alert(`読み込めませんでした🐙\n${error.message || error}`);
      }
    });
    anchor.after(button, input);
  }

  addButton("exportHistoryButton", "importHistoryButton", "履歴を読み込む", ".csv,text/csv", importHistoryCsv);
  addButton("exportReviewBookButton", "importReviewBookButton", "復習帳を読み込む🐍", ".json,application/json", importReviewBookJson);

  const note = document.createElement("p");
  note.className = "history-note";
  note.id = "importNote";
  note.textContent = "別のブラウザに引っ越すときは、前のブラウザで「保存」したファイルを、ここで「読み込む」と合体できます（今のデータは消えません）。";
  q("importReviewBookButton")?.closest(".review-book-launch")?.querySelector(".history-note")?.after(note);

  // ---------- Review notebook (JSON) ----------
  function text(value) {
    return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
  }
  function laterIso(a, b) {
    if (!a) return b || "";
    if (!b) return a;
    return new Date(a) >= new Date(b) ? a : b;
  }
  function earlierIso(a, b) {
    if (!a) return b || "";
    if (!b) return a;
    return new Date(a) <= new Date(b) ? a : b;
  }

  async function importReviewBookJson(raw) {
    let data;
    try {
      data = JSON.parse(String(raw).replace(/^﻿/, ""));
    } catch (_) {
      throw new Error("JSONファイルとして読めません。「復習帳をJSON保存🐍」で保存したファイルを選んでください。");
    }
    if (!Array.isArray(data)) throw new Error("復習帳のファイルではないようです。");

    let added = 0;
    let merged = 0;
    let skipped = 0;
    for (const item of data) {
      const thai = text(item?.thai);
      if (!thai) { skipped++; continue; }
      const incoming = {
        key: text(item.key) || reviewBookKey({ id: text(item.questionId) || undefined, thai, japanese: text(item.japanese) }),
        questionId: item.questionId ?? "",
        thai,
        japanese: text(item.japanese),
        reading: text(item.reading),
        difficulty: item.difficulty ?? "",
        note: text(item.note),
        wrongCount: Math.max(1, Number(item.wrongCount) || 1),
        firstAddedAt: text(item.firstAddedAt),
        lastWrongAt: text(item.lastWrongAt),
        updatedAt: text(item.updatedAt)
      };
      const existing = state.reviewBook.find(x => x.key === incoming.key);
      if (!existing) {
        state.reviewBook.push(incoming);
        added++;
        continue;
      }
      // Same word: keep what is here and fill in what the file adds.
      existing.japanese = existing.japanese || incoming.japanese;
      existing.reading = existing.reading || incoming.reading;
      // Keep both memos, but never add the same memo twice (e.g. importing the same file again).
      const lines = String(existing.note || "").split("\n").map(x => x.trim());
      if (incoming.note && !String(existing.note || "").includes(incoming.note) && !lines.includes(incoming.note)) {
        existing.note = existing.note ? `${existing.note}\n${incoming.note}` : incoming.note;
      }
      existing.wrongCount = Math.max(Number(existing.wrongCount) || 0, incoming.wrongCount);
      existing.firstAddedAt = earlierIso(existing.firstAddedAt, incoming.firstAddedAt);
      existing.lastWrongAt = laterIso(existing.lastWrongAt, incoming.lastWrongAt);
      existing.updatedAt = laterIso(existing.updatedAt, incoming.updatedAt);
      merged++;
    }

    saveReviewBook();
    updateReviewBookSummary();
    if (typeof renderReviewBook === "function" && !q("reviewBookScreen")?.classList.contains("hidden")) renderReviewBook();
    window.alert(
      `復習帳を読み込みました🍣\n新しく追加：${added}語\n同じ単語なので合体：${merged}語` +
      (skipped ? `\n読めなかった行：${skipped}` : "") +
      `\n今の復習帳：${state.reviewBook.length}語`
    );
  }

  // ---------- History (CSV) ----------
  // RFC 4180-style parser: quoted fields, "" escapes, CRLF or LF.
  function parseCsv(raw) {
    const s = String(raw).replace(/^﻿/, "");
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (quoted) {
        if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') quoted = false;
        else field += c;
      } else if (c === '"') {
        quoted = true;
      } else if (c === ",") {
        row.push(field); field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && s[i + 1] === "\n") i++;
        row.push(field); field = "";
        if (row.some(x => x !== "")) rows.push(row);
        row = [];
      } else {
        field += c;
      }
    }
    row.push(field);
    if (row.some(x => x !== "")) rows.push(row);
    return rows;
  }

  function historyKey(h) {
    return [h.answeredAt, h.mode, h.questionType || "word", h.thai, h.userAnswer].join("\u0000");
  }

  async function importHistoryCsv(raw) {
    const rows = parseCsv(raw);
    if (rows.length < 2) throw new Error("履歴が入っていないようです。");
    const header = rows[0].map(h => h.trim());
    const col = name => header.indexOf(name);
    if (col("answered_at") < 0 || col("thai") < 0) {
      throw new Error("「履歴をCSV保存」で保存したファイルを選んでください。");
    }
    const get = (r, name) => (col(name) >= 0 ? r[col(name)] ?? "" : "");

    const existingKeys = new Set(state.history.map(historyKey));
    let added = 0;
    let duplicate = 0;
    let skipped = 0;
    for (const r of rows.slice(1)) {
      const answeredAt = get(r, "answered_at").trim();
      if (!answeredAt || Number.isNaN(new Date(answeredAt).getTime())) { skipped++; continue; }
      const difficulty = get(r, "difficulty");
      const time = get(r, "response_time_ms");
      const entry = {
        recordId: `${new Date(answeredAt).getTime()}-imp${Math.random().toString(36).slice(2, 8)}`,
        answeredAt,
        mode: get(r, "mode"),
        questionType: get(r, "question_type") || "word",
        difficulty: difficulty === "" ? "" : Number.isNaN(Number(difficulty)) ? difficulty : Number(difficulty),
        questionId: get(r, "question_id"),
        japanese: get(r, "japanese"),
        thai: get(r, "thai"),
        userAnswer: get(r, "user_answer"),
        readingAttempt: get(r, "reading_attempt"),
        correctReading: get(r, "correct_reading"),
        isCorrect: get(r, "is_correct") === "1" || get(r, "is_correct").toLowerCase() === "true",
        responseTimeMs: time === "" ? null : Number(time),
        sourceUrl: "",
        sourceTitle: ""
      };
      const key = historyKey(entry);
      if (existingKeys.has(key)) { duplicate++; continue; }
      existingKeys.add(key);
      state.history.push(entry);
      added++;
    }

    state.history.sort((a, b) => new Date(a.answeredAt) - new Date(b.answeredAt));
    if (state.history.length > HISTORY_LIMIT) state.history = state.history.slice(-HISTORY_LIMIT);
    saveHistory();
    updateHistorySummary();
    window.alert(
      `履歴を読み込みました📈\n新しく追加：${added}件\nすでにあった記録：${duplicate}件` +
      (skipped ? `\n読めなかった行：${skipped}` : "") +
      `\n今の履歴：${state.history.length}件`
    );
  }

  window.__tvtImport = { parseCsv, importHistoryCsv, importReviewBookJson };
})();
