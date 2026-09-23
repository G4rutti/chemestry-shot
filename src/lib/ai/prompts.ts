import type { MaterialChunk, Topic } from "@/lib/types";

/** Formats chunks as `[id | doc | p.N]` blocks, trimming each so the total stays under `cap` chars. */
export function formatChunks(chunks: MaterialChunk[], cap: number): string {
  const total = chunks.reduce((n, c) => n + c.text.length, 0);
  const per = total > cap ? Math.max(300, Math.floor(cap / chunks.length)) : Infinity;
  return chunks
    .map((c) => `[id=${c.id} | doc=${c.documentName}${c.page ? ` | p.${c.page}` : ""}]\n${c.text.slice(0, per)}`)
    .join("\n\n");
}

const ROLE = "Você é um professor de Química preparando um aluno para a prova AV1. Responda sempre em português do Brasil, baseado SOMENTE no material abaixo.";

export const topicsPrompt = (material: string) => `${ROLE}
Identifique de 5 a 12 tópicos que provavelmente cairão na prova. Para cada um: name, summary (2-3 frases), examImportance (1-5, 5 = cai com certeza), keyPoints (3-6 itens curtos) e chunkIds (ids EXATOS dos trechos relevantes, conforme [id=...]).

MATERIAL:
${material}`;

const QUESTION_RULES = `Regras das questões:
- Misture os tipos: "multiple-choice" (4-5 options, correctAnswer = texto EXATO de uma option), "true-false" (options = ["Verdadeiro","Falso"]), "fill" (completar lacuna ___, options = []), "calculation" (resposta numérica curta com unidade, options = []).
- difficulty de 1 a 5, variada; questões no estilo de prova.
- explanation clara e curta; memoryTip = macete para memorizar.
- source = { document: nome do documento, page: página/slide do trecho usado }.`;

export const topicContentPrompt = (topic: Topic, material: string) => `${ROLE}
Tópico: "${topic.name}" — ${topic.summary}
Gere cerca de 15 questões variadas e 8 flashcards (front = pergunta/conceito curto, back = resposta objetiva) sobre este tópico.
${QUESTION_RULES}

MATERIAL:
${material}`;

export const moreQuestionsPrompt = (topic: Topic, material: string, existing: string[]) => `${ROLE}
Tópico: "${topic.name}" — ${topic.summary}
Gere 10 questões NOVAS sobre este tópico, diferentes destas já existentes:
${existing.map((q) => `- ${q.slice(0, 120)}`).join("\n")}
${QUESTION_RULES}

MATERIAL:
${material}`;

export const oneShotPrompt = (topic: Topic, material: string) => `${ROLE}
Crie um resumo "One Shot" do tópico "${topic.name}" para revisar em 5 minutos antes da prova:
title; essentials (o que é obrigatório saber); concepts (name + explanation); formulas (formula, meaning, whenToUse — vazio se não houver); traps (pegadinhas comuns); recognitionPatterns (como reconhecer esse tipo de questão); solvedExample (question, steps passo a passo, answer).

MATERIAL:
${material}`;
