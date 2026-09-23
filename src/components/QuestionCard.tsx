"use client";

import { useEffect, useRef, useState } from "react";
import { checkAnswer } from "@/lib/study/engine";
import type { Question } from "@/lib/types";
import Listen from "./Listen";
import Mascot from "./Mascot";
import TopicMedia from "./TopicMedia";

type Props = {
  question: Question;
  onAnswered: (given: string, correct: boolean) => void;
  onNext: () => void;
  showFeedback?: boolean;
};

const DONT_KNOW = "Não sei";
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A nudge that doesn't give the answer away: the tip with the answer blanked out, plus a type-specific clue. */
function hintFor(q: Question) {
  const tip = q.memoryTip && q.correctAnswer.length > 1 ? q.memoryTip.replace(new RegExp(escape(q.correctAnswer), "gi"), "___") : q.memoryTip;
  const words = q.correctAnswer.trim().split(/\s+/);
  const clue =
    q.type === "fill"
      ? `Começa com “${q.correctAnswer.trim()[0]}” e tem ${words.length > 1 ? `${words.length} palavras` : `${q.correctAnswer.trim().length} letras`}.`
      : q.type === "multiple-choice" && (q.options?.length ?? 0) >= 3
        ? "Risquei uma alternativa errada pra você."
        : "";
  const out = [tip, clue].filter(Boolean);
  return out.length ? out : ["Lembra do resumo One Shot desse tópico: a resposta tá lá 😉"];
}

export default function QuestionCard({ question: q, onAnswered, onNext, showFeedback = true }: Props) {
  const [given, setGiven] = useState<string | null>(null);
  const [correct, setCorrect] = useState(false);
  const [text, setText] = useState("");
  const [overridden, setOverridden] = useState(false);
  const [hint, setHint] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const hasOptions = !!q.options?.length;
  const done = given !== null;
  const dontKnow = given === DONT_KNOW;
  const wrongOptions = q.options?.filter((o) => o !== q.correctAnswer) ?? [];
  // the option the hint strikes out; stable per question so re-renders don't move it
  const cut = hint && q.type === "multiple-choice" && wrongOptions.length >= 2 ? wrongOptions[q.id.length % wrongOptions.length] : null;

  function submit(answer: string) {
    if (done || !answer.trim()) return;
    const ok = answer !== DONT_KNOW && checkAnswer(q, answer);
    if (!showFeedback) {
      onAnswered(answer, ok);
      onNext();
      return;
    }
    setGiven(answer);
    setCorrect(ok);
    onAnswered(answer, ok);
  }

  function override() {
    setOverridden(true);
    setCorrect(true);
    onAnswered(given ?? "", true);
  }

  useEffect(() => {
    if (done) nextRef.current?.focus();
    else if (!hasOptions) inputRef.current?.focus();
  }, [done, hasOptions]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done) {
        if ((e.key === "Enter" || e.key === " ") && document.activeElement !== nextRef.current) {
          e.preventDefault();
          onNext();
        }
        return;
      }
      if (!hasOptions) return;
      const i = Number(e.key) - 1;
      if (i >= 0 && i < 5 && q.options![i] !== undefined && q.options![i] !== cut) submit(q.options![i]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // state per option: idle | right | wrong | dim
  function optionState(opt: string) {
    if (!done) return opt === cut ? "dim" : "idle";
    if (opt === q.correctAnswer) return "right";
    return opt === given ? "wrong" : "dim";
  }

  const optionStyles = {
    idle: ["border-zinc-200 bg-white text-zinc-800 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-600 active:translate-y-0.5", "border-2 border-zinc-200 bg-zinc-100 text-zinc-500", ""],
    right: ["border-brand-500 bg-brand-50 text-brand-800", "bg-brand-500 text-white", "✓"],
    wrong: ["border-rose-400 bg-rose-50 text-rose-700", "bg-rose-600 text-white", "✕"],
    dim: ["border-zinc-200 bg-white opacity-60", "border-2 border-zinc-200 bg-zinc-100 text-zinc-500", ""],
  } as const;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-zinc-200 bg-zinc-50">
          <Mascot size={52} />
        </span>
        <p className="tile bubble flex-1 px-5 py-4 text-xl font-extrabold leading-snug whitespace-pre-line">{q.question}</p>
      </div>

      {hasOptions ? (
        <div className="space-y-3">
          <p className="text-sm font-extrabold uppercase tracking-wide text-zinc-500">Selecione a opção correta:</p>
          {q.options!.map((opt, i) => {
            const [tile, badge, mark] = optionStyles[optionState(opt)];
            return (
              <button
                key={i}
                type="button"
                disabled={done || opt === cut}
                onClick={() => submit(opt)}
                className={`flex w-full items-center gap-4 rounded-2xl border-2 border-b-4 px-4 py-4 text-left text-lg font-bold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300 ${tile}`}
              >
                <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${badge}`}>{i + 1}</span>
                <span className={`flex-1 ${opt === cut ? "line-through" : ""}`}>{opt}</span>
                <span aria-hidden className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-black ${mark ? badge : "border-2 border-zinc-200"}`}>{mark}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(text);
          }}
          className="flex gap-2"
        >
          <label htmlFor={`ans-${q.id}`} className="sr-only">Sua resposta</label>
          <input
            id={`ans-${q.id}`}
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={done}
            autoComplete="off"
            placeholder={q.type === "calculation" ? "Resultado (ex: 2,5 mol/L)" : "Sua resposta"}
            className={`flex-1 rounded-2xl border-2 border-b-4 px-4 py-3 text-base font-bold bg-white focus:outline-none focus:border-sky-300 ${
              done ? (correct ? "border-brand-500 bg-brand-50" : "border-rose-400 bg-rose-50") : "border-zinc-200"
            }`}
          />
          {!done && (
            <button type="submit" disabled={!text.trim()} className="btn-3d rounded-2xl bg-brand-600 px-5 py-3 font-semibold text-white disabled:opacity-40 hover:bg-brand-700">
              Responder
            </button>
          )}
        </form>
      )}

      {!done && (
        <div className="space-y-3">
          {hint && (
            <div className="tile flex gap-3 !border-amber-500/40 !bg-amber-50 p-4 font-semibold text-zinc-800" role="status">
              <span aria-hidden className="text-2xl">💡</span>
              <div className="space-y-1">
                {hintFor(q).map((h, i) => (
                  <p key={i}>{h}</p>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-between gap-2">
            {showFeedback && !hint ? (
              <button type="button" onClick={() => setHint(true)} className="btn-3d rounded-xl border-2 border-zinc-200 bg-white px-4 py-2 text-sm text-amber-600 hover:bg-zinc-50">
                💡 Dica
              </button>
            ) : (
              <span />
            )}
            <button type="button" onClick={() => submit(DONT_KNOW)} className="btn-3d rounded-xl border-2 border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-500 hover:bg-zinc-50">
              🤷 Não sei
            </button>
          </div>
        </div>
      )}

      {done && (
        <div className={`rounded-2xl p-4 space-y-2 ${correct ? "bg-brand-100 text-brand-800" : "bg-rose-100 text-rose-700"}`} role="status">
          <p className="font-black text-xl">{correct ? (overridden ? "Ok, contou como certa ✔" : "Correto! 🎉") : dontKnow ? "Tranquilo, bora aprender 👇" : "Não foi dessa vez"}</p>
          {!hasOptions && !correct && (
            <p>
              Resposta correta: <strong>{q.correctAnswer}</strong>
            </p>
          )}
          {!hasOptions && !correct && !dontKnow && (
            <button type="button" onClick={override} className="text-sm underline text-rose-700 hover:text-rose-900">
              Na verdade acertei
            </button>
          )}
          <p className="text-zinc-800">{q.explanation}</p>
          {q.memoryTip && <p className="text-zinc-800">💡 {q.memoryTip}</p>}
          <p className="text-xs text-zinc-500">
            Fonte: {q.source.document}
            {q.source.page != null && `, p. ${q.source.page}`}
          </p>
          <Listen compact parts={[correct ? "" : `A resposta certa é ${q.correctAnswer}.`, q.explanation, q.memoryTip && `Dica pra lembrar: ${q.memoryTip}`]} />
        </div>
      )}

      {done && !correct && <TopicMedia compact topicId={q.topicId} />}

      {done && (
        <button
          ref={nextRef}
          type="button"
          onClick={onNext}
          className={`w-full rounded-2xl py-4 text-lg btn-3d text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 ${
            correct ? "bg-brand-600 hover:bg-brand-700" : "bg-rose-600 hover:bg-rose-700"
          }`}
        >
          Continuar →
        </button>
      )}
    </div>
  );
}
