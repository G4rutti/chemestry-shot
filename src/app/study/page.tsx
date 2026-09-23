"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import QuestionCard from "@/components/QuestionCard";
import { getNextQuestion, topicMastery } from "@/lib/study/engine";
import { useStudy } from "@/lib/use-study";
import type { Question, StudyMode } from "@/lib/types";

const SESSION = 15;
const pill = "rounded-full border-2 border-zinc-200 bg-white px-3 py-1 text-sm font-extrabold text-amber-500 tabular-nums";
const btn = "btn-3d rounded-2xl px-5 py-3 text-center focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-300";

export default function StudyPage() {
  return (
    <Suspense fallback={<Center>Carregando…</Center>}>
      <Study />
    </Suspense>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-xl p-6 text-center space-y-4 text-zinc-700">{children}</main>;
}

function Study() {
  const params = useSearchParams();
  const raw = params.get("mode");
  const mode: StudyMode = raw === "topic" || raw === "mistakes" ? raw : "cram";
  const topicId = params.get("topic") ?? undefined;
  const { data, loading, error, reload, progress, answer } = useStudy();

  const [results, setResults] = useState<Record<string, boolean>>({});
  const [current, setCurrent] = useState<Question | null>(null);
  const [xpStart, setXpStart] = useState<number | null>(null);
  const [round, setRound] = useState(0); // answers before this round
  const [ended, setEnded] = useState(false);
  const [gen, setGen] = useState<"idle" | "loading" | "error">("idle");

  if (loading && !data) return <Center>Carregando…</Center>;
  if (error && !data) return <Center><p className="text-rose-600">Erro: {error}</p><button className={`${btn} bg-brand-600 text-white`} onClick={reload}>Tentar de novo</button></Center>;
  if (!data || data.questions.length === 0)
    return (
      <Center>
        <p>Nenhum material carregado ainda.</p>
        <Link href="/" className={`${btn} inline-block bg-brand-600 text-white`}>Importar materiais</Link>
      </Center>
    );

  const answeredIds = Object.keys(results);
  const done = answeredIds.length - round;
  const target = mode === "cram" ? SESSION : Infinity;
  let q = current;
  if (!q && !ended && done < target) {
    q = getNextQuestion(data, progress, { mode, topicId, exclude: answeredIds });
    if (q && q.id in results) q = null; // engine recycles when pool is exhausted
    if (q) setCurrent(q); // pin it so re-renders don't reshuffle
  }
  const topic = data.topics.find((t) => t.id === (q?.topicId ?? topicId));
  const correctCount = Object.values(results).filter(Boolean).length;
  const xpGained = xpStart == null ? 0 : progress.xp - xpStart;

  function onAnswered(given: string, ok: boolean) {
    if (!q) return;
    if (xpStart == null) setXpStart(progress.xp);
    setResults((r) => ({ ...r, [q.id]: ok }));
    answer(q, given, ok);
  }

  async function generate() {
    setGen("loading");
    try {
      const res = await fetch("/api/more-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId }),
      });
      if (!res.ok) throw new Error();
      await reload();
      setGen("idle");
    } catch {
      setGen("error");
    }
  }

  const header = (
    <header className="space-y-3">
      <div className="flex items-center gap-3">
        <Link href="/" aria-label="Sair" className="text-2xl text-zinc-400 hover:text-zinc-700">×</Link>
        <div className="h-4 flex-1 rounded-full bg-zinc-200 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={mode === "cram" ? SESSION : undefined} aria-valuenow={done}>
          <div className="h-full bg-brand-600 transition-all" style={{ width: `${mode === "cram" ? (done / SESSION) * 100 : Math.min(100, done * 5)}%` }} />
        </div>
        <span className={pill}>⚡ {progress.xp}</span>
        <span className={pill}>🔥 {progress.streak}</span>
      </div>
      {topic && (
        <div className="flex flex-wrap gap-2 text-xs font-extrabold uppercase tracking-wide text-zinc-500">
          <span className="rounded-full border-2 border-zinc-200 bg-zinc-100 px-3 py-1">🧪 {topic.name}</span>
          <span className="rounded-full border-2 border-zinc-200 bg-white px-3 py-1">Domínio {Math.round(topicMastery(progress, topic.id) * 100)}%</span>
        </div>
      )}
    </header>
  );

  if (!q) {
    const total = answeredIds.length;
    if (total === 0 && mode === "mistakes")
      return <main className="mx-auto max-w-xl p-4 space-y-6">{header}<Center><p className="text-xl">Nenhum erro pendente 🎉</p><p>Você está mandando bem. Que tal um modo revisão?</p><Link href="/study?mode=cram" className={`${btn} inline-block bg-brand-600 text-white`}>Revisão rápida</Link></Center></main>;
    return (
      <main className="mx-auto max-w-xl p-4 space-y-6">
        {header}
        <div className="tile p-6 text-center space-y-4">
          <h1 className="text-3xl">Sessão concluída!</h1>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-brand-50 p-4"><p className="text-3xl font-bold text-brand-600">{total ? Math.round((correctCount / total) * 100) : 0}%</p><p className="text-sm">acertos ({correctCount}/{total})</p></div>
            <div className="rounded-2xl bg-amber-50 p-4"><p className="text-3xl font-bold text-amber-500">+{xpGained}</p><p className="text-sm">XP</p></div>
          </div>
          {mode === "topic" && topicId && !ended && !process.env.NEXT_PUBLIC_VERCEL_ENV && (
            <div className="space-y-2">
              <p className="text-zinc-600">Acabaram as questões deste tópico.</p>
              <button className={`${btn} w-full bg-brand-600 text-white disabled:opacity-50`} disabled={gen === "loading"} onClick={generate}>
                {gen === "loading" ? "Gerando questões…" : gen === "error" ? "Falhou — tentar de novo" : "Gerar mais questões"}
              </button>
            </div>
          )}
          <div className="flex flex-col gap-2">
            {mode !== "topic" && (
              <button className={`${btn} bg-brand-600 text-white`} onClick={() => { setRound(answeredIds.length); setEnded(false); }}>Continuar</button>
            )}
            <Link href="/mistakes" className={`${btn} bg-rose-50 text-rose-700`}>Caderno de erros</Link>
            <Link href="/" className={`${btn} bg-zinc-100 text-zinc-700`}>Início</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl p-4 space-y-6">
      {header}
      <QuestionCard
        key={q.id}
        question={q}
        onAnswered={onAnswered}
        onNext={() => setCurrent(null)}
      />
      {mode !== "cram" && (
        <button className="w-full text-sm text-zinc-400 hover:text-zinc-700" onClick={() => { setCurrent(null); setEnded(true); }}>
          Encerrar sessão
        </button>
      )}
    </main>
  );
}
