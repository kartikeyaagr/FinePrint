# Design Document — FinePrint

## Product Vision

**One-line:** A "nutrition label" for Terms & Conditions — instant, plain-English clarity on what you're agreeing to.

**User experience:** Visit any site → see a subtle shield icon next to T&C links → click for a beautiful, scannable summary with security score → never blindly accept terms again.

## V1 Feature Specifications

### 1. T&C Link Auto-Detection

**What:** Content script scans every page for links to Terms & Conditions, Privacy Policies, and similar legal documents.

**Detection strategy (layered, confidence-scored):**

```
Layer 1: URL pattern matching (high confidence)
  - /terms, /tos, /terms-of-service, /privacy, /privacy-policy
  - /legal, /eula, /cookie-policy, /acceptable-use
  - Regex: /(terms|privacy|legal|tos|eula|cookie.?policy)/i

Layer 2: Link text matching (medium confidence)
  - "Terms of Service", "Terms and Conditions", "Privacy Policy"
  - "Terms of Use", "User Agreement", "Cookie Policy"
  - "I agree to the...", "By continuing you accept..."

Layer 3: Context heuristics (low confidence, requires corroboration)
  - Checkbox near a link (consent pattern)
  - Link in footer (common T&C placement)
  - Link near "Sign Up" / "Register" / "Accept" buttons

Confidence threshold: ≥0.6 to show badge
  - Layer 1 match alone = 0.9
  - Layer 2 match alone = 0.7
  - Layer 3 match alone = 0.3 (not enough)
  - Layer 2 + Layer 3 = 0.85
```

**SPA handling:** MutationObserver watches for DOM changes. Re-scans on:

- New nodes added to document body
- URL hash/path changes (popstate event)
- Debounced to avoid performance impact (200ms)

### 2. Shield Badge Injection

**Visual design:**

```
  ┌──────────────────────────────────┐
  │  Terms of Service 🛡️             │  ← Shield badge appears inline
  └──────────────────────────────────┘     next to detected links

Badge states:
  🛡️ Gray    = Not yet analyzed
  🛡️ Green   = Low risk (score 8-10)
  🛡️ Yellow  = Medium risk (score 4-7)
  🛡️ Red     = High risk (score 1-3)
  🛡️ Spinning = Analysis in progress
```

**Implementation:** Injected via Shadow DOM to prevent CSS conflicts with host page.

### 3. Accept Prompt Overlay

**When:** Extension detects an "I agree" / "Accept" checkbox or button near T&C links.

**Overlay design:**

```
┌─────────────────────────────────────────────┐
│  📋 Want to understand what you're          │
│     agreeing to?                            │
│                                             │
│  This page has Terms & Conditions that      │
│  would take ~47 minutes to read.            │
│                                             │
│  [Read Summary]        [Dismiss]            │
└─────────────────────────────────────────────┘
```

**Behavior:**

- Appears once per domain per session (not annoying)
- Dismissal is remembered (chrome.storage.session)
- Non-blocking — user can still accept without reading

### 4. T&C Text Extraction

**Multi-format support:**

| Format      | Strategy                                           |
| ----------- | -------------------------------------------------- |
| HTML page   | Fetch URL, extract main content (readability-like) |
| PDF         | Lazy-load pdf.js, extract text per page            |
| Multi-page  | Follow "Next" / pagination links (max 20 pages)    |
| Iframe      | Fetch iframe src URL directly via service worker   |
| JS-rendered | Wait via MutationObserver, timeout after 10s       |

**Content normalization:**

- Strip HTML tags, normalize whitespace
- Preserve paragraph structure for LLM context
- Truncate at 50,000 words (with warning)
- Detect language for multi-language prompt support

### 5. LLM Analysis

**Provider abstraction:**

```typescript
interface LLMAdapter {
  analyze(text: string, prompt: string): Promise<AnalysisResult>;
  isConfigured(): boolean;
  getProviderName(): string;
}
```

**Prompt design (summary):**

```
You are a legal document analyzer. Analyze the following Terms & Conditions
and provide a structured summary.

Return a JSON object with this exact schema:
{
  "title": "Service name",
  "summary": "2-3 sentence plain-English overview",
  "readingTime": "estimated minutes to read original",
  "clauses": [
    {
      "category": "data_collection|data_sharing|user_rights|liability|
                   termination|auto_renewal|arbitration|content_rights|
                   privacy|cookies|other",
      "title": "Short clause title",
      "summary": "Plain-English explanation",
      "severity": "good|neutral|warning|critical",
      "originalExcerpt": "Relevant quote from the original text"
    }
  ],
  "worstClause": {
    "index": 0,
    "reason": "Why this is the most concerning clause"
  },
  "securityScore": {
    "overall": 7,
    "breakdown": {
      "dataCollection": 6,
      "dataSharing": 8,
      "userRights": 7,
      "liability": 5,
      "transparency": 9
    }
  }
}
```

### 6. Security Rating

**Scoring dimensions (1-10, 10 = best for user):**

| Dimension       | What it measures                                   |
| --------------- | -------------------------------------------------- |
| Data Collection | How much personal data is collected                |
| Data Sharing    | Whether data is sold/shared with third parties     |
| User Rights     | Can you delete data? Export? Object to processing? |
| Liability       | How much liability the company disclaims           |
| Transparency    | How clear and readable are the terms               |

**Overall score:** Weighted average (data sharing weighted 2x).

**Visual representation:**

```
┌─────────────────────────────────────┐
│  Security Score: 6.2 / 10  🟡      │
│  ▓▓▓▓▓▓░░░░                        │
│                                     │
│  Data Collection    ▓▓▓▓▓▓░░░░  6  │
│  Data Sharing       ▓▓▓▓▓▓▓▓░░  8  │
│  User Rights        ▓▓▓▓▓▓▓░░░  7  │
│  Liability          ▓▓▓▓▓░░░░░  5  │
│  Transparency       ▓▓▓▓▓▓▓▓▓░  9  │
└─────────────────────────────────────┘
```

### 7. Red Flag Pattern Library

**Instant detection (no LLM needed):**

| Pattern                 | Regex/Keyword                                       | Severity    |
| ----------------------- | --------------------------------------------------- | ----------- | --- | ----- | -------- |
| Forced arbitration      | `arbitrat(ion                                       | e).\*waiv(e | er  | ing)` | Critical |
| Data sale               | `sell.*data\|data.*sold\|third.part(y\|ies).*share` | Critical    |
| Auto-renewal trap       | `auto.?renew.*cancel.*before`                       | Warning     |
| Unilateral changes      | `modify.*terms.*without.*notice`                    | Warning     |
| Class action waiver     | `class.action.*waiv`                                | Critical    |
| Broad content license   | `perpetual.*irrevocable.*license.*content`          | Warning     |
| No refund               | `no.?refund\|non.?refundable`                       | Warning     |
| Liability limitation    | `not.*liable.*indirect\|consequential`              | Neutral     |
| Data retention          | `retain.*data.*indefinit`                           | Warning     |
| Law enforcement sharing | `law.enforcement.*without.*warrant`                 | Critical    |

**Display:** Red flags shown immediately while LLM analysis loads.

### 8. T&C Version Diff Tracking

**Storage schema:**

```typescript
interface TCVersion {
  url: string;
  domain: string;
  contentHash: string; // SHA-256 of normalized text
  rawText: string; // Full T&C text
  fetchedAt: number; // Unix timestamp
  analysis?: AnalysisResult; // LLM analysis (if completed)
}
```

**Diff display:**

```
┌─────────────────────────────────────────┐
│  📋 Terms changed since Jan 15, 2026   │
│                                         │
│  + Added: "We may share anonymized      │
│    data with advertising partners"      │
│                                         │
│  ~ Changed: Data retention from         │
│    "2 years" to "indefinitely"          │
│                                         │
│  - Removed: "Users may request full     │
│    data deletion within 30 days"        │
│                                         │
│  ⚠ Security score changed: 7.1 → 5.4  │
└─────────────────────────────────────────┘
```

### 9. Reading Time Estimate

**Calculation:** `wordCount / 200` (average adult reading speed in WPM).

**Display:** "This T&C would take **47 minutes** to read. Here's the 2-minute version."

### 10. Worst Clause Spotlight

**Behavior:** From the LLM analysis, pick the clause with `severity: "critical"` and the lowest individual score. Display it prominently at the top of the summary.

```
┌─────────────────────────────────────────┐
│  ⚠ BIGGEST CONCERN                     │
│                                         │
│  "By using our service, you grant us    │
│   a perpetual, irrevocable license to   │
│   all content you create."              │
│                                         │
│  This means: The company owns your      │
│  content forever, even if you delete    │
│  your account.                          │
└─────────────────────────────────────────┘
```

## Side Panel Layout

```
┌─────────────────────────────────────────┐
│  🛡️ FinePrint          [⚙️ Settings] │
├─────────────────────────────────────────┤
│  example.com — Terms of Service         │
│  ⏱ 47 min read → 2 min summary         │
├─────────────────────────────────────────┤
│  Score: 6.2/10  🟡                      │
│  ▓▓▓▓▓▓░░░░                            │
├─────────────────────────────────────────┤
│  ⚠ BIGGEST CONCERN                     │
│  Perpetual content license...           │
├─────────────────────────────────────────┤
│  🚩 RED FLAGS (instant)                │
│  • Forced arbitration clause            │
│  • Class action waiver                  │
├─────────────────────────────────────────┤
│  📋 FULL SUMMARY                       │
│  ▸ Data Collection (6/10)              │
│  ▸ Data Sharing (8/10)                 │
│  ▸ User Rights (7/10)                  │
│  ▸ Liability (5/10)                    │
│  ▸ Transparency (9/10)                 │
├─────────────────────────────────────────┤
│  📊 CHANGES SINCE LAST VISIT           │
│  3 clauses changed on Feb 10, 2026     │
│  Score: 7.1 → 6.2 (↓0.9)              │
│  [View Changes]                         │
└─────────────────────────────────────────┘
```

## Message Passing Protocol

```
Content Script ──▶ Service Worker:
  { type: "TC_DETECTED", data: { url, linkText, confidence, tabId } }
  { type: "ANALYZE_REQUEST", data: { url, tabId } }

Service Worker ──▶ Content Script:
  { type: "BADGE_UPDATE", data: { url, status, score } }
  { type: "ANALYSIS_PROGRESS", data: { url, stage, progress } }

Service Worker ──▶ Side Panel:
  { type: "ANALYSIS_RESULT", data: { url, summary, rating, diff } }
  { type: "ANALYSIS_ERROR", data: { url, error, retryable } }

Side Panel ──▶ Service Worker:
  { type: "OPEN_ANALYSIS", data: { url } }
  { type: "RETRY_ANALYSIS", data: { url } }
  { type: "GET_SETTINGS" }
  { type: "SAVE_SETTINGS", data: { provider, apiKey, ... } }
```
