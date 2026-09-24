import assert from "node:assert/strict";
import { test } from "node:test";
import katex from "katex";
import { isLatex, toTex } from "./formula";

const renders = (s: string) => !katex.renderToString(toTex(s), { throwOnError: false }).includes("katex-error");

test("isLatex: typesets LaTeX only, not plain math or code", () => {
  assert.ok(isLatex("\\bar{x}=\\frac{\\sum x_i}{n}"));
  assert.ok(isLatex("x_{(n+1)/2}"));
  assert.ok(!isLatex("C = m / V"));
  assert.ok(!isLatex("plt.bar(faixas, frequencia)"));
});

test("toTex: prose goes into \\text{}, commands and variables stay math", () => {
  assert.equal(toTex("Amplitude=\\max(x)-\\min(x)"), "\\text{Amplitude}=\\max(x)-\\min(x)");
  assert.equal(toTex("\\sigma^2_{pop}"), "\\sigma^2_{pop}");
  assert.equal(toTex("Se n impar, x_{i}"), "\\text{Se }n\\text{ impar, }x_{i}");
  assert.equal(toTex("Q1=\\text{25\\% percentile}"), "Q1=\\text{25\\% percentile}"); // already text: untouched
  for (const f of [
    "\\bar{x}=\\frac{\\sum x_i}{n}",
    "Mediana: Se n impar, x_{(n+1)/2}; Se n par, (x_{n/2}+x_{n/2+1})/2",
    "CV=\\frac{s}{\\bar{x}}\\times100\\%",
    "Q1=\\text{25\\% percentile}, Q2=\\bar{x}, Q3=\\text{75\\% percentile}",
  ])
    assert.ok(renders(f), f);
});
