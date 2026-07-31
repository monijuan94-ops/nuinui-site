# ぬいぬいふぁくとりー 公式サイト

ぬいぐるみ作りワークショップ団体「ぬいぬいふぁくとりー」のWebサイトです。

- **サイト**: https://monijuan94-ops.github.io/nuinui-site/
- **記事ダッシュボード**: https://monijuan94-ops.github.io/nuinui-site/admin/

---

## いちばん大事なこと

**このサイトはビルドツールを使いません。** Node.js も npm も GitHub Actions も不要です。
リポジトリに入っているHTMLがそのまま公開されます。だから、

- 数年後に「ビルドが通らない」で詰むことがない
- HTMLが読める人なら誰でも直せる
- GitHubのWeb画面から直接編集しても壊れない

記事を書くと、ダッシュボードがブラウザ上でHTMLを組み立ててGitHubに直接コミットします。

---

## フォルダ構成

```
/
├── index.html            トップページ
├── works.html            私たちの活動
├── privacy.html          プライバシーポリシー
├── thanks.html           送信完了ページ
├── 404.html              ページが見つからないとき
│
├── news/index.html       お知らせ一覧
├── news/*.html           お知らせ記事（ダッシュボードが自動生成）
├── blog/index.html       ブログ一覧
├── blog/*.html           ブログ記事（ダッシュボードが自動生成）
│
├── content/news.json     お知らせの元データ ← ここが記事の正本
├── content/blog.json     ブログの元データ   ← ここが記事の正本
│
├── templates/article.html 記事ページのひな形
├── admin/                記事ダッシュボード
├── assets/css/style.css  デザイン（色は先頭の :root で一括変更できます）
├── assets/js/site.js     メニュー開閉とフォーム送信
├── assets/img/           画像（uploads/ にダッシュボードからの写真が入る）
└── docs/                 運用のための手引き
```

### 記事データの正本は `content/*.json`

`news/xxx.html` などの記事ページは、JSONから**自動生成された結果**です。
デザインを変えたら、ダッシュボードの「サイト全体を作り直す」を押せば全記事に反映されます。

### 一覧が差し込まれる仕組み

`index.html` などにある次のコメントの**あいだ**を、ダッシュボードが書き換えます。

```html
<!-- NEWS_LIST_START -->…<!-- NEWS_LIST_END -->
<!-- BLOG_LIST_START -->…<!-- BLOG_LIST_END -->
```

**このコメントは絶対に消さないでください。** 消すと一覧が更新されなくなります。

---

## 公開のしかた（GitHub Pages）

1. リポジトリの **Settings → Pages** を開く
2. Source を **Deploy from a branch**、Branch を **main / (root)** にして Save
3. 数分後、表示されたURLでサイトが見られます

独自ドメインを使う場合は、同じ画面の Custom domain に入力し、ドメイン側でDNSを設定します。

---

## 公開前にやること

- [ ] **Googleフォーム**を団体Gmail（nuinuifactory@gmail.com）で作る
- [ ] `index.html` の `<!-- GFORM_START -->` と `<!-- GFORM_END -->` のあいだに、
      Googleフォームの埋め込みHTML（`<iframe …></iframe>`）を貼り付ける
- [ ] `docs/アカウント台帳.md` を埋める
- [ ] ダッシュボードから記事を1本、実際に公開してみる

### お問い合わせフォームの差し替え方

1. Googleフォームを開く → 右上の **送信** → **`< >`（埋め込み）** タブ
2. 表示された `<iframe …></iframe>` をまるごとコピー
3. `index.html` の `<!-- GFORM_START -->` と `<!-- GFORM_END -->` の**あいだ**に貼り付け

貼り付けるまでは、代わりにメールでの案内が自動で表示されます。
フォームの下が切れる場合は `assets/css/style.css` の `.gform iframe` の `min-height` を大きくしてください。

---

## 更新のしかた

| やりたいこと | どうする |
|---|---|
| 記事を書く・写真を入れる | `/admin/` を開く → [docs/記事の書き方.md](docs/記事の書き方.md) |
| 固定ページの文章を直す | 該当のHTMLを編集（AIに頼むのが早い） |
| 色を変える | `assets/css/style.css` 先頭の `:root` |
| 過去記事にデザインを反映 | ダッシュボードの「サイト全体を作り直す」 |
| ダッシュボードが動かない | [docs/こまったときは.md](docs/こまったときは.md) |

---

## ライセンス・素材

イラスト・文章はぬいぬいふぁくとりーに帰属します。無断転載はご遠慮ください。
