"use client";

import Link from "next/link";
import { useStudy } from "@/lib/use-study";
import { topicMastery, weakTopics } from "@/lib/study/engine";

export default function ReviewPage() {
  const { data, loading, progress } = useStudy();
  if (loading && !data) return <p className="text-zinc-500">Carregando…</p>;
  if (!data) return <p>Sem materiais processados. <Link href="/" className="text-brand-600 underline">Voltar ao início</Link></p>;

  const weak = weakTopics(data, progress);
  const weakIds = new Set(weak.map((t) => t.id));
  const topics = [...data.topics].sort((a, b) => b.examImportance - a.examImportance);
  const open = progress.mistakes.filter((m) => !m.resolved).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Revisão final</h1>
        <button onClick={() => window.print()} className="no-print rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm">
          🖨️ Imprimir
        </button>
      </div>

      {weak.length > 0 && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <h2 className="font-semibold text-rose-700">Revise primeiro:</h2>
          <p className="text-sm">{weak.map((t) => `${t.name} (${Math.round(topicMastery(progress, t.id) * 100)}%)`).join(" · ")}</p>
        </section>
      )}

      {open > 0 && (
        <p className="text-sm">
          📕 {open} erro(s) em aberto —{" "}
          <Link href="/mistakes" className="text-brand-600 underline">
            ver caderno de erros
          </Link>
        </p>
      )}

      {topics.map((t) => (
        <section
          key={t.id}
          className={`break-inside-avoid tile p-5 ${weakIds.has(t.id) ? "!border-rose-300" : ""}`}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">
              {t.name} <span className="text-amber-500" aria-label={`Importância ${t.examImportance} de 5`}>{"★".repeat(t.examImportance)}</span>
            </h2>
            <span className="text-sm text-zinc-500">Domínio {Math.round(topicMastery(progress, t.id) * 100)}%</span>
          </div>
          <p className="mt-1 text-zinc-700">{t.summary}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {t.keyPoints.map((k, i) => <li key={i}>{k}</li>)}
          </ul>
        </section>
      ))}
    </div>
  );
}
