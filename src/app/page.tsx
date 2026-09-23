"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useStudy } from "@/lib/use-study";
import Mascot from "@/components/Mascot";
import { overallMastery, topicMastery, weakTopics } from "@/lib/study/engine";

const card = "tile p-5";

export default function Home() {
  const { data, setData, loading, error, reload, progress } = useStudy();
  const [startedAt, setStartedAt] = useState<number | null>(null); // server job start; survives page changes
  const [sending, setSending] = useState(false);
  const busy = sending || startedAt !== null;
  const [elapsed, setElapsed] = useState(0);
  const [procError, setProcError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const last = useRef<(() => Promise<Response>) | null>(null);

  // resume tracking a job started before navigating away / reloading
  useEffect(() => {
    fetch("/api/process")
      .then((r) => r.json())
      .then((job) => job?.running && setStartedAt(job.startedAt))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (startedAt === null) return;
    const t = setInterval(async () => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
      const job = await fetch("/api/process").then((r) => r.json()).catch(() => null);
      reload(); // topics/questions are published incrementally while the job runs
      if (job?.running) return;
      setStartedAt(null);
      if (job?.error) setProcError(job.error);
    }, 3000);
    return () => clearInterval(t);
  }, [startedAt, reload]);

  async function run(req: () => Promise<Response>) {
    last.current = req;
    setSending(true);
    setElapsed(0);
    setProcError(null);
    try {
      const res = await req();
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || json.error) throw new Error(json?.error ?? res.statusText);
      if (res.status === 202) setStartedAt(json.startedAt);
      else setData(json); // demo mode answers with data directly
    } catch (e) {
      setProcError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  function upload(files: FileList | null) {
    if (!files?.length) return;
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("files", f);
    run(() => fetch("/api/process", { method: "POST", body: fd }));
  }

  const topics = data ? [...data.topics].sort((a, b) => b.examImportance - a.examImportance) : [];
  const weak = data ? weakTopics(data, progress) : [];
  const open = progress.mistakes.filter((m) => !m.resolved).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <header className={`${card} flex flex-col gap-5 sm:p-7`}>
          <div className="flex items-center gap-5">
            <Mascot size={104} className="shrink-0 drop-shadow-sm" />
            <div className="space-y-1.5">
              <span className="inline-block rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wide text-brand-800">
                {data?.demo ? <span title="Sem GEMINI_API_KEY: dados de exemplo">Demo mode</span> : "🧪 Prova de hoje"}
              </span>
              <h1 className="text-3xl sm:text-4xl">Olá, Estudante!</h1>
              <p className="font-semibold text-zinc-500">
                {progress.streak > 0 ? `Sequência de ${progress.streak} 🔥 Continue assim.` : open > 0 ? `Você tem ${open} erro(s) pra revisar.` : "Bora estudar química?"}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/study?mode=cram"
              className="flex flex-1 items-center justify-center gap-3 btn-3d rounded-2xl bg-brand-600 px-6 py-4 text-lg text-white hover:bg-brand-500"
            >
              <span aria-hidden className="text-2xl">⚡</span> Modo Cram
            </Link>
            <Link href="/exam" className="flex items-center justify-center gap-2 btn-3d rounded-2xl border-2 border-zinc-200 bg-white px-6 py-4 text-sky-600 hover:bg-zinc-50">
              ⏱️ Simulado
            </Link>
          </div>
        </header>

        {data && (
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2" aria-label="Estatísticas">
            <Stat icon="⚡" label="XP" value={progress.xp} className="text-amber-500" />
            <Stat icon="🔥" label="Melhor sequência" value={progress.bestStreak} className="text-amber-500" />
            <Stat icon="🧠" label="Domínio geral" value={`${Math.round(overallMastery(data, progress) * 100)}%`} className="text-brand-700" />
            <Stat icon="❗" label="Erros abertos" value={open} className="text-rose-600" href="/mistakes" />
          </section>
        )}
      </div>

      {loading && !data && <p className="text-zinc-500">Carregando…</p>}
      {error && !data && (
        <p role="alert" className="text-rose-700">
          {error}{" "}
          <button onClick={reload} className="underline">
            Tentar novamente
          </button>
        </p>
      )}

      {data && (
        <>
          {weak.length > 0 && (
            <section className={`${card} !border-rose-200`} aria-labelledby="fracos">
              <h2 id="fracos" className="mb-2 text-xl text-rose-700">Pontos fracos</h2>
              <ul className="flex flex-wrap gap-2">
                {weak.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/study?mode=topic&topic=${t.id}`}
                      className="inline-block rounded-full bg-rose-50 px-3 py-1 text-sm text-rose-700 hover:bg-rose-100"
                    >
                      {t.name} · {Math.round(topicMastery(progress, t.id) * 100)}%
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="prova" className="space-y-3">
            <h2 id="prova" className="text-2xl">O que cai na prova</h2>
            <ul className="grid gap-3 lg:grid-cols-2">
              {topics.map((t) => {
                const m = Math.round(topicMastery(progress, t.id) * 100);
                return (
                  <li key={t.id} className={`${card} flex flex-col gap-3`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-xl">🧪</span>
                        <div>
                          <p className="text-lg font-bold">{t.name}</p>
                          <p className="text-amber-500" aria-label={`Importância ${t.examImportance} de 5`}>
                            {"★".repeat(t.examImportance)}
                            <span className="text-zinc-300">{"★".repeat(5 - t.examImportance)}</span>
                            <span className="ml-2 text-xs font-extrabold text-zinc-500">Nível {t.examImportance}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 text-sm">
                        <Link href={`/one-shot/${t.id}`} className="btn-3d rounded-xl bg-brand-600 px-3 py-1.5 text-white hover:bg-brand-500">
                          One Shot
                        </Link>
                        <Link href={`/study?mode=topic&topic=${t.id}`} className="btn-3d rounded-xl border-2 border-zinc-200 bg-white px-3 py-1.5 text-sky-600 hover:bg-zinc-50">
                          Praticar
                        </Link>
                        <Link href={`/flashcards?topic=${t.id}`} className="btn-3d rounded-xl border-2 border-zinc-200 bg-white px-3 py-1.5 text-sky-600 hover:bg-zinc-50">
                          Cards
                        </Link>
                      </div>
                    </div>
                    <div className="mt-auto flex items-center gap-2 text-xs font-extrabold text-zinc-500">
                      <div
                        className="h-3.5 flex-1 rounded-full bg-zinc-200 p-0.5"
                        role="progressbar"
                        aria-valuenow={m}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Domínio de ${t.name}`}
                      >
                        <div className="h-full rounded-full bg-brand-500" style={{ width: `${m}%` }} />
                      </div>
                      {m}%
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      {/* online (Vercel) content is read-only: materials are processed locally and deployed */}
      <details hidden={!!process.env.NEXT_PUBLIC_VERCEL_ENV} open={!data || busy || !!procError} className={card}>
        <summary className="cursor-pointer text-lg font-extrabold">📚 Materiais{data && ` · ${data.documents.length} documento(s)`}</summary>
        {data && (
          <p className="my-3 text-sm text-zinc-500">
            {data.documents.map((d) => d.name).join(", ")}
          </p>
        )}
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (!busy) upload(e.dataTransfer.files);
          }}
          className={`block cursor-pointer rounded-xl border-2 border-dashed p-6 text-center text-sm ${drag ? "border-brand-600 bg-brand-50" : "border-zinc-300"}`}
        >
          Arraste PDFs, PPTX, TXT ou MD aqui, ou <span className="text-brand-600 underline">escolha arquivos</span>
          <input
            type="file"
            multiple
            accept=".pdf,.pptx,.txt,.md"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              upload(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            disabled={busy}
            onClick={() => run(() => fetch("/api/process?folder=1", { method: "POST" }))}
            className="btn-3d rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Usar arquivos da pasta docs/
          </button>
          {busy && (
            <span role="status" className="text-sm text-zinc-600">
              ⏳ Analisando materiais… {elapsed}s. Os tópicos aparecem abaixo conforme ficam prontos; já pode estudar os que tiverem questões.
            </span>
          )}
        </div>
        {procError && (
          <div role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
            Erro: {procError}
            <button onClick={() => last.current && run(last.current)} className="ml-2 font-medium underline">
              Tentar novamente
            </button>
          </div>
        )}
      </details>
    </div>
  );
}

function Stat({ icon, label, value, className, href }: { icon: string; label: string; value: React.ReactNode; className: string; href?: string }) {
  const inner = (
    <>
      <p aria-hidden className="text-xl">{icon}</p>
      <p className={`text-2xl font-black tabular-nums ${className}`}>{value}</p>
      <p className="text-xs font-bold text-zinc-500">{label}</p>
    </>
  );
  const cls = "tile flex flex-col items-center justify-center p-3 text-center";
  return href ? (
    <Link href={href} className={`${cls} hover:bg-zinc-50`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
