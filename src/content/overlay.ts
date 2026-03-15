/**
 * Accept-prompt overlay.
 *
 * Shows a non-intrusive prompt near accept/agree buttons when T&C links
 * are detected, encouraging users to understand what they are agreeing to.
 * Uses Shadow DOM for CSS isolation. Dismissals are remembered per-domain
 * via chrome.storage.session.
 */

import type { DetectedLink } from "../shared/types";
import { WORDS_PER_MINUTE } from "../shared/constants";
import { sendToBackground } from "../shared/messages";

const OVERLAY_TAG = "term-reader-overlay";
const DISMISSED_KEY = "tr_dismissed_domains";

const OVERLAY_STYLES = `
  :host {
    all: initial;
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  .tr-overlay {
    background: #1e293b;
    color: #f1f5f9;
    border-radius: 12px;
    padding: 16px 20px;
    max-width: 340px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    font-size: 14px;
    line-height: 1.5;
    animation: tr-slide-in 0.3s ease-out;
  }
  @keyframes tr-slide-in {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  .tr-overlay__title {
    font-weight: 600;
    font-size: 15px;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .tr-overlay__body {
    color: #cbd5e1;
    margin-bottom: 12px;
  }
  .tr-overlay__meta {
    font-size: 12px;
    color: #94a3b8;
    margin-bottom: 12px;
  }
  .tr-overlay__actions {
    display: flex;
    gap: 8px;
  }
  .tr-btn {
    border: none;
    border-radius: 6px;
    padding: 8px 14px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .tr-btn:hover { opacity: 0.85; }
  .tr-btn--primary {
    background: #3b82f6;
    color: #fff;
  }
  .tr-btn--secondary {
    background: transparent;
    color: #94a3b8;
    border: 1px solid #334155;
  }
`;

/**
 * Show a non-intrusive overlay prompting the user to analyze terms
 * before accepting.
 *
 * @param link      - The detected T&C link to analyze.
 * @param wordCount - Optional estimated word count for reading time display.
 */
export async function showOverlay(
  link: DetectedLink,
  wordCount?: number
): Promise<void> {
  const domain = new URL(link.url).hostname;

  // Don't show if already dismissed for this domain
  if (await shouldShowOverlay(domain) === false) return;

  // Don't show if one is already visible
  if (document.querySelector(OVERLAY_TAG)) return;

  const host = document.createElement(OVERLAY_TAG);
  const shadow = host.attachShadow({ mode: "open" });

  // Styles
  const style = document.createElement("style");
  style.textContent = OVERLAY_STYLES;
  shadow.appendChild(style);

  // Content
  const container = document.createElement("div");
  container.className = "tr-overlay";

  const readingTime = wordCount
    ? `~${Math.ceil(wordCount / WORDS_PER_MINUTE)} min read`
    : null;

  container.innerHTML = `
    <div class="tr-overlay__title">
      \u{1F6E1}\uFE0F Want to understand what you're agreeing to?
    </div>
    <div class="tr-overlay__body">
      We detected a <strong>${link.type}</strong> document on this page.
      Term Reader can analyze it for you in seconds.
    </div>
    ${readingTime ? `<div class="tr-overlay__meta">${readingTime} (${wordCount!.toLocaleString()} words) — let us summarize it</div>` : ""}
    <div class="tr-overlay__actions">
      <button class="tr-btn tr-btn--primary" data-action="analyze">Analyze</button>
      <button class="tr-btn tr-btn--secondary" data-action="dismiss">Not now</button>
    </div>
  `;

  shadow.appendChild(container);

  // Event handlers
  container.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const action = target.getAttribute("data-action");

    if (action === "analyze") {
      sendToBackground("ANALYZE_REQUEST", { url: link.url });
      host.remove();
    } else if (action === "dismiss") {
      dismissOverlay(domain);
      host.remove();
    }
  });

  document.body.appendChild(host);
}

/**
 * Dismiss the overlay and remember the dismissal for this domain.
 * Uses chrome.storage.local so dismissals persist across sessions
 * and are accessible from content scripts (unlike storage.session).
 *
 * @param domain - The hostname to suppress future overlays for.
 */
export async function dismissOverlay(domain: string): Promise<void> {
  // Remove any visible overlay
  document.querySelectorAll(OVERLAY_TAG).forEach((el) => el.remove());

  // Remember dismissal in local storage (persists + works in content scripts)
  try {
    const result = await chrome.storage.local.get(DISMISSED_KEY);
    const dismissed: string[] = result[DISMISSED_KEY] ?? [];
    if (!dismissed.includes(domain)) {
      dismissed.push(domain);
      await chrome.storage.local.set({ [DISMISSED_KEY]: dismissed });
    }
  } catch {
    console.debug("[term-reader] Could not persist overlay dismissal");
  }
}

/**
 * Check whether the overlay should be shown for a given domain.
 * Returns false if the user has already dismissed it on this domain.
 *
 * @param domain - The hostname to check.
 * @returns Whether the overlay should be displayed.
 */
export async function shouldShowOverlay(domain: string): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get(DISMISSED_KEY);
    const dismissed: string[] = result[DISMISSED_KEY] ?? [];
    return !dismissed.includes(domain);
  } catch {
    return true; // Default to showing if storage is unavailable
  }
}
