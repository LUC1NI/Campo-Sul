"use client";
import { useEffect, useState } from "react";

const DEP = [
  { iniciais:"JR", nome:"João Ribeiro", papel:"Produtor de leite · 35 anos no campo", cidade:"Quitandinha — PR",
    texto:"Compro na Campo Sul há mais de cinco anos. O atendimento é diferente — eles conhecem cada produto e indicam a ração certa pro tipo de gado. Já me salvou mais de uma vez." },
  { iniciais:"MS", nome:"Maria Schmitz", papel:"Criadora de aves caipiras", cidade:"Rio Negro — PR",
    texto:"Não preciso ir até Curitiba pra encontrar produto bom. Ração, vacina, vermífugo — tudo na Campo Sul, com preço justo e atendimento que respeita a gente." },
  { iniciais:"AP", nome:"Antônio Padilha", papel:"Agricultor familiar · soja e milho", cidade:"Lapa — PR",
    texto:"Já recomendei pra meio mundo de vizinho. As sementes que comprei lá renderam acima da média. Quando alguém pergunta onde comprar, mando direto pra Campo Sul." },
];

const Star = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-verde-musgo">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

export default function Depoimentos() {
  const [idx, setIdx] = useState(0);
  const prev = () => setIdx(i => (i - 1 + DEP.length) % DEP.length);
  const next = () => setIdx(i => (i + 1) % DEP.length);
  useEffect(() => {
    const t = setInterval(next, 7500);
    return () => clearInterval(t);
  }, []);

  const d = DEP[idx];
  return (
    <section id="depoimentos" className="py-24 lg:py-32 bg-verde-mata text-white relative overflow-hidden grain">
      <div className="absolute -top-20 -left-10 font-fraunces text-[40rem] leading-none text-white/[0.03] pointer-events-none select-none italic">&ldquo;</div>
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
        <div className="reveal text-center mb-16">
          <p className="sec-num mb-3" style={{color:"#b8e096"}}>— 03 / Quem compra com a gente</p>
          <h2 className="font-fraunces text-4xl md:text-6xl font-bold leading-[0.95]">
            Histórias de<br/><span className="italic text-verde-musgo">quem confia</span>.
          </h2>
        </div>

        <div className="bg-white/[0.05] backdrop-blur border border-white/10 rounded-3xl p-8 md:p-12 lg:p-16">
          <div className="flex items-center gap-1 mb-8">{[...Array(5)].map((_,i) => <Star key={i}/>)}</div>
          <blockquote
            className="font-fraunces text-2xl md:text-4xl lg:text-5xl font-medium leading-tight mb-10 text-white"
            style={{opacity:1,transition:"opacity .4s"}}
          >
            &ldquo;{d.texto}&rdquo;
          </blockquote>
          <div className="flex items-center gap-4 pt-8 border-t border-white/10">
            <div className="w-14 h-14 rounded-full bg-verde-musgo flex items-center justify-center flex-shrink-0">
              <span className="font-fraunces font-bold text-verde-mata text-lg">{d.iniciais}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-fraunces font-bold text-lg">{d.nome}</p>
              <p className="text-white/55 text-sm">{d.papel}</p>
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-verde-musgo hidden sm:block">{d.cidade}</p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-10">
          <div className="flex gap-2">
            {DEP.map((_,i) => (
              <button key={i} onClick={() => setIdx(i)} aria-label={`Depoimento ${i+1}`}
                className={`transition-all rounded-full h-2 ${i===idx?"w-10 bg-verde-musgo":"w-2 bg-white/25 hover:bg-white/45"}`}/>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={prev} aria-label="Anterior"
              className="w-12 h-12 rounded-full bg-white/[0.08] hover:bg-verde-musgo hover:text-verde-mata border border-white/15 text-white flex items-center justify-center transition">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button onClick={next} aria-label="Próximo"
              className="w-12 h-12 rounded-full bg-white/[0.08] hover:bg-verde-musgo hover:text-verde-mata border border-white/15 text-white flex items-center justify-center transition">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
