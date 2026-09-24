// One-off: pulls a pt.wikipedia explanation + image per topic into src/lib/topic-media/quimica.json (chemistry topic ids).
// Run: node scripts/fetch-topic-media.mjs  (slow on purpose: Wikipedia rate-limits bursts)
import { readFile, writeFile } from "node:fs/promises";

// topicId -> [article for the explanation, article for the picture (when the first has none)]
const ARTICLES = {
  "eletrosfera-e-camadas-eletronicas": ["Átomo de Bohr"],
  "subniveis-de-energia-e-distribuicao-eletronica": ["Configuração eletrônica"],
  "distribuicao-eletronica-de-ions": ["Íon"],
  "numeros-quanticos-e-regras-de-preenchimento": ["Número quântico"],
  "tabela-periodica-e-sua-organizacao": ["Tabela periódica"],
  "substancias-puras-e-misturas": ["Mistura", "Destilação"],
  "ligacoes-quimicas-e-propriedades-dos-materiais": ["Ligação química"],
  "forcas-intermoleculares-e-liquidos": ["Força intermolecular", "Ligação de hidrogênio"],
  "leis-ponderais-reacoes-e-estequiometria": ["Estequiometria", "Reação química"],
  "solucoes-e-expressoes-de-concentracao": ["Concentração (química)", "Solução"],
  "propriedades-coligativas": ["Propriedades coligativas", "Osmose"],
  "equilibrio-quimico-e-principio-de-le-chatelier": ["Equilíbrio químico", "Dióxido de nitrogênio"],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function page(search) {
  const u =
    "https://pt.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&generator=search&gsrlimit=1" +
    `&gsrsearch=${encodeURIComponent(search)}&prop=pageimages|extracts|info&piprop=thumbnail&pithumbsize=640` +
    "&exintro=1&explaintext=1&exsentences=4&inprop=url";
  for (let wait = 3000; ; wait *= 2) {
    const res = await fetch(u, { headers: { "User-Agent": "chemistry-shot/1.0 (study app)" } });
    const text = await res.text();
    if (text.startsWith("{")) return JSON.parse(text).query?.pages?.[0];
    if (wait > 60000) throw new Error(`rate limited: ${search}`);
    await sleep(wait);
  }
}

const out = JSON.parse(await readFile("src/lib/topic-media/quimica.json", "utf8").catch(() => "{}"));
for (const [id, [textTitle, imageTitle]] of Object.entries(ARTICLES)) {
  if (out[id]) continue; // resumable
  const p = await page(textTitle);
  await sleep(2000);
  const img = p?.thumbnail ? p : imageTitle ? await page(imageTitle) : null;
  if (imageTitle) await sleep(2000);
  out[id] = {
    title: p.title,
    url: p.fullurl,
    extract: p.extract.replace(/\s*\n+\s*/g, " ").trim(),
    image: img?.thumbnail?.source?.replace(/\?utm_.*$/, "") ?? null,
    imageFrom: img?.title ?? null,
    imageUrl: img?.fullurl ?? null,
  };
  console.log(id, "|", p.title, "|", out[id].image ? "img" : "no-img");
  await writeFile("src/lib/topic-media/quimica.json", JSON.stringify(out, null, 2) + "\n");
}
