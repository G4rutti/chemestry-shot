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

test("normalizeQuestions: a ``` block pasted in the question moves to code", () => {
  const [q] = normalizeQuestions(
    [raw({ type: "multiple-choice", question: "O que imprime?\n```python\nprint(np.mean([1, 3]))\n```", options: ["2.0", "4"], correctAnswer: "2.0" })],
    "t",
    material,
  );
  assert.equal(q.question, "O que imprime?");
  assert.equal(q.code, "print(np.mean([1, 3]))");
});
