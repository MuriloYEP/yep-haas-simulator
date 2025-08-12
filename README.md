# YEP — Renting (HaaS) vs Compra — Simulador Interativo (v2.1)

Projeto React (Vite + Tailwind) pronto para publicar no **Vercel**.

## Requisitos
- Node.js 18+ (já instalado)
- npm (vem com o Node)

## Rodar localmente
```bash
npm install
npm run dev
```
Abra o endereço que aparecer (ex.: `http://localhost:5173`).

## Build de produção
```bash
npm run build
npm run preview
```

## Deploy no Vercel
1. Suba este projeto para um repositório no GitHub.
2. No **Vercel**, clique **New Project** → importe o repo.
3. Framework: **Vite**. Build Command: `npm run build`. Output Directory: `dist`.
4. Conclua e acesse o domínio gerado (`*.vercel.app`) ou conecte o seu.

## Logo
O logótipo está em `public/logo-bubble.jpg` e referenciado no JSX como `/logo-bubble.jpg`.

## Observações
- O botão **Partilhar cenário** cria um link com o estado no hash da URL.
- O comparativo de custos **EAC** ignora IVA (empresas deduzem). O slider de IVA apenas altera o total exibido “com IVA”.
- Use a **taxa efetiva de IRC** do cliente; em Portugal, 21% é o ponto de partida.
