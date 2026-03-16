/**
 * Content script entry point.
 *
 * Runs on every web page. Coordinates T&C link detection, badge injection,
 * overlay prompts, and message passing with the service worker.
 *
 * Lifecycle:
 *   1. Initial scan on DOMContentLoaded / load
 *   2. MutationObserver for SPA navigation (debounced)
 *   3. URL change listeners (popstate, hashchange)
 *   4. Message listener for badge updates from the service worker
 */

import type { BadgeUpdateData, DetectedLink } from "../shared/types";
import { SCAN_DEBOUNCE_MS } from "../shared/constants";
import { sendToBackground, onMessage } from "../shared/messages";
import { scanForTCLinks } from "./detector";
import { injectBadge, updateBadge, removeBadges, removeStaleBadges, setAnalyzeAllCallback } from "./badge";
import { showOverlay, dismissOverlay } from "./overlay";

/** Track the last URL we scanned to detect navigation. */
let lastScannedUrl = "";

/** Track detected links by URL to avoid re-processing and enable batch analysis. */
const detectedLinks = new Map<string, DetectedLink>();

// Register callback: when any badge is clicked, analyze all detected links
setAnalyzeAllCallback((_clickedUrl: string) => {
  const links = Array.from(detectedLinks.values());
  if (links.length > 0) {
    sendToBackground("ANALYZE_ALL_REQUEST", { links });
  }
});

/** Track domains where overlay has already been shown this session. */
const overlayShownDomains = new Set<string>();

/**
 * Check if a URL change is a same-origin SPA navigation.
 * SPA navigations keep the same host — no need to re-scan existing links.
 */
function isSameOriginNavigation(oldUrl: string, newUrl: string): boolean {
  if (!oldUrl) return false;
  try {
    return new URL(oldUrl).origin === new URL(newUrl).origin;
  } catch {
    return false;
  }
}

/**
 * Run the detection pipeline: scan for links, inject badges, notify
 * the service worker, and optionally show the overlay prompt.
 */
function runDetection(): void {
  const currentUrl = location.href;

  // If the URL changed, decide whether to reset detection state
  if (currentUrl !== lastScannedUrl) {
    if (isSameOriginNavigation(lastScannedUrl, currentUrl)) {
      // SPA navigation — keep detectedLinks, just remove stale badges
      // whose anchors no longer exist in the DOM
      removeStaleBadges();
    } else {
      // Cross-origin navigation — full reset
      detectedLinks.clear();
      removeBadges();
    }
    lastScannedUrl = currentUrl;
  }

  const links = scanForTCLinks();
  const newLinks: DetectedLink[] = [];

  for (const link of links) {
    if (detectedLinks.has(link.url)) continue;
    detectedLinks.set(link.url, link);
    newLinks.push(link);
    injectBadge(link);
  }

  if (newLinks.length === 0) return;

  // Notify service worker
  sendToBackground("TC_DETECTED", {
    links: newLinks,
    pageUrl: currentUrl,
  });

  // Show overlay for the highest-confidence link, but only once per domain per session.
  // Pass all detected links so the "Analyze" button covers everything on the page.
  const best = newLinks[0]; // Already sorted by confidence
  if (best) {
    const pageDomain = location.hostname;
    if (!overlayShownDomains.has(pageDomain)) {
      overlayShownDomains.add(pageDomain);
      showOverlay(best, Array.from(detectedLinks.values()));
    }
  }
}

// ─── Debounced Scanner ──────────────────────────────────────────────

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Schedule a detection run, debounced to avoid excessive scanning
 * during rapid DOM mutations.
 */
function scheduleScan(): void {
  if (debounceTimer != null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    runDetection();
  }, SCAN_DEBOUNCE_MS);
}

// ─── MutationObserver ───────────────────────────────────────────────

const observer = new MutationObserver((mutations) => {
  // Only re-scan if new nodes were added (not just attribute changes)
  const hasNewNodes = mutations.some(
    (m) => m.type === "childList" && m.addedNodes.length > 0
  );
  if (hasNewNodes) {
    scheduleScan();
  }
});

// ─── URL Change Detection ───────────────────────────────────────────

function onUrlChange(): void {
  if (location.href !== lastScannedUrl) {
    scheduleScan();
  }
}

// ─── Message Listeners ──────────────────────────────────────────────

onMessage<BadgeUpdateData>("BADGE_UPDATE", (data) => {
  updateBadge(data.url, data.status, data.score);
});

// Handle messages from popup and service worker
chrome.runtime.onMessage.addListener(
  (message, _sender, sendResponse) => {
    if (message.type === "GET_DETECTED_LINKS") {
      sendResponse({ links: Array.from(detectedLinks.values()) });
      return false;
    }
    if (message.type === "DISMISS_OVERLAY") {
      // Remove the overlay immediately (e.g., user clicked Analyze in popup)
      dismissOverlay(location.hostname);
      return false;
    }
    return false;
  }
);

// ─── Initialization ─────────────────────────────────────────────────

function init(): void {
  // Initial scan
  runDetection();

  // Watch for DOM changes (SPA navigation, lazy-loaded content)
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Watch for URL changes (History API, hash navigation)
  window.addEventListener("popstate", onUrlChange);
  window.addEventListener("hashchange", onUrlChange);
}

// Start when the DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
