import { test } from "node:test";
import assert from "node:assert/strict";
import { extractChunks, hasPII, redactPII } from "./extract";

const file = (name: string, text: string) => ({ name, data: new TextEncoder().encode(text) });

test("PII: e-mails and phones redacted; years, ranges and decimals kept", () => {
  assert.equal(redactPII("E-mail: fulano.tal@aedb.br"), "E-mail: [removido]");
  assert.equal(redactPII("Whatsapp: 24 – 99825-6820 urgente"), "Whatsapp: [removido] urgente");
  assert.ok(hasPII("(24) 3333-4444") && hasPII("ligue 99825-6820"));
  assert.ok(!hasPII("Turing (1950), Dartmouth 1956, período 1950-1970, p = 0,0746, n = 10000"));
});

test("csv becomes a statistical summary, never the raw rows", async () => {
  const rows = Array.from({ length: 100 }, (_, i) => `${i % 2},${20 + i},${(1.5 + i / 100).toFixed(2)}`);
  const [c, ...rest] = await extractChunks([file("dados/x.csv", ["Sexo,Idade,Altura", ...rows].join("\n"))]);
  assert.equal(rest.length, 0);
  assert.equal(c.documentName, "dados/x.csv");
  assert.match(c.text, /100 linhas, 3 colunas/);
  assert.match(c.text, /Sexo: categórica \(códigos numéricos\), 2 valores → 0: 50, 1: 50/);
  assert.match(c.text, /Idade: numérica inteira; mín 20, máx 119, média 69.5, mediana 69.5/);
  assert.ok(c.text.split("\n").length < 20);
});

test("admin slides flagged, content kept, code untouched", async () => {
  const [contacts, content, words, code] = await extractChunks([
    file("a.txt", "Contatos:\nE-mail: prof@x.br"),
    file("b.txt", "Avaliação Contínua: monitorar algoritmos para corrigir vieses."),
    file("c.txt", "Automação\nalgoritmo\nbigdata\nheurística\ninferência\nmodelagem\notimização\npredição"),
    file("d.py", "import numpy as np\n\n# 1. média\nx = np.mean([1, 2])  # comentário didático\n"),
  ]);
  assert.ok(contacts.admin && !contacts.text.includes("@"));
  assert.ok(!content.admin && words.admin && !code.admin);
  assert.match(code.text, /# comentário didático/);
});

test("C#/Razor: split by member only when big, indentation kept, never admin", async () => {
  const method = (n: number) => `    [HttpPost]\r\n    public IActionResult Create${n}(Paciente p)\r\n    {\r\n        ${"_service.Salvar(p); ".repeat(15)}\r\n        return RedirectToAction(\"Index\");\r\n    }\r\n`;
  const small = await extractChunks([file("Controllers/Home.cs", `public class HomeController : Controller\r\n{\r\n${method(0)}}`)]);
  assert.equal(small.length, 1);
  assert.match(small[0].text, /\n {4}\[HttpPost\]\n {4}public IActionResult Create0/);
  const big = await extractChunks([file("Controllers/Big.cs", `public class Big : Controller\n{\n${Array.from({ length: 12 }, (_, i) => method(i)).join("\n")}}`)]);
  assert.ok(big.length > 1 && big.every((c) => c.text.length <= 3000));
  assert.ok(big.slice(1).every((c) => /^\[HttpPost\]/.test(c.text)), "chunks start at a member");
  const [view] = await extractChunks([file("Views/Pacientes/Index.cshtml", "@model IEnumerable<Paciente>\n<h1>Contatos</h1>\n    @foreach (var p in Model) { }")]);
  assert.ok(!view.admin);
  assert.match(view.text, /\n {4}@foreach/);
});
