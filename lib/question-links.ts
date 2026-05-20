import { normalizePlatform, normalizePlatforms, type PlatformValue } from "@/lib/platform";

export type QuestionLinkValue = {
  platform: PlatformValue;
  url: string;
  platformSlug?: string;
};

type NormalizeQuestionLinksOptions = {
  questionLinks?: Array<Partial<QuestionLinkValue> | null | undefined> | null;
  platforms?: Array<string | null | undefined> | null;
  fallbackPlatform?: string | null;
  link?: string | null;
  sourceUrl?: string | null;
  platformSlug?: string | null;
};

function normalizeUrl(value?: string | null) {
  if (!value) {
    return "";
  }

  return value.trim();
}

export function normalizeQuestionLinks({
  questionLinks,
  platforms,
  fallbackPlatform,
  link,
  sourceUrl,
  platformSlug,
}: NormalizeQuestionLinksOptions) {
  const linksByPlatform = new Map<PlatformValue, QuestionLinkValue>();

  for (const rawLink of questionLinks ?? []) {
    const url = normalizeUrl(rawLink?.url);

    if (!url) {
      continue;
    }

    const platform = normalizePlatform(rawLink?.platform);
    linksByPlatform.set(platform, {
      platform,
      url,
      platformSlug: rawLink?.platformSlug?.trim() ?? "",
    });
  }

  const fallbackUrl = normalizeUrl(sourceUrl) || normalizeUrl(link);

  if (fallbackUrl) {
    const fallbackLinkPlatform =
      normalizePlatforms(platforms, fallbackPlatform)[0] ?? normalizePlatform(fallbackPlatform);

    if (!linksByPlatform.has(fallbackLinkPlatform)) {
      linksByPlatform.set(fallbackLinkPlatform, {
        platform: fallbackLinkPlatform,
        url: fallbackUrl,
        platformSlug: platformSlug?.trim() ?? "",
      });
    }
  }

  return [...linksByPlatform.values()];
}

export function upsertQuestionLink(
  questionLinks: Array<Partial<QuestionLinkValue> | null | undefined> | null | undefined,
  nextLink: Partial<QuestionLinkValue> | null | undefined,
) {
  const currentLinks = normalizeQuestionLinks({ questionLinks });

  if (!nextLink) {
    return currentLinks;
  }

  const url = normalizeUrl(nextLink.url);

  if (!url) {
    return currentLinks;
  }

  const platform = normalizePlatform(nextLink.platform);
  const linksByPlatform = new Map(currentLinks.map((linkItem) => [linkItem.platform, linkItem]));
  linksByPlatform.set(platform, {
    platform,
    url,
    platformSlug: nextLink.platformSlug?.trim() ?? "",
  });

  return [...linksByPlatform.values()];
}

export function syncQuestionLinksForLinkField(
  questionLinks: Array<Partial<QuestionLinkValue> | null | undefined> | null | undefined,
  link: string | undefined,
  platform: string | undefined = "manual",
) {
  const normalizedLinks = normalizeQuestionLinks({ questionLinks });

  if (link === undefined) {
    return normalizedLinks;
  }

  const normalizedUrl = normalizeUrl(link);
  const normalizedPlatform = normalizePlatform(platform);

  if (!normalizedUrl) {
    return normalizedLinks.filter((linkItem) => linkItem.platform !== normalizedPlatform);
  }

  return upsertQuestionLink(normalizedLinks, {
    platform: normalizedPlatform,
    url: normalizedUrl,
  });
}

export function getQuestionLinkChoices(input: {
  questionLinks?: Array<Partial<QuestionLinkValue> | null | undefined> | null;
  platforms?: Array<string | null | undefined> | null;
  fallbackPlatform?: string | null;
  link?: string | null;
  sourceUrl?: string | null;
  platformSlug?: string | null;
}) {
  return normalizeQuestionLinks(input).filter((linkItem) => linkItem.url);
}
