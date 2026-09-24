"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { emptyProgress, recordAnswer } from "@/lib/study/engine";
import { DEFAULT_SUBJECT, type Progress, type Question, type StudyData } from "@/lib/types";

// ---- active subject: chosen in the NavBar, kept in this browser; pages keep their URLs ----

const SUBJECT_KEY = "subject";

export function getActiveSubject(): string {
  try {
    return localStorage.getItem(SUBJECT_KEY) || DEFAULT_SUBJECT;
  } catch {
    return DEFAULT_SUBJECT;
  }
}

export function setActiveSubject(subject: string) {
  try {
    localStorage.setItem(SUBJECT_KEY, subject);
  } catch {}
  window.dispatchEvent(new Event(SUBJECT_KEY));
}

function subscribe(cb: () => void) {
  window.addEventListener(SUBJECT_KEY, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(SUBJECT_KEY, cb);
    window.removeEventListener("storage", cb);
  };
}

/** null during server render / hydration (localStorage only exists on the client). */
export const useSubject = () => useSyncExternalStore(subscribe, getActiveSubject, () => null);

/** `?subject=` for API calls. */
export const withSubject = (url: string, subject: string) => `${url}${url.includes("?") ? "&" : "?"}subject=${encodeURIComponent(subject)}`;

// ---- progress: one localStorage entry per subject ----

const progressKey = (subject: string) => `progress:${subject}`;
const LEGACY_KEY = "chemshot-progress"; // single-subject era: that was chemistry

export function loadProgress(subject = getActiveSubject()): Progress {
  try {
    let raw = localStorage.getItem(progressKey(subject));
    if (!raw && subject === DEFAULT_SUBJECT && (raw = localStorage.getItem(LEGACY_KEY))) {
      localStorage.setItem(progressKey(subject), raw);
      localStorage.removeItem(LEGACY_KEY);
    }
    return raw ? { ...emptyProgress(), ...JSON.parse(raw) } : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

function save(subject: string, p: Progress) {
  try {
    localStorage.setItem(progressKey(subject), JSON.stringify(p));
  } catch {}
}

/** Study data of the active subject from the server + its progress from localStorage. The answer hot path is 100% local. */
export function useStudy() {
  const subject = useSubject();
  const [data, setData] = useState<StudyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>(emptyProgress);

  const reload = useCallback(async () => {
    if (!subject) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(withSubject("/api/study", subject), { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? res.statusText);
      const json = await res.json();
      if (subject === getActiveSubject()) setData(json); // subject switched meanwhile: drop the stale answer
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [subject]);

  useEffect(() => {
    if (!subject) return;
    /* eslint-disable react-hooks/set-state-in-effect -- localStorage only exists on client; reset when the subject changes */
    setData(null);
    setProgress(loadProgress(subject));
    /* eslint-enable react-hooks/set-state-in-effect */
    reload();
  }, [subject, reload]);

  const answer = useCallback(
    (q: Question, given: string, correct: boolean) => {
      if (!subject) return;
      setProgress((p) => {
        const next = recordAnswer(p, q, given, correct);
        save(subject, next);
        return next;
      });
    },
    [subject],
  );

  const resetProgress = useCallback(() => {
    if (!subject) return;
    const p = emptyProgress();
    save(subject, p);
    setProgress(p);
  }, [subject]);

  return { subject, data, setData, loading, error, reload, progress, answer, resetProgress };
}
