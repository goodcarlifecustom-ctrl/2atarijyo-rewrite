#!/usr/bin/env node

import { access, appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const FALLBACK = "追加確認が必要";
const ARTICLE_DIR = process.argv[2] || "articles/sample-article";
const rewrittenPath = path.join(ARTICLE_DIR, "rewritten.html");
const originalPath = path.join(ARTICLE_DIR, "original.html");
const resultPath = path.join(ARTICLE_DIR, "comparison-table.json");
const changeLogPath = path.join(ARTICLE_DIR, "change-log.md");

const includeKeywords = ["おすすめ", "ランキング", "比較", "アプリ", "サービス", "店舗", "商品", "紹介", "選び方", "人気", "厳選"];
const excludeKeywords = ["faq", "よくある質問", "質問", "まとめ", "注意点", "注意", "デメリット", "目次", "この記事でわかること"];
const serviceKeywords = ["アプリ", "出会い", "サービス", "サイト", "公式", "登録", "料金", "ポイント", "会員"];
const shopKeywords = ["店舗", "スポット", "エリア", "住所", "アクセス", "場所", "店", "サロン"];

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function stripTags(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function attrValue(attrs, name) {
  const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match ? match[2] : "";
}

function isInternalOrTocLink(href) {
  if (!href) return true;
  const normalized = href.trim();
  return normalized.startsWith("#") || normalized.startsWith("/") || normalized.startsWith("javascript:") || normalized.startsWith("mailto:") || normalized.startsWith("tel:");
}

function findNearbyLink(htmlFragment) {
  for (const match of htmlFragment.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attrValue(match[1], "href");
    const label = stripTags(match[2]) || "公式サイト";
    if (!isInternalOrTocLink(href)) return { href, label };
  }
  return null;
}

function extractSentence(text, keywords) {
  const sentences = text.split(/[。！？!?\n]/).map((s) => s.trim()).filter(Boolean);
  const found = sentences.find((sentence) => keywords.some((keyword) => sentence.includes(keyword)) && sentence.length >= 8);
  if (!found) return FALLBACK;
  return found.length > 90 ? `${found.slice(0, 87)}…` : found;
}

function headingText(rawHeading) {
  return stripTags(rawHeading).replace(/^\s*\d+[.．、位)]\s*/, "").trim();
}

function shouldExcludeHeading(text, contextText) {
  const combined = `${text} ${contextText}`.toLowerCase();
  return excludeKeywords.some((keyword) => combined.includes(keyword));
}

function contextIsRelevant(text) {
  return includeKeywords.some((keyword) => text.includes(keyword));
}

function parseHeadingSections(html) {
  const matches = [...html.matchAll(/<h([23])\b[^>]*>[\s\S]*?<\/h\1>/gi)].map((match) => ({
    level: Number(match[1]),
    raw: match[0],
    text: headingText(match[0]),
    index: match.index,
  }));

  return matches.map((heading, i) => {
    const nextIndex = matches[i + 1]?.index ?? html.length;
    const body = html.slice(heading.index + heading.raw.length, nextIndex);
    const parentH2 = heading.level === 2
      ? heading.text
      : [...matches.slice(0, i)].reverse().find((candidate) => candidate.level === 2)?.text || "";
    return { ...heading, body, parentH2 };
  });
}

function extractCandidates(html) {
  const sections = parseHeadingSections(html);
  const candidates = [];

  for (const section of sections) {
    if (section.level !== 3) continue;
    const contextText = `${section.parentH2} ${section.text}`;
    if (!contextIsRelevant(contextText)) continue;
    if (shouldExcludeHeading(section.text, contextText)) continue;
    const bodyText = stripTags(section.body);
    const link = findNearbyLink(section.body.slice(0, 2500));
    candidates.push({
      name: section.text,
      feature: extractSentence(bodyText, ["特徴", "メリット", "おすすめ", "強み", "人気", "便利"]),
      price: extractSentence(bodyText, ["料金", "費用", "無料", "有料", "円", "ポイント", "月額", "価格"]),
      suitableFor: extractSentence(bodyText, ["向いて", "おすすめ", "人", "初心者", "利用", "選びたい"]),
      caution: extractSentence(bodyText, ["注意", "デメリット", "ただし", "一方", "確認", "リスク"]),
      link,
    });
  }

  const unique = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const key = candidate.name.replace(/\s+/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }
  return unique.slice(0, 10);
}

function detectColumns(html) {
  const text = stripTags(html);
  if (shopKeywords.some((keyword) => text.includes(keyword))) {
    return ["名称", "特徴", "エリア", "向いている人", "注意点", "公式サイト・詳細"];
  }
  if (serviceKeywords.some((keyword) => text.includes(keyword))) {
    return ["サービス名", "特徴", "料金・費用感", "向いている人", "注意点", "公式サイト・詳細"];
  }
  return ["比較項目", "特徴", "メリット", "注意点", "向いている人", "詳細"];
}

function buildTable(candidates, columns) {
  const header = columns.map((column) => `        <th style="width: 150px;">${escapeHtml(column)}</th>`).join("\n");
  const rows = candidates.map((candidate) => {
    const linkCell = candidate.link
      ? `<a href="${escapeHtml(candidate.link.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(candidate.link.label || "公式サイト")}</a>`
      : FALLBACK;
    const third = columns[2] === "エリア" || columns[2] === "メリット" ? candidate.feature : candidate.price;
    return `      <tr>\n        <td><strong>${escapeHtml(candidate.name)}</strong></td>\n        <td>${escapeHtml(candidate.feature)}</td>\n        <td>${escapeHtml(third)}</td>\n        <td>${escapeHtml(candidate.suitableFor)}</td>\n        <td>${escapeHtml(candidate.caution)}</td>\n        <td>${linkCell}</td>\n      </tr>`;
  }).join("\n");

  return `<div class="comparison-table-block" style="overflow-x: auto; width: 100%; -webkit-overflow-scrolling: touch;">\n  <table border="1" cellpadding="10" cellspacing="0" style="width: 100%; table-layout: fixed;">\n    <thead>\n      <tr>\n${header}\n      </tr>\n    </thead>\n    <tbody>\n${rows}\n    </tbody>\n  </table>\n</div>`;
}

function hasComparisonTable(html) {
  return /class=["'][^"']*comparison-table-block/i.test(html) || /<table\b[\s\S]*?(比較項目|サービス名|公式サイト・詳細|料金・費用感)[\s\S]*?<\/table>/i.test(html);
}

function findInsertion(html) {
  const wakaru = html.match(/この記事でわかること[\s\S]*?(<\/ul>|<\/ol>)/i);
  if (wakaru?.index !== undefined) return { index: wakaru.index + wakaru[0].length, label: "「この記事でわかること」リストの直後" };

  const recommendH2 = html.match(/<h2\b[^>]*>[\s\S]*?(おすすめ|ランキング)[\s\S]*?<\/h2>/i);
  if (recommendH2?.index !== undefined) return { index: recommendH2.index, label: "おすすめ・ランキング系H2の直前" };

  const compareH2 = html.match(/<h2\b[^>]*>[\s\S]*?(比較|選び方)[\s\S]*?<\/h2>/i);
  if (compareH2?.index !== undefined) return { index: compareH2.index, label: "最初の比較・選び方系H2の直前" };

  return { index: 0, label: "記事冒頭" };
}

function insertTable(html, tableHtml) {
  const insertion = findInsertion(html);
  return { html: `${html.slice(0, insertion.index)}\n\n${tableHtml}\n\n${html.slice(insertion.index)}`, insertionLabel: insertion.label };
}

const sourcePath = await exists(rewrittenPath) ? rewrittenPath : (await exists(originalPath) ? originalPath : null);
if (!sourcePath) {
  console.error(`${rewrittenPath} または ${originalPath} が見つかりません。`);
  process.exit(1);
}

const html = await readFile(sourcePath, "utf8");
const candidates = extractCandidates(html);
const alreadyExists = hasComparisonTable(html);
let outputHtml = html;
let inserted = false;
let insertionLabel = "";
let reason = "";

if (alreadyExists) {
  reason = "既存の比較表があるため、新規作成は行いませんでした。";
} else if (candidates.length < 2) {
  reason = "比較候補が2件未満のため、比較表を作成しませんでした。";
} else {
  const tableHtml = buildTable(candidates, detectColumns(html));
  const insertedResult = insertTable(html, tableHtml);
  outputHtml = insertedResult.html;
  insertionLabel = insertedResult.insertionLabel;
  inserted = true;
  await mkdir(ARTICLE_DIR, { recursive: true });
  await writeFile(rewrittenPath, outputHtml, "utf8");
}

const fallbackFields = candidates.flatMap((candidate) => ["feature", "price", "suitableFor", "caution"].filter((field) => candidate[field] === FALLBACK).map((field) => `${candidate.name}:${field}`));
const result = {
  ok: true,
  generatedAt: new Date().toISOString(),
  articleDir: ARTICLE_DIR,
  sourcePath,
  rewrittenPath,
  inserted,
  insertionLabel: inserted ? insertionLabel : null,
  reason: inserted ? null : reason,
  extractedCandidateCount: candidates.length,
  tableItemCount: inserted ? candidates.length : 0,
  fallbackFields,
  externalAccess: "公式サイトへの追加アクセスなし。記事内リンク周辺本文から抽出。",
  candidates,
};

await mkdir(ARTICLE_DIR, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

const log = `\n## 比較表作成・挿入（${new Date().toISOString()}）\n\n- 挿入位置: ${inserted ? insertionLabel : "未挿入"}\n- 抽出した候補数: ${candidates.length}\n- 表に入れた項目数: ${inserted ? candidates.length : 0}\n- 情報不足で「追加確認が必要」とした項目: ${fallbackFields.length ? fallbackFields.join(", ") : "なし"}\n- 公式サイトまたは外部ページへのアクセス確認: 追加アクセスなし\n- ${inserted ? "比較表を作成・挿入しました。" : `比較表を作成しなかった理由: ${reason}`}\n`;
await appendFile(changeLogPath, log, "utf8");

console.log(`比較表処理結果を保存しました: ${resultPath}`);
console.log(inserted ? `比較表を挿入しました: ${rewrittenPath}` : reason);
