/**
 * Authentication state management for FinePrint.
 *
 * Tracks whether the user has completed setup and which provider they use.
 */

import type { AuthState, LLMProvider } from "../shared/types";
import { DEFAULT_AUTH_STATE } from "../shared/types";

const AUTH_STATE_KEY = "fineprint-auth-state";

// ─── State Persistence ───────────────────────────────────────────

export async function loadAuthState(): Promise<AuthState> {
  try {
    const result = await chrome.storage.local.get(AUTH_STATE_KEY);
    if (result[AUTH_STATE_KEY]) {
      return { ...DEFAULT_AUTH_STATE, ...result[AUTH_STATE_KEY] };
    }
  } catch (err) {
    console.error("[fineprint] Failed to load auth state:", err);
  }
  return { ...DEFAULT_AUTH_STATE };
}

export async function saveAuthState(state: AuthState): Promise<void> {
  await chrome.storage.local.set({ [AUTH_STATE_KEY]: state });
}

// ─── API Key Setup ───────────────────────────────────────────────

/**
 * Mark setup as complete with a manual API key.
 */
export async function completeSetupWithApiKey(
  provider: LLMProvider
): Promise<AuthState> {
  const state: AuthState = {
    signedIn: true,
    provider,
    setupComplete: true,
  };
  await saveAuthState(state);
  return state;
}
