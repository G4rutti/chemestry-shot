"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import Listen, { type Episode } from "@/components/Listen";
import TopicMedia from "@/components/TopicMedia";
import podcasts from "@/lib/podcasts.json";
import type { OneShot } from "@/lib/types";

const card = "tile p-5";

/** Turns the One Shot into a conversational narration, like a short study podcast. */
function podcastScript(s: OneShot): string[] {
  return [
    `Fala, pessoal! Bem-vindos ao Chemistry Shot. No episódio de hoje: ${s.title}. Bora direto ao que cai na prova.`,
    ...s.essentials.map((e, i) => `${["Primeiro ponto", "Segundo ponto", "Terceiro ponto"][i] ?? "Mais um ponto"}: ${e}`),
    ...s.concepts.map((c) => `Agora, o conceito de ${c.name}. ${c.explanation}`),
    ...s.formulas.map((f) => `Anota essa fórmula: ${f.formula}. ${f.meaning}. Quando usar? ${f.whenToUse}`),
    ...s.traps.map((t) => `Cuidado com essa pegadinha: ${t}`),
    ...s.recognitionPatterns.map((r) => `Como reconhecer na prova: ${r}`),
    `Vamos resolver um exemplo juntos. ${s.solvedExample.question}`,
    ...s.solvedExample.steps,
    `Resposta: ${s.solvedExample.answer}. É isso! Agora aperta em praticar e manda ver nos exercícios.`,
  ];
}

const episodeFor = (topicId: string): Episode | undefined => {
  const e = (podcasts as Record<string, Omit<Episode, "src">>)[topicId];
  return e && { ...e, src: `/podcasts/${topicId}.mp3` };
};

export default function OneShotPage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = use(params);
  const [shot, setShot] = useState<OneShot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setShot(null);
    try {
      const res = await fetch(`/api/one-shot?topicId=${encodeURIComponent(topicId)}`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || json.error) throw new Error(json?.error ?? res.statusText);
      setShot(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [topicId]);

  useEffect(() => {
    load(); // eslint-disable-line react-hooks/set-state-in-effect -- fetch on mount
  }, [load]);

  const practice = (
    <Link
      href={`/study?mode=topic&topic=${topicId}`}
      className="inline-block btn-3d rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700"
    >
      Praticar este tópico →
    </Link>
  );

  if (error)
    return (
      <div role="alert" className={`${card} text-rose-700`}>
        <p>Erro ao gerar o One Shot: {error}</p>
        <button onClick={load} className="mt-3 btn-3d rounded-xl bg-rose-600 px-4 py-2 text-white">
          Tentar novamente
        </button>
      </div>
    );

  if (!shot)
    return (
      <div className="space-y-4" aria-busy="true" role="status">
        <p className="text-sm text-zinc-500">Gerando resumo One Shot… (pode levar ~20s na primeira vez)</p>
        {[1, 2, 3].map((i) => (
          <div key={i} className={`${card} h-32 animate-pulse bg-zinc-100`} />
        ))}
      </div>
    );

  return (
    <article className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">{shot.title}</h1>
        {practice}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem] lg:items-start">
        <aside className="space-y-4 lg:order-2">
          <Listen title="Podcast" parts={podcastScript(shot)} episode={episodeFor(topicId)} />
          <TopicMedia topicId={topicId} topicName={shot.title} />
        </aside>
        <div className="space-y-4">
          <Section title="🎯 Essencial">
            <ul className="list-disc space-y-1 pl-5">
              {shot.essentials.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </Section>

          <Section title="📚 Conceitos">
            <dl className="space-y-2">
              {shot.concepts.map((c, i) => (
                <div key={i}>
                  <dt className="font-semibold">{c.name}</dt>
                  <dd className="text-zinc-700">{c.explanation}</dd>
                </div>
              ))}
            </dl>
          </Section>

          {shot.formulas.length > 0 && (
            <Section title="🧮 Fórmulas">
              <ul className="space-y-3">
                {shot.formulas.map((f, i) => (
                  <li key={i}>
                    <code className="block rounded-lg bg-zinc-100 px-3 py-2 font-mono text-brand-700">{f.formula}</code>
                    <p className="mt-1 text-sm">{f.meaning}</p>
                    <p className="text-sm text-zinc-500">Quando usar: {f.whenToUse}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="⚠️ Pegadinhas">
            <ul className="space-y-1">
              {shot.traps.map((t, i) => (
                <li key={i} className="rounded-lg bg-amber-50 px-3 py-2">⚠️ {t}</li>
              ))}
            </ul>
          </Section>

          <Section title="🔍 Como reconhecer na prova">
            <ul className="list-disc space-y-1 pl-5">
              {shot.recognitionPatterns.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </Section>

          <Section title="✍️ Exemplo resolvido">
            <p className="font-medium">{shot.solvedExample.question}</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              {shot.solvedExample.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
            <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 font-semibold text-brand-700">Resposta: {shot.solvedExample.answer}</p>
          </Section>

        </div>
      </div>

      <div className="text-center">{practice}</div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={card}>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
