import { createHash } from "node:crypto";
import JSZip from "jszip";
import { extractText, getDocumentProxy } from "unpdf";
import type { MaterialChunk } from "@/lib/types";

const MAX_CHUNK = 3000;

export const EXTENSIONS = /\.(pdf|pptx|txt|md|py|ipynb|csv|cs|cshtml|csproj|slnx|json)$/i;
/** Source code: indentation kept, never flagged admin, sent as CÓDIGO DO CURSO with every topic. */
export const CODE = /\.(py|ipynb|cs|cshtml|csproj|slnx|json)$/i;

const clean = (s: string) => s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

// ---- personal data: never reaches the AI, so it can't end up in a question, flashcard or podcast ----

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
// with area code ("(24) 99825-6820", "24 – 99825-6820") or a bare mobile ("99825-6820"); not "1950-1970"
const PHONE = /(?:\(\d{2}\)\s*|\b\d{2}\s+(?:[–-]\s+)?)\d{4,5}-\d{4}\b|\b9\d{4}-\d{4}\b/;
const PII = new RegExp(`${EMAIL.source}|${PHONE.source}`, "g");

export const redactPII = (s: string) => s.replace(PII, "[removido]");
export const hasPII = (s: string) => new RegExp(PII.source).test(s);

// ---- administrative slides (contacts, grading, attendance, class activities): never become topics or questions ----

const ADMIN_TITLE =
  /^(?:(avalia[çc](ões|oes)|contatos?|lista de presen[çc]a|crit[ée]rios? de avalia|ca[çc]a[- ]?palavras?|atividade (pr[áa]tica|avaliativa|de pesquisa))\b|apresenta[çc][ãa]o\s*:?\s*$)/im;
const ADMIN_ANYWHERE = /whats ?app|e-?mail\s*:/i;

function isAdmin(text: string, raw: string): boolean {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (ADMIN_TITLE.test(lines.slice(0, 2).join("\n")) || ADMIN_ANYWHERE.test(raw) || hasPII(raw)) return true;
  // a bare list of single words is a word-search puzzle, not content
  return lines.length >= 8 && lines.every((l) => !/\s/.test(l));
}

/** Lines repeated on more than half of a document's pages are header/footer ("Professor: ..."): dropped everywhere. */
function stripRepeated(pages: string[]): string[] {
  if (pages.length < 4) return pages;
  const count = new Map<string, number>();
  for (const p of pages) for (const l of new Set(p.split("\n").map((x) => x.trim()).filter(Boolean))) count.set(l, (count.get(l) ?? 0) + 1);
  const noise = new Set([...count].filter(([, n]) => n > pages.length / 2).map(([l]) => l));
  return pages.map((p) => p.split("\n").filter((l) => !noise.has(l.trim())).join("\n"));
}

// ---- formats ----

type Page = { text: string; page?: number };

const decodeXml = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");

async function pdfPages(data: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(new Uint8Array(data)); // copy: pdfjs detaches the buffer
  const { text } = await extractText(pdf, { mergePages: false });
  return text;
}

async function pptxSlides(data: Uint8Array): Promise<string[]> {
  const zip = await JSZip.loadAsync(data);
  const slides = Object.keys(zip.files)
    .map((f) => f.match(/^ppt\/slides\/slide(\d+)\.xml$/))
    .filter((m) => m !== null)
    .sort((a, b) => Number(a[1]) - Number(b[1]));
  return Promise.all(
    slides.map(async (m) => {
      const xml = await zip.file(m[0])!.async("string");
      // each <a:p> paragraph → one line, its <a:t> runs concatenated
      return xml
        .split(/<\/a:p>/)
        .map((p) => [...p.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((t) => decodeXml(t[1])).join(""))
        .filter(Boolean)
        .join("\n");
    }),
  );
}

/** Packs pieces in order into chunks of up to MAX_CHUNK chars (a single bigger piece stays whole; it's sliced later). */
function pack(pieces: Page[], sep = "\n\n"): Page[] {
  const out: Page[] = [];
  for (const p of pieces) {
    const last = out.at(-1);
    if (last && last.text.length + sep.length + p.text.length <= MAX_CHUNK) last.text += sep + p.text;
    else out.push({ ...p });
  }
  return out;
}

/** Whole file when small; otherwise split before top-level defs/classes/section comments. Comments are kept (they teach). */
function pythonParts(src: string): Page[] {
  const blocks = src.split(/\n(?=\n*(?:def |class |async def |# ?\d+[.)-]|if __name__))/);
  return pack(blocks.map((text) => ({ text })), "\n");
}

type NbCell = { cell_type: string; source: string | string[]; outputs?: { output_type: string; text?: string | string[]; data?: Record<string, string | string[]> }[] };

const joined = (s: string | string[] | undefined) => (Array.isArray(s) ? s.join("") : (s ?? ""));

/** Markdown as text, code as a python block plus its text output (images/base64 dropped); small cells grouped. */
function notebookCells(data: Uint8Array): Page[] {
  const nb = JSON.parse(new TextDecoder().decode(data)) as { cells: NbCell[] };
  const cells = nb.cells.map((c, i): Page => {
    const src = joined(c.source).trim();
    if (c.cell_type !== "code") return { text: src, page: i + 1 };
    const out = (c.outputs ?? [])
      .map((o) => (o.output_type === "stream" ? joined(o.text) : o.data && !Object.keys(o.data).some((k) => k.startsWith("image/")) ? joined(o.data["text/plain"]) : ""))
      .filter((t) => t.trim())
      .join("\n")
      .slice(0, 1500);
    return { text: `\`\`\`python\n${src}\n\`\`\`${out ? `\nSaída:\n${out}` : ""}`, page: i + 1 };
  });
  return pack(cells.filter((c) => c.text.trim()));
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/\.?0+$/, ""));

// ponytail: plain comma split, no quoted fields; use a CSV parser if a dataset ever has commas inside values
/** Never the raw rows: a statistical summary (columns, types, stats, category counts, 5 sample rows). */
function csvSummary(data: Uint8Array): string {
  const lines = new TextDecoder().decode(data).split(/\r?\n/).filter((l) => l.trim());
  const header = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((l) => l.split(","));
  const cols = header.map((name, i) => {
    const values = rows.map((r) => (r[i] ?? "").trim()).filter(Boolean);
    const nums = values.map(Number);
    const numeric = values.length > 0 && nums.every((n) => !Number.isNaN(n));
    const counts = new Map<string, number>();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    const categorical = counts.size <= 12 && (!numeric || nums.every(Number.isInteger)); // coded columns (sexo 0/1, cor 2/4/8)
    if (categorical) {
      const list = [...counts].sort((a, b) => b[1] - a[1]).map(([v, n]) => `${v}: ${n}`).join(", ");
      return `- ${name}: categórica${numeric ? " (códigos numéricos)" : ""}, ${counts.size} valores → ${list}`;
    }
    if (!numeric) return `- ${name}: texto, ${counts.size} valores distintos`;
    const sorted = [...nums].sort((a, b) => a - b);
    const mid = sorted.length / 2;
    const median = sorted.length % 2 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2;
    const mean = nums.reduce((s, n) => s + n, 0) / nums.length;
    const kind = nums.every(Number.isInteger) ? "numérica inteira" : "numérica decimal";
    return `- ${name}: ${kind}; mín ${fmt(sorted[0])}, máx ${fmt(sorted.at(-1)!)}, média ${fmt(mean)}, mediana ${fmt(median)}`;
  });
  return [
    `Dataset CSV (resumo estatístico): ${rows.length} linhas, ${header.length} colunas.`,
    "Colunas:",
    ...cols,
    "Primeiras 5 linhas:",
    lines[0],
    ...lines.slice(1, 6),
  ].join("\n");
}

/** C#: split before members/attributes ([HttpPost], public ...), packed back up to MAX_CHUNK so small files stay whole. */
function csharpParts(src: string): Page[] {
  const blocks = src.replace(/\r\n/g, "\n").split(/\n(?=\n*[ \t]*(?:\[\w|(?:public|private|protected|internal)\s))/);
  return pack(blocks.map((text) => ({ text })), "\n");
}

async function pagesOf(name: string, data: Uint8Array): Promise<Page[]> {
  const ext = name.toLowerCase().split(".").pop();
  const numbered = (pages: string[]) => stripRepeated(pages).map((text, i) => ({ text, page: i + 1 }));
  if (ext === "pdf") return numbered(await pdfPages(data));
  if (ext === "pptx") return numbered(await pptxSlides(data));
  if (ext === "py") return pythonParts(new TextDecoder().decode(data));
  if (ext === "ipynb") return notebookCells(data);
  if (ext === "csv") return [{ text: csvSummary(data) }];
  if (ext === "cs") return csharpParts(new TextDecoder().decode(data));
  if (ext === "txt" || ext === "md" || CODE.test(name)) return [{ text: new TextDecoder().decode(data) }]; // views, csproj, json: whole file
  throw new Error(`Formato não suportado: ${name} (use PDF, PPTX, TXT, MD, PY, IPYNB, CSV, CS, CSHTML, CSPROJ ou JSON)`);
}

/** One chunk per page/slide/cell group (long ones split). Page numbers are 1-based; omitted for single-part files. */
export async function extractChunks(files: { name: string; data: Uint8Array }[]): Promise<MaterialChunk[]> {
  const chunks: MaterialChunk[] = [];
  for (const { name, data } of files) {
    const documentId = createHash("sha1").update(data).digest("hex").slice(0, 10);
    const pages = await pagesOf(name, data);
    const code = CODE.test(name); // keep indentation
    let i = 0;
    for (const { text: raw, page } of pages) {
      const text = code ? raw.trim() : clean(raw);
      if (!text) continue;
      const admin = (!code && isAdmin(text, raw)) || undefined;
      const safe = redactPII(text);
      for (let s = 0; s < safe.length; s += MAX_CHUNK) {
        chunks.push({ id: `${documentId}-${i++}`, documentId, documentName: name, page, text: safe.slice(s, s + MAX_CHUNK), ...(admin && { admin }) });
      }
    }
  }
  return chunks;
}
