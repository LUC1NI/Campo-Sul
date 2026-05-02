"use client";

import { useEffect, useRef } from "react";

export function Particles() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    for (let i = 0; i < 28; i++) {
      const p = document.createElement("span");
      p.className = "particle";
      p.style.left = Math.random() * 100 + "%";
      p.style.setProperty("--tx", Math.random() * 200 - 100 + "px");
      p.style.setProperty("--dur", 12 + Math.random() * 14 + "s");
      p.style.setProperty("--delay", Math.random() * 18 + "s");
      const size = 2 + Math.random() * 4 + "px";
      p.style.width = p.style.height = size;
      p.style.background = Math.random() > 0.5 ? "#b8e096" : "rgba(255,255,255,0.6)";
      host.appendChild(p);
    }
    return () => { host.innerHTML = ""; };
  }, []);

  return <div ref={ref} className="absolute inset-0 pointer-events-none" />;
}
