/**
 * T&C text extraction from web pages.
 *
 * Fetches a URL, strips HTML, and extracts readable text content.
 * Handles HTML pages, auth walls, and redirects.
 */

import { MAX_INPUT_WORDS } from "../shared/constants";

export interface ExtractionResult {
  text: string;
  wordCount: number;
  truncated: boolean;
  error?: string;
}

/** Maximum number of redirects to follow. */
const MAX_REDIRECTS = 5;

/**
 * Fetch a T&C page and extract its text content.
 *
 * - Follows up to 5 redirects
 * - Handles auth walls (401/403)
 * - Strips HTML and extracts main content
 * - Truncates at MAX_INPUT_WORDS
 */
export async function extractText(url: string): Promise<ExtractionResult> {
  let currentUrl = url;
  let response: Response;

  try {
    // Follow redirects manually to track the count
    let redirectCount = 0;
    response = await fetch(currentUrl, { redirect: "follow" });

    // Check if we hit too many redirects (fetch with redirect: "follow"
    // handles this natively, but we check the URL changed)
    if (response.redirected) {
      currentUrl = response.url;
    }

    // For manual redirect tracking if needed
    if (redirectCount > MAX_REDIRECTS) {
      return {
        text: "",
        wordCount: 0,
        truncated: false,
        error: `Too many redirects (>${MAX_REDIRECTS}) following ${url}`,
      };
    }
  } catch (err) {
    return {
      text: "",
      wordCount: 0,
      truncated: false,
      error: `Failed to fetch ${url}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Handle auth walls
  if (response.status === 401 || response.status === 403) {
    return {
      text: "",
      wordCount: 0,
      truncated: false,
      error: `Access denied (HTTP ${response.status}). The page may require authentication.`,
    };
  }

  if (!response.ok) {
    return {
      text: "",
      wordCount: 0,
      truncated: false,
      error: `HTTP error ${response.status} fetching ${url}`,
    };
  }

  const contentType = response.headers.get("content-type") || "";

  // PDF handling — placeholder for future pdf.js integration
  if (contentType.includes("application/pdf")) {
    return {
      text: "",
      wordCount: 0,
      truncated: false,
      error: "PDF extraction requires pdf.js - coming soon",
    };
  }

  // HTML extraction
  if (
    contentType.includes("text/html") ||
    contentType.includes("application/xhtml")
  ) {
    const html = await response.text();
    const rawText = extractMainContent(html);
    const normalized = normalizeText(rawText);
    const words = normalized.split(/\s+/).filter(Boolean);
    const truncated = words.length > MAX_INPUT_WORDS;
    const finalText = truncated
      ? words.slice(0, MAX_INPUT_WORDS).join(" ")
      : normalized;

    return {
      text: finalText,
      wordCount: Math.min(words.length, MAX_INPUT_WORDS),
      truncated,
    };
  }

  // Plain text fallback
  const rawText = await response.text();
  const normalized = normalizeText(rawText);
  const words = normalized.split(/\s+/).filter(Boolean);
  const truncated = words.length > MAX_INPUT_WORDS;
  const finalText = truncated
    ? words.slice(0, MAX_INPUT_WORDS).join(" ")
    : normalized;

  return {
    text: finalText,
    wordCount: Math.min(words.length, MAX_INPUT_WORDS),
    truncated,
  };
}

/**
 * Normalize whitespace: collapse runs of spaces, limit consecutive
 * newlines, and trim leading/trailing whitespace.
 */
export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^ +/gm, "")
    .trim();
}

/**
 * Extract readable content from HTML using regex-based parsing.
 *
 * Service workers have no DOM (no DOMParser, no document), so we use
 * regex to strip non-content elements and extract text. This is less
 * precise than DOM parsing but works reliably in the SW context.
 *
 * Strategy:
 *   1. Try to isolate <main>, <article>, or role="main" content
 *   2. Strip scripts, styles, nav, header, footer, hidden elements
 *   3. Convert block tags to newlines for paragraph structure
 *   4. Strip remaining HTML tags and decode entities
 */
export function extractMainContent(html: string): string {
  let content = html;

  // Try to extract main content area (prefer <main>, <article>, role="main")
  const mainMatch =
    content.match(/<main[\s>][\s\S]*?<\/main>/i) ||
    content.match(/<article[\s>][\s\S]*?<\/article>/i) ||
    content.match(/<[^>]+role\s*=\s*["']main["'][^>]*>[\s\S]*?<\/[^>]+>/i);

  if (mainMatch) {
    content = mainMatch[0];
  } else {
    // Fall back to <body>
    const bodyMatch = content.match(/<body[\s>][\s\S]*?<\/body>/i);
    if (bodyMatch) {
      content = bodyMatch[0];
    }
  }

  // Remove elements that don't contain useful content
  const stripTags = [
    "script",
    "style",
    "noscript",
    "iframe",
    "svg",
    "nav",
    "header",
    "footer",
  ];
  for (const tag of stripTags) {
    content = content.replace(
      new RegExp(`<${tag}[\\s>][\\s\\S]*?<\\/${tag}>`, "gi"),
      ""
    );
  }

  // Remove elements with role="navigation", role="banner", role="contentinfo"
  content = content.replace(
    /<[^>]+role\s*=\s*["'](navigation|banner|contentinfo)["'][^>]*>[\s\S]*?<\/[^>]+>/gi,
    ""
  );

  // Remove elements with aria-hidden="true"
  content = content.replace(
    /<[^>]+aria-hidden\s*=\s*["']true["'][^>]*>[\s\S]*?<\/[^>]+>/gi,
    ""
  );

  // Remove elements with display:none or visibility:hidden in inline styles
  content = content.replace(
    /<[^>]+style\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden)[^"']*["'][^>]*>[\s\S]*?<\/[^>]+>/gi,
    ""
  );

  // Convert block-level tags to newlines for paragraph structure
  const blockTags =
    /(<\/?(p|div|section|h[1-6]|li|tr|blockquote|dt|dd|figcaption|pre|br\s*\/?)>)/gi;
  content = content.replace(blockTags, "\n");

  // Strip all remaining HTML tags
  content = content.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  content = decodeHTMLEntities(content);

  return content;
}

/** Decode common HTML entities without DOM. */
function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&copy;/g, "©")
    .replace(/&reg;/g, "®")
    .replace(/&trade;/g, "™")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}
