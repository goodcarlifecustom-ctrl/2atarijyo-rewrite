#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const articleDir = "articles/sample-article";
const originalPath = path.join(articleDir, "original.html");
const rewrittenPath = path.join(articleDir, "rewritten.html");
const resultPath = path.join(articleDir, "validation-result.json");

const checks = [];
let hasError = false;

function addCheck(name, passed, message, details = {}) {
  checks.push({ name, passed, message, details });
  if (!passed) hasError = true;
}

async function readOptional(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function stripHtml(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, "")
    .trim();
}

function countHeadings(html, level) {
  return [...html.matchAll(new RegExp(`<h${level}\\b[^>]*>`, "gi"))].length;
}

function collectHeadingIds(html, level) {
  const ids = [];
  const re = new RegExp(`<h${level}\\b([^>]*)>`, "gi");
  for (const match of html.matchAll(re)) {
    const idMatch = match[1].match(/\bid\s*=\s*["']([^"']+)["']/i);
    if (idMatch) ids.push(idMatch[1]);
  }
  return ids;
}

function duplicates(values) {
  const seen = new Set();
  const dupes = new Set();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return [...dupes];
}

function countOccurrences(text, phrase) {
  return (text.match(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
}

function collectParagraphTexts(html) {
  return [...html.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/gi)]
    .map((match) => stripHtml(match[0]).replace(/\s+/g, " ").trim())
    .filter(Boolean);
}


function tableBlocks(html) {
  return [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)].map((match) => match[0]);
}

function isComparisonTable(tableHtml) {
  return /(比較項目|サービス名|名称|公式サイト・詳細|料金・費用感)/i.test(stripHtml(tableHtml));
}

function tableLinks(tableHtml) {
  return [...tableHtml.matchAll(/<a\b([^>]*)>/gi)].map((match) => match[1]);
}

function attrIncludes(attrs, name, expected) {
  const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  if (!match) return false;
  return match[2].split(/\s+/).includes(expected);
}

function likelyNeedsComparisonTable(html) {
  const text = stripHtml(html);
  const h3Count = countHeadings(html, 3);
  return h3Count >= 2 && /(おすすめ|ランキング|比較|アプリ|サービス|店舗|商品|紹介)/.test(text);
}

function hasSevereHtmlBreakage(html) {
  const stack = [];
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  const tagRe = /<\/?([a-z][a-z0-9-]*)(?:\s[^<>]*)?>/gi;

  for (const match of html.matchAll(tagRe)) {
    const full = match[0];
    const tag = match[1].toLowerCase();
    if (voidTags.has(tag) || full.endsWith("/>")) continue;
    if (full.startsWith("</")) {
      const last = stack.pop();
      if (last !== tag) return true;
    } else {
      stack.push(tag);
    }
  }

  return stack.length > 0;
}

const original = await readOptional(originalPath);
const rewritten = await readOptional(rewrittenPath);

addCheck("original_exists", original !== null, `${originalPath} が存在する`);
addCheck("rewritten_exists", rewritten !== null, `${rewrittenPath} が存在する`);

if (rewritten !== null) {
  addCheck("rewritten_not_empty", rewritten.trim().length > 0, "rewritten.html が空ではない", {
    bytes: Buffer.byteLength(rewritten, "utf8"),
  });
}

if (original !== null && rewritten !== null) {
  const originalTextLength = stripHtml(original).length;
  const rewrittenTextLength = stripHtml(rewritten).length;
  const lengthRatio = originalTextLength === 0 ? 1 : rewrittenTextLength / originalTextLength;
  addCheck("text_length_not_greatly_reduced", lengthRatio >= 0.9, "元記事より文字数が大きく減っていない", {
    originalTextLength,
    rewrittenTextLength,
    lengthRatio: Number(lengthRatio.toFixed(3)),
  });

  for (const level of [2, 3]) {
    const originalCount = countHeadings(original, level);
    const rewrittenCount = countHeadings(rewritten, level);
    const minAllowed = Math.max(0, Math.floor(originalCount * 0.8));
    addCheck(`h${level}_count_not_greatly_reduced`, rewrittenCount >= minAllowed, `H${level}の数が大きく減っていない`, {
      originalCount,
      rewrittenCount,
      minAllowed,
    });
  }

  for (const level of [2, 3]) {
    const ids = collectHeadingIds(rewritten, level);
    const dupes = duplicates(ids);
    addCheck(`h${level}_ids_unique`, dupes.length === 0, `H${level}のidが重複していない`, {
      ids,
      duplicates: dupes,
    });
  }

  const wakarukotoCount = countOccurrences(stripHtml(rewritten), "この記事でわかること");
  addCheck("wakarukoto_once", wakarukotoCount === 1, "「この記事でわかること」リストが1回だけ設置されている", {
    count: wakarukotoCount,
  });

  addCheck("html_not_severely_broken", !hasSevereHtmlBreakage(rewritten), "WordPressに貼り付け可能なHTMLとして大きく崩れていない");

  const paragraphTexts = collectParagraphTexts(rewritten);
  const duplicateParagraphs = duplicates(paragraphTexts);
  addCheck("p_tags_not_duplicated", duplicateParagraphs.length === 0, "完全一致するpタグが2回以上ない", {
    duplicateCount: duplicateParagraphs.length,
    duplicates: duplicateParagraphs,
  });

  const comparisonTables = tableBlocks(rewritten).filter(isComparisonTable);
  const needsComparison = likelyNeedsComparisonTable(rewritten);
  addCheck("comparison_table_not_duplicated", comparisonTables.length <= 1, "比較表が重複していない", {
    count: comparisonTables.length,
  });

  if (comparisonTables.length > 0) {
    const links = comparisonTables.flatMap(tableLinks);
    const missingTarget = links.filter((attrs) => !attrIncludes(attrs, "target", "_blank"));
    const missingRel = links.filter((attrs) => !attrIncludes(attrs, "rel", "noopener") || !attrIncludes(attrs, "rel", "noreferrer"));
    addCheck("comparison_table_links_have_target_blank", missingTarget.length === 0, "比較表内リンクに target=\"_blank\" が入っている", {
      linkCount: links.length,
      missingCount: missingTarget.length,
    });
    addCheck("comparison_table_links_have_rel", missingRel.length === 0, "比較表内リンクに rel=\"noopener noreferrer\" が入っている", {
      linkCount: links.length,
      missingCount: missingRel.length,
    });
    addCheck("comparison_table_has_no_empty_cells", !/<td[^>]*>\s*<\/td>/i.test(comparisonTables.join("\n")), "比較表に空のセルがない");
  } else {
    checks.push({
      name: "comparison_table_presence_warning",
      passed: true,
      message: needsComparison ? "比較表が必要な可能性があります（未設置でも自動失敗にはしません）" : "比較表が不要な記事として扱います",
      details: { likelyNeedsComparisonTable: needsComparison },
    });
  }

}

const result = {
  ok: !hasError,
  generatedAt: new Date().toISOString(),
  files: { originalPath, rewrittenPath },
  checks,
};

await mkdir(articleDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

console.log(`検証結果を保存しました: ${resultPath}`);
if (!result.ok) {
  console.error("検証に失敗した項目があります。");
  process.exit(1);
}
