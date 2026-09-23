import { hasKey } from "@/lib/ai/client";
import { mockStudy } from "@/lib/mock";
import { getStudy } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  return Response.json((await getStudy()) ?? (hasKey() ? null : mockStudy));
}
