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
} from "@/shared/types";
import { sendToBackground } from "@/shared/messages";

type View = "summary" | "rating" | "diff" | "settings";

interface AnalysisState {
  result: AnalysisResult | null;
  diff: TCDiff | null;
  progress: AnalysisProgressData | null;
  error: AnalysisErrorData | null;
  loading: boolean;
}

export default function App() {
  const [view, setView] = useState<View>("rating");
  const [state, setState] = useState<AnalysisState>({
    result: null,
    diff: null,
    progress: null,
    error: null,
    loading: false,
  });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);

  // Load settings, auth state, and any cached analysis on mount
  useEffect(() => {
    sendToBackground("GET_SETTINGS", {}).then((res) => {
      if (res) setSettings(res as Settings);
    });
    sendToBackground("GET_AUTH_STATE", {}).then((res) => {
      if (res) setAuthState(res as AuthState);
    });

    // Check if there's a cached analysis for the current tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url;
      if (url && url.startsWith("http")) {
        sendToBackground("GET_ANALYSIS", { url }).then((cached) => {
          if (cached) {
            const result = cached as AnalysisResult;
            setState((prev) => ({
              ...prev,
              result,
              loading: false,
              error: null,
            }));
            setView("rating");
          }
        });
      }
    });
  }, []);

  // Listen for messages from service worker
  useEffect(() => {
    const listener = (message: { type: string; data: unknown }) => {
      switch (message.type) {
        case "ANALYSIS_RESULT": {
          const payload = message.data as {
            result?: AnalysisResult;
            analysis?: AnalysisResult;
            diff?: TCDiff | null;
          };
          const analysisResult = payload.result ?? payload.analysis;
          if (analysisResult) {
            setState((prev) => ({
              ...prev,
              result: analysisResult,
              diff: payload.diff ?? null,
              loading: false,
              error: null,
              progress: null,
            }));
            setView("rating");
          }
          break;
        }
        case "ANALYSIS_PROGRESS":
          setState((prev) => ({
            ...prev,
            progress: message.data as AnalysisProgressData,
            loading: true,
          }));
          break;
        case "ANALYSIS_ERROR":
          setState((prev) => ({
            ...prev,
            error: message.data as AnalysisErrorData,
            loading: false,
            progress: null,
          }));
          break;
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const handleRetry = useCallback(() => {
    if (!state.error) return;
    setState((prev) => ({ ...prev, error: null, loading: true }));
    sendToBackground("RETRY_ANALYSIS", { url: state.error.url });
  }, [state.error]);

  const handleAnalyzeCurrentPage = useCallback(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      const url = tab?.url;
      if (url && url.startsWith("http")) {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        sendToBackground("ANALYZE_REQUEST", { url, tabId: tab.id });
        // Dismiss the overlay on the page so the user isn't prompted again
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { type: "DISMISS_OVERLAY" }).catch(() => {});
        }
      }
    });
  }, []);

  const handleAnalyzeUrl = useCallback(() => {
    const url = manualUrl.trim();
    if (!url) return;
    const fullUrl = url.startsWith("http") ? url : `https://${url}`;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    sendToBackground("ANALYZE_REQUEST", { url: fullUrl });
    setManualUrl("");
    setShowUrlInput(false);
  }, [manualUrl]);

  const handleSaveSettings = useCallback(async (newSettings: Settings) => {
    await sendToBackground("SAVE_SETTINGS", newSettings);
    setSettings(newSettings);
    const freshAuth = await sendToBackground("GET_AUTH_STATE", {});
    if (freshAuth) setAuthState(freshAuth as AuthState);
  }, []);

  const isConfigured =
    authState?.signedIn ||
    (settings?.llm.apiKey && settings.llm.apiKey.length > 0);

  // Only show tabs that have content
  const availableTabs: Array<{ key: View; label: string }> = [
    { key: "rating", label: "Security" },
    { key: "summary", label: "Summary" },
  ];
  if (state.diff) {
    availableTabs.push({ key: "diff", label: "Changes" });
  }

  return (
    <div className="flex flex-col" style={{ width: 380, minHeight: 480, maxHeight: 580 }}>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🛡️</span>
            <h1 className="font-semibold text-base text-gray-900">
              FinePrint
            </h1>
          </div>
          <button
            onClick={() => setView(view === "settings" ? "rating" : "settings")}
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

        {/* Tab navigation — only show when we have results */}
        {state.result && view !== "settings" && (
          <nav className="flex gap-1 mt-2 -mb-3">
            {availableTabs.map(({ key, label }) => (
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
          </nav>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {view === "settings" ? (
          <SettingsView
            settings={settings}
            onSave={handleSaveSettings}
          />
        ) : !isConfigured ? (
          <EmptyState
            title="Welcome to FinePrint"
            message="To analyze Terms & Conditions, you'll need a free Gemini access code. It takes 30 seconds to set up."
            actionLabel="Set Up Now"
            onAction={() => setView("settings")}
          />
        ) : state.loading ? (
          <LoadingState progress={state.progress} />
        ) : state.error ? (
          <ErrorState error={state.error} onRetry={handleRetry} />
        ) : state.result ? (
          <>
            {view === "summary" && <SummaryView result={state.result} />}
            {view === "rating" && (
              <RatingView score={state.result.securityScore} />
            )}
            {view === "diff" && <DiffView diff={state.diff} />}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 min-h-[360px]">
            <span className="text-4xl">🛡️</span>
            <h2 className="text-base font-semibold text-gray-800">
              Ready to analyze
            </h2>
            <p className="text-sm text-gray-500 max-w-[260px]">
              Click the shield badge next to any T&C or Privacy link on a webpage. Or analyze a page directly:
            </p>

            {/* Analyze current page button */}
            <button
              onClick={handleAnalyzeCurrentPage}
              className="w-full max-w-[240px] px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Analyze This Page
            </button>

            {/* Manual URL input toggle */}
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
