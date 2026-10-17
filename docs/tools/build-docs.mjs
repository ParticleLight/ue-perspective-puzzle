#!/usr/bin/env node
/* Build the paper-style static document: content/**.md -> index.html */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { md, esc } from "./md.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const CONTENT = path.join(ROOT, "content");
const SECTIONS = path.join(CONTENT, "sections");

function parseFront(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const data = {};
  let body = text;
  if (m) {
    body = text.slice(m[0].length);
    m[1].split(/\r?\n/).forEach(function (line) {
      const i = line.indexOf(":");
      if (i > 0) data[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    });
  }
  return { data: data, body: body };
}

function countOf(hay, needle) {
  return hay.split(needle).length - 1;
}

const front = parseFront(fs.readFileSync(path.join(CONTENT, "front.md"), "utf8"));
const files = fs.existsSync(SECTIONS) ? fs.readdirSync(SECTIONS).filter(function (f) { return f.endsWith(".md"); }) : [];
const chapters = files.map(function (f) {
  const parsed = parseFront(fs.readFileSync(path.join(SECTIONS, f), "utf8"));
  return { file: f, num: Number(parsed.data.chapter || 999), title: parsed.data.title || f, body: parsed.body };
}).sort(function (a, b) { return a.num - b.num; });

const LABELS = { 90: "附录", 91: "参考文献" };
const toc = [];
let htmlBody = "", chars = 0, codeCount = 0, tableCount = 0, figCount = 0;

chapters.forEach(function (ch) {
  const isSpecial = ch.num >= 90;
  const id = isSpecial ? (ch.num === 90 ? "appendix" : "references") : "ch" + ch.num;
  const heading = isSpecial ? (LABELS[ch.num] || ch.title) : ch.title;
  const rendered = md(ch.body);
  chars += ch.body.replace(/\s+/g, "").length;
  codeCount += Math.round((ch.body.match(/^[ \t]*\x60{3}/gm) || []).length / 2);
  tableCount += (rendered.match(/<table>/g) || []).length;
  figCount += (rendered.match(/<figure>/g) || []).length;
  htmlBody += '\n<section class="chapter' + (isSpecial ? " special" : "") + '" id="' + id + '">\n' +
    '<h2><a class="anchor" href="#' + id + '" aria-label="链接到本节">#</a>' +
    (isSpecial ? "" : '<span class="cnum">' + ch.num + "</span>") + esc(heading) + "</h2>\n" +
    rendered + "\n</section>\n";
  const subs = [];
  const re = /<h3 id="([^"]+)">([\s\S]*?)<\/h3>/g;
  let m;
  while ((m = re.exec(rendered)) !== null) {
    const plain = m[2].replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim();
    subs.push({ id: m[1], text: plain });
  }
  toc.push({ id: id, num: ch.num, label: isSpecial ? heading : ch.num + "  " + ch.title, subs: subs });
});

/* 摘要里的「关键词」段落单独提出来，放到摘要框下方（参考论文页的版式） */
let abstractHtml = md(front.body);
let keywordsHtml = "";
const kwMatch = abstractHtml.match(/<p><strong>关键词<\/strong>[：:]?([\s\S]*?)<\/p>/);
if (kwMatch) {
  keywordsHtml = "<strong>关键词：</strong>" + kwMatch[1].trim();
  abstractHtml = abstractHtml.replace(kwMatch[0], "").trim();
}

const readMin = Math.max(1, Math.round(chars / 420));
const stats = "全文约 " + (chars / 10000).toFixed(1) + " 万字，含 " + codeCount + " 段代码、" + tableCount + " 张表、" + figCount + " 幅插图；按中文技术文档的常规速度估计，通读约需 " + readMin + " 分钟。";

const tocHtml = toc.map(function (t) {
  return '<li class="toc-chapter"><a href="#' + t.id + '">' + esc(t.label) + "</a>" +
    (t.subs.length ? "<ul>" + t.subs.map(function (s) { return '<li><a href="#' + s.id + '">' + esc(s.text) + "</a></li>"; }).join("") + "</ul>" : "") +
    "</li>";
}).join("\n");

let page = fs.readFileSync(path.join(HERE, "page-template.html"), "utf8");
const map = {
  TITLE: esc(front.data.title || "技术文档"),
  SHORTTITLE: esc(front.data.shortTitle || front.data.title || ""),
  TITLE_EN: esc(front.data.titleEn || ""),
  SUBTITLE: esc(front.data.subtitle || ""),
  DESCRIPTION: esc(front.data.subtitle || ""),
  AUTHORS: esc(front.data.authors || ""),
  DATE: esc(front.data.date || ""),
  SOURCE: esc(front.data.source || ""),
  DOCTYPE: esc(front.data.doctype || "技术报告"),
  TOC: tocHtml,
  STATS: esc(stats),
  ABSTRACT: abstractHtml,
  KEYWORDS: keywordsHtml,
  BODY: htmlBody,
  GENERATED: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
  ASSETVER: Date.now().toString(36)
};
Object.keys(map).forEach(function (k) {
  page = page.split("{{" + k + "}}").join(map[k]);
});
const leftover = page.match(/\{\{[A-Z]+\}\}/g);
if (leftover) console.error("WARNING: unresolved placeholders:", leftover.join(","));
const ctrl = page.match(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g);
if (ctrl) {
  console.error("ERROR: 生成结果中残留 " + ctrl.length + " 个控制字符（通常是 Markdown 预处理留下的占位符），已中止构建。");
  process.exit(1);
}

fs.writeFileSync(path.join(ROOT, "index.html"), page, "utf8");
console.log("chapters: " + chapters.map(function (c) { return c.num + ":" + c.file; }).join(", "));
console.log("chars=" + chars + " codeBlocks=" + codeCount + " tables=" + tableCount + " figures=" + figCount);
console.log("missing chapters: " + [1,2,3,4,5,6,7,8,9,90,91].filter(function (n) { return !chapters.some(function (c) { return c.num === n; }); }).join(",") || "none");
console.log("index.html bytes: " + Buffer.byteLength(page, "utf8"));
