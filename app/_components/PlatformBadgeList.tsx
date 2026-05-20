import { PlatformBadge } from "@/app/_components/PlatformBadge";
import { normalizePlatforms } from "@/lib/platform";

export function PlatformBadgeList({
  platforms,
  fallbackPlatform,
}: {
  platforms?: Array<string | null | undefined> | null;
  fallbackPlatform?: string | null;
}) {
  const normalizedPlatforms = normalizePlatforms(platforms, fallbackPlatform);

  return (
    <div className="flex flex-wrap gap-2">
      {normalizedPlatforms.map((platform) => (
        <PlatformBadge key={platform} platform={platform} />
      ))}
    </div>
  );
}
