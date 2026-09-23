import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { hasKey } from "@/lib/ai/client";
import { processMaterials } from "@/lib/ai/pipeline";
import { extractChunks } from "@/lib/materials/extract";
import { mockStudy } from "@/lib/mock";

export const runtime = "nodejs";
const READ_ONLY = "Online o conteúdo é só leitura. Processe os materiais localmente e faça deploy de data/.";
export const maxDuration = 300;

const EXT = /\.(pdf|pptx|txt|md)$/i;

async function readFolder() {
  const root = path.join(/*turbopackIgnore: true*/ process.cwd(), "docs");
  const names = (await readdir(/*turbopackIgnore: true*/ root, { withFileTypes: true })).filter((e) => e.isFile() && EXT.test(e.name)).map((e) => e.name);
  return Promise.all(names.map(async (name) => ({ name, data: new Uint8Array(await readFile(path.join(/*turbopackIgnore: true*/ root, name))) })));
}

export async function POST(request: Request) {
  if (process.env.VERCEL) return Response.json({ error: READ_ONLY }, { status: 403 });
  if (!hasKey()) return Response.json(mockStudy);
  try {
    const files = new URL(request.url).searchParams.has("folder")
      ? await readFolder()
      : await Promise.all(
          (await request.formData())
            .getAll("files")
            .filter((f): f is File => f instanceof File && EXT.test(f.name))
            .map(async (f) => ({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) })),
        );
    if (!files.length) return Response.json({ error: "Nenhum arquivo .pdf, .pptx, .txt ou .md enviado." }, { status: 400 });
    if (job?.running) return Response.json(job, { status: 202 });
    const current: Job = (job = { running: true, startedAt: Date.now() });
    // runs detached from the request so leaving/reloading the page doesn't lose it; the client polls GET
    extractChunks(files)
      .then(processMaterials)
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

// ponytail: in-memory job state, single local server process; lost on server restart (data already saved stays)
type Job = { running: boolean; startedAt: number; error?: string };
let job: Job | null = null;

export function GET() {
  return Response.json(job);
}
