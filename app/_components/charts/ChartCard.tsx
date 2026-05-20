"use client";

import type { ReactNode } from "react";

import { Card } from "@/app/_components/Card";

export function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        {description ? <p className="text-sm text-slate-500">{description}</p> : null}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}
