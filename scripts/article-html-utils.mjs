export const themeNoiseClassTokens = [
  "p-postList",
  "p-postList__title",
  "c-tabBody",
  "p-postListTabBody",
  "c-pagination",
  "page-numbers",
  "p-postListTabBody",
  "p-postListTab",
  "p-postListWrap",
  "p-postList__item",
  "p-postList__link",
  "p-postList__body",
  "p-postList__thumb",
  "p-postList__meta",
  "p-postList__cat",
  "p-postList__excerpt",
  "c-postThumb",
  "p-blogCard",
  "p-cardList",
  "p-relatedPosts",
  "related-posts",
  "l-sidebar",
  "p-sidebar",
  "c-widget",
  "l-footer",
  "p-footer",
  "l-header",
  "p-header",
  "p-breadcrumb",
  "l-nav",
  "p-gnav",
  "c-gnav",
];

export const themeNoiseTextPatterns = [
  /関連記事カード/u,
  /投稿一覧カード/u,
];

const contentClassTokens = [
  "post_content",
  "entry-content",
  "p-entry__content",
  "articleBody",
  "article-body",
  "c-postContent",
];

const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

export function stripHtml(html) {
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
    .replace(/\s+/g, " ")
    .trim();
}

export function removeNoise(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}

export function sliceElementByOpeningMatch(html, openingMatch) {
  const fullOpeningTag = openingMatch[0];
  const tagName = openingMatch[1].toLowerCase();
  const startIndex = openingMatch.index;
  const tagRegex = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "gi");
  tagRegex.lastIndex = startIndex + fullOpeningTag.length;
  let depth = 1;
  let match;
  while ((match = tagRegex.exec(html)) !== null) {
    const tag = match[0];
    if (tag.startsWith("</")) depth -= 1;
    else if (!tag.endsWith("/>") && !voidTags.has(tagName)) depth += 1;
    if (depth === 0) return html.slice(startIndex, tagRegex.lastIndex);
  }
  return "";
}

function hasAttrToken(openingTag, attr, tokens) {
  const m = openingTag.match(new RegExp(`\\b${attr}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  if (!m) return false;
  const value = m[2];
  return tokens.some((token) => value.split(/\s+/).includes(token) || value.includes(token));
}

function findElementsByClass(html, tokens) {
  const elements = [];
  const re = /<([a-z0-9]+)\b[^>]*\bclass\s*=\s*(["'])(.*?)\2[^>]*>/gi;
  for (const m of html.matchAll(re)) {
    if (!tokens.some((token) => m[3].split(/\s+/).includes(token) || m[3].includes(token))) continue;
    const block = sliceElementByOpeningMatch(html, m) || m[0];
    elements.push({ start: m.index, end: m.index + block.length, html: block, token: tokens.find((token) => m[3].includes(token)) || "class" });
  }
  return elements;
}

function removeRanges(html, ranges) {
  const sorted = ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
      last.html += "\n" + range.html;
      last.tokens.push(range.token);
    } else {
      merged.push({ ...range, tokens: [range.token] });
    }
  }
  let out = "";
  let pos = 0;
  for (const range of merged) {
    out += html.slice(pos, range.start);
    pos = range.end;
  }
  out += html.slice(pos);
  return { html: out, removed: merged };
}

export function collectH2(html) {
  return [...html.matchAll(/<h2\b[^>]*>[\s\S]*?<\/h2>/gi)].map((m) => stripHtml(m[0]).replace(/\s+/g, " ").trim()).filter(Boolean);
}

export function extractContentRootDetailed(pageHtml, minHtmlLength = 500) {
  const cleaned = removeNoise(pageHtml);
  for (const token of contentClassTokens) {
    const elements = findElementsByClass(cleaned, [token]).filter((item) => stripHtml(item.html).length >= minHtmlLength);
    if (elements.length > 0) {
      const sanitized = sanitizeArticleHtml(elements[0].html);
      return { html: sanitized.html, extractedSelector: `.${token}`, sanitized: sanitized.html.trim() !== elements[0].html.trim() || sanitized.report.removedSelectors.length > 0 };
    }
  }
  for (const tag of ["article", "main"]) {
    const re = new RegExp(`<(${tag})\\b[^>]*>`, "i");
    const m = re.exec(cleaned);
    if (m) {
      const block = sliceElementByOpeningMatch(cleaned, m);
      const sanitized = sanitizeArticleHtml(block);
      if (stripHtml(sanitized.html).length >= minHtmlLength) {
        return { html: sanitized.html, extractedSelector: tag, sanitized: sanitized.html.trim() !== block.trim() || sanitized.report.removedSelectors.length > 0 };
      }
    }
  }
  const sanitized = sanitizeArticleHtml(cleaned);
  return { html: sanitized.html, extractedSelector: "full-html", sanitized: sanitized.html.trim() !== cleaned.trim() || sanitized.report.removedSelectors.length > 0 };
}

export function extractContentRoot(pageHtml, minHtmlLength = 500) {
  return extractContentRootDetailed(pageHtml, minHtmlLength).html;
}

export function sanitizeArticleHtml(inputHtml) {
  let html = removeNoise(inputHtml);
  const beforeH2 = collectH2(html);
  const ranges = findElementsByClass(html, themeNoiseClassTokens);
  const { html: withoutRanges, removed } = removeRanges(html, ranges);
  html = withoutRanges
    .replace(/<\/?(?:header|footer|nav|aside)\b[^>]*>/gi, "")
    .replace(/<main\b[^>]*\bid\s*=\s*(["'])main_content\1[^>]*>/gi, "")
    .replace(/<\/main>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const afterH2 = collectH2(html);
  const removedH2 = beforeH2.filter((title) => !afterH2.includes(title));
  return {
    html,
    report: {
      removedSelectors: [...new Set(removed.flatMap((item) => item.tokens))],
      removedRelatedTitleCount: removedH2.length,
      removedH2,
      finalH2: afterH2,
      forbiddenHits: themeNoiseClassTokens.filter((token) => html.includes(token)),
    },
  };
}
