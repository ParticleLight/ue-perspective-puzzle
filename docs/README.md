# 技术文档：透视图案拼接谜题的视角检测系统

本目录是《透视图案拼接谜题：基于方向—距离联合判据的视角检测系统》的在线版本，同时包含它的可复现源文件。

- 在线阅读：<https://particlelight.github.io/ue-perspective-puzzle/>
- 页面为纯静态资源：无框架、无外部依赖、可离线打开，可用浏览器打印导出 A4 版式的 PDF。

## 目录结构

```text
docs/
├─ index.html              由构建脚本生成，请勿手工编辑
├─ assets/paper.css        版式（含 A4 打印样式与深色主题）
├─ assets/paper.js         交互（目录定位、进度、主题、代码复制）
├─ content/front.md        标题、摘要、关键词
├─ content/sections/*.md   各章节正文（Markdown）
└─ tools/                  构建脚本
   ├─ md.mjs               Markdown → HTML 渲染（含轻量语法高亮）
   ├─ build-docs.mjs       读取 content/ 生成 index.html
   └─ page-template.html   HTML 模板
```

## 重新构建

```bash
node tools/build-docs.mjs
```

脚本按各章节 front matter 中的 `chapter` 编号排序生成正文与侧栏目录，并统计字数、代码段、表格与插图数量。

## 写作约定

- 章节文件只用 `###` 作为小节标题，并显式写出编号（如 `### 4.1 …`）；章标题由构建脚本生成。
- 表格标题写在表格上方：`<p class="caption">表 4-1 …</p>`；代码清单同理。
- 图使用内联 SVG：`<figure><svg …></svg><figcaption>图 4-1 …</figcaption></figure>`。
- 公式用 `<span class="eq">…</span>` 或 `<p class="eq">…</p>`。
