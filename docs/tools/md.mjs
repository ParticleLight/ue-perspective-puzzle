/* Minimal Markdown -> HTML renderer for the paper (build-time, Node ESM). */
const FENCE = /\x60{3}([^\n\x60]*)\n([\s\S]*?)(?:\x60{3}|$)/g;
const INLINE_CODE = /\x60([^\x60\n]+)\x60/g;
const RAW_TAG = /<\/?(?:span|sub|sup|br|figure|figcaption|svg|g|path|rect|line|polyline|circle|ellipse|text|tspan|defs|marker|p|div|table|thead|tbody|tr|td|th|ul|ol|li|code|pre|em|strong|a|b|i|kbd|small)(?:\s[^<>]*)?\/?>/gi;

export function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const CPP_KEY = /\b(?:alignas|auto|bool|break|case|catch|char|class|const|constexpr|continue|default|delete|do|double|else|enum|explicit|extern|false|float|for|friend|goto|if|inline|int|int64|long|mutable|namespace|new|nullptr|operator|override|private|protected|public|register|return|short|signed|sizeof|static|struct|switch|template|this|throw|true|try|typedef|typename|union|unsigned|using|virtual|void|volatile|while|UE_NODISCARD|UE_LOG|TEXT|FVector|FVector2D|FVector2|BeginPlay|Super)\b/;
const LANG = {
  cpp: [["com", /\/\/[^\n]*|\/\*[\s\S]*?\*\//], ["str", /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/], ["pre", /^[ \t]*#[ \t]*[a-zA-Z_]+/m], ["key", CPP_KEY], ["num", /\b\d+(?:\.\d+)?[fFuUlL]*\b/]],
  json: [["com", /\/\/[^\n]*/], ["str", /"(?:\\.|[^"\\])*"(?=\s*:)/], ["str", /"(?:\\.|[^"\\])*"/], ["num", /-?\b\d+(?:\.\d+)?\b/], ["key", /\b(?:true|false|null)\b/]],
  bash: [["com", /#[^\n]*/], ["str", /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/], ["key", /\b(?:cd|ls|echo|export|if|then|else|fi|for|do|done|cat|mkdir|rm|cp|mv|curl|git|python|node|set|source|grep|head|tail|wc|which|sleep|exit)\b/], ["fn", /(?:^|[\s|&;(])(-{1,2}[A-Za-z][\w-]*)/m], ["num", /\b\d+\b/]],
  powershell: [["com", /#[^\n]*/], ["str", /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/], ["key", /\b(?:Get-ChildItem|Get-Content|Set-Content|Get-Item|Test-Path|Join-Path|Split-Path|Select-Object|Where-Object|ForEach-Object|Write-Host|Write-Output|New-Item|Copy-Item|Remove-Item|Start-Process|Get-Command|Get-ItemProperty|Get-Process|Out-File|Add-Content|ConvertTo-Json|if|else|foreach|param|function|return|true|false|null)\b/i], ["fn", /(?:^|[\s|;(])-{1,2}[A-Za-z][\w-]*/m], ["num", /\b\d+\b/]],
  text: []
};
LANG.c = LANG.cpp;
LANG.cmd = LANG.bash;

export function highlight(code, lang) {
  const rules = LANG[lang] === undefined ? LANG.text : LANG[lang];
  if (!rules.length) return esc(code);
  let re;
  try { re = new RegExp(rules.map((r) => "(" + r[1].source + ")").join("|"), "gm"); } catch (e) { return esc(code); }
  let out = "", last = 0, m, guard = 0;
  while ((m = re.exec(code)) !== null) {
    if (guard++ > 30000) break;
    if (m.index > last) out += esc(code.slice(last, m.index));
    let gi = -1;
    for (let i = 1; i < m.length; i++) { if (m[i] !== undefined) { gi = i - 1; break; } }
    const cls = gi >= 0 && rules[gi] ? rules[gi][0] : "text";
    out += '<span class="tok-' + cls + '">' + esc(m[0]) + "</span>";
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  return out + esc(code.slice(last));
}

export function codeBlock(code, lang) {
  const l = (lang || "text").toLowerCase();
  return '<div class="code-wrap"><button class="copy" type="button" aria-label="复制代码">复制</button>' +
    '<pre class="code" data-lang="' + esc(l) + '"><code>' + highlight(code.replace(/\n$/, ""), l) + "</code></pre></div>";
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^\w\u4e00-\u9fa5-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export function inline(s) {
  const raw = [], inl = [];
  s = String(s).replace(RAW_TAG, (m) => { raw.push(m); return "\u0001R" + (raw.length - 1) + "\u0001"; });
  s = s.replace(INLINE_CODE, (m, c) => { inl.push(c); return "\u0000I" + (inl.length - 1) + "\u0000"; });
  s = esc(s);
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[\s(（【[])\*([^*\n]+?)\*(?=[\s)）】\]，。；：、!？,.;:]|$)/g, "$1<em>$2</em>");
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (m, t, u) => '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + t + "</a>");
  s = s.replace(/\u0000I(\d+)\u0000/g, (m, i) => "<code>" + esc(inl[+i]) + "</code>");
  s = s.replace(/\u0001R(\d+)\u0001/g, (m, i) => raw[+i]);
  return s;
}

const RAW_BLOCK_START = /^<(figure|div|table|section|svg|details|p)\b/i;

export function md(src) {
  const fences = [];
  let s = String(src == null ? "" : src).replace(/\r\n?/g, "\n");
  s = s.replace(FENCE, (m, lang, code) => {
    fences.push({ lang: (lang || "").trim().toLowerCase(), code: code.replace(/\n$/, "") });
    return "\u0000F" + (fences.length - 1) + "\u0000";
  });
  const lines = s.split("\n"), out = [];
  let list = null, i = 0;
  const closeList = () => { if (list) { out.push("</" + list + ">"); list = null; } };
  const openList = (t) => { if (list !== t) { closeList(); out.push("<" + t + ">"); list = t; } };
  const cells = (r) => r.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

  while (i < lines.length) {
    const line = lines[i];
    let m;
    if ((m = line.match(/^\u0000F(\d+)\u0000$/))) { closeList(); const f = fences[+m[1]]; out.push(codeBlock(f.code, f.lang)); i++; continue; }
    if (!line.trim()) { closeList(); i++; continue; }

    if (RAW_BLOCK_START.test(line.trim())) {
      const tag = line.trim().match(RAW_BLOCK_START)[1].toLowerCase();
      const buf = [];
      const isP = tag === "p" || tag === "table" || tag === "div" || tag === "section";
      while (i < lines.length) {
        buf.push(lines[i]);
        const t = lines[i].trim();
        const closed = new RegExp("</" + tag + ">\\s*$", "i").test(t);
        i++;
        if (closed) break;
        if (isP && !t) break;
      }
      closeList();
      out.push(buf.join("\n"));
      continue;
    }

    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      closeList();
      const lvl = Math.min(Math.max(m[1].length, 2), 6);
      out.push("<h" + lvl + ' id="' + slug(m[2]) + '">' + inline(m[2]) + "</h" + lvl + ">");
      i++; continue;
    }
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { closeList(); out.push("<hr>"); i++; continue; }
    if (/^\s*\|.*\|\s*$/.test(line) && lines[i + 1] && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1]) && /-/.test(lines[i + 1])) {
      closeList();
      const head = line, rows = [];
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(lines[i]); i++; }
      let html = "<table><thead><tr>" + cells(head).map((c) => "<th>" + inline(c) + "</th>").join("") + "</tr></thead><tbody>";
      html += rows.map((r) => "<tr>" + cells(r).map((c) => "<td>" + inline(c) + "</td>").join("") + "</tr>").join("");
      out.push('<div class="table-wrap">' + html + "</tbody></table></div>");
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      closeList();
      const q = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { q.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
      out.push("<blockquote>" + md(q.join("\n")) + "</blockquote>");
      continue;
    }
    if ((m = line.match(/^\s*([-*+])\s+(.*)$/))) { openList("ul"); out.push("<li>" + inline(m[2]) + "</li>"); i++; continue; }
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { openList("ol"); out.push("<li>" + inline(m[1]) + "</li>"); i++; continue; }
    closeList();
    const para = [line]; i++;
    while (i < lines.length && lines[i].trim() &&
      !/^(#{1,6}\s|\s*[-*+]\s|\s*\d+[.)]\s|\s*>\s?|\u0000F\d+\u0000|\s*\|.*\|\s*$|<(figure|div|table|section|svg|details)\b)/.test(lines[i]) &&
      !/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])) { para.push(lines[i]); i++; }
    out.push("<p>" + inline(para.join("\n")) + "</p>");
  }
  closeList();
  return out.join("\n");
}
