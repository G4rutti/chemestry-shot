"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { emptyProgress } from "@/lib/study/engine";
import { loadProgress, setActiveSubject, useSubject, useSubjects } from "@/lib/use-study";
import Mascot from "./Mascot";

const links = [
  { href: "/", match: "/", icon: "🏠", label: "Início" },
  { href: "/study?mode=cram", match: "/study", icon: "⚡", label: "Cram" },
  { href: "/mistakes", match: "/mistakes", icon: "📕", label: "Erros" },
  { href: "/flashcards", match: "/flashcards", icon: "🃏", label: "Cards" },
  { href: "/exam", match: "/exam", icon: "⏱️", label: "Simulado" },
  { href: "/review", match: "/review", icon: "📋", label: "Revisão" },
] as const;

export default function NavBar() {
  const path = usePathname();
  const [p, setP] = useState(emptyProgress);
  const subject = useSubject();
  const subjects = useSubjects();

  // progress lives in localStorage: re-read on every navigation, subject switch and when another tab changes it
  useEffect(() => {
    if (!subject) return;
    const sync = () => setP(loadProgress(subject));
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [path, subject]);

  const open = p.mistakes.filter((m) => !m.resolved).length;
  const active = (match: string) => (match === "/" ? path === "/" : path.startsWith(match));

  const tabs = (mobile: boolean) =>
    links.map((l) => {
      const on = active(l.match);
      return (
        <Link
          key={l.href}
          href={l.href}
          aria-current={on ? "page" : undefined}
          className={
            mobile
              ? `relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-extrabold ${on ? "bg-sky-50 text-sky-600" : "text-zinc-500"}`
              : `relative flex items-center gap-1.5 whitespace-nowrap rounded-xl border-2 px-2.5 py-1.5 text-sm font-extrabold uppercase tracking-wide transition ${
                  on ? "border-sky-300 border-b-4 bg-sky-50 text-sky-600" : "border-transparent text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                }`
          }
        >
          <span aria-hidden className={mobile ? "text-xl" : "text-base"}>{l.icon}</span>
          {l.label}
          {l.match === "/mistakes" && open > 0 && (
            <span className="absolute -top-1.5 right-0 min-w-5 rounded-full bg-rose-600 px-1.5 text-center text-[11px] leading-5 text-white">{open}</span>
          )}
        </Link>
      );
    });

  const chip = "flex items-center gap-1 whitespace-nowrap rounded-full border-2 border-zinc-200 bg-white px-2.5 py-1 text-sm font-black tabular-nums";

  return (
    <>
      <header className="no-print sticky top-0 z-20 border-b-2 border-zinc-200 bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-2.5">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-xl font-black tracking-tight text-brand-700">
            <Mascot size={36} />
            <span className="hidden sm:inline">Study Shot</span>
          </Link>
          {subjects.length > 1 && subject && (
            <select
              aria-label="Matéria"
              value={subject}
              onChange={(e) => setActiveSubject(e.target.value)}
              className="w-36 shrink-0 truncate rounded-full border-2 sm:w-44 border-b-4 border-zinc-200 bg-white px-3 py-1 text-sm font-extrabold text-zinc-700 focus:border-sky-300 focus:outline-none"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <nav aria-label="Principal" className="mx-auto hidden items-center gap-0.5 lg:flex">
            {tabs(false)}
          </nav>
          <div className="ml-auto flex items-center gap-2 lg:ml-0" aria-label="Seu progresso">
            <span className={`${chip} text-amber-500`} title="Sequência de acertos">🔥 {p.streak}</span>
            <span className={`${chip} text-amber-500`} title="XP">⚡ {p.xp}</span>
          </div>
        </div>
      </header>
      <nav aria-label="Principal" className="no-print fixed inset-x-0 bottom-0 z-20 flex gap-1 border-t-2 border-zinc-200 bg-white px-2 py-1.5 lg:hidden">
        {tabs(true)}
      </nav>
    </>
  );
}
