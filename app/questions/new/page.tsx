import { PageHeader } from "@/app/_components/PageHeader";
import { QuestionForm } from "@/app/_components/QuestionForm";

export default function NewQuestionPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Question"
        description="Save a solved problem with the details needed for weakness-based revision."
      />
      <QuestionForm />
    </div>
  );
}
