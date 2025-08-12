# YEP — Renting (HaaS) vs Compra — Simulador Interativo

Projeto React (Vite + Tailwind) pronto para publicar no **Vercel** (recomendado) ou **GitHub Pages**.

## Requisitos
- Node.js 18+
- npm

## Instalação
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Deploy no Vercel
1. Suba este projeto para o GitHub (novo repositório).
2. No **Vercel**, clique **New Project** → importe o repo.
3. Framework: **Vite**. Build Command: `npm run build`. Output: `dist`.
4. Conclua e use o domínio `*.vercel.app` ou adicione o seu domínio próprio.

## Logo
O logótipo foi colocado em `public/logo-bubble.jpg` e referenciado como `/logo-bubble.jpg`.
Se não aparecer, confirme se o arquivo está mesmo em `public/` no branch implantado.

## Notas
- A app usa um hash `#...` com o estado do cenário para partilha de links.
- Tailwind já está configurado.
