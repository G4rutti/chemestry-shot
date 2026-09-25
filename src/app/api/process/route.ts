import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { hasKey } from "@/lib/ai/client";
import { processMaterials } from "@/lib/ai/pipeline";
import { EXTENSIONS as EXT, extractChunks } from "@/lib/materials/extract";
import { mockStudy } from "@/lib/mock";
import { badSubject, subjectOf } from "@/lib/store";

export const runtime = "nodejs";
const READ_ONLY = "Online o conteúdo é só leitura. Processe os materiais localmente e faça deploy de data/.";
export const maxDuration = 300;

/** docs/<subject>/** — the name keeps the subfolder ("Códigos e datasets/regressao.py") so question sources are clear. */
async function readFolder(subject: string) {
  const root = path.join(/*turbopackIgnore: true*/ process.cwd(), "docs", subject);
  const paths = (await readdir(/*turbopackIgnore: true*/ root, { withFileTypes: true, recursive: true }))
    .filter((e) => e.isFile() && EXT.test(e.name) && e.name !== "subject.json")
    .map((e) => path.join(/*turbopackIgnore: true*/ e.parentPath, e.name));
  return Promise.all(
    paths.map(async (p) => ({ name: path.relative(root, p).split(path.sep).join("/"), data: new Uint8Array(await readFile(/*turbopackIgnore: true*/ p)) })),
  );
}

export async function POST(request: Request) {
  if (process.env.VERCEL) return Response.json({ error: READ_ONLY }, { status: 403 });
  const subject = subjectOf(request);
  if (!subject) return badSubject();
  if (!hasKey()) return Response.json(mockStudy);
  try {
    const files = new URL(request.url).searchParams.has("folder")
      ? await readFolder(subject)
      : await Promise.all(
          (await request.formData())
            .getAll("files")
            .filter((f): f is File => f instanceof File && EXT.test(f.name))
            .map(async (f) => ({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) })),
        );
    if (!files.length) return Response.json({ error: "Nenhum arquivo .pdf, .pptx, .txt, .md, .py, .ipynb, .csv, .cs, .cshtml ou .json enviado." }, { status: 400 });
    const running = jobs.get(subject);
    if (running?.running) return Response.json(running, { status: 202 });
    const current: Job = { running: true, startedAt: Date.now() };
    jobs.set(subject, current);
    // runs detached from the request so leaving/reloading the page doesn't lose it; the client polls GET
    extractChunks(files)
      .then((chunks) => processMaterials(subject, chunks))
      .catch((e) => {
        console.error("[api/process]", e);
        current.error = `Falha ao processar os materiais: ${e instanceof Error ? e.message : e}`;
      })
      .finally(() => (current.running = false));
    return Response.json(current, { status: 202 });
  } catch (e) {
    console.error("[api/process]", e);
    return Response.json({ error: `Falha ao processar os materiais: ${e instanceof Error ? e.message : e}` }, { status: 500 });
  }
}

// ponytail: in-memory job state per subject, single local server process; lost on server restart (data already saved stays)
type Job = { running: boolean; startedAt: number; error?: string };
const jobs = new Map<string, Job>();

export function GET(request: Request) {
  const subject = subjectOf(request);
  return Response.json(subject ? (jobs.get(subject) ?? null) : null);
}
