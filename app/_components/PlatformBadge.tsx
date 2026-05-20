import { getPlatformBadgeClass, getPlatformLabel } from "@/lib/platform";

export function PlatformBadge({ platform }: { platform?: string | null }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getPlatformBadgeClass(platform)}`}
    >
      {getPlatformLabel(platform)}
    </span>
  );
}

export function SourceBadge({ source }: { source?: string | null }) {
  const label = source === "extension" ? "Extension" : "Manual";
  const className =
    source === "extension"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
