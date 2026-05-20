export const PLATFORM_VALUES = [
  "leetcode",
  "gfg",
  "neetcode",
  "tuf",
  "manual",
] as const;

export const PLATFORM_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "leetcode", label: "LeetCode" },
  { value: "gfg", label: "GFG" },
  { value: "neetcode", label: "NeetCode" },
  { value: "tuf", label: "TUF" },
] as const;

export type PlatformValue = (typeof PLATFORM_VALUES)[number];

const platformLabelMap: Record<PlatformValue, string> = {
  manual: "Manual",
  leetcode: "LeetCode",
  gfg: "GFG",
  neetcode: "NeetCode",
  tuf: "TUF",
};

const platformBadgeClassMap: Record<PlatformValue, string> = {
  manual: "border-slate-200 bg-slate-50 text-slate-600",
  leetcode: "border-amber-200 bg-amber-50 text-amber-700",
  gfg: "border-emerald-200 bg-emerald-50 text-emerald-700",
  neetcode: "border-violet-200 bg-violet-50 text-violet-700",
  tuf: "border-cyan-200 bg-cyan-50 text-cyan-700",
};

export function getPlatformLabel(platform?: string | null) {
  if (!platform) {
    return "Manual";
  }

  return platformLabelMap[platform as PlatformValue] ?? "Manual";
}

export function getPlatformBadgeClass(platform?: string | null) {
  if (!platform) {
    return platformBadgeClassMap.manual;
  }

  return platformBadgeClassMap[platform as PlatformValue] ?? platformBadgeClassMap.manual;
}

export function normalizePlatform(platform?: string | null): PlatformValue {
  if (!platform) {
    return "manual";
  }

  return PLATFORM_VALUES.includes(platform as PlatformValue)
    ? (platform as PlatformValue)
    : "manual";
}

export function normalizePlatforms(
  platforms?: Array<string | null | undefined> | null,
  fallbackPlatform?: string | null,
) {
  const normalized = new Set<PlatformValue>();

  for (const platform of platforms ?? []) {
    normalized.add(normalizePlatform(platform));
  }

  if (normalized.size === 0) {
    normalized.add(normalizePlatform(fallbackPlatform));
  }

  return [...normalized];
}
