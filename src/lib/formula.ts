import type { OneShot } from "@/lib/types";

/** AI formulas come as LaTeX (`\frac{a}{b}`), plain math (`C = m / V`) or code (`plt.bar(x, y)`); only LaTeX gets typeset. */
export const isLatex = (s: string) => /\\[a-zA-Z]+|[_^]\{/.test(s);

/**
 * LaTeX with prose mixed in ("Mediana: Se n impar, x_{(n+1)/2}") loses its spaces in math mode, so runs of real words
 * (2+ letters, not a \command, not a {subscript}) go into \text{}. Single letters stay math: they're variables.
 */
export const toTex = (s: string) =>
  s.replace(/(\s*)(?<![\\\p{L}{])(\p{L}{2,}(?:[\s,;:.]+\p{L}{2,})*)([\s,;:.]*)/gu, (m, a: string, words: string, b: string, at: number) =>
    /\\text\{[^}]*$/.test(s.slice(0, at)) ? m : `\\text{${a}${words}${b}}`, // already inside \text{...}: leave it
  );

/** One-shots from before the formula legend (variables) existed get regenerated once. */
export const isStaleOneShot = (s: OneShot) => s.formulas.some((f) => !f.variables);
