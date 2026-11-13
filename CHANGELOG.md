# Thai Vocabulary Trainer 変更履歴 — Ver0.0〜Ver10.1

最終整理日：2026-11-13（日本時間）

## この記録について

過去の会話、当時のREADME、mainから辿れるGitHubの全147コミット（2026-04-30〜2026-11-07、日本時間）を照合して復元した履歴です。確認した50項目を収録しています。バージョン別の説明に加え、[全コミット索引](docs/COMMIT_HISTORY_THROUGH_V9.md)にデータ更新・小さな修正・空の変更も残しています。

- 日付は原則、変更コミットのauthor日時をAsia/Tokyoへ換算した日です。GitHub Pagesの公開完了日時ではありません。
- 「コミット記録」は名称・説明から確認できた範囲、「差分」は変更コードを確認した範囲を示します。会話中の提案だけを実装済みとは扱いません。
- Ver0.0/1.0は検索しやすい見出しとして含めていますが、当時の呼称に揺れがあり、正式なリリース番号・境界を確定できません。
- すべての過去チャットや消失したコードを網羅できた保証はありません。確認できた記録を全件保存し、不一致と未確認事項を明示する復元版です。
- 学習LevelとアプリのVerは別です。10レベルの画面があることは、10レベル分の教材が完成していることを意味しません。

## 現在の状態

Ver10.0で、マリとタイ語でチャットする「会話💬🌺」モードを追加。Ver9.0の日本語/Englishインターフェースを提供。ニュース短文5問の更新を継続し、長文読解は「冬眠中🐻🧊🗿」として生成・日本語化・検証・起動を停止しています。再開用の関数は残しています。学習履歴や個人メモはブラウザのlocalStorageに保存されます。

## バージョン別の変更

### Ver0.0 / 0.x（初期試作）

- **確認日・変更日：** 2026-04-30に初期コードを確認
- **変更内容：** 日本語の音・ローマ字・絵文字を手掛かりにタイ文字を入力する Thai Script Trainer。CSV → Python → JSON → HTML/JavaScript、入力検証、採点・結果表示。
- **確認状況：** 初期コードは確認できるが、正式な「0.0」公開日・タグは未確認。後年のREADMEでは0.xと整理。
- **対応コミット：** [d226d485](https://github.com/norihiko-nakano/thai-script-trainer/commit/d226d485bed6d85b48516e066a278975d379146f)

### Ver1.0 / 1.x（呼称に揺れあり）

- **確認日・変更日：** 日付未確定
- **変更内容：** 2026-08-14のREADMEは「実際のタイ語語彙と日本語4択へ移行」を1.xと説明。一方、2026-08-02の会話ではタイ文字試作を1.0と呼んでいる。
- **確認状況：** 独立した1.0リリースと変更境界は未確認。実語彙・4択のコードは2.0で確認できるため、1.0で実装済みとは断定しない。
- **対応コミット：** [2719278a](https://github.com/norihiko-nakano/thai-script-trainer/commit/2719278adc0be8c20dbb1d8f01205139e92dfb67)

### Ver2.0

- **確認日・変更日：** 2026-08-02
- **変更内容：** 語彙学習へ拡張。日本語→タイ語入力、画面上のタイ語キーボード、タイ語→日本語4択、誤答の再出題。ODS由来の問題をJSON化。
- **確認状況：** コミット差分で確認。
- **対応コミット：** [2f3360c6](https://github.com/norihiko-nakano/thai-script-trainer/commit/2f3360c63fa3923d52afe5b94e4edb99277dc5fa)

### Ver2.1

- **確認日・変更日：** 2026-08-02
- **変更内容：** ブラウザに学習履歴を保存。学習統計と履歴の操作・CSV出力を追加。
- **確認状況：** コミット差分で確認。
- **対応コミット：** [25861109](https://github.com/norihiko-nakano/thai-script-trainer/commit/2586110914ca94e38383e118213c4c474fac2c62)

### Ver2.2

- **確認日・変更日：** 2026-08-02
- **変更内容：** 学習履歴の専用閲覧画面を追加。
- **確認状況：** コミットの名称で確認。
- **対応コミット：** [c7ea5697](https://github.com/norihiko-nakano/thai-script-trainer/commit/c7ea5697fb1ae9ba405de25e253ce4d778a8d1b5)

### Ver2.3

- **確認日・変更日：** 2026-08-03
- **変更内容：** 難易度選択画面を追加し、基礎100語をLevel 1に割当。
- **確認状況：** コミット差分で確認。
- **対応コミット：** [c83f392d](https://github.com/norihiko-nakano/thai-script-trainer/commit/c83f392dcbe2907893558d4d6f3a2cd721e4092e)

### Ver2.3.1

- **確認日・変更日：** 2026-08-03
- **変更内容：** タイ語をどう読んだかアルファベットで入力する欄を追加。読みは採点せず履歴に保存し、カタカナの読みと比較。
- **確認状況：** コミット差分で確認。
- **対応コミット：** [8c30ac65](https://github.com/norihiko-nakano/thai-script-trainer/commit/8c30ac6588005e21d501915e2ac749cea007e205)

### Ver2.3.2 / 2.3.2.1

- **確認日・変更日：** 2026-08-04
- **変更内容：** 元データの個人的な覚え方メモを公開JSONと解答画面から除外。使い方・語順メモは維持。
- **確認状況：** 同一コミットで生成データの表記が2.3.2、HTMLタイトルが2.3.2.1。別々の公開日とは扱わない。
- **対応コミット：** [80d71467](https://github.com/norihiko-nakano/thai-script-trainer/commit/80d71467aa879e8536ed406e9551110a5f78957b)

### Ver3.0

- **確認日・変更日：** 2026-08-08
- **変更内容：** 文章問題を追加。単語＋文章の混合出題、タイ語文→日本語4択。Supabaseの文章データを利用し、取得失敗時の予備データに対応。
- **確認状況：** コミットと旧READMEの履歴で確認。
- **対応コミット：** [7f05c4e0](https://github.com/norihiko-nakano/thai-script-trainer/commit/7f05c4e0e92a96d3519563de20b74d9146f9e6c3)

### Ver3.1

- **確認日・変更日：** 2026-08-09
- **変更内容：** candidate1/2とchoice_groupを使い、文章内の語を差し替えて似た4択を生成。
- **確認状況：** 旧README・コミット記録で確認。
- **対応コミット：** [286d0418](https://github.com/norihiko-nakano/thai-script-trainer/commit/286d0418169869e74d3aab1c6419751fb3538ee7)

### Ver3.1.1

- **確認日・変更日：** 2026-08-09
- **変更内容：** Supabase接続設定の修正。
- **確認状況：** この番号のコミットには空の変更もあり、独立した新機能は確認できない。
- **対応コミット：** [13ef4204](https://github.com/norihiko-nakano/thai-script-trainer/commit/13ef42049ad6fb7731ca1a0e71434c416cb48f98)

### Ver3.1.2

- **確認日・変更日：** 2026-08-09
- **変更内容：** 接続診断を追加し、類似4択を作れる文章を対象にする。
- **確認状況：** HTML内の3.1.2と差分で確認。
- **対応コミット：** [1e9e7ee3](https://github.com/norihiko-nakano/thai-script-trainer/commit/1e9e7ee3c1c7a635bcf82fc0dc5dc67e4bf5fbae)

### Ver3.1.3（コード内表記）

- **確認日・変更日：** 2026-08-09
- **変更内容：** 文章取得をSupabase REST APIへの直接接続に変更し、取得・候補不足のエラーを表示。
- **確認状況：** コミット名は3.1.2だが、コード内の診断表記は3.1.3。
- **対応コミット：** [dd650192](https://github.com/norihiko-nakano/thai-script-trainer/commit/dd65019232119f737b94f9b4997a4c9cad4133af)

### Ver4.0

- **確認日・変更日：** 2026-08-13
- **変更内容：** Level 1〜10の画面、Level 2の100語と10文章。文章Level以下の語だけを使う累積ルール。単語もSupabase RESTから取得し、JSONを予備として利用。
- **確認状況：** 旧READMEとコミットで確認。全10レベルの教材完成を意味しない。
- **対応コミット：** [5b33f2b1](https://github.com/norihiko-nakano/thai-script-trainer/commit/5b33f2b1d29db788f21f524da076d0a456626635)

### Ver5.0

- **確認日・変更日：** 2026-08-14
- **変更内容：** 復習帳φ(`･ω･´ )🍣を追加。不正解の単語を自動登録し、覚え方メモ・検索・削除に対応。個人メモはlocalStorageに保存。
- **確認状況：** 旧READMEとコミットで確認。
- **対応コミット：** [2719278a](https://github.com/norihiko-nakano/thai-script-trainer/commit/2719278adc0be8c20dbb1d8f01205139e92dfb67)

### Ver5.0.1

- **確認日・変更日：** 2026-08-15
- **変更内容：** 復習帳をコンパクトな行表示に整理。類似4択を作れる文章だけを使用し、古い形式の文章履歴の再出題を抑制。
- **確認状況：** コミット差分で確認。
- **対応コミット：** [056285fa](https://github.com/norihiko-nakano/thai-script-trainer/commit/056285fada38f841ac5842d2476fd44c38ccf0fc)

### Ver5.1

- **確認日・変更日：** 2026-08-15
- **変更内容：** 読み方メモ📕を追加。上・下につく記号や母音の組み合わせ、各行の個人メモと自動保存。
- **確認状況：** 当時のREADMEとコミットで確認。
- **対応コミット：** [a91120e8](https://github.com/norihiko-nakano/thai-script-trainer/commit/a91120e81e2ea24cdf8a1b68efd6ab64c4502d02)

### Ver5.1（全部入り拡張）

- **確認日・変更日：** 2026-08-16
- **変更内容：** 子音44文字、母音32形、末子音、記号、数字を含むタイ文字の参照表へ拡張。既存メモを保持。
- **確認状況：** 番号を変えずに追加更新。当時のREADMEで確認。
- **対応コミット：** [c8f08c03](https://github.com/norihiko-nakano/thai-script-trainer/commit/c8f08c0373b74ceb089790ad28999b1963a17f27)

### Ver5.1.1

- **確認日・変更日：** 2026-08-17
- **変更内容：** 複数母音の「型」を復活。子音が入る位置を「-」で示し、既存のメモキーを再利用。
- **確認状況：** 当時のREADMEとコミットで確認。
- **対応コミット：** [ddb49a39](https://github.com/norihiko-nakano/thai-script-trainer/commit/ddb49a395bf950e5d70a4b26eab7db308a42f125)

### Ver6.0

- **確認日・変更日：** 2026-08-27
- **変更内容：** 実ニュースからAIで学習教材を作る機能を追加。ニュース短文と長文読解、出典・記事日付・AI簡略化表示、週次更新の仕組み。
- **確認状況：** GitHubではJSONを配信する構成。会話中のSupabase保存案と実装を混同しない。
- **対応コミット：** [847b36c2](https://github.com/norihiko-nakano/thai-script-trainer/commit/847b36c24dc583bf9d9578788428fbe0c16cbd7c)

### Ver6.0.1（コミット名6.01）

- **確認日・変更日：** 2026-08-27
- **変更内容：** 旧来の定型的な通常文章を出題から外す。
- **確認状況：** HTML内の6.0.1と差分で確認。
- **対応コミット：** [31e82e9d](https://github.com/norihiko-nakano/thai-script-trainer/commit/31e82e9d479d3fd86fbffbe3dc77b8eae44f7105)

### Ver6.0.2

- **確認日・変更日：** 2026-08-27
- **変更内容：** ニュースの解答解説、単語分解、文法メモ、読みポイント、誤答選択肢の理由を追加。
- **確認状況：** コミット差分で確認。
- **対応コミット：** [ac48c7c9](https://github.com/norihiko-nakano/thai-script-trainer/commit/ac48c7c967f66d95ddb7d8973a322f7b36fd832f)

### Ver6.1

- **確認日・変更日：** 2026-08-29
- **変更内容：** 🐙苦手単語を優先出題。直近の回答が不正解の単語を累計誤答回数順に扱い、正解で対象から外す。
- **確認状況：** コミット差分で確認。3回以上の条件は後の7.3。
- **対応コミット：** [eaa7472d](https://github.com/norihiko-nakano/thai-script-trainer/commit/eaa7472df9991f1a1d51a2762dea70381248c70b)

### Ver6.2

- **確認日・変更日：** 2026-08-29
- **変更内容：** 結果画面の円を正答率に連動したリング表示へ変更。0問時の計算・読み上げラベルにも対応。
- **確認状況：** 差分で確認。8月31日にworkflowの依存関係キャッシュ指定も更新。
- **対応コミット：** [7d7be652](https://github.com/norihiko-nakano/thai-script-trainer/commit/7d7be652a1592f9c1ca45e5a06c6ef17370fb3a7)

### Ver6.2.1

- **確認日・変更日：** 2026-08-31
- **変更内容：** ニュース取得・生成スクリプトを更新。Thai PBSの取得処理、直近3日を探索する設定、workflowのpipキャッシュを整備。
- **確認状況：** スクリプトとworkflowの同番号コミットで確認。
- **対応コミット：** [6cec91e7](https://github.com/norihiko-nakano/thai-script-trainer/commit/6cec91e7831c519e4508b82439ea7abba9a89822)

### Ver6.2.2

- **確認日・変更日：** 2026-08-31
- **変更内容：** AIのJSONで文字列欄に辞書・配列が入っても型エラーで即停止せず、検証結果として再生成に渡す。
- **確認状況：** unhashable type: dict 対策を差分で確認。
- **対応コミット：** [6bab04bc](https://github.com/norihiko-nakano/thai-script-trainer/commit/6bab04bc45f5af927aa2a93d14b54a5d7c190fce)

### Ver6.2.3

- **確認日・変更日：** 2026-08-31
- **変更内容：** 出力JSONの構造をスキーマで指定。語彙・出典URL・選択肢・注釈などを構造化。
- **確認状況：** コミット差分で確認。
- **対応コミット：** [768764d1](https://github.com/norihiko-nakano/thai-script-trainer/commit/768764d13c6c3e29cf2a7c749ae87c194e15c672)

### Ver6.2.4

- **確認日・変更日：** 2026-08-31
- **変更内容：** 日本語の意味・解説とカタカナ読みの要件を明確化し、言語チェックを強化。
- **確認状況：** 当時の仕様。後の辞書読み優先とは区別。
- **対応コミット：** [4b2fdb27](https://github.com/norihiko-nakano/thai-script-trainer/commit/4b2fdb27df92bad94036e503434006fb0e7b41d3)

### Ver6.2.5

- **確認日・変更日：** 2026-08-31
- **変更内容：** 正解を選択肢の番号で受け取り、日本語の正解文へ変換。誤答解説の順序・日本語指定を整理。
- **確認状況：** コミット差分で確認。
- **対応コミット：** [dd801ed8](https://github.com/norihiko-nakano/thai-script-trainer/commit/dd801ed8d06354859fccecf6d0ba4fb5aae4f66a)

### Ver6.2.6

- **確認日・変更日：** 2026-08-31
- **変更内容：** 教材構造・出典の検証と日本語化後の言語検証を分離。日本語化の専用処理と長文の難語数チェックを整備。
- **確認状況：** コミット差分で確認。
- **対応コミット：** [b6877129](https://github.com/norihiko-nakano/thai-script-trainer/commit/b687712914a2e005f2c662da6c8f87b652be98c7)

### Ver6.3

- **確認日・変更日：** 2026-08-31
- **変更内容：** ニュース処理を取得→タイ語候補生成→日本語教材化の3段階に分割。元記事と候補を保存し、途中失敗後も確認できる構成へ。
- **確認状況：** スクリプト群・READMEで確認。
- **対応コミット：** [c3be9248](https://github.com/norihiko-nakano/thai-script-trainer/commit/c3be924858180b54421467a04def36f5e2f4a2bb)

### Ver6.3.1

- **確認日・変更日：** 2026-08-31
- **変更内容：** 短文候補を先に完成させ、長文は記事ごとに生成・再試行。不適合の記事は別の記事へ切り替える。
- **確認状況：** スクリプト冒頭の変更説明と差分で確認。
- **対応コミット：** [b0314e57](https://github.com/norihiko-nakano/thai-script-trainer/commit/b0314e57dd1bfee9a06e4dc4fa5278a83ed4c1ed)

### Ver6.4

- **確認日・変更日：** 2026-08-31
- **変更内容：** 長文読解を一時凍結。週次更新をニュース短文5問に限定し、長文配列を空にする。Level 3以降で再検討。
- **確認状況：** README_V6.4とコミットで確認。
- **対応コミット：** [59ef68d8](https://github.com/norihiko-nakano/thai-script-trainer/commit/59ef68d8b20fd89037a0d37bcc218b78aedecb86)

### Ver6.5（コミット名のみ）

- **確認日・変更日：** 2026-08-31
- **変更内容：** 3段階のニュースworkflowと中間スナップショット保存を導入する変更に、この名前が付いている。
- **確認状況：** 6.3の作業中、6.4より前のコミット。独立した6.5公開版と断定せず、原記録の名前として保存。
- **対応コミット：** [23c50c2d](https://github.com/norihiko-nakano/thai-script-trainer/commit/23c50c2d4679178de93ebe9924c7e929f438bb41)

### Ver7.0

- **確認日・変更日：** 2026-09-08
- **変更内容：** Level 3の200語を解放し、L1/L2各100語と合わせて400語を利用。L2復習2問＋L3ニュース3問、L3長文2本を導入。原文・翻訳・選択肢の独立検証、辞書由来の読み、失敗時の教材保持。
- **確認状況：** README_V7.0で確認。全1,400語を完成した版ではない。
- **対応コミット：** [793cb47a](https://github.com/norihiko-nakano/thai-script-trainer/commit/793cb47a25d2c5157caf2cb4c5634b42029dcb66)

### Ver7.1

- **確認日・変更日：** 2026-09-10
- **変更内容：** 通常クイズに下位Levelの単語を約20％混ぜて復習。
- **確認状況：** 機能コミットと版番号更新で確認。
- **対応コミット：** [de2dca01](https://github.com/norihiko-nakano/thai-script-trainer/commit/de2dca01c4edea1c3d3150c23aced342863f8f20)

### Ver7.2

- **確認日・変更日：** 2026-09-10
- **変更内容：** モードごとの前回の出題構成を、次回アクセス時も記憶。
- **確認状況：** コミット記録で確認。
- **対応コミット：** [01da348f](https://github.com/norihiko-nakano/thai-script-trainer/commit/01da348fce18e4a7373b155475885570dac1a59a)

### Ver7.3

- **確認日・変更日：** 2026-09-12
- **変更内容：** 🐙苦手単語への登録条件を「累計3回以上の誤答」に変更。直近不正解という条件も維持。
- **確認状況：** コミット記録と後のREADMEで確認。復習帳の登録とは別の仕組み。
- **対応コミット：** [7193cbaf](https://github.com/norihiko-nakano/thai-script-trainer/commit/7193cbaf6a6a81760ee5f77fe0fbe8d1c333e607)

### Ver8.0

- **確認日・変更日：** 2026-09-14
- **変更内容：** 話す🦜を追加。Level 1〜3各15文、計45文。お手本音声、タイ語音声認識、言い換え、非対応時の自己評価、下位Level復習、履歴保存。
- **確認状況：** 公開コミットと当時の会話の実装報告で確認。
- **対応コミット：** [b98fb410](https://github.com/norihiko-nakano/thai-script-trainer/commit/b98fb410e3fb73852b064eead51c2160de09e806)

### Ver8.1

- **確認日・変更日：** 2026-09-14
- **変更内容：** 同じ問題のお手本音声は2回目からゆっくり再生。全文の読みヒントと、認識した発話の表示を保持。
- **確認状況：** 3件のコミット記録で確認。
- **対応コミット：** [e5907e1f](https://github.com/norihiko-nakano/thai-script-trainer/commit/e5907e1f57f0716d4c22d807d4ab53e57d74d7e4)

### Ver8.2

- **確認日・変更日：** 2026-09-14
- **変更内容：** 話す練習の全例文に、日本語の全文の意味を表示。
- **確認状況：** コミット記録で確認。
- **対応コミット：** [9bf13429](https://github.com/norihiko-nakano/thai-script-trainer/commit/9bf13429c39bab9f2d8fc597327b62d48b893f54)

### Ver8.3

- **確認日・変更日：** 2026-09-27
- **変更内容：** その日に読む練習で扱った語を、話す練習で優先する連携。
- **確認状況：** UTCでは9月26日だが、日本時間は9月27日。
- **対応コミット：** [31b0eaaf](https://github.com/norihiko-nakano/thai-script-trainer/commit/31b0eaaf0a824fc8561922d94ec81834e7890ece)

### Ver8.4

- **確認日・変更日：** 2026-09-27
- **変更内容：** ニュースの語彙Level制限を撤廃し、単語をタップして文脈上の意味を確認できるように変更。
- **確認状況：** 同名の複数コミットに分けて反映。
- **対応コミット：** [fd94c6c3](https://github.com/norihiko-nakano/thai-script-trainer/commit/fd94c6c3dfb979050bb713d23ae0d93fc0cfbfe9)

### Ver8.4期の修正

- **確認日・変更日：** 2026-09-27〜09-30
- **変更内容：** 候補の原文検証と解答検証の実施段階を整理。原文の根拠箇所をIDで選び、タイ語の空白を保持・復元。9月29日記事からL3短文を更新。
- **確認状況：** 細かな自動データ更新・重複名称のコミットも全件索引に保存。
- **対応コミット：** [2755b2b0](https://github.com/norihiko-nakano/thai-script-trainer/commit/2755b2b0ffd07baf4fb9b0619963d91643d8ba95)

### Ver8.5

- **確認日・変更日：** 2026-10-05
- **変更内容：** 読む練習を単語🐟️・文章🐬・ニュース📰の3区分に整理。Level 3の語を使った3問1セットの文章読解を追加。
- **確認状況：** コミット差分で確認。UTCでは10月4日、日本時間は10月5日。
- **対応コミット：** [dee33764](https://github.com/norihiko-nakano/thai-script-trainer/commit/dee33764c474f6efb2c3f33e97bf9c03a5faa213)

### Ver8.5期：復習ドリル

- **確認日・変更日：** 2026-11-05〜11-06
- **変更内容：** 復習ドリル画面、復習帳JSONの出力、Pythonのランダム3語抽出、Colab練習を追加。Webでは答えを表示し、「分かった」で削除、「分からん」で残し、どちらも次の語へ進む。
- **確認状況：** 段階的な実装。最初の出題時削除方式は、11月6日の判断ボタン追加で変更。
- **対応コミット：** [1d9c165a](https://github.com/norihiko-nakano/thai-script-trainer/commit/1d9c165a344539a384dc6ee89c3a24724ea45094)

### Ver9.0

- **確認日・変更日：** 2026-11-07
- **変更内容：** 日本語/EnglishのUI切替、機能の英語案内、英語の紹介・READMEを追加。既存の日本語訳・採点・復習帳保存を維持。
- **確認状況：** 単語を英訳する版ではない。
- **対応コミット：** [782ca2e0](https://github.com/norihiko-nakano/thai-script-trainer/commit/782ca2e09d7ec2216982af48588644182560d7ec)

### Ver9.0後の修正（番号据置）

- **確認日・変更日：** 2026-11-07
- **変更内容：** 数値が一致する数字だけの訳を許可し、不合格の単語と訳をログ表示。カタカナ固有名詞・タイ語引用を含む訳の検証、タイ語の不自然な空白への対策。拒否されたニュースを検証済み予備記事に切替。
- **確認状況：** 複数コミットで確認。
- **対応コミット：** [eed39f2f](https://github.com/norihiko-nakano/thai-script-trainer/commit/eed39f2ff342b5c4cfc3546b056ca411435e82a0)

### Ver9.0後：長文の冬眠

- **確認日・変更日：** 2026-11-07
- **変更内容：** 長文の生成・日本語化・検証・画面からの起動を停止。古いデータに残る長文も読み飛ばす。短文5問の更新は継続。ボタンを「長文読解（冬眠中🐻🧊🗿）」とし、押せない状態に変更。
- **確認状況：** Ver6.4の凍結→Ver7.0の再開→今回の再凍結を別の出来事として記録。
- **対応コミット：** [344ce64e](https://github.com/norihiko-nakano/thai-script-trainer/commit/344ce64e09e4d4c6dde72c111f92f84e305b11cb)

### Ver9.0後：紹介文の修正

- **確認日・変更日：** 2026-11-07
- **変更内容：** 最初の画面の「海外の採用担当者も」を削除。「Englishに切り替えると、各機能を英語で確認できます。」という案内に変更。
- **確認状況：** コード変更で確認。
- **対応コミット：** [483c1f65](https://github.com/norihiko-nakano/thai-script-trainer/commit/483c1f65f31d908c8ade2e6c1746f4a8ecd038e1)

### Ver10.0

- **確認日・変更日：** 2026-11-12〜2026-11-13
- **変更内容：** メニューに5つ目のモード「会話💬🌺」を追加。タイ人の女の子マリ（AI）とタイ語でチャットする。最初にLevel 1〜3を選び、そのレベルまでの辞書の単語＋会話の基本語（約80語）だけで話す（Supabase側で単語をチェックし、はみ出たら1回作り直し）。Level 1は1〜2語の返事。返事ごとに答えの候補3つから選ぶ選択式（自由入力も可）。日本語訳はタップで表示。オリジナルのかわいいAI音声（OpenAI gpt-4o-mini-tts）で読み上げ、失敗時はブラウザの女性の声。マイク入力。単語ボタンはタップで意味と読みを表示し、復習帳へ追加できる（📘辞書／🔰基本語／⭐辞書にない語。「สวัสดีค่ะ」のように許可された語の組み合わせは🔰）。読みは辞書にある語だけ表示。
- **確認状況：** ブラウザ（GitHub Pages）→ Supabase Edge Function `thai-chat` → OpenAI の構成。OpenAIのキーはSupabaseのSecretsだけに置き、合言葉 `TVT_CHAT_PASSCODE` で関数を保護。Edge FunctionはSupabaseへ手動でデプロイする。
- **対応コミット：** [e20f40f2](https://github.com/norihiko-nakano/thai-script-trainer/commit/e20f40f2d511f7135177e310dd0e98f3582b8c09)（会話の追加）、[95c7a4cd](https://github.com/norihiko-nakano/thai-script-trainer/commit/95c7a4cd8218b4b72eaf834ce31f8930e37df36b)（女性の声・Level 1の短文化・単語はタップで意味）、[5d1e7a39](https://github.com/norihiko-nakano/thai-script-trainer/commit/5d1e7a394ed1f865852820b5068a1ab05ec968dc)（AI音声）、[d19f940f](https://github.com/norihiko-nakano/thai-script-trainer/commit/d19f940f6f93f25b670e4c3825bc33a8e6e23904)（選択式・辞書の単語だけで話す）

### Ver10.1

- **確認日・変更日：** 2026-11-13
- **変更内容：** 会話の相手マリを絵文字から、CanvaのAI画像生成で作ったオリジナルのアニメ風イラストに変更。プルメリアの髪飾りとサイドポニー、水色のオフショルダーにタイ柄の帯。表情は「通常」「笑顔」「驚き」の3枚（`images/mali-normal.webp` / `mali-smile.webp` / `mali-surprise.webp`）と、小さいアイコン用の顔のアップ（`*-face.webp`）で、同じポーズの立ち絵から同じ位置で切り抜いて表情だけが変わるようにした。マリの返事ごとにAIが気持ち（`mood`: normal / happy / surprised）も返し、上の大きな絵と吹き出し横の顔がそれに合わせて切り替わる。メニューのボタンは笑顔。返事を考えている間は小さく揺れる（動きを減らす設定では揺れない）。
- **確認状況：** Edge Functionに `mood` を追加したため、Supabaseへの再デプロイが必要。古い関数のままでも「通常」の絵で動く。

### Ver10.1後の修正（番号据置）

- **確認日・変更日：** 2026-11-13
- **変更内容：** マリの絵を丸く切り抜くのをやめ、背景を消した透明な絵に変更（anime向けの背景除去モデル isnet-anime を使用）。メニューのボタンは笑顔のマリの上半身、会話画面の上の絵と吹き出し横の顔も枠なしで表示。
- **確認状況：** ヘッドレスChromeでメニューと会話画面を撮影して確認。Edge Functionの変更なし。

## 復元に使った資料

- [Ver5.0当時のREADME](https://github.com/norihiko-nakano/thai-script-trainer/blob/2719278adc0be8c20dbb1d8f01205139e92dfb67/README.md)：Ver0.x〜5.0の説明とLevelの設計。
- 当時の保存資料：README_V5.md、README_V5.1.md、README_V5.1_FULL_READING.md、README_V5.1.1.md。本文を読んで、復習帳・読み方メモの追加内容を確認。
- [README_V6.4.md](docs/versions/README_V6.4.md)、[README_V7.0.md](docs/versions/README_V7.0.md)、[README_V9.0.md](docs/versions/README_V9.0.md)：各時点の仕様。古い文書の説明は現在の仕様と異なる場合があります。
- GitHubのコミット一覧と、初期版・ニュース修正・各機能の関連差分。コミットの原文は[全件索引](docs/COMMIT_HISTORY_THROUGH_V9.md)から確認できます。
- 過去の開発会話：初期試作、ニュース更新、話す練習、Ver9.0の英語UI、2026-11-07の修正依頼。会話全体の書き起こしではなく、仕様確認に必要な内容だけを整理しました。

## 未確認・表記の不一致

| 項目 | 状態 |
|---|---|
| Ver0.0とVer1.0 | 後年のREADMEは0.x＝文字入力、1.x＝語彙クイズと整理。一部会話では文字入力試作を1.0と呼ぶ。正式な公開日・境界は未確定。 |
| Ver2.3.2 / 2.3.2.1 | 同一コミットにデータ側とHTML側で異なる番号。独立した2回のリリースとしない。 |
| Ver3.1.3 | コード内に存在。対応するコミットの名前は3.1.2。 |
| Ver6.01 | コード内の6.0.1を採用し、原文の6.01も併記。 |
| Ver6.5 | 6.3の作業中のworkflowコミット名。独立した公開版かは未確認。 |
| main以外の未統合作業 | この全件索引の対象外。mainから到達できる履歴を収録。 |

## 今後の追記方法

新しい版や修正では、日付・変更内容・対象コミットをこのファイルへ追記してください。版番号を変えない修正は「Ver9.0後の修正」のように区別します。将来、未確認部分の根拠が見つかったら、以前の注記を踏まえて補完してください。

このファイルは変更内容の記録です。各版のコードはリンク先のGitコミットに残っています。Gitタグ・GitHub Releaseを新規作成したものではありません。

## 2026-11-07：復習しやすいファイル配置へ整理（Ver9.0据置）

- 未使用の初期問題データ `questions.csv`、旧文章データ `sentences.json`、重複したルートの `update_news.py` を削除。ニュースの実行入口は `scripts/update_news.py` に統一。
- 過去版の説明書を `docs/versions/`、語彙確認資料を `docs/`、DB設定SQLを `sql/`、ODS変換スクリプトを `scripts/` へ移動。
- READMEを現在の構成と学習用の案内に整理し、リンク・実行例・画面内の古い配置説明を更新。
- ニュース処理、復習ドリル、Colab教材、テスト、学習データ、変更履歴は保持。過去のファイル内容はGit履歴から参照・復元可能。
