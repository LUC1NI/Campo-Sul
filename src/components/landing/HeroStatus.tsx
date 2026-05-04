"use client";
import { useEffect, useState } from "react";

function getStatus() {
  const now = new Date();
  const day = now.getDay();
  const h = now.getHours() + now.getMinutes() / 60;
  if (day >= 1 && day <= 5) {
    const open = h >= 8 && h < 18;
    return { open, status: open ? "Aberto agora" : "Fechado agora", detail: open ? "Fecha às 18h" : (h < 8 ? "Abre às 8h" : "Fechado · abre amanhã 8h") };
  }
  if (day === 6) {
    const open = h >= 8 && h < 15;
    return { open, status: open ? "Aberto agora" : "Fechado agora", detail: open ? "Fecha às 15h" : (h < 8 ? "Abre às 8h" : "Fechado · abre seg 8h") };
  }
  return { open: false, status: "Fechado agora", detail: "Domingo · abre seg 8h" };
}

export function HeroStatus() {
  const [s, setS] = useState({ open: true, status: "Aberto agora", detail: "Fecha às 18h" });
  useEffect(() => { setS(getStatus()); }, []);
  return (
    <div className="relative reveal in delay-3">
      <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-verde-musgo/30 via-transparent to-terra/30 blur-md" />
      <div className="relative bg-white/[0.08] backdrop-blur-xl border border-white/15 rounded-3xl p-6 space-y-5">
        <div>
          <p className="font-mono text-[10px] text-verde-musgo uppercase tracking-[0.2em] mb-3">{"// horário agora"}</p>
          <p className="font-fraunces text-2xl text-white font-bold">{s.status}</p>
          <p className="text-white/55 text-xs mt-1">{s.detail}</p>
        </div>
        <div className="h-px bg-white/12" />
        <div>
          <p className="font-mono text-[10px] text-verde-musgo uppercase tracking-[0.2em] mb-2">{"// telefone"}</p>
          <a href="tel:41988819166" className="font-fraunces text-xl text-white font-bold hover:text-verde-musgo transition">(41) 98881-9166</a>
        </div>
        <div className="h-px bg-white/12" />
        <div>
          <p className="font-mono text-[10px] text-verde-musgo uppercase tracking-[0.2em] mb-2">{"// endereço"}</p>
          <p className="text-white text-sm">Av. Fernandes Andrade, 1545 — fundos</p>
          <p className="text-white/55 text-xs">Quitandinha — PR · 83840-000</p>
        </div>
      </div>
    </div>
  );
}
