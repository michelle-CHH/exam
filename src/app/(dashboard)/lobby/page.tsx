import { notFound } from 'next/navigation';
import { ExamCard } from '@/app/(dashboard)/lobby/_components/ExamCard';
import { ASSIGNED_EXAM_ID, getAssignedExam } from '@/services/publicSheet';
import { INITIAL_EXAM_PAPERS } from '@/data/initialData';

export default async function LobbyPage() {
  const publishedPapers = INITIAL_EXAM_PAPERS.filter((p) => p.status === 'published');
  const exams = (
    await Promise.all(
      publishedPapers.map((paper) => getAssignedExam(paper.id))
    )
  ).filter((e): e is NonNullable<typeof e> => Boolean(e));

  if (exams.length === 0) {
    const defaultExam = await getAssignedExam(ASSIGNED_EXAM_ID);
    if (defaultExam) exams.push(defaultExam);
  }

  if (exams.length === 0) notFound();

  return (
    <main className="min-h-screen">
      <header className="exam-topbar">
        <div className="exam-shell py-6">
          <p className="text-[11px] tracking-[0.3em] text-slate-300">EXAM AND LEARN</p>
          <h1 className="mt-1 text-2xl font-bold">線上測驗系統</h1>
          <p className="mt-1 text-sm text-slate-300">系統已接收你的自組卷，確認後即可開始作答</p>
        </div>
      </header>
      <div className="exam-shell py-6">
        <ExamCard exams={exams} />
      </div>
    </main>
  );
}

