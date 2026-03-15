import { useEffect, useState } from "react";
import type { AnalysisResult, DetectedLink, AuthState } from "@/shared/types";
import { sendToBackground } from "@/shared/messages";

/**
 * Quick-glance popup shown when clicking the extension icon in the toolbar.
 *
 * Shows detected T&C links on the current page and their analysis status.
 * Each link can be individually analyzed. "Open Full Analysis" opens the
 * side panel for the detailed view.
 */
export default function Popup() {
  const [links, setLinks] = useState<DetectedLink[]>([]);
  const [analyses, setAnalyses] = useState<Map<string, AnalysisResult>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState<Set<string>>(new Set());
  const [authState, setAuthState] = useState<AuthState | null>(null);

  useEffect(() => {
    // Load auth state
    sendToBackground("GET_AUTH_STATE", {}).then((state) => {
      if (state) setAuthState(state as AuthState);
    });

    // Query the current tab for detected links
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        setLoading(false);
        return;
      }

      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: "GET_DETECTED_LINKS",
        });
        if (response?.links) {
          const detectedLinks = response.links as DetectedLink[];
          setLinks(detectedLinks);

          // Check cache for each link
          const analysisMap = new Map<string, AnalysisResult>();
          for (const link of detectedLinks) {
            const result = await sendToBackground("GET_ANALYSIS", {
              url: link.url,
            });
            if (result) {
              analysisMap.set(link.url, result as AnalysisResult);
            }
          }
          setAnalyses(analysisMap);
        }
      } catch {
        // Content script not loaded on this page (e.g., chrome:// pages)
      }
      setLoading(false);
    });
  }, []);

  const handleAnalyze = (url: string) => {
    setAnalyzing((prev) => new Set(prev).add(url));
    // Send analysis request — this also opens the side panel
    sendToBackground("ANALYZE_REQUEST", { url });
    // Close popup after a short delay to let the side panel open
    setTimeout(() => window.close(), 300);
  };

  const openSidePanel = () => {
    chrome.runtime.sendMessage({ type: "OPEN_SIDE_PANEL", data: {} });
    window.close();
  };

  const openSettings = () => {
    // Open the onboarding/settings page
    chrome.runtime.getURL("src/ui/onboarding/index.html");
    chrome.tabs.create({
      url: chrome.runtime.getURL("src/ui/onboarding/index.html"),
    });
    window.close();
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[120px]">
        <p className="text-sm text-gray-400">Scanning page...</p>
      </div>
    );
  }

  const isConfigured = authState?.signedIn;

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">🛡️</span>
        <h1 className="font-semibold text-sm">Term Reader</h1>
      </div>

      {/* Not signed in — prompt setup */}
      {!isConfigured && (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 space-y-2">
          <p className="text-xs text-amber-800">
            Sign in to start analyzing Terms & Conditions.
          </p>
          <button
            onClick={openSettings}
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            Set up now &rarr;
          </button>
        </div>
      )}

      {links.length === 0 ? (
        <p className="text-xs text-gray-500 py-2">
          No Terms & Conditions detected on this page.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            {links.length} T&C link{links.length !== 1 ? "s" : ""} detected:
          </p>
          {links.map((link) => {
            const analysis = analyses.get(link.url);
            const isAnalyzing = analyzing.has(link.url);
            return (
              <div
                key={link.url}
                className="px-3 py-2 rounded-md border border-gray-200 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-800 truncate max-w-[180px]">
                    {link.linkText || link.url}
                  </span>
                  {analysis ? (
                    <ScoreBadge score={analysis.securityScore.overall} />
                  ) : (
                    <span className="text-[10px] text-gray-400">
                      {link.type}
                    </span>
                  )}
                </div>
                {analysis ? (
                  <button
                    onClick={openSidePanel}
                    className="text-[11px] text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View Summary &rarr;
                  </button>
                ) : (
                  <button
                    onClick={() => handleAnalyze(link.url)}
                    disabled={!isConfigured || isAnalyzing}
                    className="text-[11px] text-blue-600 hover:text-blue-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    {isAnalyzing ? "Analyzing..." : "Analyze"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {links.length > 0 && links.some((l) => analyses.has(l.url)) && (
        <button
          onClick={openSidePanel}
          className="w-full py-2 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          Open Full Analysis
        </button>
      )}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 8
      ? "bg-green-100 text-green-700"
      : score >= 4
        ? "bg-amber-100 text-amber-700"
        : "bg-red-100 text-red-700";

  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${color}`}>
      {score.toFixed(1)}
    </span>
  );
}
