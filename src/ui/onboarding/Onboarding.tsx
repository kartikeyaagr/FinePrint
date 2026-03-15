import { useState } from "react";

type Step = "welcome" | "done";

export function Onboarding() {
  const [step, setStep] = useState<Step>("welcome");
  const [error, setError] = useState("");
  const [apiKey, setApiKey] = useState("");
  const provider = "gemini" as const;

  const handleSubmit = async () => {
    if (!apiKey.trim()) return;
    setError("");
    try {
      await chrome.runtime.sendMessage({
        type: "SAVE_SETTINGS",
        data: {
          llm: {
            provider,
            apiKey: apiKey.trim(),
          },
          notifications: { showOverlay: true, overlayDismissedDomains: [] },
          detection: { enabled: true, confidenceThreshold: 0.5 },
        },
      });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-8">
      <div className="max-w-lg w-full">
        {step === "welcome" && (
          <div className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
            <div className="text-center space-y-3">
              <span className="text-5xl block">🛡️</span>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome to Term Reader
              </h1>
              <p className="text-gray-500 text-sm leading-relaxed">
                Understand Terms & Conditions before you agree.
                Get plain-English summaries and security ratings for any legal document.
              </p>
            </div>

            <div className="space-y-4">
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-gray-700">
                  Quick setup — get a free access code
                </p>
                <p className="text-xs text-gray-400">
                  Term Reader uses Google&apos;s Gemini AI to analyze documents.
                  You&apos;ll need a free access code (takes 30 seconds).
                </p>
              </div>

              {/* Step-by-step instructions */}
              <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
                  <li>
                    Open{" "}
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-medium text-blue-600"
                    >
                      Google AI Studio
                    </a>
                    {" "}(sign in with your Google account)
                  </li>
                  <li>Click <strong>&quot;Create API key&quot;</strong></li>
                  <li>Copy the code and paste it below</li>
                </ol>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">
                  Paste your access code
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="AI..."
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600">{error}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={!apiKey.trim()}
                className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Finish Setup
              </button>
            </div>

            <div className="text-center">
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Your documents are analyzed using your own AI account.
                Term Reader never stores your data on any external server.
              </p>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center space-y-4">
            <span className="text-5xl block">🎉</span>
            <h2 className="text-xl font-bold text-gray-900">
              You&apos;re all set!
            </h2>
            <div className="bg-blue-50 rounded-lg p-4 text-left space-y-2">
              <p className="text-sm font-medium text-blue-900">How it works:</p>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Browse any website normally</li>
                <li>Look for the 🛡️ shield next to T&C and Privacy links</li>
                <li>Click the shield to get a plain-English summary</li>
                <li>Or click the Term Reader icon in your toolbar anytime</li>
              </ol>
            </div>
            <button
              onClick={() => window.close()}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start Browsing
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
