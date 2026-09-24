import { hasKey } from "@/lib/ai/client";
import { askDoubt } from "@/lib/ai/pipeline";
import { badSubject, subjectOf } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const subject = subjectOf(request);
  if (!subject) return badSubject();
  const { topicId, question, context, answered } = (await request.json().catch(() => ({}))) as {
    topicId?: string;
    question?: string;
    context?: string;
    answered?: boolean;
  };
  const q = question?.trim();
  if (!topicId || !q) return Response.json({ error: "Escreva sua dúvida." }, { status: 400 });
  if (q.length > 600 || (context?.length ?? 0) > 3000) return Response.json({ error: "Dúvida muito longa, resume um pouco." }, { status: 400 });
  if (!hasKey()) return Response.json({ answer: "Modo demo: configure a GEMINI_API_KEY para a IA responder suas dúvidas." });
  try {
    return Response.json({ answer: await askDoubt(subject, topicId, q, context, !!answered) });
  } catch (e) {
    console.error("[api/ask]", e);
    const busy = /\b(429|503)\b|quota|overloaded/i.test(String(e));
    return Response.json(
      { error: busy ? "A IA tá sem cota agora, tenta de novo daqui a pouco." : `Falha ao responder: ${e instanceof Error ? e.message : e}` },
      { status: busy ? 503 : 500 },
    );
  }
}
