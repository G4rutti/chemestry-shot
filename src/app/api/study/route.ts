import { hasKey } from "@/lib/ai/client";
import { mockStudy } from "@/lib/mock";
import { badSubject, getStudy, getSubject, subjectOf } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const subject = subjectOf(request);
  if (!subject) return badSubject();
  const study = await getStudy(subject);
  // always carry the subject (data made before multi-subject has none saved)
  return Response.json(study ? { ...study, subject: await getSubject(subject, study) } : hasKey() ? null : mockStudy);
}
