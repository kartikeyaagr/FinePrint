import { useState } from "react";
import type { AnalysisResult, ClauseAnalysis } from "@/shared/types";
import { WORDS_PER_MINUTE } from "@/shared/constants";

interface SummaryViewProps {
  result: AnalysisResult;
}

export function SummaryView({ result }: SummaryViewProps) {
  return (
    <div className="p-4 space-y-4 min-h-full">
      {/* Page info + reading time */}
      <div className="space-y-1">
        <h2 className="font-semibold text-gray-900">{result.title}</h2>
        <p className="text-xs text-gray-500">{result.domain}</p>
        <ReadingTime wordCount={result.wordCount} />
      </div>

      {/* Overall summary */}
      <p className="text-sm text-gray-700 leading-relaxed">{result.summary}</p>

      {/* Worst clause spotlight */}
      {result.worstClause && result.clauses[result.worstClause.index] && (
        <WorstClauseCard
          clause={result.clauses[result.worstClause.index]}
          reason={result.worstClause.reason}
        />
      )}

      {/* Red flags (instant, no LLM needed) */}
      {result.redFlags.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-red-700 uppercase tracking-wide flex items-center gap-1">
            <span>🚩</span> Red Flags
          </h3>
          <ul className="space-y-1.5">
            {result.redFlags.map((flag, i) => (
              <li
                key={i}
                className={`text-xs px-3 py-2 rounded-md ${
                  flag.severity === "critical"
                    ? "bg-red-50 text-red-800 border border-red-200"
                    : "bg-amber-50 text-amber-800 border border-amber-200"
                }`}
              >
                <span className="font-medium">{flag.pattern}:</span>{" "}
                {flag.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Clause breakdown */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Full Analysis
        </h3>
        {result.clauses.map((clause, i) => (
          <ClauseCard key={i} clause={clause} />
        ))}
      </div>

      {/* Footer */}
      <p className="text-[10px] text-gray-400 pt-2 border-t border-gray-100">
        Analyzed {new Date(result.analyzedAt).toLocaleDateString()} via Gemini.
        AI-generated summary — verify important details.
      </p>
    </div>
  );
}

function ReadingTime({ wordCount }: { wordCount: number }) {
  const minutes = Math.ceil(wordCount / WORDS_PER_MINUTE);
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">
      <span>⏱</span>
      <span>
        <span className="font-semibold">{minutes} min</span> to read original
        &middot; ~2 min summary
      </span>
    </div>
  );
}

function WorstClauseCard({
  clause,
  reason,
}: {
  clause: ClauseAnalysis;
  reason: string;
}) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
      <h3 className="text-xs font-semibold text-red-700 uppercase tracking-wide flex items-center gap-1">
        <span>⚠️</span> Biggest Concern
      </h3>
      {clause.originalExcerpt && (
        <blockquote className="text-xs text-red-900 italic border-l-2 border-red-300 pl-2">
          &ldquo;{clause.originalExcerpt}&rdquo;
        </blockquote>
      )}
      <p className="text-sm text-red-800">{clause.summary}</p>
      <p className="text-xs text-red-600">{reason}</p>
    </div>
  );
}

function ClauseCard({ clause }: { clause: ClauseAnalysis }) {
  const [expanded, setExpanded] = useState(false);

  const severityStyles = {
    good: "bg-green-50 border-green-200 text-green-800",
    neutral: "bg-gray-50 border-gray-200 text-gray-700",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    critical: "bg-red-50 border-red-200 text-red-800",
  };

  const severityIcons = {
    good: "✅",
    neutral: "ℹ️",
    warning: "⚠️",
    critical: "🚨",
  };

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className={`w-full text-left rounded-md border p-3 transition-colors ${severityStyles[clause.severity]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{severityIcons[clause.severity]}</span>
          <span className="text-sm font-medium">{clause.title}</span>
        </div>
        <span className="text-xs opacity-60">{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && (
        <div className="mt-2 space-y-2">
          <p className="text-xs leading-relaxed">{clause.summary}</p>
          {clause.originalExcerpt && (
            <blockquote className="text-[11px] italic opacity-75 border-l-2 border-current/20 pl-2">
              &ldquo;{clause.originalExcerpt}&rdquo;
            </blockquote>
          )}
        </div>
      )}
    </button>
  );
}
