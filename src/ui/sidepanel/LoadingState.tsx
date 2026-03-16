import type { AnalysisProgressData } from "@/shared/types";

interface LoadingStateProps {
  progress: AnalysisProgressData | null;
}

const STAGE_LABELS: Record<string, string> = {
  extracting: "Extracting document text...",
  scanning_flags: "Scanning for red flags...",
  analyzing: "Analyzing with AI...",
  parsing: "Processing results...",
  caching: "Saving analysis...",
};

export function LoadingState({ progress }: LoadingStateProps) {
  const stage = progress?.stage ?? "extracting";
  const pct = progress ? Math.round(progress.progress * 100) : 0;

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 min-h-full">
      {/* Spinning shield */}
      <div className="animate-spin text-4xl">🛡️</div>

      <div className="space-y-2">
        <h2 className="text-base font-semibold text-gray-800">
          Analyzing Terms
        </h2>
        <p className="text-sm text-gray-500">
          {STAGE_LABELS[stage] ?? "Working..."}
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-48 space-y-1">
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[10px] text-gray-400">{pct}%</p>
      </div>
    </div>
  );
}
