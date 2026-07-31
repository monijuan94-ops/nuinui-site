/* ぬいぬいふぁくとりー サイト共通スクリプト
   やっていることは2つだけです：
   1. スマホのハンバーガーメニューの開閉
   2. お問い合わせフォームの送信（Formspree）とサンクスページへの移動          */

(function () {
  "use strict";

  /* ---------- 1. ハンバーガーメニュー ---------- */
  var btn = document.querySelector(".hamburger");
  if (btn) {
    btn.addEventListener("click", function () {
      var open = document.body.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
    });
    // メニュー内のリンクを押したら閉じる
    document.querySelectorAll(".drawer a").forEach(function (a) {
      a.addEventListener("click", function () {
        document.body.classList.remove("is-open");
        document.body.style.overflow = "";
      });
    });
  }

  /* ---------- 2. お問い合わせ（Googleフォーム） ----------
     Googleフォームが貼られていればそれを表示し、まだなら
     メールでの案内を出す。切り替えは自動なので、フォームを
     貼り付けるだけで案内のほうは消えます。                        */
  var slot     = document.querySelector(".gform");
  var fallback = document.querySelector(".gform-fallback");
  if (slot && fallback) {
    var embedded = !!slot.querySelector("iframe");
    fallback.style.display = embedded ? "none" : "";
  }
})();
