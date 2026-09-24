"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_SUBJECT } from "@/lib/types";
import { useSubject, withSubject } from "@/lib/use-study";
import Mascot from "./Mascot";

export type Doubt = { id: string; topicId: string; question: string; answer: string; context?: string; at: number };

const key = (subject: string) => `doubts:${subject}`;
const LEGACY_KEY = "chemshot-doubts"; // single-subject era: that was chemistry

// ponytail: doubts live in this browser only (like progress); a shared list needs a database (e.g. Supabase)
export function loadDoubts(subject: string): Doubt[] {
  try {
    let raw = localStorage.getItem(key(subject));
    if (!raw && subject === DEFAULT_SUBJECT && (raw = localStorage.getItem(LEGACY_KEY))) {
      localStorage.setItem(key(subject), raw);
      localStorage.removeItem(LEGACY_KEY);
    }
    return JSON.parse(raw ?? "[]") as Doubt[];
  } catch {
    return [];
  }
}

function saveDoubts(subject: string, all: Doubt[]) {
  try {
    localStorage.setItem(key(subject), JSON.stringify(all));
  } catch {}
}

/** The question's context plus the chat so far, so follow-ups ("e o passo 2?") make sense; fits the API's 3000-char cap. */
function withThread(context: string | undefined, thread: Doubt[]) {
  const chat = thread.map((d) => `Aluno: ${d.question}\nProfessor: ${d.answer}`).join("\n").slice(-1500);
  return [context, chat && `Conversa até aqui:\n${chat}`].filter(Boolean).join("\n").slice(0, 3000) || undefined;
}

type Props = Readonly<{
  topicId: string;
  /** the question the student is looking at, sent so the AI knows what "isso" refers to */
  context?: string;
  /** whether the student already answered `context` (otherwise the AI guides without giving the answer) */
  answered?: boolean;
  /** inline panel inside a question (shows only this panel's thread) */
  compact?: boolean;
  placeholder?: string;
  /** asked on its own as soon as the panel opens (e.g. after "Não sei") */
  autoAsk?: string;
}>;

/** "Tirar dúvida": asks Gemini about the topic and keeps every answer in localStorage. */
export default function AskAI({ topicId, context, answered = false, compact = false, placeholder, autoAsk }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Doubt[]>([]);
  const [thread, setThread] = useState<Doubt[]>([]);
  const subject = useSubject();

  useEffect(() => {
    if (subject) setHistory(loadDoubts(subject).filter((d) => d.topicId === topicId)); // eslint-disable-line react-hooks/set-state-in-effect -- localStorage only exists on client
  }, [subject, topicId]);

  const autoAsked = useRef(false); // once, even under StrictMode's double effects
  useEffect(() => {
    if (!autoAsk || !subject || autoAsked.current) return;
    autoAsked.current = true;
    ask(autoAsk);
  }, [autoAsk, subject]); // eslint-disable-line react-hooks/exhaustive-deps -- ask reads current state; must not re-run

  async function ask(question: string) {
    if (!question || busy || !subject) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(withSubject("/api/ask", subject), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, question, context: withThread(context, thread), answered }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.answer) throw new Error(json?.error ?? "A IA não respondeu, tenta de novo.");
      const d: Doubt = { id: crypto.randomUUID(), topicId, question, answer: json.answer, context, at: Date.now() };
      saveDoubts(subject, [...loadDoubts(subject), d]);
      setHistory((h) => [...h, d]);
      setThread((t) => [...t, d]);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function remove(id: string) {
    if (!subject) return;
    saveDoubts(subject, loadDoubts(subject).filter((d) => d.id !== id));
    setHistory((h) => h.filter((d) => d.id !== id));
  }

  const shown = compact ? thread : [...history].reverse();

  return (
    <section className={compact ? "space-y-3" : "tile space-y-4 p-5"} aria-label="Tirar dúvida com a IA">
      {!compact && (
        <div>
          <h2 className="text-lg">🙋 Dúvidas</h2>
          <p className="text-sm font-semibold text-zinc-500">Pergunta qualquer coisa do tópico. As respostas ficam salvas aqui.</p>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(text.trim());
        }}
        className="flex gap-2"
      >
        <label htmlFor={`ask-${topicId}`} className="sr-only">
          Sua dúvida
        </label>
        <input
          id={`ask-${topicId}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={600}
          autoComplete="off"
          placeholder={placeholder ?? "Ex.: como sei quantos elétrons cabem em cada camada?"}
          className="min-w-0 flex-1 rounded-2xl border-2 border-b-4 border-zinc-200 bg-white px-4 py-3 font-semibold focus:border-sky-300 focus:outline-none"
        />
        <button type="submit" disabled={!text.trim() || busy} className="btn-3d shrink-0 rounded-2xl bg-sky-600 px-4 py-3 text-sm text-white disabled:opacity-40">
          {busy ? "Pensando…" : "Perguntar"}
        </button>
      </form>

      {busy && (
        <p role="status" className="animate-pulse text-sm font-bold text-zinc-500">
          🧪 O professor tá pensando…
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          {error}
        </p>
      )}

      {shown.length > 0 && (
        <ul className="space-y-4">
          {shown.map((d) => (
            <li key={d.id} className="space-y-2">
              <p className="ml-auto w-fit max-w-[90%] rounded-2xl rounded-br-md bg-sky-50 px-4 py-2 font-bold text-sky-700">{d.question}</p>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-zinc-200 bg-zinc-50">
                  <Mascot size={32} />
                </span>
                <div className="tile bubble flex-1 px-4 py-3">
                  <p className="whitespace-pre-line text-zinc-800">{d.answer}</p>
                  {!compact && (
                    <button type="button" onClick={() => remove(d.id)} className="mt-2 text-xs font-extrabold uppercase tracking-wide text-zinc-400 hover:text-rose-600">
                      Apagar
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {compact && thread.length > 0 && <p className="text-xs font-semibold text-zinc-500">Salvo nas dúvidas do tópico (no resumo One Shot).</p>}
    </section>
  );
}
