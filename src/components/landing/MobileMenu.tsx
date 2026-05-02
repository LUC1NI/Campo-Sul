"use client";
import { useState } from "react";
import Link from "next/link";

const LINKS = [
  ["#produtos","Produtos"],["#numeros","Nossos números"],
  ["#depoimentos","Depoimentos"],["#diferenciais","Por que nós?"],["#localizacao","Localização"],
];
const WA = "https://wa.me/5541988819166";

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(!open)} aria-label={open ? "Fechar menu" : "Abrir menu"}
        className="lg:hidden w-10 h-10 rounded-full bg-bege/60 hover:bg-bege flex items-center justify-center text-verde-mata transition">
        {open ? (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/>
          </svg>
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>
          </svg>
        )}
      </button>
      {open && (
        <div className="lg:hidden absolute left-0 right-0 top-full bg-off-white border-b border-bege shadow-xl z-50">
          <div className="px-6 py-5 flex flex-col gap-1">
            {LINKS.map(([href,label]) => (
              <a key={href} href={href} onClick={() => setOpen(false)}
                className="py-3 px-3 rounded-xl hover:bg-bege/50 text-foreground font-medium">{label}</a>
            ))}
            <div className="my-2 h-px bg-bege"/>
            <Link href="/login" onClick={() => setOpen(false)}
              className="flex items-center gap-2 py-3 px-3 rounded-xl hover:bg-bege/50 text-verde-mata font-semibold text-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 flex-shrink-0">
                <rect x="3" y="4" width="18" height="12" rx="1"/><path d="M2 20h20"/>
              </svg>
              Acessar Sistema
            </Link>
            <a href={WA} target="_blank" rel="noopener" onClick={() => setOpen(false)}
              className="mt-1 py-3 px-4 rounded-full bg-[#25D366] text-white text-center font-bold">
              Falar no WhatsApp
            </a>
          </div>
        </div>
      )}
    </>
  );
}
