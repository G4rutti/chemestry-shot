"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useStudy } from "@/lib/use-study";

export default function FlashcardsPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const { topic } = use(searchParams);
  const { data, loading } = useStudy();
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [score, setScore] = useState({ knew: 0, didnt: 0 });

  const cards = data?.flashcards.filter((c) => !topic || c.topicId === topic) ?? [];
  const n = cards.length;
  const card = cards[i % Math.max(n, 1)];
  const topicName = topic && data?.topics.find((t) => t.id === topic)?.name;

  function go(d: number) {
    setFlipped(false);
    setI((x) => (x + d + n) % n);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!n) return;
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === " " && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        setFlipped((f) => !f);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (loading && !data) return <p className="text-zinc-500">Carregando…</p>;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl">Flashcards{topicName && ` · ${topicName}`}</h1>
        {topic && (
          <Link href="/flashcards" className="text-sm text-brand-600 underline">
            Ver todos
          </Link>
        )}
      </div>

      {!card ? (
        <p className="tile p-5">Nenhum flashcard disponível.</p>
      ) : (
        <>
          <p className="text-sm text-zinc-500" aria-live="polite">
            {(i % n) + 1} / {n} · <span className="text-brand-600">Sabia {score.knew}</span> ·{" "}
            <span className="text-rose-600">Não sabia {score.didnt}</span>
          </p>
          <button
            onClick={() => setFlipped((f) => !f)}
            aria-label={flipped ? "Verso do cartão (clique para ver a frente)" : "Frente do cartão (clique para virar)"}
            className={`flex min-h-64 w-full items-center justify-center tile p-8 text-center text-2xl font-bold transition ${
              flipped ? "!border-sky-300 !bg-sky-50 text-sky-600" : ""
            }`}
          >
            <span aria-live="polite">{flipped ? card.back : card.front}</span>
          </button>
          <p className="text-center text-xs text-zinc-400">Clique ou Espaço para virar · ← → para navegar</p>
          <div className="flex gap-2">
            <button onClick={() => go(-1)} className="rounded-xl border border-zinc-300 bg-white px-4 py-2" aria-label="Anterior">
              ←
            </button>
            <button
              onClick={() => {
                setScore((s) => ({ ...s, didnt: s.didnt + 1 }));
                go(1);
              }}
              className="flex-1 btn-3d rounded-xl bg-rose-600 px-4 py-2 font-semibold text-white hover:bg-rose-700"
            >
              Não sabia
            </button>
            <button
              onClick={() => {
                setScore((s) => ({ ...s, knew: s.knew + 1 }));
                go(1);
              }}
              className="flex-1 btn-3d rounded-xl bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700"
            >
              Sabia
            </button>
            <button onClick={() => go(1)} className="rounded-xl border border-zinc-300 bg-white px-4 py-2" aria-label="Próximo">
              →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
