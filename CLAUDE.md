# AIエージェント向けの手引き

このリポジトリを引き継ぐAIエージェントは、作業前に必ずこのファイルを読んでください。

## このプロジェクトの性格

日本の小規模ボランティア団体「ぬいぬいふぁくとりー」（ぬいぐるみ作りワークショップ）の公式サイト。
運営者は非エンジニア。予算ゼロ。更新は月に数回。

**設計方針：durability first.** 動きの派手さより、5年後も壊れていないことを優先しています。

## 絶対に守ること

1. **ビルドツールを導入しない。** Node / npm / バンドラ / SSG / GitHub Actions によるビルドを
   「モダンだから」という理由で追加しないでください。素のHTML・CSS・JSのままにすることが、
   このプロジェクトの最重要要件です。運営者はコマンドラインを使いません。
2. **一覧差し込みのマーカーコメントを消さない。**
   `<!-- NEWS_LIST_START -->` `<!-- NEWS_LIST_END -->`
   `<!-- BLOG_LIST_START -->` `<!-- BLOG_LIST_END -->`
   ダッシュボードがこの間を書き換えます。消すと記事一覧が更新されなくなります。
3. **`content/*.json` を直接消さない。** ここが記事の唯一の正本です。
   `news/*.html` `blog/*.html` はここから生成された成果物にすぎません。
4. **破壊的な操作は必ず確認を取る。** ファイル削除、`content/` の書き換え、
   `git push --force` に相当する操作は、実行前にユーザーへ確認してください。
5. **日本語で応答する。** ドキュメント・コメントも日本語で書いてください。
   専門用語には短い言い換えを添えてください。

## 構成

| パス | 役割 |
|---|---|
| `index.html` `works.html` `privacy.html` `thanks.html` `404.html` | 固定ページ |
| `news/index.html` `blog/index.html` | 記事一覧（マーカー内が自動更新） |
| `news/<slug>.html` `blog/<slug>.html` | 記事ページ（自動生成物・手で書かない） |
| `content/news.json` `content/blog.json` | 記事の正本 |
| `templates/article.html` | 記事ページのひな形（`{{TITLE}}` などを置換） |
| `admin/index.html` `admin/app.js` | 記事ダッシュボード |
| `assets/css/style.css` | 全ページ共通のデザイン。色は先頭の `:root` |
| `assets/js/site.js` | メニュー開閉・フォーム送信のみ |

### 記事データの形

```json
{
  "slug": "20260731-a1b2",
  "title": "記事タイトル",
  "date": "2026-07-31",
  "category": "NEWS",
  "cover": "/assets/img/uploads/202607-xxxx-photo.jpg",
  "excerpt": "一覧に出る短い紹介文",
  "body": "Markdown記法の本文",
  "published": true
}
```

`category` はお知らせのみ（`NEWS` / `EVENT` / `VOICE`）。
`body` は `admin/app.js` の `mdToHtml()` が対応する記法のみ使えます
（`##` `###` `**太字**` `[リンク](url)` `![](画像)` `- 箇条書き` `> 引用`）。

## ヘッダー・フッターの重複について

共通部品の仕組み（インクルード）を使わず、各HTMLに直接書いています。
ビルドなしを維持するための意図的な判断です。**ナビゲーションを変更するときは、
以下すべてを同じ内容に更新してください。**

`index.html` / `works.html` / `privacy.html` / `thanks.html` / `404.html` /
`news/index.html` / `blog/index.html` / `templates/article.html`

`templates/article.html` を直したら、ダッシュボードの「サイト全体を作り直す」で
既存記事にも反映する必要があります（ユーザーに実行を依頼してください）。

## パスの規約（重要）

**すべて相対パスです。絶対パス（先頭が `/`）を書かないでください。**
サイトがドメイン直下でも、`example.github.io/nuinui-site/` のようなサブフォルダでも、
ローカルでHTMLを直接開いても動くようにするためです。

| 場所 | 書き方 |
|---|---|
| 直下のページ（`index.html` など） | `assets/css/style.css` `news/` `works.html` |
| 1階層下（`news/` `blog/` `admin/` `templates/`） | `../assets/css/style.css` `../works.html` |

`content/*.json` の `cover` と、本文の画像パスは **`assets/img/uploads/…`（先頭スラッシュなし）** で保存します。
表示時に `admin/app.js` の `withPrefix()` が場所に応じて `../` を足します。

## 動作確認のしかた

相対パスなので、`index.html` をブラウザで直接開くだけで確認できます。
サーバを立てたい場合は `python3 -m http.server 8000`。

`admin/` はGitHub APIを使うため、ローカルでも実際のリポジトリに書き込みます。
**検証時に誤って本番へコミットしないよう注意してください。**

## 未完了・注意点

- `index.html` のFormspree ID（`XXXXXXXX`）は未設定。公開前に差し替えが必要。
- 記事はまだ0件。旧STUDIOサイトのお知らせ4件は未移行。
- 独自ドメイン未取得。取得したら `CNAME` ファイルの追加が必要。
