# TODOS

## Deferred from v1 Plan Review (2026-03-15)

### TODO: Comparison Scoring

**What:** After analyzing a T&C, compare its rating against the average for similar services (stored locally from past analyses). Show "These terms are stricter than 80% of social media apps you've reviewed."
**Why:** Makes the security rating contextual and actionable — a "C" rating means nothing without a benchmark.
**Pros:** Adds comparative context; encourages users to analyze more T&Cs; builds toward community features.
**Cons:** Needs enough local data (10+ analyses) to be meaningful; category classification adds complexity.
**Context:** Depends on the security rating engine from v1. Uses the same IndexedDB cache. Category could be inferred by LLM during analysis or from domain patterns.
**Effort:** M
**Priority:** P2
**Depends on:** v1 security rating + cache infrastructure

### TODO: Dark Pattern Detection

**What:** Detect and flag dark patterns on the page itself — pre-checked consent boxes, double-negative opt-outs, hidden unsubscribe flows.
**Why:** Extends the extension's protection from document analysis to UI analysis. Users get warned about manipulative design, not just manipulative legalese.
**Pros:** Unique differentiator; works without LLM (pattern-based); high user trust impact.
**Cons:** Different detection engine than T&C analysis (DOM inspection vs text analysis); false positive risk; sites may change UI frequently.
**Context:** This is page UI analysis, not document analysis. Requires a separate content script module that inspects form elements, checkbox states, and button proximity. Start with a curated list of known dark patterns.
**Effort:** M
**Priority:** P2
**Depends on:** v1 content script infrastructure

### TODO: Share Summary

**What:** Let users share a T&C summary as a clean card image or copyable text on social media. "Did you know Spotify's T&C lets them..."
**Why:** Viral growth mechanic. Creates public pressure on companies to improve their terms. Free marketing.
**Pros:** Viral distribution; user advocacy; zero ongoing cost.
**Cons:** Needs design polish for shareable cards; social media preview requirements vary by platform.
**Context:** Could start as simple "copy summary to clipboard" and evolve to generated card images (using Canvas API or a template). Consider Open Graph meta tags for link previews.
**Effort:** M
**Priority:** P3
**Depends on:** v1 summary generation

### TODO: Similar Services Quick Lookup

**What:** When analyzing a T&C for e.g. Dropbox, show a button: "Compare with Google Drive, OneDrive terms." Pre-populated competitor list by category.
**Why:** Helps users make informed choices between competing services based on their terms.
**Pros:** High user value for purchase/signup decisions; encourages deeper engagement.
**Cons:** Requires curated service category database; maintenance burden as services change.
**Context:** Start with a hand-curated list of top 50-100 services grouped by category (cloud storage, social media, streaming, etc.). Could be stored as a JSON file in the extension, updated with each release. Later, could be community-contributed.
**Effort:** M
**Priority:** P3
**Depends on:** v1 analysis pipeline + comparison scoring (TODO above)
