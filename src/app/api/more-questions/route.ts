import { hasKey } from "@/lib/ai/client";
import { moreQuestions } from "@/lib/ai/pipeline";
import { badSubject, subjectOf } from "@/lib/store";

export const runtime = "nodejs";
const READ_ONLY = "Online o conteúdo é só leitura. Processe os materiais localmente e faça deploy de data/.";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (process.env.VERCEL) return Response.json({ error: READ_ONLY }, { status: 403 });
  const subject = subjectOf(request);
  if (!subject) return badSubject();
  const { topicId } = (await request.json().catch(() => ({}))) as { topicId?: string };
  if (!topicId) return Response.json({ error: "Campo topicId obrigatório." }, { status: 400 });
  if (!hasKey()) return Response.json({ questions: [] });
  try {
    return Response.json({ questions: await moreQuestions(subject, topicId) });
  } catch (e) {
    console.error("[api/more-questions]", e);
    return Response.json({ error: `Falha ao gerar novas questões: ${e instanceof Error ? e.message : e}` }, { status: 500 });
  }
}
