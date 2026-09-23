import type { Flashcard, OneShot, Question, QuestionType, StudyData, Topic } from "@/lib/types";

const DOC = "Demonstração";
const TF = ["Verdadeiro", "Falso"];

const topics: Topic[] = [
  {
    id: "atomistica",
    name: "Atomística e Tabela Periódica",
    summary: "Estrutura do átomo, número atômico e de massa, distribuição eletrônica e propriedades periódicas.",
    examImportance: 5,
    keyPoints: ["Z = prótons; A = Z + N", "Isótopos têm mesmo Z", "Raio atômico cresce para baixo e para a esquerda", "Eletronegatividade cresce para cima e para a direita"],
    chunkIds: [],
  },
  {
    id: "ligacoes-quimicas",
    name: "Ligações Químicas",
    summary: "Ligações iônica, covalente e metálica, regra do octeto e propriedades das substâncias.",
    examImportance: 4,
    keyPoints: ["Iônica: metal + ametal, transferência de elétrons", "Covalente: ametal + ametal, compartilhamento", "Compostos iônicos conduzem fundidos ou em solução"],
    chunkIds: [],
  },
  {
    id: "solucoes",
    name: "Soluções",
    summary: "Soluto, solvente, concentração comum, molaridade e diluição.",
    examImportance: 4,
    keyPoints: ["C = m/V (g/L)", "M = n/V (mol/L)", "Diluição: M1·V1 = M2·V2"],
    chunkIds: [],
  },
];

type Q = [QuestionType, string, string[] | undefined, string, string, string, number];
const raw: Record<string, Q[]> = {
  atomistica: [
    ["multiple-choice", "Um átomo com 11 prótons e 12 nêutrons tem número de massa:", ["11", "12", "23", "1"], "23", "A = Z + N = 11 + 12 = 23.", "A de 'Adição': prótons + nêutrons.", 1],
    ["true-false", "Isótopos são átomos com o mesmo número de massa.", TF, "Falso", "Isótopos têm o mesmo número atômico (Z); mesmo A são isóbaros.", "isóTOPOS = mesmo número de PrÓtons.", 2],
    ["fill", "O número de prótons no núcleo é chamado de número ___.", undefined, "atômico", "Z, o número atômico, identifica o elemento.", "Z é o RG do elemento.", 1],
    ["multiple-choice", "Qual elemento tem maior eletronegatividade?", ["Na", "F", "Fe", "Cs"], "F", "O flúor é o elemento mais eletronegativo da tabela.", "'FON Cl' — F > O > N > Cl.", 2],
    ["calculation", "Quantos nêutrons tem o ³⁵Cl (Z = 17)?", undefined, "18", "N = A − Z = 35 − 17 = 18.", "Nêutrons = massa menos prótons.", 2],
    ["multiple-choice", "A distribuição eletrônica do Ca (Z = 20) termina em:", ["3p⁶", "4s²", "3d²", "4p²"], "4s²", "1s² 2s² 2p⁶ 3s² 3p⁶ 4s² — o 4s enche antes do 3d.", "Siga as diagonais de Linus Pauling.", 3],
  ],
  "ligacoes-quimicas": [
    ["multiple-choice", "O NaCl é formado por ligação:", ["Covalente", "Iônica", "Metálica", "De hidrogênio"], "Iônica", "Na (metal) doa elétron ao Cl (ametal).", "Metal + ametal = iônica.", 1],
    ["true-false", "Compostos iônicos conduzem corrente elétrica no estado sólido.", TF, "Falso", "Só conduzem fundidos ou em solução aquosa, quando os íons ficam livres.", "Íon preso não conduz.", 2],
    ["fill", "Na ligação covalente, os átomos ___ pares de elétrons.", undefined, "compartilham", "Covalente = compartilhamento entre ametais.", "CO-valente = COmpartilhar.", 1],
    ["multiple-choice", "Qual substância apresenta ligação covalente?", ["KBr", "MgO", "H₂O", "CaCl₂"], "H₂O", "H e O são ametais: compartilham elétrons.", "Só ametais = covalente.", 2],
    ["calculation", "Qual a fórmula do composto entre Al³⁺ e O²⁻? (responda a fórmula)", undefined, "Al₂O₃", "Cargas cruzadas: 2·(+3) + 3·(−2) = 0.", "Regra da tesoura: a carga de um vira índice do outro.", 3],
    ["true-false", "A regra do octeto diz que átomos tendem a ficar com 8 elétrons na camada de valência.", TF, "Verdadeiro", "Estabilidade semelhante à dos gases nobres.", "Oito = gás nobre.", 1],
  ],
  solucoes: [
    ["calculation", "Qual a concentração comum de 20 g de NaCl em 0,5 L de solução?", undefined, "40 g/L", "C = m/V = 20/0,5 = 40 g/L.", "C = massa sobre volume.", 2],
    ["multiple-choice", "Em uma solução de açúcar em água, o solvente é:", ["Açúcar", "Água", "Ambos", "Nenhum"], "Água", "O solvente é o componente em maior quantidade que dissolve o soluto.", "Solvente = quem dissolve.", 1],
    ["calculation", "Qual a molaridade de 2 mol de soluto em 4 L de solução?", undefined, "0,5 mol/L", "M = n/V = 2/4 = 0,5 mol/L.", "M = mols por litro.", 2],
    ["true-false", "Ao diluir uma solução, a quantidade de soluto diminui.", TF, "Falso", "Na diluição só se adiciona solvente; o soluto se mantém.", "Diluir = mais água, mesmo soluto.", 2],
    ["fill", "Na diluição vale M1·V1 = M2·___.", undefined, "V2", "O número de mols de soluto é constante.", "Mols antes = mols depois.", 1],
    ["calculation", "100 mL de solução 2 mol/L são diluídos a 400 mL. Qual a nova molaridade?", undefined, "0,5 mol/L", "M2 = 2·100/400 = 0,5 mol/L.", "Volume 4x maior, concentração 4x menor.", 3],
  ],
};

const questions: Question[] = Object.entries(raw).flatMap(([topicId, qs]) =>
  qs.map(([type, question, options, correctAnswer, explanation, memoryTip, difficulty], i) => ({
    id: `${topicId}-demo-${i}`,
    topicId,
    type,
    question,
    ...(options && { options }),
    correctAnswer,
    explanation,
    memoryTip,
    difficulty: difficulty as Question["difficulty"],
    source: { document: DOC },
  })),
);

const flashcards: Flashcard[] = [
  ["atomistica", "O que é número atômico (Z)?", "Número de prótons do núcleo."],
  ["atomistica", "Isótopos, isóbaros e isótonos?", "Mesmo Z / mesmo A / mesmo N."],
  ["ligacoes-quimicas", "Ligação iônica ocorre entre?", "Metal e ametal (transferência de elétrons)."],
  ["ligacoes-quimicas", "Ligação covalente ocorre entre?", "Ametais (compartilhamento de elétrons)."],
  ["solucoes", "Fórmula da molaridade?", "M = n / V (mol/L)."],
  ["solucoes", "Fórmula da diluição?", "M1·V1 = M2·V2."],
].map(([topicId, front, back], i) => ({ id: `${topicId}-demo-fc-${i}`, topicId, front, back }));

export const mockStudy: StudyData = {
  version: "demo",
  createdAt: "2026-01-01T00:00:00.000Z",
  demo: true,
  documents: [{ id: "demo", name: DOC }],
  topics,
  questions,
  flashcards,
};

export function mockOneShot(topicId: string): OneShot {
  const topic = topics.find((t) => t.id === topicId) ?? topics[0];
  const example = questions.find((q) => q.topicId === topic.id && q.type === "calculation") ?? questions[0];
  return {
    topicId,
    title: `${topic.name} em 5 minutos`,
    essentials: topic.keyPoints,
    concepts: [{ name: topic.name, explanation: topic.summary }],
    formulas: topic.keyPoints.filter((k) => k.includes("=")).map((k) => ({ formula: k, meaning: "Relação fundamental do tópico.", whenToUse: "Questões de cálculo." })),
    traps: questions.filter((q) => q.topicId === topic.id && q.type === "true-false").map((q) => q.explanation),
    recognitionPatterns: ["Modo demonstração: configure GEMINI_API_KEY para gerar a partir dos seus materiais."],
    solvedExample: { question: example.question, steps: [example.explanation], answer: example.correctAnswer },
  };
}
