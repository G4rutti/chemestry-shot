"use client";

import Link from "next/link";
import { useStudy } from "@/lib/use-study";
import type { Mistake, Question } from "@/lib/types";

const card = "tile p-5";

export default function MistakesPage() {
  const { data, loading, progress } = useStudy();
  if (loading && !data) return <p className="text-zinc-500">Carregando…</p>;

  const byId = new Map(data?.questions.map((q) => [q.id, q]));
  const items = progress.mistakes
    .map((m) => ({ m, q: byId.get(m.questionId) }))
    .filter((x): x is { m: Mistake; q: Question } => !!x.q)
    .sort((a, b) => b.m.at - a.m.at);
  const open = items.filter((x) => !x.m.resolved);
  const resolved = items.filter((x) => x.m.resolved);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">📕 Caderno de erros</h1>
        {open.length > 0 && (
          <Link href="/study?mode=mistakes" className="btn-3d rounded-xl bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700">
            Refazer erros ({open.length})
          </Link>
        )}
      </div>

      {open.length === 0 && <p className={card}>Nenhum erro em aberto. 🎉</p>}

      {open.map(({ m, q }) => (
        <article key={q.id} className={`${card} space-y-2`}>
          <p className="font-medium">{q.question}</p>
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-rose-700">✗ Sua resposta: {m.answer}</p>
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-brand-700">✓ Correta: {q.correctAnswer}</p>
          <p className="text-zinc-700">{q.explanation}</p>
          {q.memoryTip && <p className="rounded-lg bg-amber-50 px-3 py-2">💡 {q.memoryTip}</p>}
          <p className="text-xs text-zinc-400">
            Fonte: {q.source.document}
            {q.source.page != null && `, p. ${q.source.page}`}
          </p>
        </article>
      ))}

      {resolved.length > 0 && (
        <details className={`${card} opacity-60`}>
          <summary className="cursor-pointer font-medium">Resolvidos ({resolved.length})</summary>
          <ul className="mt-3 space-y-2 text-sm">
            {resolved.map(({ q }) => (
              <li key={q.id}>
                <p>{q.question}</p>
                <p className="text-brand-700">✓ {q.correctAnswer}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
