/**
 * Service worker entry point for the FinePrint extension.
 *
 * Handles:
 *   - Message routing between content script, popup, and side panel
 *   - Analysis pipeline orchestration
 *   - Side panel lifecycle (opens automatically on analysis)
 *   - Onboarding on first install
 */

import type {
  AnalyzeRequestData,
  BadgeUpdateData,
  Settings,
  TCDetectedData,
  AnalysisProgressData,
  AnalysisErrorData,
} from "../shared/types";
import { DEFAULT_SETTINGS } from "../shared/types";
import { sendToTab } from "../shared/messages";
import { analyzeTC, getCache } from "./analyzer";
import { getRatingColor } from "./rating";
import {
  loadAuthState,
  completeSetupWithApiKey,
} from "./auth";

// ─── Settings Management ──────────────────────────────────────────

const SETTINGS_KEY = "fineprint-settings";

async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return result[SETTINGS_KEY]
    ? { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] }
    : { ...DEFAULT_SETTINGS };
}

async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

// ─── Badge Management ─────────────────────────────────────────────

const BADGE_COLORS: Record<string, string> = {
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
};

async function updateExtBadge(tabId: number, score?: number): Promise<void> {
  if (score !== undefined) {
    const color = getRatingColor(score);
    await chrome.action.setBadgeText({ text: score.toFixed(1), tabId });
    await chrome.action.setBadgeBackgroundColor({
      color: BADGE_COLORS[color] || BADGE_COLORS.yellow,
      tabId,
    });
  } else {
    await chrome.action.setBadgeText({ text: "", tabId });
  }
}

// ─── Analysis State ───────────────────────────────────────────────

const activeAnalyses = new Map<string, Promise<void>>();

/**
 * Run analysis for a URL — opens side panel, extracts T&C text,
 * sends to LLM, and broadcasts results.
 */
async function runAnalysis(url: string, tabId?: number): Promise<void> {
  if (activeAnalyses.has(url)) {
    await activeAnalyses.get(url);
    return;
  }

  const analysisPromise = (async () => {
    try {
      const settings = await loadSettings();

      // Resolve the LLM config
      const llmConfig = { ...settings.llm };

      if (!llmConfig.apiKey) {
        broadcastError(
          url,
          "No access code configured. Please add your free Gemini code in settings. Get one from aistudio.google.com/apikey",
          true
        );
        return;
      }

      // Notify: analysis starting
      if (tabId) {
        await sendToTab(tabId, "BADGE_UPDATE", {
          url,
          status: "analyzing",
        } satisfies BadgeUpdateData);
      }

      const onProgress = (progress: AnalysisProgressData) => {
        chrome.runtime.sendMessage({
          type: "ANALYSIS_PROGRESS",
          data: progress,
        }).catch(() => {});
      };

      const { analysis, diff } = await analyzeTC(url, llmConfig, onProgress);

      // Broadcast result to side panel
      chrome.runtime.sendMessage({
        type: "ANALYSIS_RESULT",
        data: { result: analysis, diff },
      }).catch(() => {});

      // Update badges
      if (tabId) {
        await updateExtBadge(tabId, analysis.securityScore.overall);
        await sendToTab(tabId, "BADGE_UPDATE", {
          url,
          status: "cached",
          score: analysis.securityScore.overall,
        } satisfies BadgeUpdateData);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const retryable = !message.includes("API key") && !message.includes("sign in");
      broadcastError(url, message, retryable);

      if (tabId) {
        await sendToTab(tabId, "BADGE_UPDATE", {
          url,
          status: "error",
        } satisfies BadgeUpdateData);
      }
    } finally {
      activeAnalyses.delete(url);
    }
  })();

  activeAnalyses.set(url, analysisPromise);
  await analysisPromise;
}

function broadcastError(url: string, error: string, retryable: boolean): void {
  chrome.runtime.sendMessage({
    type: "ANALYSIS_ERROR",
    data: { url, error, retryable } satisfies AnalysisErrorData,
  }).catch(() => {});
}

// ─── Message Listeners ────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    message: { type: string; data: unknown },
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => {
    const { type, data } = message;

    switch (type) {
      // ── Detection ─────────────────────────────────
      case "TC_DETECTED": {
        const detected = data as TCDetectedData;
        const tabId = detected.tabId ?? sender.tab?.id;
        if (tabId) {
          chrome.action.setBadgeText({ text: "!", tabId }).catch(() => {});
          chrome.action.setBadgeBackgroundColor({
            color: "#6366f1",
            tabId,
          }).catch(() => {});
        }
        return false;
      }

      // ── Analysis ──────────────────────────────────
      case "ANALYZE_REQUEST": {
        const request = data as AnalyzeRequestData;
        const tabId = request.tabId ?? sender.tab?.id;
        runAnalysis(request.url, tabId);
        sendResponse({ status: "started" });
        return false;
      }

      case "RETRY_ANALYSIS": {
        const { url: retryUrl } = data as { url: string };
        const tabId = sender.tab?.id;
        runAnalysis(retryUrl, tabId);
        sendResponse({ status: "retrying" });
        return false;
      }

      case "GET_ANALYSIS": {
        const { url: analysisUrl } = data as { url: string };
        getCache()
          .then((cache) => cache.getAnalysis(analysisUrl))
          .then((result) => sendResponse(result || null));
        return true;
      }

      // ── Settings ──────────────────────────────────
      case "GET_SETTINGS": {
        loadSettings().then(sendResponse);
        return true;
      }

      case "SAVE_SETTINGS": {
        const settings = data as Settings;
        saveSettings(settings).then(() => {
          // If API key was provided, mark setup as complete
          if (settings.llm.apiKey) {
            completeSetupWithApiKey(settings.llm.provider)
              .then(() => sendResponse({ success: true }));
          } else {
            sendResponse({ success: true });
          }
        });
        return true;
      }

      // ── Auth ──────────────────────────────────────
      case "GET_AUTH_STATE": {
        loadAuthState().then(sendResponse);
        return true;
      }

      default:
        return false;
    }
  }
);

// ─── Install / Onboarding ─────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    // Check if already set up (e.g., re-install)
    const authState = await loadAuthState();
    if (!authState.setupComplete) {
      // Open the onboarding page in a new tab
      chrome.tabs.create({
        url: chrome.runtime.getURL("src/ui/onboarding/index.html"),
      });
    }
  }

});

// ─── Initialization ───────────────────────────────────────────────

getCache().catch((err) =>
  console.error("[fineprint] Failed to initialize cache:", err)
);

console.log("[fineprint] Service worker initialized");
