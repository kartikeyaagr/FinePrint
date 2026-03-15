import type { TCDiff } from "@/shared/types";

interface DiffViewProps {
  diff: TCDiff | null;
}

export function DiffView({ diff }: DiffViewProps) {
  if (!diff) {
    return (
      <div className="p-4 text-center space-y-2">
        <span className="text-3xl">📋</span>
        <p className="text-sm text-gray-500">First time analyzing this page</p>
        <p className="text-xs text-gray-400">
          Come back later to see if the terms have changed.
        </p>
      </div>
    );
  }

  const totalChanges =
    diff.additions.length + diff.removals.length + diff.modifications.length;

  if (totalChanges === 0) {
    return (
      <div className="p-4 text-center space-y-2">
        <span className="text-3xl">✅</span>
        <p className="text-sm text-gray-600">No changes detected</p>
        <p className="text-xs text-gray-400">
          Terms haven't changed since{" "}
          {new Date(diff.previousVersion.fetchedAt).toLocaleDateString()}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Change summary header */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
        <h3 className="text-sm font-semibold text-amber-800">
          {totalChanges} change{totalChanges !== 1 ? "s" : ""} detected
        </h3>
        <p className="text-xs text-amber-700">
          Since{" "}
          {new Date(diff.previousVersion.fetchedAt).toLocaleDateString()}
        </p>
        {diff.scoreChange && (
          <p className="text-xs font-medium">
            Security score:{" "}
            <span className="text-gray-600">
              {diff.scoreChange.before.toFixed(1)}
            </span>
            {" → "}
            <span
              className={
                diff.scoreChange.after >= diff.scoreChange.before
                  ? "text-green-600"
                  : "text-red-600"
              }
            >
              {diff.scoreChange.after.toFixed(1)}
              {diff.scoreChange.after >= diff.scoreChange.before
                ? " ↑"
                : " ↓"}
            </span>
          </p>
        )}
      </div>

      {/* Additions */}
      {diff.additions.length > 0 && (
        <DiffSection
          title="Added"
          icon="+"
          items={diff.additions}
          className="bg-green-50 border-green-200 text-green-800"
          markerClass="bg-green-200 text-green-700"
        />
      )}

      {/* Removals */}
      {diff.removals.length > 0 && (
        <DiffSection
          title="Removed"
          icon="−"
          items={diff.removals}
          className="bg-red-50 border-red-200 text-red-800"
          markerClass="bg-red-200 text-red-700"
        />
      )}

      {/* Modifications */}
      {diff.modifications.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Changed
          </h4>
          {diff.modifications.map((mod, i) => (
            <div
              key={i}
              className="border border-amber-200 rounded-md overflow-hidden text-xs"
            >
              <div className="bg-red-50 text-red-800 px-3 py-2 border-b border-amber-200">
                <span className="font-mono text-red-400 mr-1">−</span>
                {mod.before}
              </div>
              <div className="bg-green-50 text-green-800 px-3 py-2">
                <span className="font-mono text-green-400 mr-1">+</span>
                {mod.after}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DiffSection({
  title,
  icon,
  items,
  className,
  markerClass,
}: {
  title: string;
  icon: string;
  items: string[];
  className: string;
  markerClass: string;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {title}
      </h4>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li
            key={i}
            className={`flex items-start gap-2 text-xs px-3 py-2 rounded-md border ${className}`}
          >
            <span
              className={`inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold flex-shrink-0 ${markerClass}`}
            >
              {icon}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
