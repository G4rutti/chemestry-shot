import { hasKey } from "@/lib/ai/client";
import { oneShot } from "@/lib/ai/pipeline";
import { mockOneShot } from "@/lib/mock";
import { badSubject, subjectOf } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const subject = subjectOf(request);
  if (!subject) return badSubject();
  const topicId = new URL(request.url).searchParams.get("topicId");
  if (!topicId) return Response.json({ error: "Parâmetro topicId obrigatório." }, { status: 400 });
  if (!hasKey()) return Response.json(mockOneShot(topicId));
  try {
    return Response.json(await oneShot(subject, topicId));
  } catch (e) {
    console.error("[api/one-shot]", e);
    return Response.json({ error: `Falha ao gerar o One Shot: ${e instanceof Error ? e.message : e}` }, { status: 500 });
  }
}
