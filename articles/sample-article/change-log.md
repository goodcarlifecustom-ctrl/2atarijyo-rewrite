# change-log

## 対象URL
https://poi-poi.co.jp/bike/shashu/

## 実施内容
- `node scripts/import-original-from-url.mjs "https://poi-poi.co.jp/bike/shashu/"` を実行しました。
- コンテナから対象URLへの直接取得は `fetch failed` で失敗しました。
- 直接取得失敗時に、`original.meta.json` へ `fetchSource: "fallback"`、`fetchOk: false`、`fetchedUrl`、`fetchError`、`extractedSelector`、`sanitized` を記録することを確認しました。
- 既存の `original.html` / `rewritten.html` に対して `node scripts/validate-rewritten.mjs articles/sample-article` を実行し、`check-report.md` と `validation-result.json` に「URL直接取得失敗」が明記されることを確認しました。

## 本文外HTMLチェック
- `p-postList`: 検出なし
- `p-postList__title`: 検出なし
- `c-tabBody`: 検出なし
- `p-postListTabBody`: 検出なし
- `c-pagination`: 検出なし
- `page-numbers`: 検出なし
- 関連記事カード: 検出なし
- 投稿一覧カード: 検出なし
- 本文外の関連記事H2: 検出なし

## 比較表
比較候補が2件未満のため作成しませんでした。この記事はメーカー別・車種別相場リンク集が主目的であり、本文外の関連記事カードを比較表候補として使わないことを優先しました。

## 外部リンク
元記事本文内のメーカー別・車種別リンクを保持しています。追加の外部リンクは実施していません。

## WordPress投稿
URL直接取得に失敗しているため、WordPress下書き作成はスキップしました。既存本文や代替本文を使った場合は、実URL直接取得成功として扱いません。

## 検証結果
`node scripts/validate-rewritten.mjs articles/sample-article` は、productionモードでURL直接取得失敗を検出するため意図通り失敗ステータスになりました。`node scripts/validate-rewritten.mjs articles/sample-article --mode=fixture` は、fixture検証としてURL直接取得失敗を許容し、`check-report.md` と `validation-result.json` に `fixture検証OK（実URL取得ではない）`、`fetchOk: false`、`fetchSource: fallback`、`fetchError: fetch failed` が記録されています。

## 結論
実URL取得OKではありません。今回は対象URLの直接取得が失敗したため、既存本文を使った確認は「fixture検証」または「実URL相当検証」として扱います。productionモードでは下書き作成禁止、fixture/content-onlyモードでも下書き作成対象外です。
