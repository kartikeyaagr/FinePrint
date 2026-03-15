/**
 * T&C link detection engine.
 *
 * Scans the current page for links that point to terms of service,
 * privacy policies, and similar legal documents using a layered
 * confidence scoring system.
 */

import type { DetectedLink } from "../shared/types";
import {
  URL_PATTERNS,
  URL_PATTERN_CONFIDENCE,
  TEXT_PATTERNS,
  TEXT_PATTERN_CONFIDENCE,
  CONSENT_PATTERNS,
  CONTEXT_CONFIDENCE,
  CONTEXT_BOOST,
  MIN_CONFIDENCE,
  MAX_LINKS_PER_PAGE,
} from "../shared/constants";

/**
 * Check whether a link element is in a consent context — near a checkbox,
 * inside a footer, or adjacent to signup/accept buttons.
 */
function hasConsentContext(anchor: HTMLAnchorElement): boolean {
  const parent = anchor.closest(
    "form, label, footer, .footer, [class*=footer], [class*=consent], [class*=signup], [class*=register], [class*=accept]"
  );
  if (parent) return true;

  // Check for a nearby checkbox (within the same parent container)
  const container = anchor.parentElement?.parentElement;
  if (container?.querySelector('input[type="checkbox"]')) return true;

  // Check for consent-related text in the surrounding container
  const surroundingText = anchor.parentElement?.textContent ?? "";
  return CONSENT_PATTERNS.some((pattern) => pattern.test(surroundingText));
}

/**
 * Score a single anchor element against all detection layers.
 * Returns null if the link does not meet the minimum confidence threshold.
 */
function scoreLink(
  anchor: HTMLAnchorElement
): DetectedLink | null {
  const href = anchor.href;
  if (!href || href === "#" || href.startsWith("javascript:")) return null;

  const linkText = (anchor.textContent ?? "").trim();
  if (!linkText) return null;

  let bestConfidence = 0;
  let bestType: DetectedLink["type"] = "other";

  // Layer 1: URL pattern matching (confidence 0.9)
  for (const { regex, type } of URL_PATTERNS) {
    if (regex.test(href)) {
      bestConfidence = URL_PATTERN_CONFIDENCE;
      bestType = type as DetectedLink["type"];
      break;
    }
  }

  // Layer 2: Link text matching (confidence 0.7)
  if (bestConfidence < TEXT_PATTERN_CONFIDENCE) {
    for (const { regex, type } of TEXT_PATTERNS) {
      if (regex.test(linkText)) {
        bestConfidence = TEXT_PATTERN_CONFIDENCE;
        bestType = type as DetectedLink["type"];
        break;
      }
    }
  }

  // Layer 3: Context heuristics (confidence 0.3, or +0.15 boost)
  if (hasConsentContext(anchor)) {
    if (bestConfidence > 0 && bestConfidence < URL_PATTERN_CONFIDENCE) {
      // Boost an existing text match
      bestConfidence = Math.min(bestConfidence + CONTEXT_BOOST, 1);
    } else if (bestConfidence === 0) {
      // Standalone context signal — only if the link text is vaguely legal
      const vagueTerms = /terms|privacy|policy|legal|agreement|conditions/i;
      if (vagueTerms.test(linkText) || vagueTerms.test(href)) {
        bestConfidence = CONTEXT_CONFIDENCE;
      }
    }
  }

  if (bestConfidence < MIN_CONFIDENCE) return null;

  // Build a simple CSS selector for re-finding this element
  const selector = buildSelector(anchor);

  return {
    url: href,
    linkText,
    confidence: bestConfidence,
    type: bestType,
    element: selector,
  };
}

/**
 * Build a minimal CSS selector that can relocate the anchor element.
 */
function buildSelector(anchor: HTMLAnchorElement): string {
  if (anchor.id) return `#${CSS.escape(anchor.id)}`;

  const href = anchor.getAttribute("href");
  if (href) return `a[href="${CSS.escape(href)}"]`;

  // Cannot reliably identify this anchor — return empty string
  return "";
}

/**
 * Scan the current document for links that likely point to terms of service,
 * privacy policies, and other legal documents.
 *
 * @returns An array of detected links sorted by confidence (highest first),
 *          capped at {@link MAX_LINKS_PER_PAGE} and deduplicated by URL.
 */
export function scanForTCLinks(): DetectedLink[] {
  const anchors = document.querySelectorAll<HTMLAnchorElement>("a[href]");
  const seen = new Map<string, DetectedLink>();

  for (const anchor of anchors) {
    const link = scoreLink(anchor);
    if (!link) continue;

    // Deduplicate by normalized URL (strip trailing slash and fragment),
    // keeping the highest-confidence entry per URL
    const normalizedUrl = link.url.replace(/#.*$/, "").replace(/\/$/, "");
    const existing = seen.get(normalizedUrl);
    if (!existing || link.confidence > existing.confidence) {
      seen.set(normalizedUrl, link);
    }
  }

  // Sort by confidence descending, then cap
  const results = Array.from(seen.values());
  results.sort((a, b) => b.confidence - a.confidence);
  return results.slice(0, MAX_LINKS_PER_PAGE);
}
