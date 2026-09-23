"use client";

import { useCallback, useEffect, useState } from "react";
import { emptyProgress, recordAnswer } from "@/lib/study/engine";
import type { Progress, Question, StudyData } from "@/lib/types";

const KEY = "chemshot-progress";

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...emptyProgress(), ...JSON.parse(raw) } : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

function save(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}

/** Study data from the server + progress from localStorage. The answer hot path is 100% local. */
export function useStudy() {
  const [data, setData] = useState<StudyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>(emptyProgress);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/study", { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? res.statusText);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setProgress(loadProgress()); // eslint-disable-line react-hooks/set-state-in-effect -- localStorage only exists on client
    reload();
  }, [reload]);

  const answer = useCallback((q: Question, given: string, correct: boolean) => {
    setProgress((p) => {
      const next = recordAnswer(p, q, given, correct);
      save(next);
      return next;
    });
  }, []);

  const resetProgress = useCallback(() => {
    const p = emptyProgress();
    save(p);
    setProgress(p);
  }, []);

  return { data, setData, loading, error, reload, progress, answer, resetProgress };
}
