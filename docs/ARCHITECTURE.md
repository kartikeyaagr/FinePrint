<div align="center">
  <img src="../public/icons/icon-128.png" alt="FinePrint" width="72" />
  <h1>FinePrint — Architecture</h1>
  <p><em>Read the fine print. We already did.</em></p>
</div>

---

> Chrome extension (Manifest V3) that auto-detects Terms & Conditions and Privacy Policy
> links, extracts the full document, analyzes it via the user's own LLM (Claude or Gemini),
> and presents a plain-English summary with security ratings.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CHROME EXTENSION                               │
│                                                                         │
│  ┌──────────────────┐   ┌─────────────────────┐   ┌──────────────────┐ │
│  │  Content Script   │   │   Service Worker     │   │  Side Panel UI   │ │
│  │  (per tab)        │   │   (background)       │   │  (React + TW)    │ │
│  │                   │   │                      │   │                  │ │
│  │  • DOM scanner    │──▶│  • T&C extractor     │◀─▶│  • Summary view  │ │
│  │  • Link detector  │   │  • LLM orchestrator  │   │  • Rating view   │ │
│  │  • Badge injector │   │  • Cache manager     │   │  • Diff viewer   │ │
│  │  • Overlay prompt │   │  • Diff engine       │   │  • Clause browser│ │
│  │                   │◀──│  • Rating engine     │   │  • Settings      │ │
│  └──────────────────┘   │  • Red flag scanner  │   └──────────────────┘ │
│                          └──────────┬───────────┘                       │
│                                     │                                   │
└─────────────────────────────────────┼───────────────────────────────────┘
                                      │
                        ┌─────────────┼─────────────┐
                        │             │             │
                  ┌─────▼─────┐ ┌────▼──────┐ ┌────▼──────┐
                  │  LLM API   │ │  Cache /   │ │  pdf.js   │
                  │            │ │  Storage   │ │ (lazy)    │
                  │ ┌────────┐ │ │ IndexedDB  │ │           │
                  │ │ Claude │ │ │            │ │ PDF text  │
                  │ ├────────┤ │ │ • T&C text │ │ extraction│
                  │ │ Gemini │ │ │ • Summaries│ └───────────┘
                  │ └────────┘ │ │ • Diffs    │
                  └────────────┘ │ • Ratings  │
                                 └────────────┘
```

## Component Responsibilities

### Content Script (`src/content/`)

Runs in every web page's context. Must be **lightweight** (<50KB).

| Module        | Responsibility                                 |
| ------------- | ---------------------------------------------- |
| `detector.ts` | Scan DOM for T&C/privacy links using patterns, |
|               | heuristics, and confidence scoring             |
| `badge.ts`    | Inject shield badge next to detected links     |
| `overlay.ts`  | Show "Want to understand this?" prompt when    |
|               | accept/agree buttons are detected              |
| `content.ts`  | Entry point. Sets up MutationObserver for SPAs |

### Service Worker (`src/background/`)

Handles all heavy lifting. Runs in extension's isolated context.

| Module              | Responsibility                               |
| ------------------- | -------------------------------------------- |
| `service-worker.ts` | Entry point. Message routing between         |
|                     | content script ↔ UI                          |
| `extractor.ts`      | Fetch and extract T&C text from URLs         |
|                     | (HTML, PDF, multi-page)                      |
| `analyzer.ts`       | Orchestrate: extract → LLM → parse → cache   |
| `rating.ts`         | Compute security rating from clause analysis |
| `diff.ts`           | Compare T&C versions, compute change set     |
| `red-flags.ts`      | Instant regex-based red flag pattern scanner |
| `cache.ts`          | IndexedDB wrapper for all persistent data    |

### LLM Layer (`src/background/llm/`)

| Module       | Responsibility                                   |
| ------------ | ------------------------------------------------ |
| `adapter.ts` | Common interface for all LLM providers           |
| `claude.ts`  | Anthropic Claude API implementation              |
| `gemini.ts`  | Google Gemini API implementation                 |
| `prompts.ts` | Prompt templates for summary, rating, comparison |

### Side Panel UI (`src/ui/sidepanel/`)

| Component          | What it renders                                |
| ------------------ | ---------------------------------------------- |
| `App.tsx`          | Root layout, routing, state management         |
| `SummaryView.tsx`  | Plain-English summary with clause sections     |
| `RatingView.tsx`   | Security score + drill-down into clauses       |
| `DiffView.tsx`     | T&C changes since last visit                   |
| `SettingsView.tsx` | API key entry, provider selection, preferences |

## Data Flow

### Primary Flow: Page Load → Detection → Analysis → Display

```
PAGE LOAD ──▶ DOM SCAN ──▶ LINK DETECTED? ──▶ BADGE INJECT ──▶ USER CLICKS
    │             │              │                   │              │
    ▼             ▼              ▼                   ▼              ▼
[SPA nav?]   [DOM ready?]   [false pos?]      [CSP block?]   [cached?]
[iframe?]    [dynamic       [not T&C but      [shadow DOM        │
              content?]      looks like it?]   fallback]    YES──▶ SHOW
                                                             │
                                                            NO
                                                             │
                                                             ▼
FETCH T&C ──▶ RED FLAGS ──▶ SEND TO LLM ──▶ PARSE ──▶ CACHE ──▶ DISPLAY
    │           (instant)        │              │         │
    ▼             ▼              ▼              ▼         ▼
[auth wall?]  [patterns      [timeout?]    [invalid?] [quota?]
[PDF?]         matched →     [rate limit?] [empty?]
[multi-page?]  show early]   [key expired?]
[offline?]                   [SW killed?]
```

### Shadow Path Analysis

For every data node, four paths are traced:

```
INPUT ──▶ VALIDATION ──▶ TRANSFORM ──▶ PERSIST ──▶ OUTPUT
  │            │              │            │           │
  ▼            ▼              ▼            ▼           ▼
[nil?]    [invalid?]    [exception?]  [conflict?]  [stale?]
[empty?]  [too long?]   [timeout?]    [dup key?]   [partial?]
[wrong    [wrong type?] [OOM?]        [locked?]    [encoding?]
 type?]
```

## State Machine: Analysis Lifecycle

```
┌─────────┐    link detected    ┌──────────┐   user clicks    ┌────────────┐
│  IDLE   │ ──────────────────▶ │ DETECTED │ ───────────────▶ │ EXTRACTING │
└─────────┘                     └──────────┘                  └─────┬──────┘
     ▲                               │                              │
     │                          page navigated                 success│fail
     │                               │                         ┌─────┴──────┐
     │                               ▼                         │            │
     │                          ┌──────────┐              ┌────▼───┐  ┌─────▼────┐
     │                          │ DISMISSED│              │ANALYZING│  │  ERROR   │
     │                          └──────────┘              │ (LLM)  │  │(retryable│
     │                                                    └───┬────┘  │ / fatal) │
     │                                                        │       └─────┬────┘
     │                                               success│fail          │
     │                                                ┌──────┴─┐      retry │
     │                                                │        │           │
     │                                           ┌────▼───┐ ┌──▼──────┐   │
     │                                           │ CACHED │ │PARSE ERR│───┘
     │                                           │(ready) │ └─────────┘
     │                                           └────┬───┘
     │                                                │
     └────────────────────────────────────────────────┘
                        cache expires / page revisit
```

## Security Architecture

### Threat Model

| Threat                         | Likelihood | Impact | Mitigation                                               |
| ------------------------------ | ---------- | ------ | -------------------------------------------------------- |
| Prompt injection via T&C text  | High       | Med    | Strict output schema, role separation, output validation |
| API key theft from storage     | Med        | High   | chrome.storage.local encryption, minimal permissions     |
| XSS via injected UI            | Med        | High   | Shadow DOM isolation for all injected elements           |
| Malicious page serves fake T&C | Med        | Low    | Fetch from canonical URL, verify content                 |
| MITM on LLM API calls          | Low        | Med    | HTTPS enforced by APIs                                   |

### Prompt Injection Defense

- System prompt and user content use API-native role separation
- LLM output must conform to a strict JSON schema — anything else is discarded
- Output is never eval'd or executed — display-only text
- API keys and cached data are never included in prompt context

## Performance Constraints

| Constraint                 | Target           | Strategy                         |
| -------------------------- | ---------------- | -------------------------------- |
| Content script bundle size | <50KB            | Only detector + badge code       |
| DOM scan time              | <100ms           | Event-driven (MutationObserver)  |
| LLM analysis latency       | <15s p99         | Async with loading state         |
| Cache storage              | <50MB            | LRU eviction on quota pressure   |
| Service worker cold start  | <200ms           | No heavy initialization          |
| PDF.js load                | Lazy (on demand) | Dynamic import when PDF detected |

## Key Design Decisions

| Decision          | Choice               | Rationale                                         |
| ----------------- | -------------------- | ------------------------------------------------- |
| Manifest version  | V3                   | Required for new Chrome extensions                |
| LLM API ownership | User's own account   | Zero cost to us, maximum privacy                  |
| Auth: Gemini      | Google OAuth via     | Seamless UX — user clicks "Sign in with Google"   |
|                   | chrome.identity      |                                                   |
| Auth: Claude      | Manual API key       | Anthropic has no consumer OAuth                   |
| Onboarding        | Install-time page    | Opens automatically on first install              |
| UI framework      | React + Tailwind     | Best ecosystem for Chrome extension UIs           |
| Browser scope     | Chrome-only (v1)     | Covers Chromium family; Firefox in Phase 2        |
| Storage           | IndexedDB            | Structured data, large capacity, async API        |
| Key storage       | chrome.storage.local | Encrypted at rest by Chrome, standard practice    |
| Content injection | Shadow DOM           | XSS isolation from host page                      |
| Build system      | Vite + CRXJS         | Hot reload, fast builds, Chrome extension support |
