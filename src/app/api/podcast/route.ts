import { hasKey } from "@/lib/ai/client";
import { oneShot } from "@/lib/ai/pipeline";
import { makePodcast } from "@/lib/ai/podcast";
import { badSubject, getStudy, getSubject, subjectOf } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 300; // script + multi-speaker TTS for ~2 min of audio

export async function POST(request: Request) {
  const subject = subjectOf(request);
  if (!subject) return badSubject();
  const { topicId, mistakes } = (await request.json().catch(() => ({}))) as { topicId?: string; mistakes?: unknown };
  if (!topicId) return Response.json({ error: "Campo topicId obrigatório." }, { status: 400 });
  if (!hasKey()) return Response.json({ error: "Configure uma chave de IA para gerar podcasts." }, { status: 503 });
  // the student's recent wrong questions personalize the episode; capped so the prompt stays small
  const wrong = (Array.isArray(mistakes) ? mistakes : []).filter((m): m is string => typeof m === "string").slice(0, 5).map((m) => m.slice(0, 300));
  try {
    const shot = await oneShot(subject, topicId);
    const { mp3, ...rest } = await makePodcast(await getSubject(subject, await getStudy(subject)), shot, wrong);

    return Response.json({ ...rest, audio: mp3?.toString("base64") ?? null });
  } catch (e) {
    console.error("[api/podcast]", e);
    const busy = /\b(429|503)\b|quota|overloaded/i.test(String(e));
    return Response.json(
      { error: busy ? "As IAs estão sem cota agora, tenta de novo daqui a pouco." : `Falha ao gerar o podcast: ${e instanceof Error ? e.message : e}` },
      { status: busy ? 503 : 500 },
    );
  }
}
