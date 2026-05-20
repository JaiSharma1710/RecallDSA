import { QuestionDetailClient } from "@/app/_components/QuestionDetailClient";

export default async function QuestionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <QuestionDetailClient questionId={id} />;
}
