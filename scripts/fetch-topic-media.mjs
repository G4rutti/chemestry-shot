// One-off: pulls a pt.wikipedia explanation + image per topic into src/lib/topic-media/<subject>.json.
// Run: node scripts/fetch-topic-media.mjs [subject]  (default quimica; slow on purpose: Wikipedia rate-limits bursts)
import { readFile, writeFile } from "node:fs/promises";

// topicId -> [article for the explanation, article for the picture (when the first has none)]
const ALL = {
 quimica: {
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
 },
 "it-advanced-topics": {
  "introducao-a-inteligencia-artificial-ia": ["Inteligência artificial", "Rede neural artificial"],
  "historia-da-ia-e-abordagens-metodologicas": ["História da inteligência artificial", "Teste de Turing"],
  "etica-e-impacto-social-da-ia": ["Ética na inteligência artificial", "Carro autônomo"],
  "distribuicao-de-frequencia-e-visualizacao-de-dados": ["Distribuição de frequências", "Histograma"],
  "medidas-de-tendencia-central-e-dispersao": ["Desvio padrão", "Diagrama de caixa"],
  "probabilidade-e-distribuicoes-binomial-e-normal": ["Distribuição normal", "Distribuição binomial"],
  "simulacao-de-dados-e-probabilidades-em-python": ["Método de Monte Carlo"],
  "regressao-linear-com-scikit-learn": ["Regressão linear"],
  "analise-exploratoria-de-dados-dataset": ["Análise exploratória de dados", "Diagrama de caixa"],
 },
};
const SUBJECT = process.argv[2] ?? "quimica";
const ARTICLES = ALL[SUBJECT];
const FILE = `src/lib/topic-media/${SUBJECT}.json`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function page(search) {
  const u =
    "https://pt.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1" +
    `&titles=${encodeURIComponent(search)}&prop=pageimages|extracts|info&piprop=thumbnail&pithumbsize=640` +
    "&exintro=1&explaintext=1&exsentences=4&inprop=url";
  for (let wait = 3000; ; wait *= 2) {
    const res = await fetch(u, { headers: { "User-Agent": "chemistry-shot/1.0 (study app)" } });
    const text = await res.text();
    if (text.startsWith("{")) return JSON.parse(text).query?.pages?.[0];
    if (wait > 60000) throw new Error(`rate limited: ${search}`);
    await sleep(wait);
  }
}

const out = JSON.parse(await readFile(FILE, "utf8").catch(() => "{}"));
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
  await writeFile(FILE, JSON.stringify(out, null, 2) + "\n");
}
