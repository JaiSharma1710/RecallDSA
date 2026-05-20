import type { ReactNode } from "react";
import type { QuestionStatus } from "@/app/_types/question";

type BadgeProps = {
  children: ReactNode;
  status?: QuestionStatus;
  tone?: "slate" | "blue";
};

const statusClasses: Record<QuestionStatus, string> = {
  Red: "border-red-200 bg-red-50 text-red-700",
  Orange: "border-orange-200 bg-orange-50 text-orange-700",
  Yellow: "border-yellow-200 bg-yellow-50 text-yellow-800",
  Green: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const toneClasses = {
  slate: "border-slate-200 bg-slate-50 text-slate-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
};

export function Badge({ children, status, tone = "slate" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
        status ? statusClasses[status] : toneClasses[tone]
      }`}
    >
      {children}
    </span>
  );
}

export function getStatusLabel(status: QuestionStatus) {
  return `${status} Zone`;
}
