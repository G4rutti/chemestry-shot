"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CodeBlock from "@/components/CodeBlock";
import QuestionCard from "@/components/QuestionCard";
import { buildExam } from "@/lib/study/engine";
import { useStudy } from "@/lib/use-study";
import type { Question } from "@/lib/types";

type Result = { q: Question; given: string; correct: boolean };
const btn = "btn-3d rounded-2xl px-5 py-3 text-center focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-300";
const clock = () => Date.now();
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function ExamPage() {
  const { data, loading, error, reload, answer } = useStudy();
  const [exam, setExam] = useState<Question[] | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [start, setStart] = useState(0);
  const [now, setNow] = useState(0);

  const finished = !!exam && results.length >= exam.length;

  useEffect(() => {
    if (!exam || finished) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [exam, finished]);

  const elapsed = Math.max(0, Math.floor((now - start) / 1000));

  if (loading && !data) return <main className="p-6 text-center text-zinc-600">Carregando…</main>;
  if (error && !data)
    return (
      <main className="mx-auto max-w-xl p-6 text-center space-y-4">
        <p className="text-rose-600">Erro: {error}</p>
        <button className={`${btn} bg-brand-600 text-white`} onClick={reload}>Tentar de novo</button>
      </main>
    );
  if (!data || data.questions.length === 0)
    return (
      <main className="mx-auto max-w-xl p-6 text-center space-y-4">
        <p>Nenhum material carregado ainda.</p>
        <Link href="/" className={`${btn} inline-block bg-brand-600 text-white`}>Importar materiais</Link>
      </main>
    );

  const topicName = (id: string) => data.topics.find((t) => t.id === id)?.name ?? id;

  function begin(size: number) {
    const t = clock();
    setExam(buildExam(data!, size));
    setResults([]);
    setStart(t);
    setNow(t);
  }

  if (!exam)
    return (
      <main className="mx-auto max-w-xl py-2 sm:p-4 space-y-6">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800">← Início</Link>
        <div className="tile p-6 space-y-4 text-center">
          <h1 className="text-3xl">Simulado</h1>
          <p className="text-zinc-600">Responda tudo sem feedback. O resultado aparece no final.</p>
          <div className="grid grid-cols-3 gap-3">
            {[10, 20, 30].map((n) => (
              <button key={n} className={`${btn} bg-brand-600 text-white py-6 text-xl hover:bg-brand-700`} onClick={() => begin(n)}>
                {n}
                <span className="block text-sm font-normal">questões</span>
              </button>
            ))}
          </div>
        </div>
      </main>
    );

  if (!finished) {
    const q = exam[results.length];
    return (
      <main className="mx-auto max-w-xl py-2 sm:p-4 space-y-6">
        <header className="flex items-center gap-3">
          <Link href="/" aria-label="Sair" className="text-2xl text-zinc-400 hover:text-zinc-700">×</Link>
          <div className="h-4 flex-1 rounded-full bg-zinc-200 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={exam.length} aria-valuenow={results.length}>
            <div className="h-full bg-brand-600 transition-all" style={{ width: `${(results.length / exam.length) * 100}%` }} />
          </div>
          <span className="text-sm text-zinc-600 tabular-nums">{results.length + 1}/{exam.length}</span>
          <span className="text-sm font-semibold text-zinc-700 tabular-nums">⏱ {fmt(elapsed)}</span>
        </header>
        <QuestionCard
          key={q.id}
          question={q}
          showFeedback={false}
          onAnswered={(given, correct) => {
            answer(q, given, correct);
            setResults((r) => [...r, { q, given, correct }]);
          }}
          onNext={() => {}}
        />
      </main>
    );
  }

  const score = results.filter((r) => r.correct).length;
  const byTopic = new Map<string, { ok: number; total: number }>();
  for (const r of results) {
    const s = byTopic.get(r.q.topicId) ?? { ok: 0, total: 0 };
    s.total++;
    if (r.correct) s.ok++;
    byTopic.set(r.q.topicId, s);
  }
  const wrong = results.filter((r) => !r.correct);

  return (
    <main className="mx-auto max-w-xl py-2 sm:p-4 space-y-6">
      <div className="tile p-6 text-center space-y-2">
        <h1 className="text-3xl">Resultado</h1>
        <p className={`text-5xl font-bold ${score / results.length >= 0.6 ? "text-brand-600" : "text-rose-600"}`}>
          {Math.round((score / results.length) * 100)}%
        </p>
        <p className="text-zinc-600">{score}/{results.length} acertos · ⏱ {fmt(elapsed)}</p>
      </div>

      <section className="tile p-5 space-y-3">
        <h2 className="font-bold">Por tópico</h2>
        {[...byTopic].map(([id, s]) => (
          <div key={id}>
            <div className="flex justify-between text-sm"><span>{topicName(id)}</span><span>{s.ok}/{s.total}</span></div>
            <div className="h-2 rounded-full bg-rose-100 overflow-hidden">
              <div className="h-full bg-brand-500" style={{ width: `${(s.ok / s.total) * 100}%` }} />
            </div>
          </div>
        ))}
      </section>

      {wrong.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-bold">Erros ({wrong.length})</h2>
          {wrong.map(({ q, given }) => (
            <div key={q.id} className="tile p-4 space-y-2">
              <p className="font-medium">{q.question}</p>
              <CodeBlock code={q.code} />
              <p className="text-sm text-rose-700">Sua resposta: {given}</p>
              <p className="text-sm text-brand-700">Correta: <strong>{q.correctAnswer}</strong></p>
              <p className="text-sm text-zinc-700">{q.explanation}</p>
              {q.memoryTip && <p className="text-sm text-zinc-700">💡 {q.memoryTip}</p>}
            </div>
          ))}
        </section>
      )}

      <div className="flex flex-col gap-2">
        <button className={`${btn} bg-brand-600 text-white`} onClick={() => setExam(null)}>Novo simulado</button>
        <Link href="/mistakes" className={`${btn} bg-rose-50 text-rose-700`}>Caderno de erros</Link>
        <Link href="/" className={`${btn} bg-zinc-100 text-zinc-700`}>Início</Link>
      </div>
    </main>
  );
}
