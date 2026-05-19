"use client";

import { useEffect } from "react";

export function LandingClient() {
  useEffect(() => {
    // ── Scroll reveal ──
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

    // ── Header scroll (shrink logo) ──
    const header = document.querySelector("header");
    const onHeaderScroll = () => {
      if (window.scrollY > 30) header?.classList.add("scrolled");
      else header?.classList.remove("scrolled");
    };
    window.addEventListener("scroll", onHeaderScroll, { passive: true });

    // ── Parallax ──
    const parEls = document.querySelectorAll<HTMLElement>("[data-parallax]");
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const y = window.scrollY;
          parEls.forEach((el) => {
            const speed = parseFloat(el.dataset.parallax ?? "0.3");
            el.style.transform = `translate3d(0, ${y * speed}px, 0)`;
          });
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // ── Custom cursor (desktop only) ──
    const dot = document.getElementById("cdot");
    const ring = document.getElementById("cring");
    // Inicia fora da tela — fica invisível até o primeiro mousemove.
    // Evita o "ponto preso no canto superior esquerdo" antes do usuário mover.
    let mx = -100, my = -100, rx = -100, ry = -100;
    let primeiroMove = true;
    const onMouseMove = (e: MouseEvent) => {
      mx = e.clientX; my = e.clientY;
      if (primeiroMove) {
        // Teleporta o ring pro ponto atual sem animar a interpolação a partir de (-100,-100)
        rx = mx; ry = my;
        primeiroMove = false;
      }
      if (dot) dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
    };
    let rafId: number;
    const loop = () => {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      if (ring) ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
      rafId = requestAnimationFrame(loop);
    };
    if (dot && ring) {
      // Esconde o ponto até o primeiro movimento (CSS já fica em -100,-100 via inline style)
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
      window.addEventListener("mousemove", onMouseMove);
      rafId = requestAnimationFrame(loop);
      document.querySelectorAll("a, button, .prod-card").forEach((el) => {
        el.addEventListener("mouseenter", () => document.body.classList.add("is-hover"));
        el.addEventListener("mouseleave", () => document.body.classList.remove("is-hover"));
      });
    }

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <>
      <div className="cursor-dot hidden md:block" id="cdot" />
      <div className="cursor-ring hidden md:block" id="cring" />
    </>
  );
}
