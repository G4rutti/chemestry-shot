# Tarefa: transformar o Chemistry Shot em app multi-matéria (1ª nova matéria: Tópicos Avançados de Computação II)

Você vai evoluir este app (Next.js 16 + Gemini) que hoje só funciona pra Química. O objetivo é suportar **várias matérias**, cada uma com seu material, seus dados gerados e seu progresso, e deixar a matéria `it-advanced-topics` funcionando de ponta a ponta com a mesma qualidade da química.

> ⚠️ Antes de mexer em rota, layout ou API do Next, leia o guia relevante em `node_modules/next/dist/docs/` (ver AGENTS.md). Esta versão tem breaking changes.

## Contexto do que existe hoje

- `docs/` agora tem subpastas: `docs/quimica/` (PDF/PPTX) e `docs/it-advanced-topics/` com `Slides de aula/*.pdf` e `Códigos e datasets/` (`regressao.py`, `Gabarito_exercícios_de_probabilidade.ipynb` e `dados_estudantes.csv`, que tem ~77 mil linhas).
- `src/app/api/process/route.ts` lê só arquivos da raiz de `docs/` (não recursivo) e aceita `pdf|pptx|txt|md`.
- `src/lib/materials/extract.ts` gera um chunk por página/slide.
- `src/lib/ai/prompts.ts` tem `ROLE` fixo em "professor de Química… prova AV1". O `askPrompt` recusa dúvida que "não for de química".
- `src/lib/ai/podcast.ts` fala em "prova de Química HOJE".
- `src/lib/topic-media.json` é específico de química.
- `src/lib/store.ts` salva tudo em `data/` (study.json, one-shots.json, cache), sem noção de matéria.
- Progresso (XP, domínio, erros) fica no localStorage numa chave única.
- `src/lib/study/engine.ts` corrige respostas. Não aceita `7,46%` quando o gabarito é `0,0746` (nem o contrário), nem frações tipo `1/6`.

## O que fazer

### 1. Conceito de matéria (Subject)
- A pasta define a matéria: `docs/<slug>/` = uma matéria. O slug vira o id (`quimica`, `it-advanced-topics`).
- Arquivo opcional `docs/<slug>/subject.json`:
  ```json
  { "name": "Tópicos Avançados de Computação II", "exam": "AV1", "course": "Sistemas de Informação / Eng. de Software", "language": "pt-BR" }
  ```
  Se não existir, gere o perfil automaticamente na etapa de tópicos (nome da disciplina, área e estilo de prova) e salve junto dos dados.
- Crie `subject.json` para as duas matérias atuais.
- Tipo `Subject` em `types.ts` com `id, name, exam, course?, profile?`. O `profile` descreve o tipo de conteúdo (conceitual, cálculo, código) e é gerado pela IA.

### 2. Armazenamento por matéria
- `data/<slug>/study.json`, `data/<slug>/one-shots.json`, `data/<slug>/cache/…`.
- Migre os dados atuais de `data/` para `data/quimica/` sem reprocessar (é só mover arquivos; o hash de versão continua válido).
- Todas as rotas de API recebem a matéria (`?subject=slug` ou segmento de rota, o que for mais idiomático nessa versão do Next).
- Progresso no localStorage com chave por matéria (`progress:<slug>`). Migre a chave antiga pra `progress:quimica`.
- Podcast store e respostas do AskAI também por matéria.

### 3. UI
- Home lista as matérias (card com nome, nº de tópicos, domínio médio, botão "Processar" se ainda não tiver dados).
- Seletor de matéria no `NavBar`. Todas as páginas (study, exam, flashcards, review, mistakes, one-shot) operam na matéria ativa.
- Upload de arquivos na home pede/usa a matéria ativa.
- Não quebre o visual atual (ver `DESIGN.md`).

### 4. Extração: novos formatos e limpeza
- **Leitura recursiva** de `docs/<slug>/**`. O `documentName` inclui a subpasta (`Códigos e datasets/regressao.py`) pra fonte da questão ficar clara.
- **`.py`**: um chunk por arquivo, dividido por função/bloco se passar do `MAX_CHUNK`. Mantenha os comentários, que ali são didáticos.
- **`.ipynb`**: um chunk por célula, ou juntando células pequenas. Markdown vira texto e code vira bloco de código. Inclua outputs de texto (`stream`/`text/plain`) e descarte imagens/base64.
- **`.csv`**: NUNCA mande as linhas cruas. Gere um chunk de resumo com o nome das colunas, o nº de linhas, o tipo inferido de cada coluna, min/max/média/mediana das numéricas, contagem de valores distintos das categóricas com poucos valores, e 5 linhas de exemplo. Colunas como `Sexo` e `Cor` estão codificadas (0/1, 2/8…): trate como categóricas.
- **Remoção de ruído recorrente**: linhas que se repetem em mais de ~50% das páginas do mesmo documento viram rodapé/cabeçalho e devem sair. Nesses slides todo slide tem "Professor: Douglas Grillo" e "Eng. Elétrica/Eletrônica – Mecânica – Produção – de Software - SI".
- **Slides administrativos**: marque como `admin` chunks que falam de contato, e-mail, WhatsApp, critérios de avaliação, lista de presença e prazos. Eles não entram na geração de tópicos nem de questões. **Nenhum telefone ou e-mail pode aparecer em questão, flashcard ou podcast.** Aplique um filtro por regex (telefone/e-mail) além da marcação.
- Atividades tipo "caça-palavras" e "atividade prática/pesquisa" também não viram tópico.

### 5. Prompts parametrizados
- `ROLE` passa a ser uma função `role(subject)`: "Você é um professor de {subject.name} ({course}) preparando um aluno para a prova {exam}…".
- `askPrompt`: "Se a dúvida não for sobre {subject.name}, diga educadamente que só tira dúvidas dessa matéria." Quando o material não cobrir, use o nível de graduação da área (não "química do ensino médio").
- `podcast.ts`: título, contexto e regras de fala vêm da matéria. Pra matérias com fórmula ou código, adicione regras de leitura: "mi" pra μ, "sigma" pra σ, "N escolhe K" pra combinação, e nome de função falado tipo "norm ponto sf". Nunca leia código linha a linha: explique o que ele faz.
- `topic-media.json` passa a ser por matéria (`src/lib/topic-media/<slug>.json`). Matéria sem arquivo simplesmente não mostra mídia.
- Os `ANGLES` do podcast devem ter variações genéricas. As analogias vêm do cotidiano e, pra computação, de servidor, API e app.

### 6. Questões que fazem sentido pra computação/estatística
- Adicione o campo opcional `code?: string` em `Question` e `Flashcard`. O `QuestionCard` renderiza o campo em bloco monospace com scroll horizontal, sem syntax highlighter pesado.
- Sem criar tipos novos de questão, as regras (`QUESTION_RULES`) passam a pedir, quando o material tiver código:
  - **"O que esse código faz/imprime?"**: `multiple-choice` com `code` preenchido (ex.: o que `norm.sf(150, 120, 15)` calcula).
  - **Completar código**: `fill` com uma lacuna `___` dentro do `code` (ex.: `modelo.___(X, y)` → `fit`).
  - **Cálculo**: `calculation` com resposta numérica. Nesta matéria: média/mediana/moda, amplitude, frequência relativa/acumulada, binomial (ex. do servidor com 5% de rejeição), regra 68-95-99,7 da normal, R²/RMSE interpretados.
  - **Interpretação**: formato de histograma, assimetria, outlier puxando a média, barras vs. histograma, discreto vs. contínuo.
  - **Conceitual**: IA forte vs. fraca, subcampos, marcos históricos (aqui pode citar datas, desde que estejam no material), ética (privacidade, viés, mercado de trabalho).
- Regra: questão com código usa só as bibliotecas que aparecem no material (numpy, pandas, scipy.stats, matplotlib, seaborn, sklearn). Nada de API inventada.
- A regra atual "não repita a mesma substância/elemento" vira "não repita o mesmo exemplo/dataset/cenário em mais de 2 questões".

### 7. Correção de respostas (`engine.ts`)
- Percentual ↔ decimal: `7,46%` = `0,0746` = `0.0746`. Aplique a tolerância de 2% depois de normalizar.
- Frações: `1/6` ≈ `0,1667`. Cuidado: hoje `/` separa alternativas ("X / Y"). Só trate como fração quando os dois lados forem números.
- Nomes de função/código em `fill`: comparação exata ignorando espaços e maiúsculas (`fit` ≠ `fit_transform`). Não aplique o "typo tolerante" em respostas que parecem código (têm `_`, `.`, `(`).
- Escreva testes novos em `engine.test.ts` pra cada caso acima e garanta que os antigos continuam passando (`npm test`).

## Critérios de aceite
1. `npm test`, `npm run lint` e `npm run build` passam.
2. Química continua funcionando igual, com os dados já gerados, sem reprocessar e sem perder progresso.
3. Processar `it-advanced-topics` gera uns 6–10 tópicos cobrindo algo como: Introdução à IA (definição, forte/fraca, subcampos, história), IA aplicada, Ética em IA, Tipos de dados e gráficos, Medidas de tendência central/dispersão, Distribuição de frequência e histograma, Probabilidade (clássica/frequentista/subjetiva, eventos dependentes/independentes), Distribuições binomial e normal, Python para análise de dados/simulação, Regressão linear (R², RMSE). Isso é pra sanity check, NÃO hard-code tópicos.
4. Nenhum tópico sobre "Avaliações", "Contatos" ou "Caça-palavras". `grep` nos JSONs gerados não encontra telefone nem e-mail.
5. Pelo menos ~20% das questões da matéria usam `code`, e pelo menos uma questão de binomial e uma de normal têm resposta numérica corrigida certo em % e em decimal.
6. O CSV aparece como resumo estatístico nos chunks, nunca como 77 mil linhas.

## Como trabalhar
- Antes de codar, leia o código atual inteiro (é pequeno, ~3,5k linhas) e me mostre um plano curto com os arquivos que vai mexer.
- Faça em commits pequenos, nesta ordem: (1) Subject + store + migração, (2) extração/limpeza, (3) prompts, (4) tipo `code` + UI, (5) engine + testes, (6) seletor de matéria na UI.
- Mudança mínima e sem abstração desnecessária. Se algo aqui conflitar com o código real, avise em vez de forçar.
