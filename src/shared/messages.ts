/**
 * Type-safe message passing between content script, service worker, and UI.
 *
 * Uses Chrome's runtime.sendMessage / runtime.onMessage for extension-wide
 * messaging, and tabs.sendMessage for targeted tab communication.
 */

import type { Message } from "./types";

/**
 * Send a message to the service worker (from content script or UI).
 */
export async function sendToBackground<T>(
  type: Message["type"],
  data: T
): Promise<unknown> {
  return chrome.runtime.sendMessage({ type, data });
}

/**
 * Send a message to a specific tab's content script (from service worker).
 */
export async function sendToTab<T>(
  tabId: number,
  type: Message["type"],
  data: T
): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type, data });
  } catch {
    // Tab may have been closed or navigated away — silently ignore
    console.debug(`[term-reader] Failed to send ${type} to tab ${tabId}`);
  }
}

/**
 * Listen for messages of a specific type.
 * Returns an unsubscribe function.
 */
export function onMessage<T>(
  type: Message["type"],
  handler: (data: T, sender: chrome.runtime.MessageSender) => void | Promise<unknown>
): () => void {
  const listener = (
    message: Message<T>,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => {
    if (message.type !== type) return false;
    const result = handler(message.data as T, sender);
    if (result instanceof Promise) {
      result.then(sendResponse).catch((err) => {
        console.error(`[term-reader] Error handling ${type}:`, err);
        sendResponse({ error: String(err) });
      });
      return true; // Keep message channel open for async response
    }
    return false;
  };

  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}
