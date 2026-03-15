/**
 * Security rating computation from clause analysis.
 *
 * Maps clause categories and severities to a 1-10 security score
 * across five dimensions: data collection, data sharing, user rights,
 * liability, and transparency.
 */

import type {
  ClauseAnalysis,
  ClauseCategory,
  SecurityScore,
} from "../shared/types";

/** Maps clause categories to scoring dimensions. */
const CATEGORY_TO_DIMENSION: Record<
  ClauseCategory,
  keyof SecurityScore["breakdown"]
> = {
  data_collection: "dataCollection",
  data_sharing: "dataSharing",
  user_rights: "userRights",
  liability: "liability",
  termination: "userRights",
  auto_renewal: "transparency",
  arbitration: "userRights",
  content_rights: "userRights",
  privacy: "dataCollection",
  cookies: "dataCollection",
  other: "transparency",
};

/** Severity to score mapping (lower = worse). */
const SEVERITY_SCORES: Record<string, number> = {
  good: 9,
  neutral: 6,
  warning: 3,
  critical: 1,
};

/**
 * Compute a SecurityScore from an array of clause analyses.
 *
 * Each clause is mapped to a scoring dimension. Scores per dimension
 * are averaged. Data sharing is weighted 2x in the overall score.
 * Dimensions with no clauses default to 5 (neutral).
 */
export function computeRating(clauses: ClauseAnalysis[]): SecurityScore {
  const dimensionScores: Record<
    keyof SecurityScore["breakdown"],
    number[]
  > = {
    dataCollection: [],
    dataSharing: [],
    userRights: [],
    liability: [],
    transparency: [],
  };

  for (const clause of clauses) {
    const dimension = CATEGORY_TO_DIMENSION[clause.category];
    if (dimension) {
      const score = SEVERITY_SCORES[clause.severity] ?? 5;
      dimensionScores[dimension].push(score);
    }
  }

  const breakdown: SecurityScore["breakdown"] = {
    dataCollection: average(dimensionScores.dataCollection, 5),
    dataSharing: average(dimensionScores.dataSharing, 5),
    userRights: average(dimensionScores.userRights, 5),
    liability: average(dimensionScores.liability, 5),
    transparency: average(dimensionScores.transparency, 5),
  };

  // Weighted overall: data sharing counts 2x
  const weights = {
    dataCollection: 1,
    dataSharing: 2,
    userRights: 1,
    liability: 1,
    transparency: 1,
  };

  let weightedSum = 0;
  let totalWeight = 0;
  for (const [dim, weight] of Object.entries(weights)) {
    weightedSum += breakdown[dim as keyof typeof breakdown] * weight;
    totalWeight += weight;
  }

  const overall = Math.round(
    Math.max(1, Math.min(10, weightedSum / totalWeight))
  );

  return { overall, breakdown };
}

/** Returns the color tier for a score. */
export function getRatingColor(score: number): "green" | "yellow" | "red" {
  if (score >= 8) return "green";
  if (score >= 4) return "yellow";
  return "red";
}

/** Returns a human-readable risk label for a score. */
export function getRatingLabel(score: number): string {
  if (score >= 8) return "Low Risk";
  if (score >= 4) return "Medium Risk";
  return "High Risk";
}

/** Average an array of numbers, returning defaultVal if empty. */
function average(values: number[], defaultVal: number): number {
  if (values.length === 0) return defaultVal;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 10) / 10;
}
