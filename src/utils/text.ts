/**
 * Text processing utilities for T&C content normalization and chunking.
 */

import { MAX_INPUT_WORDS, CHUNK_SIZE_WORDS, WORDS_PER_MINUTE } from "@/shared/constants";

/** Normalize text: collapse whitespace, trim, remove zero-width chars. */
export function normalizeText(text: string): string {
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // Zero-width chars
    .replace(/\r\n/g, "\n") // Normalize line endings
    .replace(/[ \t]+/g, " ") // Collapse horizontal whitespace
    .replace(/\n{3,}/g, "\n\n") // Max 2 consecutive newlines
    .trim();
}

/** Count words in text. */
export function countWords(text: string): number {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

/** Estimate reading time in minutes. */
export function estimateReadingTime(wordCount: number): number {
  return Math.ceil(wordCount / WORDS_PER_MINUTE);
}

/**
 * Truncate text to MAX_INPUT_WORDS.
 * Returns { text, truncated, originalWordCount }.
 */
export function truncateText(text: string): {
  text: string;
  truncated: boolean;
  originalWordCount: number;
} {
  const trimmed = text.trim();
  if (!trimmed) {
    return { text: "", truncated: false, originalWordCount: 0 };
  }
  const words = trimmed.split(/\s+/);
  const originalWordCount = words.length;

  if (originalWordCount <= MAX_INPUT_WORDS) {
    return { text, truncated: false, originalWordCount };
  }

  return {
    text: words.slice(0, MAX_INPUT_WORDS).join(" "),
    truncated: true,
    originalWordCount,
  };
}

/**
 * Split text into chunks for processing long documents.
 * Splits on paragraph boundaries to preserve context.
 */
export function chunkText(text: string): string[] {
  const words = text.split(/\s+/);
  if (words.length <= CHUNK_SIZE_WORDS) {
    return [text];
  }

  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let currentChunk: string[] = [];
  let currentWordCount = 0;

  for (const paragraph of paragraphs) {
    const paragraphWordCount = paragraph.split(/\s+/).length;

    if (
      currentWordCount + paragraphWordCount > CHUNK_SIZE_WORDS &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.join("\n\n"));
      currentChunk = [];
      currentWordCount = 0;
    }

    currentChunk.push(paragraph);
    currentWordCount += paragraphWordCount;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join("\n\n"));
  }

  return chunks;
}

/**
 * Extract readable text from HTML string.
 * Strips tags, preserves paragraph structure, extracts main content.
 */
export function htmlToText(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Remove script, style, nav, header, footer elements
  const removeSelectors = [
    "script",
    "style",
    "noscript",
    "nav",
    "header",
    "footer",
    "iframe",
    "svg",
    "img",
    ".cookie-banner",
    ".cookie-consent",
    "#cookie-banner",
  ];
  for (const selector of removeSelectors) {
    doc.querySelectorAll(selector).forEach((el) => el.remove());
  }

  // Try to find main content container
  const mainContent =
    doc.querySelector("main") ??
    doc.querySelector("article") ??
    doc.querySelector('[role="main"]') ??
    doc.querySelector(".content") ??
    doc.querySelector("#content") ??
    doc.body;

  if (!mainContent) return "";

  // Convert block elements to newlines for paragraph structure
  const blockElements = new Set([
    "P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6",
    "LI", "TR", "BLOCKQUOTE", "SECTION", "ARTICLE",
  ]);

  let text = "";
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (blockElements.has(el.tagName)) {
        text += "\n\n";
      } else if (el.tagName === "BR") {
        text += "\n";
      }
      for (const child of el.childNodes) {
        walk(child);
      }
      if (blockElements.has(el.tagName)) {
        text += "\n\n";
      }
    }
  };

  walk(mainContent);
  return normalizeText(text);
}
