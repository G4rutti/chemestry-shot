import { createHash } from "node:crypto";
import JSZip from "jszip";
import { extractText, getDocumentProxy } from "unpdf";
import type { MaterialChunk } from "@/lib/types";

const MAX_CHUNK = 3000;

const clean = (s: string) => s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

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

async function pagesOf(name: string, data: Uint8Array): Promise<string[]> {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "pdf") return pdfPages(data);
  if (ext === "pptx") return pptxSlides(data);
  if (ext === "txt" || ext === "md") return [new TextDecoder().decode(data)];
  throw new Error(`Formato não suportado: ${name} (use PDF, PPTX, TXT ou MD)`);
}

/** One chunk per page/slide (long pages split). Page numbers are 1-based; omitted for txt/md. */
export async function extractChunks(files: { name: string; data: Uint8Array }[]): Promise<MaterialChunk[]> {
  const chunks: MaterialChunk[] = [];
  for (const { name, data } of files) {
    const documentId = createHash("sha1").update(data).digest("hex").slice(0, 10);
    const pages = await pagesOf(name, data);
    const paged = pages.length > 1 || !/\.(txt|md)$/i.test(name);
    let i = 0;
    pages.forEach((raw, p) => {
      const text = clean(raw);
      for (let s = 0; s < text.length; s += MAX_CHUNK) {
        chunks.push({
          id: `${documentId}-${i++}`,
          documentId,
          documentName: name,
          page: paged ? p + 1 : undefined,
          text: text.slice(s, s + MAX_CHUNK),
        });
      }
    });
  }
  return chunks;
}
