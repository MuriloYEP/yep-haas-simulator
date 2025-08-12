import React from 'react'

export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-4">
        <div className="flex items-center gap-3">
          <img src="/logo-bubble.jpg" alt="YEP" className="w-12 h-12 rounded-full border" onError={(e)=>{e.currentTarget.style.display='none'}} />
          <h1 className="text-2xl font-bold">YEP — Renting (HaaS) vs Compra</h1>
        </div>
        <p className="opacity-80">Este projeto está pronto para rodar no Vercel. Substitua este componente pelo conteúdo da versão v2.1 que criámos no canvas.</p>
        <ol className="list-decimal ml-6 space-y-1">
          <li>Copie o conteúdo do canvas (App v2.1) para <code>src/App.jsx</code>.</li>
          <li>Execute <code>npm install</code> e <code>npm run dev</code>.</li>
          <li>Faça deploy no Vercel.</li>
        </ol>
      </div>
    </div>
  )
}
