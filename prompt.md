# Codex Cloud用：記事URL一発リライト・WordPress下書き作成指示書

このリポジトリは、Codex CloudでWordPress記事をSEOリライトし、新規下書きとして投稿するためのワークフローです。

ユーザーが記事URLを1つ渡したら、確認待ちで停止せず、URL取得からWordPress下書き作成、作業ログ記録まで最後まで実行してください。

## 最重要方針

- Codex Cloud前提で実行する。
- Codex CLI前提の説明やローカル実行前提の手順を書かない。
- `rewrite-plan.md` 作成後に確認待ちで止まらない。
- 既存の重要なH2/H3を勝手に削除しない。
- 元記事より情報量を減らさない。
- 元記事より本文文字数を少なくしない。
- 検索意図を変えない。
- WordPressに貼り付け可能なHTMLで作成する。
- SWELLテーマで崩れにくいHTMLにする。
- WordPressの既存公開記事は直接更新しない。
- WordPressには必ず新規下書きとして投稿する。
- `.env` や認証情報は作成・編集・コミットしない。
- WordPressユーザー名、アプリケーションパスワード、認証情報をログや作業メモに出力しない。

## 使用する制御ファイル

作業開始前に、必ず以下を読んでください。

- `rules/` 配下のすべてのルールファイル
- `articles/sample-article/input.md`

リライト内容は主に以下で制御します。

- リライト方針: `rules/rewrite-rule.md` と `articles/sample-article/input.md`
- 外部リンク方針: `rules/external-link-rule.md`
- 比較表方針: `rules/comparison-table-rule.md`
- SWELL装飾方針: `rules/decoration-rule.md`

## URL一発ワークフロー

ユーザー指示に記事URLが含まれる場合、以下を順番に最後まで実行してください。

1. `rules/` 配下をすべて読む。比較表作成時は必ず `rules/comparison-table-rule.md` を読む。
2. `articles/sample-article/input.md` を読む。
3. ユーザー指示内の記事URLを取得する。
4. `node scripts/import-original-from-url.mjs "<記事URL>"` を実行し、WordPress/SWELLテーマ由来の関連記事一覧・投稿一覧・ページネーション・サイドバー・フッター・ナビゲーションを除いた記事本文のみを `articles/sample-article/original.html` に作成する。
5. `articles/sample-article/original.html` を分析し、検索意図、既存H2/H3、残すべき重要見出し、不足情報を確認する。
6. `articles/sample-article/rewrite-plan.md` を作成する。
7. 確認待ちで止まらず、続けて `articles/sample-article/rewritten.html` を作成する。
8. リライト後・外部リンク挿入前・装飾前に必ず `rules/comparison-table-rule.md` を読み、`node scripts/build-comparison-table.mjs articles/sample-article` を実行して、必要に応じて比較表を自動作成・挿入する。
9. 比較表作成後・装飾前に必ず `rules/external-link-rule.md` を読み直し、その内容に従い、公的機関・公式サイト・信頼できる情報源への外部リンクを必要な箇所にだけ自然に追加する。
10. `rules/decoration-rule.md` に従い、SWELL向けにHTML装飾を適用する。装飾工程内で外部リンクを調整する場合も、必ず `rules/external-link-rule.md` を再確認し、見出し内にリンクを設置しない。
11. `node scripts/validate-rewritten.mjs` を実行し、`p-postList` / `p-postList__title` / `c-tabBody` / `p-postListTabBody` / `c-pagination` / `page-numbers` / `main#main_content` などの本文外HTMLが残っていないか検査する。検出時は自動削除・修正し、`articles/sample-article/check-report.md` に結果を記録する。
12. WordPress認証情報が環境変数で設定されている場合、`node scripts/create-wordpress-draft.mjs` を実行し、WordPressへ新規下書きを作成する。認証情報がない場合は投稿実行のみスキップする。
13. `articles/sample-article/change-log.md` に、変更内容、比較表の作成・未作成理由、外部リンク追加箇所、検証結果、本文外HTMLチェック結果、WordPress下書きURLまたは投稿スキップ理由を記録する。



### URL取得失敗時の扱い

- 対象URLから直接 `original.html` を生成できた場合のみ「実URL取得OK」または「実URL検証OK」と記録する。
- URL直接取得に失敗した場合は、既存 `original.html`、代替本文、fixture を使って成功扱いにしない。`original.meta.json`、`check-report.md`、`validation-result.json`、`change-log.md` に「URL直接取得失敗」と記録する。
- 代替本文やfixtureで確認した場合は「実URL相当検証OK」または「fixture検証OK」と記録し、実URL直接取得と区別する。
- URL直接取得に失敗した場合はWordPress下書き作成をスキップし、その理由を `check-report.md` と `change-log.md` に記録する。
- `original.meta.json` には `fetchSource`、`fetchOk`、`fetchedUrl`、`fetchError`、`extractedSelector`、`sanitized` を記録する。


### validate-rewritten.mjs の validationMode

- デフォルトは `production`。URL一発ワークフロー本番ではこのモードを使い、`fetchOk: false` は必ず失敗扱いにする。
- `fixture` はfixture・代替本文の検証用。`fetchOk: false` を許容するが、`check-report.md` / `validation-result.json` に「fixture検証OK」「実URL取得ではない」と明記する。
- `content-only` は本文HTML構造のみの検証用。URL取得成否は警告扱いにするが、「実URL取得OK」とは記録しない。
- `fetchOk: false` の場合、productionでは下書き作成禁止。fixture/content-onlyでも下書き作成対象外として扱う。

## rewrite-plan.md に含める内容

- 元記事の検索意図
- 現在のH2/H3構成
- 絶対に残すべきH2/H3
- 削除してはいけない見出し
- 追加した方がよいH2/H3
- 情報が不足している箇所
- 内部リンク候補
- 公的・信頼性のある外部リンク候補
- アフィリエイト導線の改善案
- SWELL装飾の改善案
- リライト時の注意点

## rewritten.html 作成ルール

- 記事本文のみをHTMLで作成する。
- 不要な説明文や作業メモを入れない。
- コードブロックで囲まず、WordPressに貼り付け可能なHTMLをそのまま保存する。
- H2/H3/H4階層を崩さない。
- 既存の重要見出しは、検索意図に合う形で残す・補強する。
- 必要に応じて比較表、箇条書き、FAQ、注意点、メリット・デメリット、利用手順を追加する。比較表は `rules/comparison-table-rule.md` に従い、手動貼り付けではなく取得済みHTMLから自動生成する。
- 外部リンクは読者の安全性・信頼性・判断材料になる箇所へ自然に追加し、追加箇所を `change-log.md` に記録する。
- 装飾は過剰にせず、SWELLで崩れにくいシンプルなHTMLにする。

## WordPress下書き作成

- `scripts/create-wordpress-draft.mjs` は `articles/sample-article/rewritten.html` を読み込み、WordPress REST APIへ `status: "draft"` で新規投稿する。
- 既存記事は更新しない。
- 認証情報は環境変数から読む。
- 投稿結果は `articles/sample-article/wordpress-draft.json` に保存する。
- 下書きID、編集URL、公開プレビューに使えるURLが取得できる場合は `change-log.md` に記録する。

## 品質ガード（比較表・見出し・日本語）

- 比較表は `rules/comparison-table-rule.md` に従い、「この記事でわかること」のcapbox内には入れない。
- 既存比較表がある場合は重複追加しない。
- `original.html` / `rewritten.html` / WordPress下書き本文には、本文外の関連記事一覧・投稿一覧・ページネーション・サイドバー・フッター・ナビゲーションを含めない。
- 本文内のメーカー別・車種別相場表や本文内リンクは削除しない。削除対象は本文外の関連記事カード、投稿一覧、ページネーションなどに限定する。
- 本文外の関連記事一覧・投稿一覧に含まれるH2（例: `p-postList__title`）は本文見出しとして扱わず、必ず削除する。
- 比較表候補はおすすめ・ランキング・サービス紹介系H2配下のサービス名、アプリ名、商品名、店舗名に限定する。
- 選び方、注意点、FAQ、まとめ、方法、手順、チェックリスト系のH3は比較表に入れない。
- 本文のないH2/H3、数字だけ違う量産見出し、同じH3の繰り返し、文字数稼ぎの見出し追加は禁止する。
- 「サービスサービス」「必要ことです」「注意ことです」「重要ことです」などの不自然な日本語や同一段落の繰り返しを出力しない。
