// Run the actual application functions with file/REST boundaries stubbed; no browser required.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).sort((a,b)=>b.length-a.length)[0];
const dict = JSON.parse(fs.readFileSync(path.join(root,'questions.json')));
const news = JSON.parse(fs.readFileSync(path.join(root,'news_content.json')));
const context = vm.createContext({console, URLSearchParams, AbortSignal, setTimeout,
  document:{addEventListener(){}}, window:{}, localStorage:{getItem(){return null},setItem(){throw Error('unexpected history write')}},
  fetch: async url => ({ok:true,json:async()=>String(url).startsWith('questions')?structuredClone(dict):structuredClone(news)})});
vm.runInContext(script, context);
const run = code => vm.runInContext(code, context);
(async()=>{
  run('state.history = [{recordId:"keep"}];');
  await run('loadWordQuestions()');
  assert.deepEqual(JSON.parse(run('JSON.stringify([1,2,3].map(l=>state.allQuestions.filter(q=>q.difficulty===l).length))')), [100,100,200]);
  assert.equal(run('state.history[0].recordId'), 'keep');
  await run('loadNewsContent()');
  assert.equal(run('state.allNewsQuestions.length'),5);
  assert.equal(run('state.readingPassages.length'),2);
  for(let i=0;i<100;i++){
    assert.equal(run('selectNewsWithReview(state.allNewsQuestions,5,3).filter(q=>q.difficulty===3).length'),3);
    assert.equal(run('selectNewsWithReview(state.allNewsQuestions,5,3).filter(q=>q.reviewQuestion).length'),2);
  }
  assert.equal(run('new Set(selectNewsWithReview(state.allNewsQuestions,10,3).map(q=>q.id)).size'),5);
  assert.equal(run('selectNewsWithReview(state.allNewsQuestions.filter(q=>q.difficulty===2),5,2).length'),2);
  assert.equal(run('buildLongReadingQuestions(state.readingPassages[0]).length'),3);
  assert.equal(run('hydrateNewsReadings({...state.allNewsQuestions[0],thai:"tampered"})'),null);
  // A current Supabase pronunciation beats both packaged data and AI material.
  run('getSupabaseRestConfig = () => ({configured:true}); restGet = async () => [{id:1,thai:"กลับ",japanese:"戻る,帰る",reading:"辞書の更新読み",level:2}];');
  await run('loadWordQuestions()');
  assert.equal(run('state.allQuestions.find(q=>q.thai==="กลับ").reading'),'辞書の更新読み');
  assert.equal(run('state.allQuestions.filter(q=>q.difficulty===3).length'),200);
  // A live assignment beats a bundled L3 assignment; a new word ID cannot inherit a different word's level.
  const l3=dict.questions.find(q=>q.difficulty===3);
  context.live={id:l3.id,thai:l3.thai,japanese:l3.japanese,reading:l3.reading,level:4};
  run('restGet=async()=>[live]');await run('loadWordQuestions()');
  assert.equal(run('state.allQuestions.find(q=>q.id===live.id).difficulty'),4);
  context.live={...context.live,thai:'replacement',level:null};await run('loadWordQuestions()');
  assert.equal(run('state.allQuestions.some(q=>q.thai==="replacement")'),false);
  run('restGet=async()=>{throw Error("offline")};');await run('loadWordQuestions()');
  assert.equal(run('state.allQuestions.length'),400);
  // Unverified news is never served.
  context.fetch=async()=>({ok:true,json:async()=>({...news,short_news:news.short_news.map(q=>({...q,source_verified:false}))})});
  await run('loadNewsContent()');assert.equal(run('state.allNewsQuestions.length'),0);
  assert.match(html,/data-mode="longreading" title=/);
  assert.doesNotMatch(html,/data-difficulty="(?:9|10)"/);
  console.log('PASS: 100/100/200 words, 3+2 review selection, 6 passage questions, dictionary precedence, offline fallback, history preservation, fail-closed news.');
})().catch(e=>{console.error(e);process.exit(1)});
