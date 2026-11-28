// Checks the 4級問題 question bank: answers point at real options, options are unique,
// order questions use exactly their tokens, and blanks are present where needed.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'kentei4_questions.json'), 'utf8'));
const ids = new Set();
const unique = id => { assert.ok(!ids.has(id), `duplicate id ${id}`); ids.add(id); };
for (const qn of data.vocab) {
  unique(qn.id);
  assert.ok(qn.thai.includes('（　）'), `${qn.id} has no blank`);
  assert.equal(qn.options.length, 4); assert.equal(new Set(qn.options).size, 4);
  assert.ok(qn.answer >= 0 && qn.answer < 4); assert.ok(qn.japanese && qn.explain);
}
for (const qn of data.dialogue) {
  unique(qn.id);
  assert.equal([qn.a, qn.b].filter(t => t.includes('（　）')).length, 1, `${qn.id} needs one blank`);
  assert.equal(qn.options.length, 4); assert.equal(new Set(qn.options).size, 4);
  assert.ok(qn.answer >= 0 && qn.answer < 4);
}
for (const qn of data.order) {
  unique(qn.id);
  const sorted = a => [...a].sort().join('|');
  for (const a of qn.accepted) assert.equal(sorted(a), sorted(qn.tokens), `${qn.id} accepted order uses other tokens`);
}
console.log(`kentei4 OK: ${data.vocab.length} vocab, ${data.dialogue.length} dialogue, ${data.order.length} order`);
