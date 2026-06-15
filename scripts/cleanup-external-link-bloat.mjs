#!/usr/bin/env node

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const articleDir = process.argv[2] || "articles/sample-article";
const rewrittenPath = path.join(articleDir, "rewritten.html");
const reportPath = path.join(articleDir, "check-report.md");

function normalizeText(value) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForDuplicate(value) {
  return normalizeText(value)
    .replace(/[ァ-ヶー一-龠々〆ヵヶぁ-んA-Za-z0-9]+に関する出会い/g, "〇〇に関する出会い")
    .replace(/[ァ-ヶー一-龠々〆ヵヶぁ-んA-Za-z0-9]+で失敗しないためには/g, "〇〇で失敗しないためには")
    .replace(/\s+/g, "");
}

function linkHrefs(fragment) {
  return [...fragment.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>/gi)].map((m) => m[2]);
}

const genericPatterns = [
  /匿名性の高さだけに頼らず.*?(個人情報保護委員会|e-Gov法令検索)/,
  /プロフィールの誠実さ、合意形成、個人情報保護、相手への敬意/,
  /アフィリエイト導線としておすすめアプリを紹介する場合も/,
];

const sectionTitlePatterns = [
  /安全に使うためのチェックリスト/,
  /よくある質問/,
];

let html = await readFile(rewrittenPath, "utf8");
const originalHtml = html;
const removedParagraphs = [];
const removedLinks = [];
const keptLinks = new Set();
const seenParagraphs = new Map();
let publicLinkAlreadyKept = false;

html = html.replace(/<p\b[^>]*>[\s\S]*?<\/p>/gi, (paragraph) => {
  const text = normalizeText(paragraph);
  const key = normalizeForDuplicate(paragraph);
  const hrefs = linkHrefs(paragraph);
  const isGeneric = genericPatterns.some((pattern) => pattern.test(text));
  const hasPublicLink = hrefs.some((href) => /ppc\.go\.jp|e-gov\.go\.jp|npa\.go\.jp|caa\.go\.jp|gov|go\.jp/.test(href));

  if (isGeneric) {
    if (publicLinkAlreadyKept || !hasPublicLink) {
      removedParagraphs.push({ reason: "H3直下などに繰り返された汎用安全・導線文", text, hrefs });
      removedLinks.push(...hrefs);
      return "";
    }
    publicLinkAlreadyKept = true;
    hrefs.forEach((href) => keptLinks.add(href));
  }

  if (seenParagraphs.has(key)) {
    removedParagraphs.push({ reason: "完全一致またはKW差し替え類似のpタグ重複", text, hrefs });
    removedLinks.push(...hrefs);
    return "";
  }

  seenParagraphs.set(key, true);
  hrefs.forEach((href) => keptLinks.add(href));
  return paragraph;
});

for (const titlePattern of sectionTitlePatterns) {
  let seen = false;
  html = html.replace(/<h2\b[^>]*>[\s\S]*?<\/h2>[\s\S]*?(?=<h2\b|$)/gi, (section) => {
    const title = normalizeText(section.match(/<h2\b[^>]*>[\s\S]*?<\/h2>/i)?.[0] || "");
    if (!titlePattern.test(title)) return section;
    if (!seen) {
      seen = true;
      linkHrefs(section).forEach((href) => keptLinks.add(href));
      return section;
    }
    removedParagraphs.push({ reason: `重複セクション「${title}」`, text: title, hrefs: linkHrefs(section) });
    removedLinks.push(...linkHrefs(section));
    return "";
  });
}

function uniquifyHeadingIds(input) {
  const seenIds = new Map();
  return input.replace(/<(h[23])\b([^>]*)>/gi, (tag, name, attrs) => {
    const idMatch = attrs.match(/\bid\s*=\s*(["'])([^"']+)\1/i);
    if (!idMatch) return tag;
    const id = idMatch[2];
    const count = seenIds.get(id) || 0;
    seenIds.set(id, count + 1);
    if (count === 0) return tag;
    const nextId = `${id}-${count + 1}`;
    return `<${name}${attrs.replace(idMatch[0], `id=${idMatch[1]}${nextId}${idMatch[1]}`)}>`;
  });
}
html = uniquifyHeadingIds(html);
html = html.replace(/\n{3,}/g, "\n\n");

await writeFile(rewrittenPath, html, "utf8");

const exactParagraphCounts = new Map();
for (const match of html.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/gi)) {
  const key = normalizeText(match[0]);
  if (!key) continue;
  exactParagraphCounts.set(key, (exactParagraphCounts.get(key) || 0) + 1);
}
const exactDuplicates = [...exactParagraphCounts.entries()].filter(([, count]) => count >= 2);

const report = [
  "# 外部リンク重複チェックレポート",
  "",
  `- 対象HTML: \`${rewrittenPath}\``,
  `- HTML修正: ${html === originalHtml ? "変更なし" : "変更あり"}`,
  `- 削除した重複・汎用文: ${removedParagraphs.length}件`,
  `- 完全一致するpタグ（2回以上）: ${exactDuplicates.length}件`,
  "",
  "## 削除した重複文",
  ...(removedParagraphs.length ? removedParagraphs.map((item, index) => `${index + 1}. ${item.reason}: ${item.text}`) : ["- なし"]),
  "",
  "## 残した外部リンク",
  ...([...keptLinks].length ? [...keptLinks].map((href) => `- ${href}`) : ["- なし"]),
  "",
  "## 削除した外部リンク",
  ...([...new Set(removedLinks)].length ? [...new Set(removedLinks)].map((href) => `- ${href}`) : ["- なし"]),
  "",
  "## 完全一致pタグ重複",
  ...(exactDuplicates.length ? exactDuplicates.map(([text, count]) => `- ${count}回: ${text}`) : ["- なし"]),
  "",
].join("\n");

await mkdir(articleDir, { recursive: true });
await writeFile(reportPath, report, "utf8");
console.log(`外部リンク重複チェック結果を保存しました: ${reportPath}`);
if (exactDuplicates.length > 0) process.exitCode = 1;
