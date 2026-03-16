import { useEffect, useState, useCallback } from "react";
import { SummaryView } from "./SummaryView";
import { RatingView } from "./RatingView";
import { DiffView } from "./DiffView";
import { SettingsView } from "./SettingsView";
import { EmptyState } from "./EmptyState";
import { LoadingState } from "./LoadingState";
import { ErrorState } from "./ErrorState";
import type {
  AnalysisResult,
  AnalysisProgressData,
  AnalysisErrorData,
  TCDiff,
  Settings,
  AuthState,
  DetectedLink,
} from "@/shared/types";
import { sendToBackground } from "@/shared/messages";

type ContentView = "rating" | "summary" | "diff";

interface DocumentState {
  result: AnalysisResult | null;
  diff: TCDiff | null;
  loading: boolean;
  progress: AnalysisProgressData | null;
  error: AnalysisErrorData | null;
  linkType: DetectedLink["type"];
  linkText: string;
}

function docTabLabel(doc: DocumentState): string {
  // Prefer deriving from the result title if we have it
  if (doc.result?.title) {
    const t = doc.result.title.toLowerCase();
    if (t.includes("term") || t.includes("condition")) return "Terms";
    if (t.includes("privac")) return "Privacy";
    if (t.includes("cook")) return "Cookies";
    if (t.includes("eula") || t.includes("licen")) return "EULA";
  }
  switch (doc.linkType) {
    case "terms": return "Terms";
    case "privacy": return "Privacy";
    case "cookies": return "Cookies";
    case "eula": return "EULA";
    default: return "Policy";
  }
}

const EMPTY_DOC: DocumentState = {
  result: null,
  diff: null,
  loading: false,
  progress: null,
  error: null,
  linkType: "other",
  linkText: "",
};

export default function App() {
  const [documents, setDocuments] = useState<Map<string, DocumentState>>(new Map());
  const [urlOrder, setUrlOrder] = useState<string[]>([]);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [view, setView] = useState<ContentView>("rating");
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);

  const upsertDocument = useCallback(
    (url: string, patch: Partial<DocumentState>, opts?: { noOverwrite?: boolean }) => {
      setDocuments((prev) => {
        if (opts?.noOverwrite && prev.has(url)) return prev;
        const next = new Map(prev);
        next.set(url, { ...(prev.get(url) ?? EMPTY_DOC), ...patch });
        return next;
      });
      setUrlOrder((prev) => (prev.includes(url) ? prev : [...prev, url]));
    },
    []
  );

  // Load settings + cached analyses on mount
  useEffect(() => {
    sendToBackground("GET_SETTINGS", {}).then((res) => {
      if (res) setSettings(res as Settings);
    });
    sendToBackground("GET_AUTH_STATE", {}).then((res) => {
      if (res) setAuthState(res as AuthState);
    });

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) return;
      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: "GET_DETECTED_LINKS",
        });
        const links = response?.links as DetectedLink[] | undefined;
        if (!links?.length) return;
        for (const link of links) {
          const cached = await sendToBackground("GET_ANALYSIS", { url: link.url });
          if (cached) {
            const result = cached as AnalysisResult;
            upsertDocument(link.url, {
              result,
              diff: null,
              loading: false,
              progress: null,
              error: null,
              linkType: link.type,
              linkText: link.linkText,
            });
          }
        }
      } catch {
        // Tab may not have the content script (e.g., chrome:// pages) — ignore
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-activate first document when list gains its first entry
  useEffect(() => {
    if (!activeUrl && urlOrder.length > 0) {
      setActiveUrl(urlOrder[0]);
    }
  }, [urlOrder, activeUrl]);

  // Message listener
  useEffect(() => {
    const listener = (message: { type: string; data: unknown }) => {
      switch (message.type) {
        case "MULTI_ANALYSIS_STARTED": {
          const { links } = message.data as { links: DetectedLink[] };
          for (const link of links) {
            upsertDocument(
              link.url,
              { loading: true, progress: null, error: null, linkType: link.type, linkText: link.linkText },
              { noOverwrite: false }
            );
          }
          if (links[0]) setActiveUrl(links[0].url);
          setShowSettings(false);
          setView("rating");
          break;
        }

        case "ANALYSIS_PROGRESS": {
          const progress = message.data as AnalysisProgressData;
          // Auto-init if we haven't heard about this URL yet (panel opened after MULTI_ANALYSIS_STARTED)
          upsertDocument(progress.url, { progress, loading: true }, { noOverwrite: false });
          setActiveUrl((prev) => prev ?? progress.url);
          break;
        }

        case "ANALYSIS_RESULT": {
          const payload = message.data as {
            result?: AnalysisResult;
            analysis?: AnalysisResult;
            diff?: TCDiff | null;
          };
          const result = payload.result ?? payload.analysis;
          if (result) {
            upsertDocument(result.url, {
              result,
              diff: payload.diff ?? null,
              loading: false,
              progress: null,
              error: null,
              // Update label with real title from analysis
              linkText: result.title || result.url,
            });
            setActiveUrl((prev) => prev ?? result.url);
            setView("rating");
          }
          break;
        }

        case "ANALYSIS_ERROR": {
          const error = message.data as AnalysisErrorData;
          upsertDocument(error.url, { error, loading: false, progress: null });
          break;
        }
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [upsertDocument]);

  const activeDoc = activeUrl ? (documents.get(activeUrl) ?? null) : null;

  const handleRetry = useCallback(() => {
    if (!activeDoc?.error) return;
    const url = activeDoc.error.url;
    upsertDocument(url, { error: null, loading: true });
    sendToBackground("RETRY_ANALYSIS", { url });
  }, [activeDoc, upsertDocument]);

  const handleAnalyzeCurrentPage = useCallback(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (!tab?.id || !tab.url?.startsWith("http")) return;
      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: "GET_DETECTED_LINKS",
        });
        const links = (response?.links as DetectedLink[]) ?? [];
        if (links.length > 0) {
          sendToBackground("ANALYZE_ALL_REQUEST", { links, tabId: tab.id });
        } else {
          sendToBackground("ANALYZE_REQUEST", { url: tab.url, tabId: tab.id });
        }
      } catch {
        sendToBackground("ANALYZE_REQUEST", { url: tab.url, tabId: tab.id });
      }
      chrome.tabs.sendMessage(tab.id, { type: "DISMISS_OVERLAY" }).catch(() => {});
    });
  }, []);

  const handleAnalyzeUrl = useCallback(() => {
    const url = manualUrl.trim();
    if (!url) return;
    const fullUrl = url.startsWith("http") ? url : `https://${url}`;
    upsertDocument(fullUrl, { loading: true, error: null, linkType: "other", linkText: fullUrl });
    setActiveUrl(fullUrl);
    sendToBackground("ANALYZE_REQUEST", { url: fullUrl });
    setManualUrl("");
    setShowUrlInput(false);
  }, [manualUrl, upsertDocument]);

  const handleSaveSettings = useCallback(async (newSettings: Settings) => {
    await sendToBackground("SAVE_SETTINGS", newSettings);
    setSettings(newSettings);
    const freshAuth = await sendToBackground("GET_AUTH_STATE", {});
    if (freshAuth) setAuthState(freshAuth as AuthState);
  }, []);

  const isConfigured =
    authState?.signedIn || (settings?.llm.apiKey && settings.llm.apiKey.length > 0);

  const hasMultipleDocs = urlOrder.length > 1;

  const availableViewTabs: Array<{ key: ContentView; label: string }> = [
    { key: "rating", label: "Security" },
    { key: "summary", label: "Summary" },
  ];
  if (activeDoc?.diff) {
    availableViewTabs.push({ key: "diff", label: "Changes" });
  }

  return (
    <div className="w-full h-screen flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        {/* Title row */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img src="/public/icons/icon-32.png" alt="FinePrint" className="w-5 h-5" />
            <h1 className="font-semibold text-base text-gray-900">FinePrint</h1>
          </div>
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
            aria-label="Settings"
          >
            <svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>

        {/* Document tabs — top navbar row (shown when any docs are tracked) */}
        {!showSettings && urlOrder.length > 0 && (
          <div
            className={`flex overflow-x-auto px-2 ${hasMultipleDocs ? "border-b border-gray-100" : ""}`}
            style={{ scrollbarWidth: "none" }}
          >
            {urlOrder.map((url) => {
              const doc = documents.get(url);
              if (!doc) return null;
              const label = docTabLabel(doc);
              const isActive = url === activeUrl;
              return (
                <button
                  key={url}
                  onClick={() => {
                    setActiveUrl(url);
                    // Reset view to rating when switching documents
                    setView("rating");
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${
                    isActive
                      ? "border-indigo-500 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {doc.loading && (
                    <span
                      className="inline-block w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  {doc.error && !doc.result && (
                    <span className="text-red-500 font-bold">!</span>
                  )}
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* View tabs — bottom navbar row (shown when active doc has a result) */}
        {!showSettings && activeDoc?.result && (
          <div className="flex gap-1 px-4 pt-1 -mb-px">
            {availableViewTabs.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-t-md border-b-2 transition-colors ${
                  view === key
                    ? "border-blue-500 text-blue-600 bg-blue-50"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* ── Content ────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        {showSettings ? (
          <SettingsView settings={settings} onSave={handleSaveSettings} />
        ) : !isConfigured ? (
          <EmptyState
            title="Welcome to FinePrint"
            message="To analyze Terms & Conditions, you'll need a free Gemini access code. It takes 30 seconds to set up."
            actionLabel="Set Up Now"
            onAction={() => setShowSettings(true)}
          />
        ) : activeDoc?.loading ? (
          <LoadingState progress={activeDoc.progress} />
        ) : activeDoc?.error && !activeDoc.result ? (
          <ErrorState error={activeDoc.error} onRetry={handleRetry} />
        ) : activeDoc?.result ? (
          <>
            {view === "summary" && <SummaryView result={activeDoc.result} />}
            {view === "rating" && <RatingView score={activeDoc.result.securityScore} />}
            {view === "diff" && <DiffView diff={activeDoc.diff} />}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 min-h-full">
            <span className="text-4xl">🛡️</span>
            <h2 className="text-base font-semibold text-gray-800">Ready to analyze</h2>
            <p className="text-sm text-gray-500 max-w-[260px]">
              Click the shield badge next to any T&C or Privacy link on a webpage. Or analyze a
              page directly:
            </p>

            <button
              onClick={handleAnalyzeCurrentPage}
              className="w-full max-w-[240px] px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Analyze This Page
            </button>

            {!showUrlInput ? (
              <button
                onClick={() => setShowUrlInput(true)}
                className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
              >
                Or paste a specific URL
              </button>
            ) : (
              <div className="w-full max-w-[280px] space-y-2">
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAnalyzeUrl()}
                    placeholder="example.com/privacy"
                    className="flex-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                  <button
                    onClick={handleAnalyzeUrl}
                    disabled={!manualUrl.trim()}
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    Go
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
