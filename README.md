# Study Shot

```bash
npm install
cp .env.example .env.local   # coloque sua GEMINI_API_KEY (sem ela roda em Demo mode)
npm run dev                  # http://localhost:3000
```

Cada matéria é uma pasta `docs/<slug>/` (PDF, PPTX, TXT, MD, PY, IPYNB, CSV, em qualquer subpasta), com um `subject.json` opcional (`name`, `exam`, `course`).
Na home: escolha a matéria e clique em "Processar" → espere o processamento (1–3 min, uma vez só; fica em cache em `data/<slug>/`) → ⚡ CRAM MODE.
Progresso (XP, domínio, erros) fica no localStorage do navegador, separado por matéria. `npm test` roda os testes do engine e da extração.
