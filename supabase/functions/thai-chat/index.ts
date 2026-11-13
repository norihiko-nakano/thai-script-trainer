// Thai Vocabulary Trainer Ver10.5 — 会話 (conversation) Edge Function
//
// Browser (GitHub Pages) -> this function -> OpenAI. The OpenAI key never reaches the browser.
//
// Supabase secrets (Edge Functions > Secrets):
//   OPENAI_API_KEY      required. OpenAI API key used only by this function.
//   TVT_CHAT_PASSCODE   required. Any phrase you choose; the app asks for it once per browser.
//   OPENAI_CHAT_MODEL   optional. Defaults to gpt-5.4-mini.
//   OPENAI_TTS_VOICE    optional. Default voice for Mali's speech (the app can pick one of TTS_VOICES). Defaults to nova.
//
// Deploy with "Verify JWT" turned OFF: the app sends the passcode instead of a login token.

const MODEL = Deno.env.get("OPENAI_CHAT_MODEL") ?? "gpt-5.4-mini";
const TTS_MODEL = "gpt-4o-mini-tts";
const TTS_VOICE = Deno.env.get("OPENAI_TTS_VOICE") ?? "nova";
// Voices the app may choose from (female-sounding OpenAI voices).
const TTS_VOICES = ["nova", "shimmer", "coral", "sage", "alloy"];
const MAX_TTS_CHARS = 300;
const TTS_PACE: Record<number, string> = {
  1: "Speak slowly, with a short pause between words, so a beginner can catch every sound.",
  2: "Speak a little slower than normal and very clearly.",
  3: "Speak at a relaxed, natural pace.",
};
const TTS_STYLE = `Voice: an original, sweet, high-pitched voice of a cheerful young woman of about 20, like a bright anime heroine. Light, youthful and bubbly, smiling while speaking. Never deep, mature or husky.
Language: Thai. Pronounce every Thai tone and vowel length accurately, like a native speaker from Bangkok.
Tone: warm, friendly and encouraging, like talking to a friend who is learning Thai.`;
const ALLOWED_ORIGINS = [
  "https://norihiko-nakano.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
];

// Abuse and cost limits.
const MAX_TURNS = 24;            // most recent messages sent to the model
const MAX_MESSAGE_CHARS = 400;   // per message
const MAX_VOCAB_WORDS = 600;     // dictionary words up to the selected level (Level 3 has about 400)
const MAX_OUTPUT_TOKENS = 900;

const LEVEL_STYLE: Record<number, string> = {
  1: `The learner is a complete beginner. Each reply must be only 1 or 2 words (one tiny phrase), plus the polite particle ค่ะ / คะ if needed.
Examples of good replies: "สวัสดีค่ะ", "ชื่ออะไรคะ", "สบายดีไหมคะ", "ชอบไหมคะ", "อร่อยค่ะ".
Never write a full sentence or two phrases in one reply. Use only very basic words.`,
  2: "The learner is elementary. Each reply is one short sentence of about 3 to 6 words. Use common everyday words and ask one easy question.",
  3: "The learner is lower-intermediate. Each reply is 1 or 2 natural everyday sentences of up to about 12 words each, mostly with common vocabulary. An occasional new word that fits the context is fine.",
};

const PERSONA = `You are Mali (มะลิ), a friendly 25-year-old Thai woman from Bangkok who works at a café near a university.
You are a conversation partner for a Japanese adult learning Thai. Your relationship is a friendly language-exchange partner: warm, cheerful and polite, never romantic or flirtatious.
Speak natural, polite Thai as a woman (use ค่ะ / คะ correctly). Follow the length rule for the learner's level strictly; when you ask something, ask only one thing.
Talk about everyday topics: food, weather, hobbies, travel, work, Thailand and Japan.
If the learner writes in Japanese or English, reply in simple Thai and gently encourage them to try Thai.
Never ask for or discuss personal identifying details, and stay on safe, everyday topics.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["thai", "japanese", "mood", "words", "choices"],
  properties: {
    thai: { type: "string", description: "Mali's reply in Thai script only." },
    japanese: { type: "string", description: "Natural Japanese translation of the Thai reply." },
    mood: {
      type: "string",
      enum: ["normal", "happy", "surprised"],
      description: "Mali's feeling in this reply: happy when laughing, delighted or praising; surprised when something is unexpected or impressive; otherwise normal.",
    },
    choices: {
      type: "array",
      description: "Exactly 3 different replies the learner could send back to Mali, written from the learner's point of view (a Japanese man, so polite particle ครับ). Each must be a natural, correct answer that fits Mali's reply, follows the same length rule for the learner's level, and differs in meaning (for example yes / no / something else).",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["thai", "japanese"],
        properties: {
          thai: { type: "string", description: "The learner's reply in Thai script only." },
          japanese: { type: "string", description: "Natural Japanese translation of that reply." },
        },
      },
    },
    words: {
      type: "array",
      description: "Key words from the Thai reply in the order they appear (at most 6; for a 1-2 word reply, list each word). List each word on its own, without a polite particle such as ค่ะ / คะ / ครับ attached.",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["thai", "japanese"],
        properties: {
          thai: { type: "string", description: "The word exactly as written in the reply." },
          japanese: { type: "string", description: "Short Japanese meaning in this context." },
        },
      },
    },
  },
};

type ChatMessage = { role: "user" | "assistant"; content: string };

function corsHeaders(origin: string | null): HeadersInit {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-tvt-passcode",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8" },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function cleanMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_MESSAGE_CHARS) }))
    .filter((m) => m.content.length > 0)
    .slice(-MAX_TURNS);
}

function cleanVocab(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((w) => typeof w === "string")
    .map((w) => w.trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, MAX_VOCAB_WORDS);
}

function outputText(data: any): string {
  if (typeof data?.output_text === "string") return data.output_text;
  for (const item of data?.output ?? []) {
    for (const part of item?.content ?? []) {
      if (part?.type === "output_text" && typeof part.text === "string") return part.text;
    }
  }
  return "";
}

// Everyday words a conversation cannot do without, allowed at every level on top of
// the learner's dictionary words (questions.json). Edit this list to taste.
const BASIC_WORDS = [
  // greetings and politeness
  "สวัสดี", "ขอบคุณ", "ขอโทษ", "ไม่เป็นไร", "ยินดี", "รู้จัก", "ลาก่อน", "โชคดี",
  // polite particles and sentence endings
  "ค่ะ", "คะ", "ครับ", "นะ", "จ้ะ", "จ้า", "ไหม", "มั้ย", "หรือ", "เหรอ", "หรอ",
  // yes / no
  "ใช่", "ไม่", "ไม่ใช่", "โอเค", "ได้",
  // people
  "ฉัน", "ผม", "คุณ", "เขา", "เรา", "คน",
  // question words
  "อะไร", "ใคร", "ที่ไหน", "ไหน", "เมื่อไร", "ทำไม", "อย่างไร", "ยังไง", "กี่", "เท่าไร",
  // very common verbs and words
  "เป็น", "คือ", "มี", "อยู่", "ไป", "มา", "ทำ", "ชอบ", "อยาก", "จะ", "แล้ว", "ยัง", "ก็", "ด้วย",
  "และ", "แต่", "กับ", "ที่", "ของ", "กัน", "เจอ", "สบาย", "สบายดี", "ดี", "มาก", "นิดหน่อย", "จริง",
  "นี่", "นี้", "นั่น", "นั้น", "วัน", "ชื่อ",
  // places
  "ไทย", "ญี่ปุ่น", "กรุงเทพ", "ประเทศ",
];

const THAI_RUN = /[\u0E00-\u0E7F]+/g;

// Finds the parts of a Thai text that cannot be built from the allowed words.
// Thai has no spaces, so this is a dynamic-programming segmentation that
// minimises the number of uncovered characters.
function outsideWords(text: string, allowed: Set<string>, maxLen: number): string[] {
  const found: string[] = [];
  for (const run of text.match(THAI_RUN) ?? []) {
    const n = run.length;
    const cost = new Array<number>(n + 1).fill(Infinity);
    const prev = new Array<number>(n + 1).fill(-1);
    const matched = new Array<boolean>(n + 1).fill(false);
    cost[0] = 0;
    for (let i = 0; i < n; i++) {
      if (cost[i] === Infinity) continue;
      if (cost[i] + 1 < cost[i + 1]) { cost[i + 1] = cost[i] + 1; prev[i + 1] = i; matched[i + 1] = false; }
      for (let len = 1; len <= maxLen && i + len <= n; len++) {
        if (allowed.has(run.slice(i, i + len)) && cost[i] < cost[i + len]) {
          cost[i + len] = cost[i]; prev[i + len] = i; matched[i + len] = true;
        }
      }
    }
    if (cost[n] === 0) continue;
    // Walk back and join neighbouring uncovered characters into spans.
    const spans: string[] = [];
    let span = "";
    for (let j = n; j > 0; j = prev[j]) {
      if (matched[j]) {
        if (span) { spans.push(span); span = ""; }
      } else {
        span = run.slice(prev[j], j) + span;
      }
    }
    if (span) spans.push(span);
    found.push(...spans.reverse());
  }
  return [...new Set(found)];
}

function replyOutsideWords(reply: any, allowed: Set<string>, maxLen: number): string[] {
  const texts = [reply?.thai, ...(Array.isArray(reply?.choices) ? reply.choices.map((c: any) => c?.thai) : [])];
  return [...new Set(texts.filter((t) => typeof t === "string").flatMap((t) => outsideWords(t, allowed, maxLen)))];
}

// Short plain-text lines from the scenario file (data/mali_scenarios.json),
// trimmed and capped so a request cannot grow the prompt without limit.
function cleanLines(raw: unknown, maxItems: number, maxChars = 200): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x) => typeof x === "string")
    .map((x) => x.replace(/\s+/g, " ").trim().slice(0, maxChars))
    .filter(Boolean)
    .slice(0, maxItems);
}

function cleanText(raw: unknown, maxChars = 300): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, maxChars) : "";
}

// The learner is a man: his ready-made answers must use the male polite particle.
// Only a particle at the end of a phrase is changed, so words such as คะแนน stay intact.
function toMaleSpeech(text: string): string {
  return text
    .replace(/(ค่ะ|คะ|ค๊ะ)(?=$|[\s!?.,…~]|ๆ)/g, "ครับ")
    .replace(/^(ดิฉัน|ฉัน)/, "ผม");
}

function normaliseThai(text: unknown): string {
  return typeof text === "string" ? text.replace(/[\s!?.,…~]/g, "") : "";
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  const passcode = Deno.env.get("TVT_CHAT_PASSCODE");
  if (!apiKey || !passcode) return json({ error: "server_not_configured" }, 500, origin);
  if (!timingSafeEqual(req.headers.get("x-tvt-passcode") ?? "", passcode)) {
    return json({ error: "bad_passcode" }, 401, origin);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400, origin);
  }

  const level = [1, 2, 3].includes(Number(body?.level)) ? Number(body.level) : 1;

  // Text-to-speech: returns MP3 audio of Mali reading the given Thai text.
  if (body?.action === "speak") {
    const text = typeof body?.text === "string" ? body.text.trim().slice(0, MAX_TTS_CHARS) : "";
    if (!text) return json({ error: "bad_request" }, 400, origin);
    let speech: Response;
    try {
      speech = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: TTS_MODEL,
          voice: TTS_VOICES.includes(body?.voice) ? body.voice : TTS_VOICE,
          input: text,
          instructions: `${TTS_STYLE}\nPace: ${TTS_PACE[level]}`,
          response_format: "mp3",
        }),
      });
    } catch {
      return json({ error: "openai_unreachable" }, 502, origin);
    }
    if (!speech.ok) {
      console.error("OpenAI TTS error", speech.status, await speech.text().catch(() => ""));
      return json({ error: "openai_error", status: speech.status }, 502, origin);
    }
    return new Response(speech.body, {
      status: 200,
      headers: { ...corsHeaders(origin), "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  }

  const messages = cleanMessages(body?.messages);
  const vocab = cleanVocab(body?.vocab);
  if (messages.length === 0) messages.push({ role: "user", content: "(The learner just opened the chat. Greet them and start a conversation.)" });

  // Allowed words: the learner's dictionary words up to this level, the basic words,
  // and anything the learner typed themselves (for example their own name).
  const learnerText = messages.filter((m) => m.role === "user").map((m) => m.content).join(" ");
  const allowed = new Set<string>([...vocab, ...BASIC_WORDS]);
  let maxLen = Math.max(1, ...[...allowed].map((w) => w.length));
  for (const word of outsideWords(learnerText, allowed, maxLen)) allowed.add(word);
  maxLen = Math.max(maxLen, ...[...allowed].map((w) => w.length));

  // Mali's behaviour from the scenario file, sent by the app.
  const profile = cleanLines(body?.profile, 8);
  const moodRules = cleanLines(body?.mood_rules, 5);
  const scenario = body?.scenario && typeof body.scenario === "object" ? body.scenario : null;
  const steps = cleanLines(scenario?.steps, 10);
  const step = Math.max(0, Math.floor(Number(body?.step) || 0));
  const scenarioText = scenario
    ? [
      `Scenario: ${cleanText(scenario.title, 60)}. ${cleanText(scenario.situation)}`,
      cleanText(scenario.role) ? `Your role: ${cleanText(scenario.role)}` : "",
      cleanText(scenario.goal) ? `Learning goal: ${cleanText(scenario.goal)}` : "",
      steps.length
        ? `Follow these steps in order, ONE step per reply:\n${steps.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n` +
          (step < steps.length
            ? `Now do step ${step + 1}: ${steps[step]} (first react briefly to what the learner said, if anything).`
            : "All steps are done: thank the learner, praise their Thai, and close the conversation kindly. If they keep talking, chat freely.")
        : "",
    ].filter(Boolean).join("\n")
    : "";

  const baseInstructions = [
    PERSONA,
    profile.length ? `About Mali (stay consistent with these facts):\n- ${profile.join("\n- ")}` : "",
    LEVEL_STYLE[level],
    scenarioText,
    moodRules.length ? `How to choose mood:\n- ${moodRules.join("\n- ")}` : "",
    `Word rule (very important): in your reply AND in the 3 choices, use ONLY these words, combined freely. Do not use any other Thai word, even a common one. If you cannot say something with these words, say something simpler.
Allowed words: ${[...vocab, ...BASIC_WORDS].join(", ")}`,
    "Names: you may use a name the learner has written. Otherwise do not invent Thai names.",
    `Keep the conversation moving (very important): never repeat a line you already said, and never answer a greeting with the same greeting again. After greeting, move to a new simple topic each turn (follow the scenario steps if there are any; otherwise for example: name -> how are you -> where are you from -> what do you like -> food -> coffee -> today). React to what the learner said, then ask one new thing.`,
    `The learner is a Japanese MAN. Every choice is something HE says, so a choice ends with ครับ (never ค่ะ or คะ) and uses ผม for "I" (never ฉัน or ดิฉัน). The 3 choices must not copy your own line word for word.`,
    "Return JSON that matches the schema. The japanese field translates your Thai reply. The choices are 3 ready-made answers the learner can tap.",
  ].filter(Boolean).join("\n\n");

  async function ask(extra: string): Promise<{ reply?: any; error?: Response }> {
    let openai: Response;
    try {
      openai = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          instructions: extra ? `${baseInstructions}\n\n${extra}` : baseInstructions,
          input: messages,
          max_output_tokens: MAX_OUTPUT_TOKENS,
          text: { format: { type: "json_schema", name: "mali_reply", strict: true, schema: SCHEMA } },
        }),
      });
    } catch {
      return { error: json({ error: "openai_unreachable" }, 502, origin) };
    }
    const data = await openai.json().catch(() => null);
    if (!openai.ok) {
      console.error("OpenAI error", openai.status, JSON.stringify(data?.error ?? data));
      return { error: json({ error: "openai_error", status: openai.status }, 502, origin) };
    }
    try {
      return { reply: JSON.parse(outputText(data)) };
    } catch {
      console.error("Unparseable OpenAI output", JSON.stringify(data));
      return { error: json({ error: "bad_model_output" }, 502, origin) };
    }
  }

  // Lines Mali has already said, to stop her repeating herself.
  const saidBefore = new Set(messages.filter((m) => m.role === "assistant").map((m) => normaliseThai(m.content)));
  const problemsOf = (r: any) => {
    const outside = replyOutsideWords(r, allowed, maxLen);
    const repeated = saidBefore.has(normaliseThai(r?.thai));
    return { outside, repeated, score: outside.length + (repeated ? 5 : 0) };
  };

  let result = await ask("");
  if (result.error) return result.error;
  let reply = result.reply;
  let problems = problemsOf(reply);

  // One retry when words outside the list slipped in or Mali repeated a line;
  // keep whichever draft has fewer problems.
  if (problems.score > 0) {
    const notes: string[] = [];
    if (problems.outside.length) {
      notes.push(`Your previous draft used words that are NOT allowed: ${problems.outside.join(", ")}. Use only the allowed words.`);
    }
    if (problems.repeated) {
      notes.push(`Your previous draft "${reply.thai}" repeats something you already said. Say something new that moves the conversation forward.`);
    }
    const retry = await ask(`${notes.join("\n")}\nWrite a new reply and new choices.`);
    if (retry.reply) {
      const retryProblems = problemsOf(retry.reply);
      if (retryProblems.score <= problems.score) {
        reply = retry.reply;
        problems = retryProblems;
      }
    }
  }
  const outside = problems.outside;

  // Make sure every ready-made answer is in the learner's (male) voice.
  if (Array.isArray(reply.choices)) {
    reply.choices = reply.choices.map((c: any) => ({ ...c, thai: toMaleSpeech(String(c?.thai ?? "")) }));
  }

  // Tell the app where each key word comes from: dictionary, basic list, or new.
  const vocabSet = new Set(vocab);
  const basicSet = new Set(BASIC_WORDS);
  if (Array.isArray(reply.words)) {
    reply.words = reply.words.map((w: any) => {
      const thai = typeof w?.thai === "string" ? w.thai.trim() : "";
      // A word made only of allowed pieces (for example สวัสดี + ค่ะ) still counts as known.
      const known = thai && outsideWords(thai, allowed, maxLen).length === 0;
      const source = vocabSet.has(thai) ? "dictionary" : basicSet.has(thai) || known ? "basic" : "new";
      return { ...w, thai, source };
    });
  }
  reply.outside = outside;
  return json({ reply, model: MODEL }, 200, origin);
});
