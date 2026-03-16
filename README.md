<div align="center">
  <img src="public/icons/icon-128.png" alt="FinePrint" width="96" />
  <h1>FinePrint</h1>
  <p><em>Read the fine print. We already did.</em></p>
  <p><strong>Coming soon to the Chrome Web Store</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white" alt="Chrome Extension" />
    <img src="https://img.shields.io/badge/Manifest-V3-green" alt="Manifest V3" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  </p>
</div>

**A "nutrition label" for Terms & Conditions.** FinePrint is a Chrome extension that auto-detects legal documents on any website and gives you a plain-English summary with a security score — so you never blindly click "I agree" again.

---

## The Problem

The average Terms & Conditions document takes **47 minutes** to read. Nobody reads them. But buried inside are clauses about data selling, forced arbitration, content licensing, and auto-renewal traps that directly affect you.

## How FinePrint Solves It

1. **Browse normally.** FinePrint runs in the background, watching for T&C and Privacy Policy links.
2. **See the shield.** A blue shield icon appears next to every detected legal link.
3. **Click for clarity.** One click analyzes **all** legal documents on the page simultaneously — Terms, Privacy Policy, Cookie Policy — and opens a side panel with each in its own tab.
4. **Make informed decisions.** Know exactly what you're agreeing to in 30 seconds instead of 47 minutes.

---

## Features

### Instant Security Score

Every document gets a **1–10 security score** across five dimensions:

| Dimension       | What it measures                                         |
| --------------- | -------------------------------------------------------- |
| Data Collection | How much personal data is collected                      |
| Data Sharing    | Whether your data is sold to third parties (weighted 2x) |
| User Rights     | Your ability to delete, export, or control your data     |
| Liability       | How much the company disclaims responsibility            |
| Transparency    | How clear and readable the terms are                     |

Scores are color-coded: **green** (8–10, low risk), **yellow** (4–7, medium risk), **red** (1–3, high risk).

### Red Flag Detection

Before the AI even finishes analyzing, FinePrint instantly scans for **10 critical patterns** using regex — no network request needed:

- Forced arbitration clauses
- Data sale to third parties
- Class action waivers
- Auto-renewal traps
- Unilateral terms changes
- Broad content licensing
- No refund policies
- Indefinite data retention
- Law enforcement data sharing (without warrant)
- Liability limitations

Red flags appear immediately while the full AI analysis loads.

### Smart Link Detection

A 3-layer confidence scoring system finds T&C links even when they're hidden in footers or disguised with vague text:

```
Layer 1: URL patterns        → 0.9 confidence  (/terms, /privacy, /tos, /eula)
Layer 2: Link text matching  → 0.7 confidence  ("Terms of Service", "Privacy Policy")
Layer 3: Context heuristics  → 0.3 confidence  ("I agree to the...", checkbox nearby)
```

Links need ≥0.5 combined confidence to trigger detection. SPA-aware — works on React/Next.js sites, Twitter/X, and other single-page apps without re-prompting on every navigation.

### Worst Clause Spotlight

The most concerning clause is pulled out and displayed prominently at the top of every analysis:

> **Biggest Concern**
>
> _"By using our service, you grant us a perpetual, irrevocable, worldwide license to all content you create."_
>
> This means the company owns your content forever, even after you delete your account.

### Version Diff Tracking

Revisit a site and FinePrint compares the current T&C against the last version it analyzed. You'll see exactly what changed — additions, removals, modifications — and how the security score shifted.

### Non-Intrusive Design

- Shield badges use **Shadow DOM** for zero CSS conflicts with any website
- Overlay prompts appear **once per site per session** — dismiss once, never see it again
- Clicking "Analyze" in the popup **auto-dismisses** the page notification
- All analysis happens through **your own API key** — no data leaves your browser except the direct API call

---

## Getting Started

### Prerequisites

- Google Chrome (or any Chromium-based browser)
- A free [Google Gemini API key](https://aistudio.google.com/apikey) (takes 30 seconds)

### Install from Source

```bash
# Clone the repo
git clone https://github.com/kartikeyaagr/fineprint.git
cd fineprint

# Install dependencies
npm install

# Build the extension
npm run build
```

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder

### First Run

On first install, an onboarding page opens with step-by-step instructions to set up your free Gemini API key. The entire setup takes about 30 seconds.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CHROME EXTENSION                         │
│                                                              │
│  Content Script          Service Worker        Side Panel UI  │
│  (runs on every page)    (background)          (React)       │
│                                                              │
│  ┌─────────────────┐    ┌──────────────────┐  ┌───────────┐ │
│  │ Link Detector   │───▶│ T&C Extractor    │  │ Security  │ │
│  │ Badge Injector  │    │ LLM Orchestrator │─▶│ Summary   │ │
│  │ Overlay Prompt  │◀───│ Cache (IndexedDB) │  │ Diff View │ │
│  │ SPA Handler     │    │ Red Flag Scanner │  │ Settings  │ │
│  └─────────────────┘    │ Diff Engine      │  └───────────┘ │
│                          └──────────────────┘                │
│                                  │                           │
│                          ┌───────▼───────┐                   │
│                          │  Gemini API   │                   │
│                          │  (user's key) │                   │
│                          └───────────────┘                   │
└──────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer               | Technology                         |
| ------------------- | ---------------------------------- |
| Extension framework | Chrome Manifest V3                 |
| UI                  | React 19 + Tailwind CSS            |
| Language            | TypeScript 5.8                     |
| Build               | Vite + CRXJS                       |
| Storage             | IndexedDB (via `idb`)              |
| AI                  | Google Gemini API (user's own key) |
| Content isolation   | Shadow DOM                         |

### Project Structure

```
src/
├── content/          # Content scripts (detection, badges, overlay)
│   ├── detector.ts   # 3-layer confidence scoring
│   ├── badge.ts      # Shield badge injection (Shadow DOM)
│   ├── overlay.ts    # "Want to understand?" prompt
│   └── content.ts    # Entry point, SPA navigation handling
├── background/       # Service worker
│   ├── extractor.ts  # T&C text extraction from HTML
│   ├── analyzer.ts   # Analysis pipeline orchestrator
│   ├── cache.ts      # IndexedDB caching layer
│   ├── diff.ts       # Version comparison engine
│   ├── rating.ts     # Security score computation
│   ├── red-flags.ts  # Instant regex pattern scanner
│   └── llm/          # LLM adapter layer
│       ├── adapter.ts
│       ├── gemini.ts  # Google Gemini adapter
│       ├── prompts.ts # Prompt templates with injection defense
│       └── utils.ts   # Response parsing, retry logic
├── ui/
│   ├── sidepanel/    # Side panel UI (React)
│   └── onboarding/   # First-install setup page
├── shared/           # Types, constants, message passing
└── utils/            # Storage helpers, text processing
```

---

## Security & Privacy

FinePrint is designed with privacy as a core principle:

- **No backend server.** Everything runs locally in your browser.
- **Your API key stays local.** Stored in `chrome.storage.local` (encrypted at rest by Chrome), never transmitted to any server other than the Gemini API.
- **Minimal permissions.** Only `activeTab`, `storage`, `tabs`, and `sidePanel` — no access to browsing history, bookmarks, or other sensitive data.
- **Prompt injection defense.** The LLM prompt uses strict role separation and schema validation. Adversarial instructions embedded in T&C text are treated as data, never executed.
- **Shadow DOM isolation.** All injected UI elements (badges, overlays) are encapsulated in Shadow DOM to prevent XSS from host pages.

---

## Development

```bash
# Start dev server with hot reload
npm run dev

# Type checking
npm run typecheck

# Lint
npm run lint

# Production build
npm run build
```

After building, reload the extension in `chrome://extensions` to pick up changes.

---

## How It Works Under the Hood

1. **Detection** — Content script scans every page for links matching URL patterns (`/terms`, `/privacy`), text patterns ("Terms of Service"), and contextual heuristics ("I agree to the..."). Confidence scores from each layer are combined.

2. **Badge injection** — Detected links get a shield badge via Shadow DOM. Badge color reflects analysis status (blue = unanalyzed, green/yellow/red = scored, spinning = in progress).

3. **Extraction** — On click, the service worker fetches the T&C URL and extracts clean text using regex-based HTML parsing (service workers have no DOM access).

4. **Red flag scan** — While the LLM call is in flight, 10 regex patterns scan instantly for critical clauses like forced arbitration and data selling. Results show immediately.

5. **LLM analysis** — The extracted text is sent to Gemini with a structured prompt. The response is parsed into clauses, severity ratings, and a security score breakdown.

6. **Caching** — Results are stored in IndexedDB. Revisiting the same page serves cached results instantly. If the T&C text has changed, a diff is computed.

7. **Display** — The side panel shows each document in its own tab (Terms, Privacy, Cookies). Within each document, sub-tabs give the security score, full clause summary, and version diff.

---

## License

MIT
