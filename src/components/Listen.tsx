"use client";

import { useEffect, useRef, useState } from "react";
import Mascot from "./Mascot";

type Line = { speaker: string; text: string };
export type Episode = { src: string; lines: Line[]; seconds: number };

type Props = Readonly<{
  parts: string[];
  title?: string;
  /** small inline "listen" button instead of the podcast card */
  compact?: boolean;
  /** pre-recorded two-host episode (scripts/make-podcasts.mts); falls back to browser TTS without it */
  episode?: Episode;
}>;

const HOST_ICON: Record<string, string> = { Lia: "👩‍🔬", Beto: "👨‍🔬" };

const RATES = [1, 1.25, 1.5];

// Chrome cuts long utterances off after ~15s, so speak sentence by sentence.
const sentences = (parts: string[]) =>
  parts.flatMap((p) => p.split(/(?<=[.!?:;])\s+/)).map((s) => s.trim()).filter(Boolean);

// neural voices (Edge "Online (Natural)", Chrome "Google") sound far less robotic than the OS defaults
function ptVoice() {
  const pt = speechSynthesis.getVoices().filter((v) => /^pt[-_]BR/i.test(v.lang));
  return pt.find((v) => /natural|online/i.test(v.name)) ?? pt.find((v) => /google/i.test(v.name)) ?? pt[0];
}

export default function Listen(props: Props) {
  return props.episode && !props.compact ? <EpisodePlayer title={props.title} episode={props.episode} /> : <Speech {...props} />;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Player for a recorded episode, with a caption that follows the transcript. */
function EpisodePlayer({ title = "Podcast", episode }: Readonly<{ title?: string; episode: Episode }>) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [rate, setRate] = useState(1);
  const [duration, setDuration] = useState(episode.seconds);

  // ponytail: caption position estimated from text length, no per-line timestamps from TTS
  const ends = episode.lines.map((l, i, all) => all.slice(0, i + 1).reduce((n, x) => n + x.text.length, 0));
  const target = (time / duration) * ends[ends.length - 1];
  const line = episode.lines[Math.max(0, ends.findIndex((end) => end >= target))];

  return (
    <section className="tile space-y-4 p-5" aria-label={title}>
      <audio
        ref={audio}
        src={episode.src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || episode.seconds)}
        onEnded={() => setTime(0)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
      />
      <div className="flex items-center gap-4">
        <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-zinc-200 bg-zinc-50">
          <Mascot size={44} />
          <span aria-hidden className="absolute -right-1 -bottom-1 text-xl">🎧</span>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg">🎙️ {title}</h2>
          <p className="text-sm font-semibold text-zinc-500">Com Lia e Beto · {fmt(episode.seconds)}</p>
        </div>
        <button
          type="button"
          onClick={() => (playing ? audio.current?.pause() : audio.current?.play())}
          aria-label={playing ? "Pausar" : "Ouvir"}
          className="btn-3d flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-600 text-2xl text-white hover:bg-brand-500"
        >
          {playing ? "⏸" : "▶"}
        </button>
      </div>

      <div className="flex items-start gap-2">
        <span aria-hidden className="mt-2 text-2xl">{HOST_ICON[line.speaker] ?? "🎙️"}</span>
        <p aria-live="off" className="tile bubble ml-2 min-h-14 flex-1 px-4 py-3 font-bold text-zinc-800">
          <span className="block text-xs font-extrabold uppercase tracking-wide text-sky-600">{line.speaker}</span>
          {line.text}
        </p>
      </div>

      <div className="space-y-2">
        <input
          type="range"
          min={0}
          max={duration}
          step={0.1}
          value={time}
          onChange={(e) => audio.current && (audio.current.currentTime = Number(e.target.value))}
          aria-label="Posição do episódio"
          className="w-full accent-brand-600"
        />
        <div className="flex items-center justify-between text-xs font-extrabold text-zinc-500 tabular-nums">
          <span>
            {fmt(time)} / {fmt(duration)}
          </span>
          <div className="flex gap-1" role="group" aria-label="Velocidade">
            {RATES.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={rate === r}
                onClick={() => {
                  setRate(r);
                  if (audio.current) audio.current.playbackRate = r;
                }}
                className={`rounded-full border-2 px-2.5 py-0.5 ${rate === r ? "border-sky-300 bg-sky-50 text-sky-600" : "border-zinc-200 bg-white"}`}
              >
                {r}x
              </button>
            ))}
          </div>
        </div>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer font-extrabold text-zinc-500">📜 Transcrição</summary>
        <ol className="mt-2 space-y-1.5">
          {episode.lines.map((l, i) => (
            <li key={i} className={l === line && time > 0 ? "font-bold text-zinc-900" : "text-zinc-600"}>
              <span className="font-extrabold text-sky-600">{l.speaker}:</span> {l.text}
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}

/** Narration with the browser's built-in text-to-speech (no network), for text without a recorded episode. */
function Speech({ parts, title = "Modo podcast", compact = false }: Props) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<"idle" | "playing" | "paused">("idle");
  const [at, setAt] = useState(-1);
  const [rate, setRate] = useState(1);
  const run = useRef(0); // invalidates callbacks of a cancelled run
  const lines = sentences(parts);

  useEffect(() => {
    setSupported("speechSynthesis" in window); // eslint-disable-line react-hooks/set-state-in-effect -- browser-only API
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- bumping the counter is the point: it voids pending callbacks
      run.current++;
      if ("speechSynthesis" in window) speechSynthesis.cancel();
    };
  }, []);

  function play(from = 0, r = rate) {
    const id = ++run.current;
    speechSynthesis.cancel();
    const voice = ptVoice();
    lines.slice(from).forEach((text, k) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "pt-BR";
      u.rate = r;
      if (voice) u.voice = voice;
      u.onstart = () => id === run.current && setAt(from + k);
      if (from + k === lines.length - 1)
        u.onend = () => {
          if (id !== run.current) return;
          setState("idle");
          setAt(-1);
        };
      speechSynthesis.speak(u);
    });
    setState("playing");
  }

  function stop() {
    run.current++;
    speechSynthesis.cancel();
    setState("idle");
    setAt(-1);
  }

  function toggle() {
    if (state === "idle") return play();
    if (state === "playing") {
      speechSynthesis.pause();
      setState("paused");
    } else {
      speechSynthesis.resume();
      setState("playing");
    }
  }

  if (!supported || !lines.length) return null;

  if (compact)
    return (
      <button
        type="button"
        onClick={() => (state === "idle" ? play() : stop())}
        className="btn-3d inline-flex items-center gap-2 rounded-xl border-2 border-zinc-200 bg-white px-3 py-1.5 text-xs text-sky-600 hover:bg-zinc-50"
      >
        <span aria-hidden>{state === "idle" ? "🔊" : "⏹️"}</span>
        {state === "idle" ? "Ouvir explicação" : "Parar"}
      </button>
    );

  const pct = at < 0 ? 0 : Math.round(((at + 1) / lines.length) * 100);

  return (
    <section className="tile space-y-4 p-5" aria-label={title}>
      <div className="flex items-center gap-4">
        <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-zinc-200 bg-zinc-50">
          <Mascot size={44} />
          <span aria-hidden className="absolute -right-1 -bottom-1 text-xl">🎧</span>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg">🎙️ {title}</h2>
          <p className="text-sm font-semibold text-zinc-500">Resumo narrado, dá pra ouvir no ônibus.</p>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label={state === "playing" ? "Pausar" : "Ouvir"}
          className="btn-3d flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-600 text-2xl text-white hover:bg-brand-500"
        >
          {state === "playing" ? "⏸" : "▶"}
        </button>
      </div>

      <p aria-live="polite" className="tile bubble ml-2 min-h-14 px-4 py-3 font-bold text-zinc-800">
        {at >= 0 ? lines[at] : <span className="text-zinc-400">Aperte ▶ pra começar o episódio.</span>}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="h-3.5 flex-1 rounded-full bg-zinc-200 p-0.5" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso do episódio">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex gap-1" role="group" aria-label="Velocidade">
          {RATES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={rate === r}
              onClick={() => {
                setRate(r);
                if (state !== "idle") play(Math.max(at, 0), r);
              }}
              className={`rounded-full border-2 px-2.5 py-0.5 text-xs font-extrabold ${rate === r ? "border-sky-300 bg-sky-50 text-sky-600" : "border-zinc-200 bg-white text-zinc-500"}`}
            >
              {r}x
            </button>
          ))}
        </div>
        {state !== "idle" && (
          <button type="button" onClick={stop} className="text-xs font-extrabold uppercase tracking-wide text-zinc-500 hover:text-zinc-800">
            Parar
          </button>
        )}
      </div>
    </section>
  );
}
