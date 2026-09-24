import { hasKey } from "@/lib/ai/client";
import { mockStudy } from "@/lib/mock";
import { badSubject, getStudy, subjectOf } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const subject = subjectOf(request);
  if (!subject) return badSubject();
  return Response.json((await getStudy(subject)) ?? (hasKey() ? null : mockStudy));
}
