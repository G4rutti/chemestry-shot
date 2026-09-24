import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeQuestions } from "./schemas";

const raw = (extra: Partial<Parameters<typeof normalizeQuestions>[0][number]>) => ({
  type: "fill" as const,
  question: "Complete:",
  options: [],
  correctAnswer: "fit",
  explanation: "",
  memoryTip: "",
  difficulty: 2,
  source: { document: "regressao.py" },
  ...extra,
});

const material = "from sklearn.linear_model import LinearRegression\nimport numpy as np";

test("normalizeQuestions: code questions only with the material's libraries and a real blank", () => {
  const [ok] = normalizeQuestions([raw({ code: "```python\nmodelo = LinearRegression()\nmodelo.___(X, y)\n```" })], "t", material);
  assert.equal(ok.code, "modelo = LinearRegression()\nmodelo.___(X, y)"); // fences stripped
  assert.equal(normalizeQuestions([raw({ code: "import numpy as np\nnp.___([1, 2])", correctAnswer: "mean" })], "t", material).length, 1); // library from the material
  assert.equal(normalizeQuestions([raw({ code: "from tensorflow.keras.layers import Dense\n___" })], "t", material).length, 0); // invented API
  assert.equal(normalizeQuestions([raw({ code: "import numpy as np\nnp.mean(x)" })], "t", material).length, 0); // blank missing: code gives it away
});

test("normalizeQuestions: drops questions citing a code/table that isn't there", () => {
  const mc = { type: "multiple-choice" as const, options: ["a", "b"], correctAnswer: "a" };
  assert.equal(normalizeQuestions([raw({ ...mc, question: "O que o seguinte código faz?" })], "t").length, 0);
  assert.equal(normalizeQuestions([raw({ ...mc, question: "Com base na tabela abaixo, qual a moda?" })], "t").length, 0);
  assert.equal(normalizeQuestions([raw({ ...mc, question: "O que o código abaixo faz?", code: "print(1)" })], "t").length, 1);
  assert.equal(normalizeQuestions([raw({ ...mc, question: "Qual gráfico usar para dados categóricos?" })], "t").length, 1);
});

test("normalizeQuestions: a ``` block pasted in the question moves to code", () => {
  const [q] = normalizeQuestions(
    [raw({ type: "multiple-choice", question: "O que imprime?\n```python\nprint(np.mean([1, 3]))\n```", options: ["2.0", "4"], correctAnswer: "2.0" })],
    "t",
    material,
  );
  assert.equal(q.question, "O que imprime?");
  assert.equal(q.code, "print(np.mean([1, 3]))");
});
