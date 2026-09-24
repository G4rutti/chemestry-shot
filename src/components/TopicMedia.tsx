"use client";
/* eslint-disable @next/next/no-img-element -- remote Wikimedia images, no need for next/image config */
import Link from "next/link";
import quimica from "@/lib/topic-media/quimica.json";
import { useSubject } from "@/lib/use-study";

type Media = { title: string; url: string; extract: string; image: string | null; imageFrom: string | null; imageUrl: string | null };

// one file per subject (src/lib/topic-media/<subject>.json); a subject without one just shows no media
const MEDIA: Record<string, Record<string, Media>> = { quimica };

type Props = Readonly<{
  topicId: string;
  topicName?: string;
  /** thumbnail + link, for answer feedback */
  compact?: boolean;
}>;

/** Picture + plain explanation from pt.wikipedia (fetched once by scripts/fetch-topic-media.mjs) and video lessons. */
export default function TopicMedia({ topicId, topicName, compact = false }: Props) {
  const subject = useSubject();
  const m = subject ? MEDIA[subject]?.[topicId] : undefined;
  const videos = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${topicName ?? m?.title ?? ""} aula`)}`;

  if (compact)
    return (
      <Link href={`/one-shot/${topicId}`} className="tile flex items-center gap-3 p-2 pr-4 hover:bg-zinc-50">
        {m?.image ? (
          <img src={m.image} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-xl bg-white object-contain" />
        ) : (
          <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-2xl">📖</span>
        )}
        <span className="text-sm font-bold text-zinc-800">
          Revisar a explicação completa
          <span className="block text-xs font-semibold text-zinc-500">Resumo, imagem e podcast do tópico →</span>
        </span>
      </Link>
    );

  if (!m)
    return (
      <a href={videos} target="_blank" rel="noreferrer" className="btn-3d flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 py-3 text-white">
        ▶️ Vídeo-aulas no YouTube
      </a>
    );

  return (
    <section className="tile overflow-hidden" aria-label="Explicação visual">
      {m.image && (
        <figure className="border-b-2 border-zinc-200 bg-white">
          <img src={m.image} alt={m.imageFrom ?? m.title} loading="lazy" className="mx-auto max-h-72 w-full object-contain p-4" />
          <figcaption className="px-5 pb-3 text-xs font-semibold text-zinc-500">
            Imagem:{" "}
            <a href={m.imageUrl ?? m.url} target="_blank" rel="noreferrer" className="underline hover:text-zinc-800">
              {m.imageFrom}, Wikipédia
            </a>
          </figcaption>
        </figure>
      )}
      <div className="space-y-4 p-5">
        <h2 className="text-lg">🖼️ Entenda de outro jeito</h2>
        <p className="line-clamp-6 text-zinc-700">{m.extract}</p>
        <div className="grid grid-cols-2 gap-2 text-center">
          <a href={m.url} target="_blank" rel="noreferrer" className="btn-3d rounded-xl border-2 border-zinc-200 bg-white px-2 py-2 text-sm text-sky-600 hover:bg-zinc-50">
            📚 Ler na Wikipédia
          </a>
          <a href={videos} target="_blank" rel="noreferrer" className="btn-3d rounded-xl bg-rose-600 px-2 py-2 text-sm text-white hover:bg-rose-700">
            ▶️ Vídeo-aulas
          </a>
        </div>
      </div>
    </section>
  );
}
