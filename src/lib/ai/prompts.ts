import type { MaterialChunk, Subject, Topic } from "@/lib/types";

/** Formats chunks as `[id | doc | p.N]` blocks, trimming each so the total stays under `cap` chars. */
export function formatChunks(chunks: MaterialChunk[], cap: number): string {
  const total = chunks.reduce((n, c) => n + c.text.length, 0);
  const per = total > cap ? Math.max(300, Math.floor(cap / chunks.length)) : Infinity;
  return chunks
    .map((c) => `[id=${c.id} | doc=${c.documentName}${c.page ? ` | p.${c.page}` : ""}]\n${c.text.slice(0, per)}`)
    .join("\n\n");
}

const teacher = (s: Subject) => `professor de ${s.name}${s.course ? ` (${s.course})` : ""}`;

const role = (s: Subject) =>
  `Você é um ${teacher(s)} preparando um aluno para a prova ${s.exam}.${s.profile ? ` Perfil da matéria: ${s.profile}` : ""} Responda sempre em português do Brasil, baseado SOMENTE no material abaixo.`;

export const topicsPrompt = (s: Subject, material: string) => `${role(s)}
Identifique de 5 a 12 tópicos que provavelmente cairão na prova. Para cada um: name, summary (2-3 frases), examImportance (1-5, 5 = cai com certeza), keyPoints (3-6 itens curtos) e chunkIds (ids EXATOS de TODOS os trechos relevantes, conforme [id=...], inclusive código .py/.ipynb e datasets .csv que exemplificam o tópico).
Nada administrativo vira tópico: apresentação do professor, contatos, avaliações/notas, presença, prazos, nem atividades de aula (caça-palavras, atividade prática, pesquisa, atividade avaliativa).
Devolva também subject: name (nome da disciplina), course (área/curso) e profile (1-2 frases: tipo de conteúdo — conceitual, cálculo, código — e estilo provável da prova).

MATERIAL:
${material}`;

const QUESTION_RULES = `Regras das questões:
- Misture os tipos: "multiple-choice" (4-5 options, correctAnswer = texto EXATO de uma option), "true-false" (options = ["Verdadeiro","Falso"]), "fill" (completar lacuna ___, options = []), "calculation" (resposta numérica curta, com unidade se houver; probabilidade pode vir em decimal ou %; options = []).
- code (opcional): trecho de código curto (até ~12 linhas) mostrado junto do enunciado, sem \`\`\` e sem repetir o código no enunciado; omita quando não usar.
- Se houver CÓDIGO DO CURSO abaixo e o tópico for de cálculo, estatística, probabilidade, dados ou programação: PELO MENOS 1/3 das questões e 2 flashcards TÊM code preenchido, adaptado desse código:
  • "o que esse código faz/imprime?": multiple-choice com code (ex.: o que uma chamada de função do material calcula);
  • completar código: fill com a lacuna ___ DENTRO do code e correctAnswer = só o que falta (ex.: o nome do método);
  • use SÓ bibliotecas e funções que aparecem no material ou no CÓDIGO DO CURSO; nada de API inventada.
- Tópico conceitual (história, ética, definições) ou matéria sem código: não use code.
- Quando o material permitir, inclua também: cálculo (calculation com resposta numérica), interpretação (gráficos, tabelas, resultados) e conceitual.
- difficulty de 1 a 5, variada; questões no estilo de prova.
- Varie os exemplos: não use o mesmo exemplo/dataset/cenário/substância em mais de 2 questões e não repita a mesma pergunta com outras palavras.
- Nunca inclua nome de professor, e-mail ou telefone.
- explanation clara e curta; memoryTip = macete para memorizar.
- source = { document: nome do documento, page: página/slide do trecho usado }.`;

// the course's code (a few small files) goes with every topic: quantitative topics build code questions from it
const courseCode = (code: string) => (code ? `\n\nCÓDIGO DO CURSO (referência para questões com code):\n${code}` : "");

export const topicContentPrompt = (s: Subject, topic: Topic, material: string, code = "") => `${role(s)}
Tópico: "${topic.name}" — ${topic.summary}
Gere cerca de 15 questões variadas e 8 flashcards (front = pergunta/conceito curto, back = resposta objetiva, code opcional como nas questões) sobre este tópico.
${QUESTION_RULES}

MATERIAL:
${material}${courseCode(code)}`;

export const moreQuestionsPrompt = (s: Subject, topic: Topic, material: string, existing: string[], code = "") => `${role(s)}
Tópico: "${topic.name}" — ${topic.summary}
Gere 10 questões NOVAS sobre este tópico, diferentes destas já existentes:
${existing.map((q) => `- ${q.slice(0, 120)}`).join("\n")}
${QUESTION_RULES}

MATERIAL:
${material}${courseCode(code)}`;

export const oneShotPrompt = (s: Subject, topic: Topic, material: string) => `${role(s)}
Crie um resumo "One Shot" do tópico "${topic.name}" para revisar em 5 minutos antes da prova:
title; essentials (o que é obrigatório saber); concepts (name + explanation); formulas (formula, meaning, whenToUse — vazio se não houver; pode ser uma função/linha de código do material); traps (pegadinhas comuns); recognitionPatterns (como reconhecer esse tipo de questão); solvedExample (question, steps passo a passo, answer).

MATERIAL:
${material}`;

export const askPrompt = (s: Subject, topic: Topic, material: string, question: string, context: string | undefined, answered: boolean) => `Você é um ${teacher(s)} paciente e bem-humorado tirando a dúvida de um aluno que tem prova HOJE. Responda em português do Brasil.
Tópico: "${topic.name}".${context ? `\nO aluno estava nesta questão: ${context}` : ""}${context && !answered ? "\nREGRA IMPORTANTE: ele ainda NÃO respondeu essa questão. Explique o conceito com um exemplo DIFERENTE do caso da questão, mas NÃO diga qual é a resposta, se a afirmação é verdadeira ou falsa, nem compare os itens exatos da questão (ex.: não diga qual dos itens citados é maior). Termine com uma pergunta que faça ele chegar sozinho na resposta." : ""}
Dúvida do aluno: "${question}"
Responda de forma didática e curta (até ~180 palavras): explique o porquê, dê um exemplo concreto e, se ajudar, um passo a passo numerado (1., 2., ...). Use o material abaixo como base; se ele não cobrir, use o nível de graduação de ${s.course ?? s.name} e diga que não está no material. Texto simples, sem markdown (sem **, #, tabelas).
Se a dúvida não for sobre ${s.name}, diga educadamente que só tira dúvidas dessa matéria.

MATERIAL:
${material}`;
