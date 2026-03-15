/**
 * Shield badge injection and lifecycle management.
 *
 * Each detected T&C link gets a small shield icon (🛡️) injected next to it.
 * Badges use Shadow DOM for CSS isolation from the host page. Clicking a
 * badge triggers an analysis request to the service worker.
 */

import type { AnalysisStatus, DetectedLink } from "../shared/types";
import { sendToBackground } from "../shared/messages";

const BADGE_TAG = "fineprint-badge";
const BADGE_ATTR = "data-tr-url";

/** Color map for analysis status / score ranges. */
function badgeColor(status: AnalysisStatus, score?: number): string {
  if (status === "analyzing" || status === "extracting") return "#888"; // gray, spinner
  if (status === "error") return "#888";
  if (score != null) {
    if (score >= 8) return "#22c55e"; // green
    if (score >= 4) return "#eab308"; // yellow
    return "#ef4444"; // red
  }
  return "#3b82f6"; // blue — unanalyzed, visible on most backgrounds
}

/** Whether to show the spin animation. */
function isSpinning(status: AnalysisStatus): boolean {
  return status === "analyzing" || status === "extracting";
}

/** Shared badge styles injected into each Shadow DOM. */
const BADGE_STYLES = `
  :host {
    display: inline-flex !important;
    align-items: center;
    vertical-align: middle;
    margin-left: 6px;
    cursor: pointer;
  }
  .tr-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    font-size: 14px;
    line-height: 1;
    border: 1.5px solid rgba(255,255,255,0.3);
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    transition: background-color 0.3s, transform 0.3s;
    user-select: none;
  }
  .tr-badge:hover {
    transform: scale(1.25);
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
  .tr-badge:active {
    transform: scale(0.9);
  }
  @keyframes tr-pulse {
    0% { box-shadow: 0 0 0 0 rgba(59,130,246,0.5); }
    70% { box-shadow: 0 0 0 8px rgba(59,130,246,0); }
    100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
  }
  .tr-badge--clicked {
    animation: tr-pulse 0.6s ease-out;
  }
  @keyframes tr-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .tr-badge--spinning {
    animation: tr-spin 1s linear infinite;
  }
`;

/**
 * Inject a shield badge next to a detected T&C link.
 *
 * The badge is rendered inside a Shadow DOM to prevent the host page's
 * styles from interfering. Clicking the badge sends an ANALYZE_REQUEST
 * message to the background service worker.
 *
 * @param link - The detected link metadata.
 */
export function injectBadge(link: DetectedLink): void {
  // Don't double-inject
  if (document.querySelector(`${BADGE_TAG}[${BADGE_ATTR}="${CSS.escape(link.url)}"]`)) {
    return;
  }

  // Find the anchor element on the page
  const anchor = link.element
    ? document.querySelector<HTMLAnchorElement>(link.element)
    : document.querySelector<HTMLAnchorElement>(`a[href="${CSS.escape(link.url)}"]`);

  if (!anchor) return;

  // Create the custom element host
  const host = document.createElement(BADGE_TAG);
  host.setAttribute(BADGE_ATTR, link.url);
  host.setAttribute("data-tr-status", "idle");
  host.title = `FinePrint: Analyze ${link.type} (${Math.round(link.confidence * 100)}% confidence)`;

  const shadow = host.attachShadow({ mode: "open" });

  // Styles
  const style = document.createElement("style");
  style.textContent = BADGE_STYLES;
  shadow.appendChild(style);

  // Badge element
  const badge = document.createElement("span");
  badge.className = "tr-badge";
  badge.textContent = "\u{1F6E1}\uFE0F"; // 🛡️
  badge.style.backgroundColor = badgeColor("idle");
  shadow.appendChild(badge);

  // Click handler — request analysis with visual feedback
  host.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    badge.classList.remove("tr-badge--clicked");
    // Force reflow so re-adding the class restarts the animation
    void badge.offsetWidth;
    badge.classList.add("tr-badge--clicked");
    sendToBackground("ANALYZE_REQUEST", { url: link.url });
  });

  // Insert after the anchor
  anchor.insertAdjacentElement("afterend", host);
}

/**
 * Update the visual state of an existing badge.
 *
 * @param url    - The T&C URL this badge tracks.
 * @param status - The current analysis status.
 * @param score  - Optional overall security score (1-10).
 */
export function updateBadge(
  url: string,
  status: AnalysisStatus,
  score?: number
): void {
  const host = document.querySelector<HTMLElement>(
    `${BADGE_TAG}[${BADGE_ATTR}="${CSS.escape(url)}"]`
  );
  if (!host) return;

  host.setAttribute("data-tr-status", status);

  const oldShadow = host.shadowRoot;
  if (!oldShadow) return;

  const badge = oldShadow.querySelector<HTMLElement>(".tr-badge");
  if (!badge) return;

  badge.style.backgroundColor = badgeColor(status, score);

  if (isSpinning(status)) {
    badge.classList.add("tr-badge--spinning");
  } else {
    badge.classList.remove("tr-badge--spinning");
  }

  // Update tooltip
  if (score != null) {
    host.title = `FinePrint: Score ${score}/10`;
  } else if (status === "analyzing" || status === "extracting") {
    host.title = "FinePrint: Analyzing...";
  } else if (status === "error") {
    host.title = "FinePrint: Analysis failed (click to retry)";
  }
}

/**
 * Remove all injected badges from the page.
 */
export function removeBadges(): void {
  document.querySelectorAll(BADGE_TAG).forEach((el) => el.remove());
}

/**
 * Remove badges whose anchor elements no longer exist in the DOM.
 * Useful for SPA navigations where some page content is replaced
 * but persistent elements (e.g., footers) stay.
 */
export function removeStaleBadges(): void {
  document.querySelectorAll(BADGE_TAG).forEach((el) => {
    // A badge is stale if its previous sibling (the anchor) is gone
    if (!el.previousElementSibling || !document.body.contains(el.previousElementSibling)) {
      el.remove();
    }
  });
}
