# FinePrint

Chrome extension (Manifest V3) that auto-detects T&C/privacy links, summarizes them via user's own LLM (Claude/Gemini), and shows security ratings.

## Project Structure

- `src/content/` — Content scripts (DOM scanning, badge injection, overlay)
- `src/background/` — Service worker (extraction, LLM orchestration, caching, diffing)
- `src/background/llm/` — LLM adapter layer (Claude, Gemini, prompts)
- `src/ui/sidepanel/` — React side panel (summary, rating, diff, settings views)
- `src/ui/popup/` — Quick-glance popup
- `src/shared/` — Types, constants, message passing
- `src/utils/` — Storage helpers, text processing
- `docs/` — Architecture, design docs

## Key Decisions

- Manifest V3, Chrome-only (v1)
- User provides their own Claude or Gemini API key (no backend)
- React + Tailwind for UI, Vite + CRXJS for build
- IndexedDB for caching (via `idb` package)
- Shadow DOM for content script injection (XSS isolation)
- Prompt injection defense: strict output schema, API-native role separation

## Commands

- `npm run dev` — Development with hot reload
- `npm run build` — Production build to `dist/`
- `npm run typecheck` — TypeScript type checking
- `npm run lint` — ESLint

## currentDate
Today's date is 2026-03-15.

# gstack

Use the /browse skill from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.

Available skills:

- /plan-ceo-review
- /plan-eng-review
- /review
- /ship
- /browse
- /qa
- /setup-browser-cookies
- /retro
