/**
 * Chrome storage helpers for settings and session state.
 *
 * Uses chrome.storage.local for persistent data (settings, API keys)
 * and chrome.storage.session for per-session data (overlay dismissals).
 */

import type { Settings } from "@/shared/types";
import { DEFAULT_SETTINGS } from "@/shared/types";

const SETTINGS_KEY = "fineprint-settings";

/** Load settings from chrome.storage.local, returning defaults if none saved. */
export async function loadSettings(): Promise<Settings> {
  try {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    if (result[SETTINGS_KEY]) {
      // Merge with defaults to handle schema evolution — new fields get defaults
      return { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] };
    }
  } catch (err) {
    console.error("[fineprint] Failed to load settings:", err);
  }
  return { ...DEFAULT_SETTINGS };
}

/** Save settings to chrome.storage.local. */
export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  } catch (err) {
    console.error("[fineprint] Failed to save settings:", err);
  }
}

/** Check if overlay was dismissed for this domain (session-scoped). */
export async function isOverlayDismissed(domain: string): Promise<boolean> {
  try {
    const result = await chrome.storage.session.get("dismissed-overlays");
    const dismissed: string[] = result["dismissed-overlays"] ?? [];
    return dismissed.includes(domain);
  } catch {
    return false;
  }
}

/** Mark overlay as dismissed for this domain (session-scoped). */
export async function dismissOverlay(domain: string): Promise<void> {
  try {
    const result = await chrome.storage.session.get("dismissed-overlays");
    const dismissed: string[] = result["dismissed-overlays"] ?? [];
    if (!dismissed.includes(domain)) {
      dismissed.push(domain);
      await chrome.storage.session.set({ "dismissed-overlays": dismissed });
    }
  } catch (err) {
    console.error("[fineprint] Failed to dismiss overlay:", err);
  }
}
