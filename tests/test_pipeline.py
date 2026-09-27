import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import news_common as common
import generate_news as gen
import build_news_content as build

class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.vocab = json.loads((ROOT/'data/allowed_vocab.json').read_text())
        self.dictionary = common.vocab_map(self.vocab)
        self.seed = json.loads((ROOT/'news_content.json').read_text())
        self.raw = json.loads((ROOT/'data/news_raw.json').read_text())
        self.article = self.raw['articles'][9]

    def test_dictionary_levels_and_preservation(self):
        q=json.loads((ROOT/'questions.json').read_text())['questions']
        for level, count in [(1,100),(2,100),(3,200)]:
            self.assertEqual(sum(r['difficulty']==level for r in q),count)
        self.assertEqual(len({r['id'] for r in q}),len(q))
        l3=json.loads((ROOT/'data/level3_words.json').read_text())
        self.assertEqual(len({r['thai'] for r in l3}),200)
        self.assertEqual(len({r['thai'] for r in l3}&{r['thai'] for r in q if r['difficulty'] in (1,2)}),0)

    def test_seed_evidence_tokens_and_choices(self):
        articles={a['source_url']:a for a in self.raw['articles']}
        for q in self.seed['short_news']:
            self.assertIn(q['source_review']['evidence'],articles[q['source_url']]['body'])
            self.assertEqual(''.join(q['thai_tokens']),q['thai'])
            self.assertEqual(q['reading'],' '.join(self.dictionary[t]['reading'] for t in q['thai_tokens']))
            self.assertTrue(all(self.dictionary[t]['level']<=q['level'] for t in q['thai_tokens']))
            self.assertEqual(len(set(q['choices'])),4)
            self.assertIn(q['japanese'],q['choices'])
        for p in self.seed['reading_passages']:
            self.assertIn(p['source_review']['evidence'],articles[p['source_url']]['body'])
            self.assertEqual(len(p['questions']),3)
            for q in p['questions']:
                self.assertEqual(len(set(q['choices'])),4)
                self.assertIn(q['answer'],q['choices'])

    def test_review_fails_closed(self):
        ok={'supported':True,'natural_thai':True,'answer_valid':True,'evidence_ids':[0],'reason':'supported'}
        with patch.object(common,'structured_response',return_value=ok):
            self.assertEqual(common.verify_source(None,'เขาเดินทางด้วยเครื่องบิน',self.article)['method'],'independent_model_review')
        for bad in [{**ok,'supported':False},{**ok,'natural_thai':False},{**ok,'answer_valid':False},{**ok,'evidence_ids':[999999]}]:
            with patch.object(common,'structured_response',return_value=bad),self.assertRaises(ValueError):
                common.verify_source(None,'candidate',self.article, {'choices': []})

    def test_evidence_is_copied_from_source_and_failures_are_explicit(self):
        article = {'source_title': 'title', 'body': 'Original  text\nwith spacing and “quotes”.'}
        result = dict(supported=True, natural_thai=True, answer_valid=True,
                      evidence_ids=[0], reason='supported and natural')
        with patch.object(common, 'structured_response', return_value=result):
            review = common.verify_source(None, 'candidate', article)
            self.assertEqual(review['evidence'], article['body'])
        for ids in [[], [-1], [1000], ['0'], [True]]:
            with patch.object(common, 'structured_response', return_value={**result, 'evidence_ids':ids}):
                with self.assertRaisesRegex(ValueError, 'invalid evidence_ids'):
                    common.verify_source(None, 'candidate', article)
        with patch.object(common, 'structured_response', return_value={**result, 'supported':False}):
            with self.assertRaisesRegex(ValueError, 'supported=False'):
                common.verify_source(None, 'candidate', article)

    def test_candidate_review_does_not_require_nonexistent_answers(self):
        review = dict(supported=True, natural_thai=True, answer_valid=False,
                      evidence_ids=[0], reason='no answers yet')
        with patch.object(common, 'structured_response', return_value=review):
            common.verify_source(None, 'candidate', self.article)
            with self.assertRaises(ValueError):
                common.verify_source(None, 'candidate', self.article, {'choices': []})
        for key in ['supported', 'natural_thai']:
            with patch.object(common, 'structured_response', return_value={**review, key: False}):
                with self.assertRaises(ValueError):
                    common.verify_source(None, 'candidate', self.article)

    def test_shorts_accept_unknown_words_after_source_review(self):
        articles = [{'source_url': str(i)} for i in range(3)]
        def item(source, word):
            return {'source_url': str(source), 'thai':word*4, 'thai_tokens': [word] * 4}
        drafts = [{'short_pool': [item(0, 'a'), item(1, 'unknown')]},
                  {'short_pool': [item(0, 'a'), item(1, 'b')]}]
        with patch.object(gen, 'news_snapshot_text', return_value='snapshot'), \
             patch.object(gen, 'structured_response', side_effect=drafts), \
             patch.object(gen, 'verify_source', return_value={'method': 'mock'}) as review, \
             patch.object(gen.time, 'sleep'):
            result = gen.generate_shorts(None, articles, ['a', 'b'], 'vocab', count=2, min_sources=2)
        self.assertEqual(len(result), 2)
        self.assertEqual(review.call_count, 2)
        self.assertIn('unknown', result[1]['thai_tokens'])
        self.assertEqual({q['source_url'] for q in result}, {'0', '1'})

    def test_short_spacing_survives_generation(self):
        article = self.article
        sentence = 'ถนน 31 เส้นทาง มีน้ำท่วม'
        good = {'source_url':article['source_url'], 'thai':sentence,
                'thai_tokens':['ถนน ', '31 ', 'เส้นทาง ', 'มีน้ำท่วม'], 'source_fact_th':'fact'}
        bad = {**good, 'thai_tokens':[word.strip() for word in good['thai_tokens']]}
        with patch.object(gen, 'structured_response', side_effect=[{'short_pool':[bad]}, {'short_pool':[good]}]), \
             patch.object(gen, 'verify_source', return_value={'method':'mock'}) as review, \
             patch.object(gen.time, 'sleep'):
            selected = gen.generate_shorts(None, [article], [], '', count=1, min_sources=1)
        self.assertEqual(review.call_count, 1)
        enriched = gen.enrich_short(selected[0], {article['source_url']:article}, 1)
        self.assertEqual(enriched['thai'], sentence)

    def test_ai_readings_cannot_override_dictionary(self):
        q=self.seed['short_news'][0]
        localized={'token_meanings':['文中の意味']*len(q['thai_tokens']),'title_ja':q['title'],'choices':q['choices'],'correct_index':0,'token_readings':['WRONG']*4,
                   'explanation':'説明です','grammar_note':'文法です','reading_tip':'分けて読みます','choice_explanations':['説明です']*4}
        result=build.build_short(q,localized,self.dictionary)
        self.assertEqual(result['reading'],q['reading'])
        missing=copy.deepcopy(self.dictionary);missing[q['thai_tokens'][0]]['reading']=''
        result = build.build_short(q,localized,missing)
        self.assertEqual(result['breakdown'][0]['reading'], '')
        self.assertEqual(result['breakdown'][0]['japanese'], '文中の意味')
        self.assertIn('読み未登録', result['reading'])
        self.assertNotIn('token_readings',build.short_schema(4)['properties'])
        self.assertNotIn('reading',build.passage_schema(1)['properties']['note_localizations']['items']['properties'])

    def test_unknown_note_has_no_invented_pronunciation(self):
        p={**self.seed['reading_passages'][0],'note_words':['未登録語']}
        localized={'title_ja':'タイトル','note_localizations':[{'japanese':'注釈の意味'}],
                   'questions':[{'prompt':'質問です','choices':['正解','違う','別','他'],'answer_index':0,'explanation':'説明です'}]}
        self.assertEqual(build.build_passage(p,localized,self.dictionary)['annotations'][0]['reading'],'')

    def test_passage_has_no_new_vocabulary_ceiling(self):
        passage = {'lines': [{'tokens': [{'thai': f'word{i}', 'kind': 'note'} for i in range(10)]}]*3}
        self.assertTrue(gen.validate_passage(passage, [])[0])

    def test_all_passage_words_get_contextual_meanings(self):
        article = self.article
        item = {'source_url': article['source_url'], 'source_fact_th': 'fact',
                'source_review': {}, 'lines': [{'tokens': [
                    {'thai':'เขา', 'kind':'known'}, {'thai':'ใหม่', 'kind':'note'}]}]*3}
        candidate = gen.enrich_passage(item, {article['source_url']:article}, 1)
        self.assertEqual(candidate['note_words'], ['เขา', 'ใหม่'])
        localized = {'title_ja':'記事', 'note_localizations':[{'japanese':'彼'},{'japanese':'新しい'}], 'questions':[]}
        result = build.build_passage(candidate, localized, {'เขา':{'japanese':'山', 'reading':'カオ'}})
        self.assertEqual(result['annotations'][0]['japanese'], '彼')
        self.assertEqual(result['annotations'][1]['reading'], '')

    def test_offline_vocab_is_complete(self):
        with patch.object(common.requests,'get',side_effect=ConnectionError('offline')):
            rows=common.load_vocab()
        self.assertEqual(len(rows),400)

    def test_duplicate_choices_rejected(self):
        result={'title_ja':'記事です','choices':['同じです']*4,'correct_index':0,'explanation':'説明です','grammar_note':'文法です','reading_tip':'読みます','choice_explanations':['説明です']*4}
        self.assertFalse(build.validate_short_localization(result,4)[0])

    def test_generation_stage_smoke(self):
        # Exercises production main/enrichment and the all-Level-3 news curriculum offline.
        calls = []
        def fake_shorts(client,articles,allowed,text,count=5,min_sources=3):
            calls.append((set(allowed), count, min_sources))
            return [{'source_url':a['source_url'],'thai_tokens':['เขา','เดินทาง','ด้วย','เครื่องบิน'],
                     'source_fact_th':'fact','source_review':{'method':'mock'}} for a in articles[:count]]
        def fake_passages(client,articles,allowed,text,short_sources):
            return [{'source_url':a['source_url'],'source_fact_th':'fact','source_review':{'method':'mock'},
                     'lines':[{'tokens':[{'thai':t,'kind':'known'} for t in ['เขา','จะ','ไป','ประชุม']]}]*3} for a in articles[:2]]
        with tempfile.TemporaryDirectory() as tmp:
            target=Path(tmp)/'candidates.json'
            with patch.dict('os.environ',{'OPENAI_API_KEY':'test'}),patch.object(gen,'load_vocab',return_value=self.vocab),patch('openai.OpenAI'),patch.object(gen,'generate_shorts',side_effect=fake_shorts),patch.object(gen,'generate_passages',side_effect=fake_passages),patch.object(gen,'CANDIDATES_FILE',target):
                self.assertEqual(gen.main(),0)
            data=json.loads(target.read_text())
            self.assertEqual([q['level'] for q in data['short_candidates']],[3,3,3,3,3])
            self.assertEqual(calls, [(set(row['thai'] for row in self.vocab), 5, 3)])
            self.assertEqual(len(data['reading_passages']),2)
            self.assertTrue(all(q['level']==3 for q in data['reading_passages']))

    def test_complete_build_and_late_rejection(self):
        candidates={'raw_fetched_at':self.raw['fetched_at'],'target_level':3,
                    'short_candidates':[dict(q, source_fact_th='fact') for q in self.seed['short_news']],
                    'reading_passages':[dict(p, source_fact_th='fact',note_words=[]) for p in self.seed['reading_passages']]}
        def short(client,q,article,vocab):
            return {'token_meanings':['文中の意味']*len(q['thai_tokens']),'title_ja':q['title'],'choices':q['choices'],'correct_index':0,
                    'explanation':q['explanation'],'grammar_note':q['grammar_note'],'reading_tip':q['reading_tip'],
                    'choice_explanations':['説明です']*4}
        def passage(client,p,article):
            return {'title_ja':p['title'],'note_localizations':[],
                    'questions':[dict(q,answer_index=0) for q in p['questions']]}
        with tempfile.TemporaryDirectory() as tmp:
            target=Path(tmp)/'published.json'
            with patch.dict('os.environ',{'OPENAI_API_KEY':'test'}),patch('openai.OpenAI'),patch.object(build,'load_json',side_effect=lambda path: candidates if path==build.CANDIDATES_FILE else self.raw),patch.object(build,'load_vocab',return_value=self.vocab),patch.object(build,'localize_short',side_effect=short),patch.object(build,'localize_passage',side_effect=passage),patch.object(build,'verify_source',return_value={'method':'mock'}),patch.object(build,'CONTENT_FILE',target):
                self.assertEqual(build.main(),0)
                final=json.loads(target.read_text())
                self.assertEqual(len(final['short_news']),5)
                self.assertEqual(len(final['reading_passages']),2)
                before=target.read_bytes()
                with patch.object(build,'verify_source',side_effect=[{'method':'mock'}]*6+[ValueError('last passage rejected')]):
                    self.assertEqual(build.main(),1)
                self.assertEqual(target.read_bytes(),before)

    def test_failed_build_preserves_last_published_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            target=Path(tmp)/'news_content.json';target.write_text('existing published content')
            with patch.dict('os.environ',{'OPENAI_API_KEY':'test'}),patch.object(build,'CONTENT_FILE',target),patch.object(build,'load_json',return_value={'raw_fetched_at':'mismatch','fetched_at':'different'}):
                self.assertEqual(build.main(),1)
            self.assertEqual(target.read_text(),'existing published content')

if __name__=='__main__':unittest.main()

