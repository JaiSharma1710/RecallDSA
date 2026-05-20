import { QuestionRevisionsClient } from "@/app/_components/QuestionRevisionsClient";

export default async function QuestionRevisionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <QuestionRevisionsClient questionId={id} />;
}
