/* 文档页交互：目录过滤、滚动定位、移动端目录、代码复制、打印（零依赖） */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* 主题：默认跟随系统，选择记入 localStorage */
  var themeBtn = $("#btnTheme");
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    document.documentElement.style.colorScheme = t === "dark" ? "dark" : "light";
    if (themeBtn) themeBtn.textContent = t === "dark" ? "浅色" : "深色";
  }
  (function () {
    var saved = null;
    try { saved = localStorage.getItem("paper-theme"); } catch (e) {}
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(saved || (prefersDark ? "dark" : "light"));
  })();
  if (themeBtn) themeBtn.addEventListener("click", function () {
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem("paper-theme", next); } catch (e) {}
  });

  var printBtn = $("#btnPrint");
  if (printBtn) printBtn.addEventListener("click", function () { window.print(); });

  var topBtn = $("#btnTop");
  if (topBtn) topBtn.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });

  /* 移动端目录抽屉 */
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

  /* 手风琴目录：只展开当前章，避免目录自身成为需要滚动的容器（滚轮被吞） */
  function chapterLiOf(a) { return a ? a.closest(".toc-chapter") : null; }
  function openChapterOf(a) {
    var li = chapterLiOf(a);
    if (!li) return;
    $$("#toc .toc-chapter.open").forEach(function (x) { if (x !== li) x.classList.remove("open"); });
    li.classList.add("open");
  }
  $$("#toc .toc-chapter").forEach(function (li) {
    var head = li.querySelector(":scope > a");
    if (head) head.addEventListener("click", function () { openChapterOf(head); });
  });
  var firstChapter = $("#toc .toc-chapter");
  if (firstChapter) firstChapter.classList.add("open");
  var activeLink = $("#toc a.active");
  if (activeLink) openChapterOf(activeLink);

  /* 目录过滤 */
  var filter = $("#tocFilter");
  if (filter) {
    filter.addEventListener("input", function () {
      var q = filter.value.trim().toLowerCase();
      document.body.classList.toggle("toc-filtering", !!q);
      $$("#toc .toc-chapter").forEach(function (li) {
        li.classList.toggle("filtered", !!q && li.textContent.toLowerCase().indexOf(q) === -1);
      });
    });
    filter.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { filter.value = ""; filter.dispatchEvent(new Event("input")); }
    });
  }

  /* 滚动定位：目录高亮 */
  var links = {};
  $$("#toc a").forEach(function (a) {
    var id = (a.getAttribute("href") || "").slice(1);
    if (id) links[id] = a;
  });
  var targets = $$(".body h2[id], .body h3[id]");
  var sidebar = $("#sidebar");
  if ("IntersectionObserver" in window && targets.length && sidebar) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var a = links[en.target.id];
        if (!a) return;
        $$("#toc a.active").forEach(function (x) { x.classList.remove("active"); });
        a.classList.add("active");
        openChapterOf(a);
        var r = a.getBoundingClientRect(), sr = sidebar.getBoundingClientRect();
        if (r.top < sr.top + 36) sidebar.scrollTop -= (sr.top + 36 - r.top);
        else if (r.bottom > sr.bottom - 36) sidebar.scrollTop += (r.bottom - (sr.bottom - 36));
      });
    }, { rootMargin: "-60px 0px -72% 0px", threshold: 0 });
    targets.forEach(function (t) { io.observe(t); });
  }

  /* 代码复制 */
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

  /* 锚点跳转 */
  function jump() {
    var id = location.hash.slice(1);
    if (!id) return;
    var el = document.getElementById(id);
    if (el) el.scrollIntoView({ block: "start" });
  }
  window.addEventListener("hashchange", jump);
  if (location.hash) setTimeout(jump, 80);
})();
