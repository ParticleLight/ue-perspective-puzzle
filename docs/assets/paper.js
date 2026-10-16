/* 论文页交互：进度、主题、打印、目录过滤、滚动定位、代码复制（零依赖） */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* theme */
  var saved = null;
  try { saved = localStorage.getItem("paper-theme"); } catch (e) {}
  var initial = saved || "light";
  document.documentElement.setAttribute("data-theme", initial);
  $("#btnTheme").addEventListener("click", function () {
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("paper-theme", next); } catch (e) {}
  });

  /* print */
  $("#btnPrint").addEventListener("click", function () { window.print(); });

  /* mobile toc drawer */
  var tocBtn = $("#btnToc");
  if (tocBtn) tocBtn.addEventListener("click", function () { document.body.classList.toggle("toc-open"); });
  document.addEventListener("click", function (e) {
    if (window.innerWidth > 1180) return;
    if (!document.body.classList.contains("toc-open")) return;
    if (e.target.closest(".sidebar") || e.target.closest("#btnToc")) return;
    document.body.classList.remove("toc-open");
  });
  $$(".toc a").forEach(function (a) {
    a.addEventListener("click", function () {
      if (window.innerWidth <= 1180) document.body.classList.remove("toc-open");
    });
  });

  /* progress + back to top */
  var bar = $("#progressBar");
  function onScroll() {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + "%";
  }
  document.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  $("#btnTop").addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });

  /* toc filter */
  var filter = $("#tocFilter");
  if (filter) {
    filter.addEventListener("input", function () {
      var q = filter.value.trim().toLowerCase();
      $$("#toc .toc-chapter").forEach(function (li) {
        var text = li.textContent.toLowerCase();
        var hit = !q || text.indexOf(q) !== -1;
        li.classList.toggle("filtered", !hit);
      });
    });
    filter.addEventListener("keydown", function (e) { if (e.key === "Escape") { filter.value = ""; filter.dispatchEvent(new Event("input")); } });
  }

  /* scroll spy */
  var links = {};
  $$("#toc a").forEach(function (a) {
    var id = (a.getAttribute("href") || "").slice(1);
    if (id) links[id] = a;
  });
  var targets = $$(".body h2[id], .body h3[id]");
  var sidebar = $("#sidebar");
  if ("IntersectionObserver" in window && targets.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var a = links[en.target.id];
        if (!a) return;
        $$("#toc a.active").forEach(function (x) { x.classList.remove("active"); });
        a.classList.add("active");
        var r = a.getBoundingClientRect(), sr = sidebar.getBoundingClientRect();
        if (r.top < sr.top + 40 || r.bottom > sr.bottom - 40) a.scrollIntoView({ block: "nearest" });
      });
    }, { rootMargin: "-72px 0px -72% 0px", threshold: 0 });
    targets.forEach(function (t) { io.observe(t); });
  }

  /* copy buttons */
  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest ? e.target.closest(".code-wrap .copy") : null;
    if (!btn) return;
    var pre = btn.parentNode.querySelector("pre.code");
    var text = pre ? pre.textContent : "";
    var done = function () {
      btn.textContent = "已复制";
      btn.classList.add("done");
      setTimeout(function () { btn.textContent = "复制"; btn.classList.remove("done"); }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { done(); });
    } else { done(); }
  });

  /* deep link highlight */
  function jump() {
    var id = location.hash.slice(1);
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: "start" });
  }
  window.addEventListener("hashchange", jump);
  if (location.hash) setTimeout(jump, 80);
})();
