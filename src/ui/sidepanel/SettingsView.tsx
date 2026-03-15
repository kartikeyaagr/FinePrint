import { useState, useEffect } from "react";
import type { Settings } from "@/shared/types";
import { DEFAULT_SETTINGS } from "@/shared/types";

interface SettingsViewProps {
  settings: Settings | null;
  onSave: (settings: Settings) => void;
}

export function SettingsView({ settings, onSave }: SettingsViewProps) {
  const [local, setLocal] = useState<Settings>(settings ?? DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (settings) setLocal(settings);
  }, [settings]);

  const handleSave = () => {
    onSave(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateLLM = (updates: Partial<Settings["llm"]>) => {
    setLocal((prev) => ({
      ...prev,
      llm: { ...prev.llm, ...updates },
    }));
  };

  return (
    <div className="p-4 space-y-6">
      {/* Access Code Section */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Gemini Access Code
        </h3>

        <ApiKeyInput
          value={local.llm.apiKey}
          onChange={(key) => updateLLM({ apiKey: key })}
          showKey={showKey}
          onToggleShow={() => setShowKey(!showKey)}
          placeholder="AI..."
          helpText="Get your free code from aistudio.google.com/apikey (takes 30 seconds)"
          helpLink="https://aistudio.google.com/apikey"
          helpLinkLabel="Google AI Studio"
          helpExtra="sign in with Google, click &quot;Create API key&quot;, and paste it here"
        />
      </section>

      {/* Detection Settings */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Detection
        </h3>
        <label className="flex items-center justify-between">
          <span className="text-sm text-gray-700">Auto-detect T&C links</span>
          <input
            type="checkbox"
            checked={local.detection.enabled}
            onChange={(e) =>
              setLocal((prev) => ({
                ...prev,
                detection: { ...prev.detection, enabled: e.target.checked },
              }))
            }
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
        </label>
        <label className="flex items-center justify-between">
          <span className="text-sm text-gray-700">
            Show &quot;Read first&quot; prompts
          </span>
          <input
            type="checkbox"
            checked={local.notifications.showOverlay}
            onChange={(e) =>
              setLocal((prev) => ({
                ...prev,
                notifications: {
                  ...prev.notifications,
                  showOverlay: e.target.checked,
                },
              }))
            }
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
        </label>
      </section>

      {/* Save button */}
      <button
        onClick={handleSave}
        className={`w-full py-2 rounded-md text-sm font-medium transition-colors ${
          saved
            ? "bg-green-500 text-white"
            : "bg-blue-600 text-white hover:bg-blue-700"
        }`}
      >
        {saved ? "Saved!" : "Save Settings"}
      </button>

      {/* About */}
      <div className="text-[10px] text-gray-400 space-y-1 pt-2 border-t border-gray-100">
        <p><span className="font-medium">Term Reader v0.1.0</span></p>
        <p>
          All analysis runs through your own AI account.
          Your credentials are stored locally and never sent to our servers.
        </p>
      </div>
    </div>
  );
}

function ApiKeyInput({
  value,
  onChange,
  showKey,
  onToggleShow,
  placeholder,
  helpText,
  helpLink,
  helpLinkLabel,
  helpExtra,
}: {
  value: string;
  onChange: (key: string) => void;
  showKey: boolean;
  onToggleShow: () => void;
  placeholder: string;
  helpText: string;
  helpLink?: string;
  helpLinkLabel?: string;
  helpExtra?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          type={showKey ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          onClick={onToggleShow}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
        >
          {showKey ? "Hide" : "Show"}
        </button>
      </div>
      <p className="text-[11px] text-gray-400">
        {helpLink ? (
          <>
            Get your free code from{" "}
            <a
              href={helpLink}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-blue-500 hover:text-blue-600"
            >
              {helpLinkLabel}
            </a>
            {helpExtra && <> — {helpExtra}</>}
          </>
        ) : (
          helpText
        )}
        . Your code is stored on your device only — never sent to our servers.
      </p>
    </div>
  );
}
