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

  /* ---------- 2. お問い合わせフォーム ---------- */
  var form = document.getElementById("contact-form");
  if (!form) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var endpoint = form.getAttribute("action");

    // Formspree未設定のうちは、間違って送信されないよう案内だけ出す
    if (!endpoint || endpoint.indexOf("XXXXXXXX") !== -1) {
      alert(
        "お問い合わせフォームはまだ設定中です。\n" +
        "お急ぎの方は nuinuifactory@gmail.com までメールでご連絡ください。"
      );
      return;
    }

    var submit = form.querySelector("button[type=submit]");
    var label  = submit.textContent;
    submit.disabled = true;
    submit.textContent = "送信中…";

    fetch(endpoint, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" }
    })
      .then(function (res) {
        if (!res.ok) throw new Error("送信に失敗しました");
        location.href = form.dataset.thanks || "/thanks.html";
      })
      .catch(function () {
        alert(
          "送信できませんでした。通信環境をご確認のうえ、もう一度お試しください。\n" +
          "解決しない場合は nuinuifactory@gmail.com までご連絡ください。"
        );
        submit.disabled = false;
        submit.textContent = label;
      });
  });
})();
