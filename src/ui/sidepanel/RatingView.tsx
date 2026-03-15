import type { SecurityScore } from "@/shared/types";

interface RatingViewProps {
  score: SecurityScore;
}

const DIMENSIONS: Array<{
  key: keyof SecurityScore["breakdown"];
  label: string;
  description: string;
}> = [
  {
    key: "dataCollection",
    label: "Data Collection",
    description: "How much personal data is collected",
  },
  {
    key: "dataSharing",
    label: "Data Sharing",
    description: "Whether data is sold or shared with third parties",
  },
  {
    key: "userRights",
    label: "User Rights",
    description: "Your ability to delete, export, or control your data",
  },
  {
    key: "liability",
    label: "Liability",
    description: "How much liability the company disclaims",
  },
  {
    key: "transparency",
    label: "Transparency",
    description: "How clear and readable the terms are",
  },
];

export function RatingView({ score }: RatingViewProps) {
  const color = getScoreColor(score.overall);

  return (
    <div className="p-4 space-y-5">
      {/* Overall score */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2">
          <span
            className={`text-4xl font-bold ${color.text}`}
          >
            {score.overall.toFixed(1)}
          </span>
          <span className="text-gray-400 text-lg">/ 10</span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${color.bar}`}
            style={{ width: `${Math.min(100, Math.max(0, score.overall * 10))}%` }}
          />
        </div>
        <p className={`text-sm font-medium ${color.text}`}>
          {getScoreLabel(score.overall)}
        </p>
        <p className="text-xs text-gray-400 max-w-[260px]">
          {getScoreExplanation(score.overall)}
        </p>
      </div>

      {/* Dimension breakdown */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Score Breakdown
        </h3>
        {DIMENSIONS.map((dim) => {
          const value = score.breakdown[dim.key];
          const dimColor = getScoreColor(value);
          return (
            <div key={dim.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-800">
                    {dim.label}
                  </span>
                  {dim.key === "dataSharing" && (
                    <span className="ml-1 text-[10px] text-gray-400">2x weight</span>
                  )}
                </div>
                <span className={`text-sm font-semibold ${dimColor.text}`}>
                  {value}
                </span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${dimColor.bar}`}
                  style={{ width: `${Math.min(100, Math.max(0, value * 10))}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-400">{dim.description}</p>
            </div>
          );
        })}
      </div>

      {/* Scoring explainer */}
      <div className="text-[10px] text-gray-400 space-y-1 pt-2 border-t border-gray-100">
        <p>
          <span className="font-medium">How scores work:</span> 10 = best for
          you (privacy-respecting, fair terms). 1 = worst (invasive, one-sided).
        </p>
        <p>Data Sharing is weighted 2x because it has the most direct impact on your privacy.</p>
      </div>
    </div>
  );
}

function getScoreColor(score: number) {
  if (score >= 8) return { text: "text-green-600", bar: "bg-green-500" };
  if (score >= 4) return { text: "text-amber-600", bar: "bg-amber-500" };
  return { text: "text-red-600", bar: "bg-red-500" };
}

function getScoreLabel(score: number) {
  if (score >= 8) return "Low Risk";
  if (score >= 4) return "Medium Risk";
  return "High Risk";
}

function getScoreExplanation(score: number): string {
  if (score >= 8) return "These terms are mostly fair and respect your privacy. Safe to agree for most people.";
  if (score >= 4) return "Some concerning clauses found. Read the summary before agreeing.";
  return "Significant red flags detected. Proceed with caution — your rights or privacy may be at risk.";
}
