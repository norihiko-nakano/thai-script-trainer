-- Thai Vocabulary Trainer Ver3.0
-- GitHub Pages から sentences を読み取るための最小権限設定
-- 文章データは公開教材として SELECT のみ許可します。

alter table public.sentences enable row level security;

grant select on table public.sentences to anon, authenticated;

drop policy if exists "public_read_sentences" on public.sentences;

create policy "public_read_sentences"
on public.sentences
for select
to anon, authenticated
using (true);

-- sentence_words や words は Ver3.0 の表示には公開不要です。
