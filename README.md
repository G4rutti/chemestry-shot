# Chemistry Shot

```bash
npm install
cp .env.example .env.local   # coloque sua GEMINI_API_KEY (sem ela roda em Demo mode)
npm run dev                  # http://localhost:3000
```

Na home: arraste os PDFs/PPTX ou clique em "Usar arquivos da pasta docs/" → espere o processamento (1–3 min, uma vez só; fica em cache em `data/`) → ⚡ CRAM MODE.
Progresso (XP, domínio, erros) fica no localStorage do navegador. `npm test` roda os testes do engine.
