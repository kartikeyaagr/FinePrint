import type { AnalysisErrorData } from "@/shared/types";

interface ErrorStateProps {
  error: AnalysisErrorData;
  onRetry: () => void;
}

/** Map technical errors to user-friendly messages. */
function friendlyMessage(raw: string): string {
  if (raw.includes("API key")) return "Your access code isn't working. Please check it in settings.";
  if (raw.includes("sign in")) return "Please set up your account in settings first.";
  if (raw.includes("Rate limit")) return "Too many requests. Please wait a minute and try again.";
  if (raw.includes("extraction failed")) return "We couldn't read this page. It might be behind a login or in an unsupported format.";
  if (raw.includes("No text content")) return "This page doesn't seem to have readable text. It might be loading dynamically.";
  if (raw.includes("timeout") || raw.includes("Timeout")) return "The analysis is taking too long. Please try again.";
  if (raw.includes("expired")) return "Your session expired. Please update your access code in settings.";
  return raw;
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center space-y-3 min-h-[300px]">
      <span className="text-4xl">⚠️</span>
      <h2 className="text-base font-semibold text-gray-800">
        Something went wrong
      </h2>
      <p className="text-sm text-gray-500 max-w-[260px]">
        {friendlyMessage(error.error)}
      </p>
      {error.retryable && (
        <button
          onClick={onRetry}
          className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
