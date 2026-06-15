# 変更ログ

## 実行概要（2026-06-15）

- 対象URL: https://www.atarijo.com/media/datingapp-osusume10/
- 狙うキーワード: セックス アプリ
- 関連キーワード: セックス アプリ おすすめ、セックスできるアプリ、セフレ アプリ、出会い系アプリ セフレ、マッチングアプリ セックス、大人の出会い アプリ
- URL取得: 成功（WordPress REST API認証付き取得。`articles/sample-article/original.html` に保存）
- rewritten.html作成: 成功（元記事の重要H2/H3を維持し、冒頭で検索意図を補強）
- 外部リンク: 既存の警視庁リンクに `target="_blank" rel="noopener noreferrer"` を付与。本文内の既存公式・アフィリエイトリンクは維持。
- SWELL装飾: 既存のcapbox、アンカー、マーカー、比較カードを維持。比較表はcapbox外へ配置。
- HTML検証: 成功（`node scripts/validate-rewritten.mjs`）
- WordPress下書き作成: 成功（新規下書き。既存公開記事は更新していない）

## 比較表作成・挿入

- 実行コマンド: `npm run table -- articles/sample-article`
- 比較表作成: 成功
- 挿入位置: 「この記事でわかること」のcapboxが完全に閉じた直後、最初のH2の直前
- 抽出した候補数: 10
- 表に入れた項目数: 10
- 情報不足で「追加確認が必要」とした項目: 5セル（全60セル中。半数未満）
- 選び方・注意点・FAQ・まとめ・チェックリスト系H3: 比較表に含めていない
- 重複比較表: なし（`comparison-table-block` は1件）
- capbox内挿入: なし
- 公式サイトまたは外部ページへの追加アクセス確認: 追加アクセスなし。記事内リンク周辺本文から抽出。

## 外部リンク追加・確認

- URL: https://www.keishicho.metro.tokyo.lg.jp/tetsuzuki/other/internet_iseisyokai/gaiyo.html
  - アンカーテキスト: 警視庁の定めるインターネット異性紹介事業
  - 設置箇所: 冒頭本文
  - 理由: 出会い系アプリ・マッチングアプリの安全性、届出、法令順守に関わる公的情報として読者の判断材料になるため
  - アクセス確認結果: 元記事内で既存設置済み。`cleanup-external-link-bloat` 実行後も残存リンクとして確認。
  - リダイレクト: なし（本文URLを維持）

## 検証結果

- `node scripts/cleanup-external-link-bloat.mjs articles/sample-article`: 成功。完全一致pタグ重複なし。
- `node scripts/validate-rewritten.mjs`: 成功。
- rewritten.html本文文字数: 20689（検証JSONの `rewrittenTextLength`）
- original.html本文文字数: 18406（検証JSONの `originalTextLength`）
- H2数: 10、H3数: 53。元記事から大きく減少なし。
- 空見出し: なし。
- 数字だけ違う量産見出し: なし。
- 同じH3の繰り返し: なし。
- 不自然日本語（サービスサービス、必要ことです、注意ことです、重要ことです等）: 検出なし。
- 比較表品質: capbox外、重複なし、抽象見出しなし、リンク属性あり、「追加確認が必要」は半数未満。

## WordPress下書き

- 投稿方式: WordPress REST APIで新規作成
- ステータス: draft
- 下書きID: 1616
- 編集URL: https://www.atarijo.com/wp-admin/post.php?post=1616&action=edit
- プレビューURL: https://www.atarijo.com/media/?p=1616
- WordPress下書き本文: あり（`rewritten.html` の本文を送信）

## 残っている問題点

- なし。
