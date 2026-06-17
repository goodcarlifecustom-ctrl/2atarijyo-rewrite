# rewrite-plan

## 対象URL
https://poi-poi.co.jp/bike/shashu/

## 検証目的
今回の実URL検証では、本文外のWordPress/SWELLテーマ由来HTMLが original.html / rewritten.html に混入しないことを確認する。

## 残すべき重要見出し
- レッドバロンなどのバイク販売店とバイク王のような出張査定はどちらが高く売れるのか？
- メーカー車種別バイク買取相場
- ホンダ バイク買取下取相場表
- ヤマハ バイク買取下取相場表
- スズキ バイク買取下取相場表
- カワサキ バイク買取下取相場表
- ハーレー・海外メーカー バイク買取下取相場表
- バイクを少しでも高く売るためのコツ
- おすすめバイク買取店3選

## 削除対象
- 本文外の関連記事カード
- 投稿一覧カード
- ページネーション
- p-postList / p-postList__title / c-tabBody / p-postListTabBody / c-pagination / page-numbers

## 検証方針
本文内のメーカー別・車種別相場表と本文内リンクを残し、関連記事一覧に由来するH2を本文見出しとして扱わない。
