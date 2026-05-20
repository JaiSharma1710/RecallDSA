"use client";

import { useEffect, useState } from "react";

import { Button } from "@/app/_components/Button";
import { Card } from "@/app/_components/Card";
import { PlatformBadge } from "@/app/_components/PlatformBadge";
import type { QuestionLink } from "@/app/_types/question";

export function QuestionLinksModal({
  isOpen,
  questionId,
  questionName,
  links,
  onClose,
}: {
  isOpen: boolean;
  questionId: string;
  questionName: string;
  links: QuestionLink[];
  onClose: () => void;
}) {
  const [resolvedLinks, setResolvedLinks] = useState<QuestionLink[]>(links);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isActive = true;

    async function loadLinks() {
      setResolvedLinks(links);
      setIsLoading(true);

      try {
        const response = await fetch(`/api/questions/${questionId}/links`);
        const data = (await response.json()) as
          | { links?: QuestionLink[]; error?: string }
          | { error: string };

        if (!response.ok || !("links" in data) || !data.links) {
          return;
        }

        if (isActive) {
          setResolvedLinks(data.links);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadLinks();

    return () => {
      isActive = false;
    };
  }, [isOpen, links, questionId]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6">
      <Card className="w-full max-w-lg p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Open question</h2>
            <p className="mt-1 text-sm text-slate-500">{questionName}</p>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="mt-5 space-y-3">
          {isLoading ? (
            <p className="text-sm text-slate-500">Loading all platform links...</p>
          ) : null}
          {resolvedLinks.map((linkItem) => (
            <a
              key={`${linkItem.platform}-${linkItem.url}`}
              href={linkItem.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <PlatformBadge platform={linkItem.platform} />
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">{linkItem.url}</p>
              </div>
              <span className="text-sm font-medium text-slate-700">Open</span>
            </a>
          ))}
          {!isLoading && resolvedLinks.length === 0 ? (
            <p className="text-sm text-slate-500">No platform links available yet.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
