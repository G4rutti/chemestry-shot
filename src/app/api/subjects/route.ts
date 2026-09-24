import { getStudy, getSubject, listSubjects } from "@/lib/store";

export const runtime = "nodejs";

/** Every subject folder with just enough to draw its card (the client adds mastery from its local progress). */
export async function GET() {
  const subjects = await Promise.all(
    (await listSubjects()).map(async (id) => {
      const study = await getStudy(id);
      const { name, exam } = await getSubject(id, study);
      return { id, name, exam, hasData: !!study, topics: study?.topics.map((t) => ({ id: t.id, examImportance: t.examImportance })) ?? [] };
    }),
  );
  return Response.json(subjects);
}
