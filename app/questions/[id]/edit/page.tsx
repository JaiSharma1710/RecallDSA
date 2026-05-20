import { PageHeader } from "@/app/_components/PageHeader";
import { QuestionEditForm } from "@/app/_components/QuestionEditForm";

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Question"
        description="Update the question details. Weakness score and status are recalculated after saving."
      />
      <QuestionEditForm questionId={id} />
    </div>
  );
}
