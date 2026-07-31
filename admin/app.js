/* =====================================================================
   ぬいふぁく 記事ダッシュボード
   ---------------------------------------------------------------------
   何をしているか（ざっくり）
     1. GitHubのトークンをブラウザに保存する
     2. content/news.json と content/blog.json を読み書きする
     3. 「公開する」を押したら、記事のHTMLと一覧ページをその場で組み立てて
        GitHubにまとめて1回のコミットで送る
   ビルドツール（Node・npm）は一切使いません。すべてこの1ファイルで完結します。
   ===================================================================== */
"use strict";

/* ---------------------------------------------------------------
   設定の保存
   --------------------------------------------------------------- */
var CFG_KEY = "nuifac_admin_cfg";
var cfg = null;

function loadCfg() {
  try { cfg = JSON.parse(localStorage.getItem(CFG_KEY) || "null"); } catch (e) { cfg = null; }
  return cfg;
}
function saveCfg(c) { cfg = c; localStorage.setItem(CFG_KEY, JSON.stringify(c)); }

/* ---------------------------------------------------------------
   小道具
   --------------------------------------------------------------- */
var $ = function (id) { return document.getElementById(id); };

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function b64encode(str) {
  var bytes = new TextEncoder().encode(str), bin = "";
  for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64decode(b64) {
  var bin = atob(b64.replace(/\s/g, "")), bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
function toast(msg, ms) {
  var t = document.createElement("div");
  t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function () { t.remove(); }, ms || 2600);
}
function jpDate(iso) {
  if (!iso) return "";
  var p = iso.split("-");
  return p[0] + "." + p[1] + "." + p[2];
}

/* ---------------------------------------------------------------
   GitHub API
   --------------------------------------------------------------- */
function api(path, options) {
  options = options || {};
  var headers = {
    Authorization: "Bearer " + cfg.token,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (options.body) headers["Content-Type"] = "application/json";
  return fetch("https://api.github.com/repos/" + cfg.owner + "/" + cfg.repo + path, {
    method: options.method || "GET",
    headers: headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  }).then(function (res) {
    if (res.status === 404 && options.allow404) return null;
    if (!res.ok) {
      return res.json().catch(function () { return {}; }).then(function (j) {
        var m = j.message || res.statusText;
        if (res.status === 401) m = "トークンが正しくないようです。設定をやり直してください。";
        if (res.status === 403) m = "権限が足りません。トークンの Contents を Read and write にしてください。";
        throw new Error(m);
      });
    }
    return res.status === 204 ? null : res.json();
  });
}

function getFile(path) {
  return api("/contents/" + encodeURI(path) + "?ref=" + encodeURIComponent(cfg.branch), { allow404: true })
    .then(function (j) { return j ? { text: b64decode(j.content), sha: j.sha } : null; });
}

/* 複数ファイルを1回のコミットでまとめて送る（途中で失敗しても中途半端な状態にならない） */
function commitFiles(files, message) {
  var ref = "heads/" + cfg.branch, baseCommit, baseTree;
  return api("/git/ref/" + ref)
    .then(function (r) { baseCommit = r.object.sha; return api("/git/commits/" + baseCommit); })
    .then(function (c) {
      baseTree = c.tree.sha;
      return Promise.all(files.map(function (f) {
        if (f.remove) return Promise.resolve({ path: f.path, mode: "100644", type: "blob", sha: null });
        return api("/git/blobs", {
          method: "POST",
          body: f.base64
            ? { content: f.base64, encoding: "base64" }
            : { content: f.content, encoding: "utf-8" }
        }).then(function (b) {
          return { path: f.path, mode: "100644", type: "blob", sha: b.sha };
        });
      }));
    })
    .then(function (tree) { return api("/git/trees", { method: "POST", body: { base_tree: baseTree, tree: tree } }); })
    .then(function (t) {
      return api("/git/commits", { method: "POST", body: { message: message, tree: t.sha, parents: [baseCommit] } });
    })
    .then(function (c) { return api("/git/refs/" + ref, { method: "PATCH", body: { sha: c.sha } }); });
}

/* ---------------------------------------------------------------
   Markdown → HTML（必要な記法だけの軽い変換）
   --------------------------------------------------------------- */
/* サイト内の画像パスは「assets/…」の形で保存し、表示する場所の深さに応じて
   prefix（"" か "../"）を足す。こうしておくと、サイトがドメイン直下でも
   サブフォルダでも、ローカルでファイルを開いても正しく表示されます。      */
function withPrefix(url, prefix) {
  if (/^(https?:|data:|mailto:|#|\/)/.test(url)) return url;   // 外部URLはそのまま
  return (prefix || "") + url;
}
function inline(s, prefix) {
  return esc(s)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (_, alt, u) {
      return '<img src="' + withPrefix(u, prefix) + '" alt="' + alt + '">';
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}
function mdToHtml(md, prefix) {
  var out = [];
  String(md || "").replace(/\r\n?/g, "\n").split(/\n{2,}/).forEach(function (block) {
    block = block.replace(/^\n+|\n+$/g, "");
    if (!block) return;
    var m;
    if ((m = block.match(/^###\s+(.*)$/))) { out.push("<h3>" + inline(m[1], prefix) + "</h3>"); return; }
    if ((m = block.match(/^##\s+(.*)$/)))  { out.push("<h2>" + inline(m[1], prefix) + "</h2>"); return; }
    if (/^>\s?/.test(block)) {
      out.push("<blockquote>" + inline(block.replace(/^>\s?/gm, ""), prefix).replace(/\n/g, "<br>") + "</blockquote>");
      return;
    }
    if (/^[-*]\s+/.test(block)) {
      var li = block.split("\n").filter(function (l) { return /^[-*]\s+/.test(l); })
        .map(function (l) { return "<li>" + inline(l.replace(/^[-*]\s+/, ""), prefix) + "</li>"; });
      out.push("<ul>" + li.join("") + "</ul>");
      return;
    }
    // 画像だけの行はそのまま画像に
    if ((m = block.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/))) {
      out.push('<img src="' + esc(withPrefix(m[2], prefix)) + '" alt="' + esc(m[1]) + '">'); return;
    }
    out.push("<p>" + inline(block, prefix).replace(/\n/g, "<br>") + "</p>");
  });
  return out.join("\n");
}

/* ---------------------------------------------------------------
   カード（一覧に並ぶ記事1件分のHTML）
   --------------------------------------------------------------- */
function cardHtml(type, a, prefix) {
  var url = (prefix || "") + type + "/" + a.slug + ".html";
  var thumb = a.cover
    ? '<img src="' + esc(withPrefix(a.cover, prefix)) + '" alt="">'
    : '<img src="' + (prefix || "") + 'assets/img/mascot-lpink.svg" alt="" style="object-fit:contain;padding:18%">';
  var badge = "";
  if (type === "news" && a.category) {
    var cls = a.category === "NEWS" ? "badge" : "badge badge--" + a.category.toLowerCase();
    badge = '<span class="' + cls + '">' + esc(a.category) + "</span>";
  }
  return [
    '<a class="card" href="' + url + '">',
    '  <div class="card__thumb">' + thumb + "</div>",
    '  <div class="card__meta"><span class="card__date">' + esc(jpDate(a.date)) + "</span>" + badge + "</div>",
    '  <h3 class="card__title">' + esc(a.title) + "</h3>",
    a.excerpt ? '  <p class="card__excerpt">' + esc(a.excerpt) + "</p>" : "",
    "</a>"
  ].filter(Boolean).join("\n");
}

function listHtml(type, items, limit, prefix) {
  var pub = items.filter(function (a) { return a.published; })
    .sort(function (x, y) { return (y.date || "").localeCompare(x.date || ""); });
  if (limit) pub = pub.slice(0, limit);
  if (!pub.length) return '<p class="cards__empty">まだ記事がありません。</p>';
  return '<div class="cards">\n' +
    pub.map(function (a) { return cardHtml(type, a, prefix); }).join("\n") + "\n</div>";
}

function replaceBetween(html, marker, inner) {
  var s = "<!-- " + marker + "_START -->", e = "<!-- " + marker + "_END -->";
  var i = html.indexOf(s), j = html.indexOf(e);
  if (i === -1 || j === -1) return html;
  return html.slice(0, i + s.length) + inner + html.slice(j);
}

/* ---------------------------------------------------------------
   記事ページのHTMLを組み立てる
   --------------------------------------------------------------- */
function articleHtml(tpl, type, a) {
  var badge = "";
  if (type === "news" && a.category) {
    var cls = a.category === "NEWS" ? "badge" : "badge badge--" + a.category.toLowerCase();
    badge = '<span class="' + cls + '">' + esc(a.category) + "</span>";
  }
  // 記事ページは news/ blog/ の中にあるので、1つ上に戻る "../" を付ける
  var P = "../";
  var cover = a.cover
    ? '<div class="article__cover"><img src="' + esc(withPrefix(a.cover, P)) + '" alt=""></div>' : "";
  return tpl
    .replace(/\{\{TITLE\}\}/g, esc(a.title))
    .replace(/\{\{EXCERPT\}\}/g, esc(a.excerpt || a.title))
    .replace(/\{\{COVER_BLOCK\}\}/g, cover)
    .replace(/\{\{COVER\}\}/g, esc(withPrefix(a.cover || "assets/img/hero.svg", P)))
    .replace(/\{\{DATE\}\}/g, esc(jpDate(a.date)))
    .replace(/\{\{BADGE\}\}/g, badge)
    .replace(/\{\{BODY\}\}/g, mdToHtml(a.body, P))
    .replace(/\{\{LIST_URL\}\}/g, P + type + "/")
    .replace(/\{\{LIST_LABEL\}\}/g, type === "news" ? "お知らせ一覧へ" : "ブログ一覧へ");
}

/* ---------------------------------------------------------------
   画面の状態
   --------------------------------------------------------------- */
var state = { type: "news", data: { news: [], blog: [] }, editing: null, isNew: false };

function show(view) {
  ["setup", "list", "edit"].forEach(function (v) {
    $("view-" + v).classList.toggle("hide", v !== view);
  });
  $("bar").classList.toggle("hide", view !== "edit");
  $("btn-logout").classList.toggle("hide", view === "setup");
}

/* ---------------------------------------------------------------
   起動
   --------------------------------------------------------------- */
/* いま開いているURLから「どのサイトにつなぐか」を自動で読み取る。
   例: https://monijuan94-ops.github.io/nuinui-site/admin/
       → owner = monijuan94-ops, repo = nuinui-site
   これにより、利用者はユーザー名やリポジトリ名を入力しなくて済みます。      */
function detectRepo() {
  var host = location.hostname, parts = location.pathname.split("/").filter(Boolean);
  if (/\.github\.io$/i.test(host)) {
    var owner = host.replace(/\.github\.io$/i, "");
    // /admin/ だけなら owner.github.io という名前のリポジトリ
    var repo = (parts.length >= 2) ? parts[0] : host;
    return { owner: owner, repo: repo, branch: "main" };
  }
  // 独自ドメインなどURLから判定できない場合は、HTMLに書いてある予備を使う
  var meta = document.querySelector('meta[name="nuifac-repo"]');
  if (meta && meta.content.indexOf("/") > 0) {
    var p = meta.content.split("/");
    return { owner: p[0], repo: p[1], branch: "main" };
  }
  return null;
}

function boot() {
  var d = detectRepo();
  if (d) {
    $("detected").textContent = d.owner + " / " + d.repo;
    $("cfg-owner").value = d.owner; $("cfg-repo").value = d.repo; $("cfg-branch").value = d.branch;
  } else {
    $("detected").textContent = "下の「くわしい設定」で入力してください";
  }
  // GitHubのトークン作成ページを、設定済みの状態で開くリンク
  $("btn-open-github").href = "https://github.com/settings/tokens/new?scopes=repo" +
    "&description=" + encodeURIComponent("ぬいふぁくサイトの記事ダッシュボード");

  if (!loadCfg() || !cfg.token) { show("setup"); return; }
  $("cfg-owner").value = cfg.owner; $("cfg-repo").value = cfg.repo; $("cfg-branch").value = cfg.branch;
  show("list");
  loadAll();
}

function setupMsg(text, ok) {
  var el = $("setup-msg");
  el.textContent = text;
  el.className = "setup-msg setup-msg--" + (ok ? "ok" : "ng");
}

function loadAll() {
  $("list").innerHTML = '<p class="muted">読み込み中…</p>';
  Promise.all([getFile("content/news.json"), getFile("content/blog.json")])
    .then(function (r) {
      state.data.news = r[0] ? JSON.parse(r[0].text) : [];
      state.data.blog = r[1] ? JSON.parse(r[1].text) : [];
      renderList();
    })
    .catch(function (e) {
      $("list").innerHTML = '<p class="muted">読み込めませんでした：' + esc(e.message) + "</p>";
    });
}

function renderList() {
  var items = state.data[state.type].slice()
    .sort(function (x, y) { return (y.date || "").localeCompare(x.date || ""); });
  if (!items.length) {
    $("list").innerHTML = '<p class="muted">まだ記事がありません。右上の「＋ 新しい記事を書く」から始めましょう。</p>';
    return;
  }
  $("list").innerHTML = items.map(function (a, i) {
    var thumb = a.cover ? esc(withPrefix(a.cover, "../")) : "../assets/img/mascot-lpink.svg";
    return [
      '<div class="item">',
      '  <img class="item__thumb" src="' + thumb + '" alt="">',
      '  <div class="item__main">',
      '    <div class="item__title">' + esc(a.title || "（無題）") + "</div>",
      '    <div class="muted">' + esc(jpDate(a.date)) + "　" +
           '<span class="pill ' + (a.published ? "pill--pub\">公開中" : "pill--draft\">下書き") + "</span></div>",
      "  </div>",
      '  <button class="btn-line" data-edit="' + esc(a.slug) + '">編集</button>',
      "</div>"
    ].join("\n");
  }).join("");
  Array.prototype.forEach.call($("list").querySelectorAll("[data-edit]"), function (b) {
    b.addEventListener("click", function () { openEditor(b.getAttribute("data-edit")); });
  });
}

/* ---------------------------------------------------------------
   エディタ
   --------------------------------------------------------------- */
function newSlug() {
  var d = new Date(), p = function (n) { return String(n).padStart(2, "0"); };
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" +
         Math.random().toString(36).slice(2, 6);
}

function openEditor(slug) {
  var a = slug ? state.data[state.type].find(function (x) { return x.slug === slug; }) : null;
  state.isNew = !a;
  if (!a) {
    a = { slug: newSlug(), title: "", date: new Date().toISOString().slice(0, 10),
          category: "NEWS", cover: "", excerpt: "", body: "", published: false };
  }
  state.editing = JSON.parse(JSON.stringify(a));
  $("title").value = a.title; $("date").value = a.date; $("category").value = a.category || "NEWS";
  $("cover").value = a.cover || ""; $("excerpt").value = a.excerpt || "";
  $("body").value = a.body || ""; $("slug").value = a.slug;
  $("cat-wrap").classList.toggle("hide", state.type !== "news");
  $("btn-delete").classList.toggle("hide", state.isNew);
  $("bar-note").textContent = state.isNew ? "新しい記事" :
    (a.published ? "公開中の記事を編集しています" : "下書きを編集しています");
  renderPreview();
  show("edit");
  window.scrollTo(0, 0);
}

function collect() {
  var a = state.editing;
  a.title = $("title").value.trim();
  a.date = $("date").value;
  a.category = $("category").value;
  a.cover = $("cover").value.trim();
  a.excerpt = $("excerpt").value.trim();
  a.body = $("body").value;
  a.slug = ($("slug").value.trim() || newSlug()).replace(/[^A-Za-z0-9-]/g, "-").toLowerCase();
  return a;
}

/* プレビュー内の画像は、まだ公開前でも見えるようGitHubの生URLに読み替える */
function toRaw(html) {
  return html.replace(/src="(?:\.\.\/)?(assets\/[^"]+)"/g, function (_, p) {
    return 'src="https://raw.githubusercontent.com/' + cfg.owner + "/" + cfg.repo + "/" + cfg.branch + "/" + p + '"';
  });
}
function renderPreview() { $("preview").innerHTML = toRaw(mdToHtml($("body").value, "../")); }

/* ---------------------------------------------------------------
   保存・公開
   --------------------------------------------------------------- */
function save(published) {
  var a = collect();
  if (!a.title) { toast("タイトルを入れてください"); return; }
  if (!a.date)  { toast("日付を入れてください"); return; }
  a.published = published;

  var type = state.type;
  var arr = state.data[type].filter(function (x) { return x.slug !== a.slug; });
  arr.push(a);
  state.data[type] = arr;

  setBusy(true, published ? "公開しています…" : "保存しています…");

  getFile("templates/article.html")
    .then(function (t) {
      if (!t) throw new Error("templates/article.html が見つかりません");
      return Promise.all([t.text, getFile("index.html"), getFile("news/index.html"), getFile("blog/index.html")]);
    })
    .then(function (r) {
      var tpl = r[0], top = r[1], newsIdx = r[2], blogIdx = r[3];
      var files = [];

      files.push({ path: "content/" + type + ".json",
                   content: JSON.stringify(state.data[type], null, 2) + "\n" });

      if (published) {
        files.push({ path: type + "/" + a.slug + ".html", content: articleHtml(tpl, type, a) });
      } else {
        files.push({ path: type + "/" + a.slug + ".html", remove: true });
      }

      if (top) {
        var h = top.text;
        h = replaceBetween(h, "NEWS_LIST", "\n" + listHtml("news", state.data.news, 3, "") + "\n    ");
        h = replaceBetween(h, "BLOG_LIST", "\n" + listHtml("blog", state.data.blog, 3, "") + "\n    ");
        files.push({ path: "index.html", content: h });
      }
      if (newsIdx) {
        files.push({ path: "news/index.html",
          content: replaceBetween(newsIdx.text, "NEWS_LIST", "\n" + listHtml("news", state.data.news, 0, "../") + "\n    ") });
      }
      if (blogIdx) {
        files.push({ path: "blog/index.html",
          content: replaceBetween(blogIdx.text, "BLOG_LIST", "\n" + listHtml("blog", state.data.blog, 0, "../") + "\n    ") });
      }

      return commitFiles(files, (published ? "記事を公開: " : "下書きを保存: ") + a.title);
    })
    .then(function () {
      setBusy(false);
      toast(published ? "公開しました！反映まで1〜2分かかります" : "下書きを保存しました", 3600);
      show("list"); renderList();
    })
    .catch(function (e) { setBusy(false); alert("うまくいきませんでした：\n" + e.message); });
}

function removeArticle() {
  var a = state.editing, type = state.type;
  if (!confirm("「" + a.title + "」を削除します。もとに戻せません。よろしいですか？")) return;
  state.data[type] = state.data[type].filter(function (x) { return x.slug !== a.slug; });
  setBusy(true, "削除しています…");

  Promise.all([getFile("index.html"), getFile("news/index.html"), getFile("blog/index.html")])
    .then(function (r) {
      var files = [
        { path: "content/" + type + ".json", content: JSON.stringify(state.data[type], null, 2) + "\n" },
        { path: type + "/" + a.slug + ".html", remove: true }
      ];
      if (r[0]) {
        var h = r[0].text;
        h = replaceBetween(h, "NEWS_LIST", "\n" + listHtml("news", state.data.news, 3, "") + "\n    ");
        h = replaceBetween(h, "BLOG_LIST", "\n" + listHtml("blog", state.data.blog, 3, "") + "\n    ");
        files.push({ path: "index.html", content: h });
      }
      if (r[1]) files.push({ path: "news/index.html",
        content: replaceBetween(r[1].text, "NEWS_LIST", "\n" + listHtml("news", state.data.news, 0, "../") + "\n    ") });
      if (r[2]) files.push({ path: "blog/index.html",
        content: replaceBetween(r[2].text, "BLOG_LIST", "\n" + listHtml("blog", state.data.blog, 0, "../") + "\n    ") });
      return commitFiles(files, "記事を削除: " + a.title);
    })
    .then(function () { setBusy(false); toast("削除しました"); show("list"); renderList(); })
    .catch(function (e) { setBusy(false); alert("削除できませんでした：\n" + e.message); });
}

/* 全記事をテンプレートから作り直す（デザイン変更後に使う） */
function rebuildAll() {
  if (!confirm("公開中のすべての記事ページを、今のデザインで作り直します。よろしいですか？")) return;
  setBusy(true, "作り直しています…");
  Promise.all([getFile("templates/article.html"), getFile("index.html"),
               getFile("news/index.html"), getFile("blog/index.html")])
    .then(function (r) {
      if (!r[0]) throw new Error("templates/article.html が見つかりません");
      var tpl = r[0].text, files = [];
      ["news", "blog"].forEach(function (type) {
        state.data[type].filter(function (a) { return a.published; }).forEach(function (a) {
          files.push({ path: type + "/" + a.slug + ".html", content: articleHtml(tpl, type, a) });
        });
      });
      if (r[1]) {
        var h = r[1].text;
        h = replaceBetween(h, "NEWS_LIST", "\n" + listHtml("news", state.data.news, 3, "") + "\n    ");
        h = replaceBetween(h, "BLOG_LIST", "\n" + listHtml("blog", state.data.blog, 3, "") + "\n    ");
        files.push({ path: "index.html", content: h });
      }
      if (r[2]) files.push({ path: "news/index.html",
        content: replaceBetween(r[2].text, "NEWS_LIST", "\n" + listHtml("news", state.data.news, 0, "../") + "\n    ") });
      if (r[3]) files.push({ path: "blog/index.html",
        content: replaceBetween(r[3].text, "BLOG_LIST", "\n" + listHtml("blog", state.data.blog, 0, "../") + "\n    ") });
      if (!files.length) throw new Error("作り直す記事がありません");
      return commitFiles(files, "サイト全体を作り直し");
    })
    .then(function () { setBusy(false); toast("作り直しました", 3200); })
    .catch(function (e) { setBusy(false); alert("できませんでした：\n" + e.message); });
}

function setBusy(on, note) {
  ["btn-publish", "btn-draft", "btn-delete", "btn-back", "btn-rebuild"].forEach(function (id) {
    if ($(id)) $(id).disabled = on;
  });
  if (note) $("bar-note").textContent = note;
}

/* ---------------------------------------------------------------
   画像アップロード
   --------------------------------------------------------------- */
var uploadTarget = "body";   // "body" か "cover"

function uploadImage(file) {
  var safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
  var d = new Date(), p = function (n) { return String(n).padStart(2, "0"); };
  var path = "assets/img/uploads/" + d.getFullYear() + p(d.getMonth() + 1) + "-" +
             Math.random().toString(36).slice(2, 6) + "-" + safe;

  setBusy(true, "写真を送っています…");
  var reader = new FileReader();
  reader.onload = function () {
    var b64 = reader.result.split(",")[1];
    api("/contents/" + encodeURI(path), {
      method: "PUT",
      body: { message: "画像を追加: " + safe, content: b64, branch: cfg.branch }
    })
      .then(function () {
        var url = path;
        if (uploadTarget === "cover") {
          $("cover").value = url;
        } else {
          var ta = $("body"), pos = ta.selectionStart;
          var md = "\n\n![](" + url + ")\n\n";
          ta.value = ta.value.slice(0, pos) + md + ta.value.slice(pos);
          renderPreview();
        }
        setBusy(false, "");
        toast("写真を入れました");
      })
      .catch(function (e) { setBusy(false, ""); alert("写真を送れませんでした：\n" + e.message); });
  };
  reader.readAsDataURL(file);
}

/* ---------------------------------------------------------------
   ツールバー
   --------------------------------------------------------------- */
function wrapSel(before, after, placeholder) {
  var ta = $("body"), s = ta.selectionStart, e = ta.selectionEnd;
  var sel = ta.value.slice(s, e) || placeholder;
  ta.value = ta.value.slice(0, s) + before + sel + after + ta.value.slice(e);
  ta.focus();
  ta.selectionStart = s + before.length;
  ta.selectionEnd = s + before.length + sel.length;
  renderPreview();
}

/* ---------------------------------------------------------------
   イベント登録
   --------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", function () {

  $("btn-save-cfg").addEventListener("click", function () {
    var btn = this;
    var c = {
      token: $("cfg-token").value.trim(),
      owner: $("cfg-owner").value.trim(),
      repo: $("cfg-repo").value.trim(),
      branch: $("cfg-branch").value.trim() || "main"
    };
    if (!c.token) {
      setupMsg("合いことばが入っていません。GitHubで出てきた文字を貼り付けてください。", false); return;
    }
    if (!c.owner || !c.repo) {
      setupMsg("つなぎ先がわかりませんでした。下の「くわしい設定」で入力してください。", false); return;
    }
    saveCfg(c);
    btn.disabled = true; btn.textContent = "つないでいます…";
    api("")
      .then(function () {
        setupMsg("つながりました。記事を書きはじめられます。", true);
        setTimeout(function () { show("list"); loadAll(); }, 900);
      })
      .catch(function (e) {
        btn.disabled = false; btn.textContent = "つなぐ";
        var m = e.message;
        if (/トークン|Bad credentials/i.test(m)) {
          m = "合いことばが正しくないようです。前後によけいな空白が入っていないか確認して、もう一度貼り付けてください。";
        } else if (/Not Found/i.test(m)) {
          m = "つなぎ先のサイトが見つかりませんでした（" + c.owner + " / " + c.repo + "）。" +
              "下の「くわしい設定」で確認してください。";
        }
        setupMsg("つながりませんでした。" + m, false);
      });
  });

  // 貼り付けたらすぐエラー表示を消す
  $("cfg-token").addEventListener("input", function () { $("setup-msg").className = "setup-msg hide"; });

  $("btn-logout").addEventListener("click", function () {
    if (!confirm("この端末からトークンを消します。よろしいですか？")) return;
    localStorage.removeItem(CFG_KEY); location.reload();
  });

  Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) {
    t.addEventListener("click", function () {
      document.querySelectorAll(".tab").forEach(function (x) { x.classList.remove("on"); });
      t.classList.add("on");
      state.type = t.getAttribute("data-type");
      renderList();
    });
  });

  $("btn-new").addEventListener("click", function () { openEditor(null); });
  $("btn-back").addEventListener("click", function () {
    if (confirm("保存していない変更は消えます。一覧へ戻りますか？")) { loadAll(); show("list"); }
  });
  $("btn-draft").addEventListener("click", function () { save(false); });
  $("btn-publish").addEventListener("click", function () { save(true); });
  $("btn-delete").addEventListener("click", removeArticle);
  $("btn-rebuild").addEventListener("click", rebuildAll);

  $("body").addEventListener("input", renderPreview);

  $("btn-img").addEventListener("click", function () { uploadTarget = "body"; $("file").click(); });
  $("btn-cover").addEventListener("click", function () { uploadTarget = "cover"; $("file").click(); });
  $("file").addEventListener("change", function () {
    if (this.files[0]) uploadImage(this.files[0]);
    this.value = "";
  });

  Array.prototype.forEach.call(document.querySelectorAll("[data-md]"), function (b) {
    b.addEventListener("click", function () {
      switch (b.getAttribute("data-md")) {
        case "h2":    wrapSel("\n\n## ", "\n\n", "大見出し"); break;
        case "h3":    wrapSel("\n\n### ", "\n\n", "小見出し"); break;
        case "b":     wrapSel("**", "**", "太字にする文字"); break;
        case "link":  wrapSel("[", "](https://)", "リンクの文字"); break;
        case "ul":    wrapSel("\n\n- ", "\n\n", "箇条書きの項目"); break;
        case "quote": wrapSel("\n\n> ", "\n\n", "引用する文章"); break;
      }
    });
  });

  boot();
});
