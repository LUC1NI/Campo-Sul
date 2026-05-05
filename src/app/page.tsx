import Link from "next/link";
import Image from "next/image";
import { LandingClient } from "@/components/landing/LandingClient";
import { Particles } from "@/components/landing/Particles";
import { MobileMenu } from "@/components/landing/MobileMenu";
import { CounterItem } from "@/components/landing/CounterItem";
import Depoimentos from "@/components/landing/Depoimentos";
import { HeroStatus } from "@/components/landing/HeroStatus";

const WA = "https://wa.me/5541988819166";
const MAPS = "https://maps.app.goo.gl/aYA6iQHz3Quc7fnbA";
const MAPS_EMBED = "https://www.google.com/maps?q=Avenida+Fernandes+Andrade+1545+Quitandinha+PR+Brasil&output=embed&z=16";
const INSTA = "https://www.instagram.com/agro_padilha/";
const FB = "https://www.facebook.com/p/Campo-Sul-Agropecu%C3%A1ria-100029105237261/";

const PRODUTOS = [
  { tag:"Ração & Nutrição", title:"Ração que", titleItalic:"sustenta", sub:"o rebanho.", desc:"Para bovinos, suínos, aves e equinos. Suplementos minerais, vitamínicos e energéticos.", img:"https://images.unsplash.com/photo-1500595046743-cd271d694d30?auto=format&fit=crop&w=1200&q=80", alt:"Ração", large:true, col:"lg:col-span-5 lg:row-span-2" },
  { tag:"Saúde animal", title:"Vacinas e", titleItalic:null, sub:"medicamentos", desc:"", img:"https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&w=900&q=80", alt:"Saúde animal", large:false, col:"lg:col-span-4" },
  { tag:"Sementes", title:"Pastagens", titleItalic:null, sub:"produtivas", desc:"", img:"https://images.unsplash.com/photo-1530092285049-1c42085fd395?auto=format&fit=crop&w=800&q=80", alt:"Sementes", large:false, col:"lg:col-span-3" },
  { tag:"Ferramentas", title:"Para o dia", titleItalic:null, sub:"do produtor", desc:"", img:"https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=800&q=80", alt:"Ferramentas", large:false, col:"lg:col-span-3" },
  { tag:"Insumos & adubos", title:"Para a sua", titleItalic:null, sub:"lavoura render", desc:"", img:"https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=900&q=80", alt:"Insumos", large:false, col:"lg:col-span-4" },
];

const DIFERENCIAIS = [
  { t:"Atendimento que conhece o campo", d:"Você não é mais um número. Indicamos o produto certo pra cada situação, sem enrolação." },
  { t:"Produtos testados e aprovados", d:"Só vendemos o que recomendamos. Cada item do estoque foi selecionado com critério." },
  { t:"Preço justo pro produtor", d:"Margem importa. Trabalhamos preço competitivo pra o melhor custo-benefício na região." },
  { t:"Em Quitandinha, para o Paraná", d:"Localização central, fácil acesso. Atendemos toda a região com agilidade." },
  { t:"Suporte técnico que faz diferença", d:"Dúvida sobre dosagem, manejo, vacinação? Resolvemos no balcão ou pelo WhatsApp." },
];

function ArrowIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
      <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
    </svg>
  );
}

function ChevRight({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

function WAIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.87 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.69.25-1.29.18-1.41-.07-.12-.27-.2-.57-.35M12.05 21.78a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26C2.16 6.45 6.6 2 12.05 2c2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.43 9.88-9.88 9.88"/>
    </svg>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-off-white font-sans relative">
      <LandingClient />

      {/* ── ANNOUNCEMENT MARQUEE ── */}
      <div className="bg-verde-mata-2 text-bege/70 text-[11px] py-2 overflow-hidden marquee">
        <div className="marquee-track flex whitespace-nowrap gap-12 px-6">
          {[...Array(2)].map((_, r) => (
            <span key={r} className="flex gap-12">
              {["14 anos servindo o produtor rural do Paraná","Frete para Quitandinha e região","Atendimento técnico veterinário","Pedidos pelo WhatsApp"].map(t => (
                <span key={t} className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-verde-folha inline-block"/>
                  {t}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 bg-off-white/85 backdrop-blur-xl border-b border-bege/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-[72px]">
            <a href="#" className="flex items-center gap-3 group">
              <Image src="/logo.jpg" alt="Campo Sul Agropecuária" width={52} height={42} className="hidden sm:block h-10 w-auto object-contain" priority/>
              <div className="leading-tight">
                <p className="font-fraunces font-bold text-verde-mata text-[17px] tracking-tight">Campo Sul</p>
                <p className="text-[9px] text-terra uppercase tracking-[0.22em] font-semibold">Agropecuária</p>
              </div>
            </a>

            <nav className="hidden lg:flex items-center gap-9">
              {[["#produtos","Produtos"],["#numeros","Nossos números"],["#depoimentos","Depoimentos"],["#diferenciais","Por que nós?"],["#localizacao","Localização"]].map(([href,label]) => (
                <a key={href} href={href} className="ulink text-[13px] text-foreground/70 hover:text-verde-mata font-medium">{label}</a>
              ))}
              <Link href="/login" className="text-[13px] text-foreground/35 hover:text-verde-mata font-medium transition-colors">Sistema ↗</Link>
            </nav>

            <div className="flex items-center gap-2 sm:gap-3">
              <a href={WA} target="_blank" rel="noopener"
                className="hidden sm:inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1da851] text-white text-[13px] font-bold px-5 py-2.5 rounded-full transition-all hover:shadow-lg hover:shadow-[#25D366]/25 hover:-translate-y-0.5">
                <WAIcon/> WhatsApp
              </a>
              <MobileMenu/>
            </div>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative lg:min-h-screen flex items-end overflow-hidden" style={{background:"linear-gradient(180deg,#1d3a23 0%,#2d4a2b 35%,#243d22 65%,#1a2e1a 100%)"}}>
        <div className="absolute inset-0 overflow-hidden" data-parallax="0.3">
          <div className="absolute inset-0 w-full h-[120%]">
            <Image src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=2400&q=80"
                 alt="Campo ao amanhecer" fill priority sizes="100vw" className="object-cover"/>
          </div>
        </div>

        {/* Sun orb */}
        <div className="absolute top-[18%] right-[12%] w-44 h-44 sun-anim pointer-events-none" data-parallax="0.5">
          <div className="w-full h-full rounded-full" style={{background:"radial-gradient(circle, rgba(255,220,160,0.85), rgba(255,180,100,0.15) 60%, transparent 75%)", filter:"blur(2px)"}}/>
        </div>

        {/* Overlays */}
        <div className="absolute inset-0" style={{background:"linear-gradient(115deg,rgba(26,46,26,0.96) 0%,rgba(45,74,43,0.82) 40%,rgba(45,74,43,0.55) 70%,rgba(45,74,43,0.35) 100%)"}}/>
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a2e1a]/70 via-transparent to-transparent"/>

        <Particles/>

        {/* Landscape SVG */}
        <svg className="absolute bottom-0 left-0 right-0 w-full pointer-events-none" viewBox="0 0 1440 240" preserveAspectRatio="none" style={{height:"28%"}}>
          <defs>
            <linearGradient id="h1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1a2e1a" stopOpacity="0.55"/><stop offset="1" stopColor="#1a2e1a" stopOpacity="1"/></linearGradient>
            <linearGradient id="h2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d1d0d" stopOpacity="0.7"/><stop offset="1" stopColor="#0d1d0d" stopOpacity="1"/></linearGradient>
          </defs>
          <path d="M0,140 Q180,100 360,130 T720,140 T1080,120 T1440,135 L1440,240 L0,240 Z" fill="url(#h1)"/>
          <path d="M0,180 Q200,150 400,170 T800,180 T1200,165 T1440,175 L1440,240 L0,240 Z" fill="url(#h2)"/>
          <g fill="#0a1a0a" opacity="0.85">
            <path d="M120 130 L114 150 L126 150 Z"/><path d="M340 124 L334 150 L346 150 Z"/>
            <path d="M620 130 L614 152 L626 152 Z"/><path d="M960 116 L954 144 L966 144 Z"/>
            <path d="M1240 122 L1234 148 L1246 148 Z"/>
          </g>
        </svg>

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-28 pb-14 lg:pt-28 lg:pb-44 w-full">
          <div className="inline-flex items-center gap-3 mb-6 lg:mb-8 bg-white/[0.08] backdrop-blur-md border border-white/15 px-4 py-2 rounded-full reveal in">
            <span className="relative flex w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-verde-folha pulse-dot"/>
              <span className="relative w-2 h-2 rounded-full bg-verde-folha"/>
            </span>
            <span className="text-white/85 text-[11px] font-mono uppercase tracking-[0.22em]">Quitandinha · Paraná · Brasil</span>
          </div>

          <h1 className="font-fraunces font-bold text-white leading-[0.9] mb-6 lg:mb-8 tracking-tight reveal in delay-1" style={{fontSize:"clamp(2.4rem,8.5vw,7rem)"}}>
            Tudo que sua<br/>
            <em className="shimmer-text not-italic">propriedade</em><br/>
            precisa.
          </h1>

          <p className="text-white/80 text-sm md:text-xl leading-relaxed mb-8 lg:mb-10 max-w-2xl reveal in delay-2">
            Rações, medicamentos veterinários, sementes, insumos e ferramentas.
            Atendimento de quem <em className="font-fraunces italic text-verde-musgo">vive e entende o campo</em> — em Quitandinha.
          </p>

          <div className="flex flex-wrap gap-3 reveal in delay-3">
            <a href="#produtos" className="group inline-flex items-center gap-2 bg-verde-musgo hover:bg-white text-verde-mata font-bold px-6 py-3.5 lg:px-7 lg:py-4 rounded-full transition-all hover:-translate-y-1 hover:shadow-2xl text-sm">
              Ver produtos <ChevRight className="w-4 h-4 transition-transform group-hover:translate-x-1"/>
            </a>
            <a href={WA} target="_blank" rel="noopener"
              className="group inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1da851] text-white font-bold px-6 py-3.5 lg:px-7 lg:py-4 rounded-full transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-[#25D366]/30 text-sm">
              <WAIcon/> Falar no WhatsApp
            </a>
          </div>
        </div>

        {/* HeroStatus card — desktop only, absolute para não afetar o fluxo do hero */}
        <div className="hidden lg:block absolute right-8 bottom-44 z-20 w-[290px]">
          <HeroStatus/>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 hidden md:flex flex-col items-center gap-2 text-white/55">
          <span className="font-mono text-[9px] uppercase tracking-[0.3em]">Role</span>
          <span className="w-px h-10 bg-gradient-to-b from-white/55 to-transparent overflow-hidden relative block">
            <span className="absolute top-0 left-0 w-full h-3 bg-verde-musgo" style={{animation:"scrollBar 2s ease-in-out infinite"}}/>
          </span>
        </div>
      </section>

      {/* ── MARQUEE STRIP CATEGORIAS ── */}
      <div className="bg-verde-mata-2 text-white py-6 border-y border-white/5 overflow-hidden marquee">
        <div className="marquee-track fast flex whitespace-nowrap items-center gap-10 font-fraunces text-2xl md:text-3xl">
          {[...Array(2)].map((_,r) => (
            <span key={r} className="flex items-center gap-10">
              <span>Ração</span><span className="text-verde-folha">✦</span>
              <span className="italic text-verde-musgo">Vacinas</span><span className="text-verde-folha">✦</span>
              <span>Sementes</span><span className="text-verde-folha">✦</span>
              <span className="italic text-verde-musgo">Insumos</span><span className="text-verde-folha">✦</span>
              <span>Ferramentas</span><span className="text-verde-folha">✦</span>
              <span className="italic text-verde-musgo">Higiene</span><span className="text-verde-folha">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── NÚMEROS ── */}
      <section id="numeros" className="py-24 lg:py-32 bg-bege relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-verde-musgo/10 blur-3xl pointer-events-none"/>
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-terra/10 blur-3xl pointer-events-none"/>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <div className="reveal max-w-2xl mb-16">
            <p className="sec-num mb-3">— 01 / Em números</p>
            <h2 className="font-fraunces text-4xl md:text-6xl font-bold text-verde-mata leading-[0.95]">
              Confiança<br/>que se mede<br/><span className="italic text-terra">no campo</span>.
            </h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-terra/15 rounded-3xl overflow-hidden">
            {[{n:14,s:"+",l:"Anos no campo"},{n:1400,s:"+",l:"Produtores atendidos"},{n:120,s:"",l:"Marcas parceiras"},{n:99,s:"%",l:"Clientes satisfeitos"}].map((c,i) => (
              <div key={i} className={`bg-bege p-7 lg:p-10 reveal${i>0?` delay-${i}`:""}`}>
                <p className="font-fraunces text-5xl lg:text-7xl font-bold text-verde-mata">
                  <CounterItem target={c.n} suffix={c.s}/>
                </p>
                <p className="text-foreground/55 text-xs uppercase tracking-widest mt-2 font-semibold">{c.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUTOS BENTO ── */}
      <section id="produtos" className="py-24 lg:py-32 bg-off-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-16">
            <div className="reveal max-w-2xl">
              <p className="sec-num mb-3">— 02 / Linha completa</p>
              <h2 className="font-fraunces text-4xl md:text-6xl font-bold text-verde-mata leading-[0.95]">
                Tudo o que sua<br/>propriedade precisa,<br/><span className="italic text-terra">num lugar só</span>.
              </h2>
            </div>
            <a href={WA} target="_blank" rel="noopener" className="reveal delay-2 inline-flex items-center gap-2 text-sm text-verde-claro hover:text-verde-mata font-semibold group whitespace-nowrap">
              <span className="ulink">Consultar estoque completo</span>
              <ChevRight className="w-4 h-4 transition-transform group-hover:translate-x-1"/>
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 lg:grid-rows-2 gap-4 lg:h-[680px]">
            {PRODUTOS.map((p, i) => (
              <a key={p.tag} href={WA} target="_blank" rel="noopener"
                className={`prod-card reveal group relative rounded-3xl overflow-hidden bg-verde-mata min-h-[280px] ${p.col}${i>0?` delay-${Math.min(i,4)}`:""}`}>
                <Image src={p.img} alt={p.alt} fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" className="prod-img object-cover"/>
                <div className="absolute inset-0 bg-gradient-to-t from-verde-mata-2 via-verde-mata/40 to-transparent"/>
                <div className="absolute top-5 left-5 right-5 flex items-start justify-between">
                  <span className="bg-bege/95 backdrop-blur text-verde-mata text-[10px] font-bold uppercase tracking-[0.22em] px-3 py-1.5 rounded-full">{p.tag}</span>
                  <span className="prod-arrow w-10 h-10 rounded-full bg-white/15 backdrop-blur border border-white/20 flex items-center justify-center text-white">
                    <ArrowIcon/>
                  </span>
                </div>
                <div className="absolute bottom-6 left-6 right-6">
                  {p.large ? (
                    <>
                      <h3 className="font-fraunces text-3xl lg:text-5xl font-bold text-white leading-[0.95] mb-3">
                        {p.title}<br/><span className="italic text-verde-musgo">{p.titleItalic}</span> {p.sub}
                      </h3>
                      <p className="text-white/75 text-sm max-w-md">{p.desc}</p>
                    </>
                  ) : (
                    <h3 className="font-fraunces text-xl font-bold text-white leading-tight">{p.title}<br/>{p.sub}</h3>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEPOIMENTOS ── */}
      <Depoimentos/>

      {/* ── DIFERENCIAIS ── */}
      <section id="diferenciais" className="py-24 lg:py-32 bg-off-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="reveal max-w-2xl mb-16">
            <p className="sec-num mb-3">— 04 / Por que a Campo Sul</p>
            <h2 className="font-fraunces text-4xl md:text-6xl font-bold text-verde-mata leading-[0.95]">
              Atendimento<br/>de quem <span className="italic text-terra">vive o campo</span>.
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-2">
            <div className="space-y-2">
              {DIFERENCIAIS.map((d, i) => (
                <div key={i} className={`reveal group flex items-start gap-6 py-7 border-b border-bege transition-all hover:border-terra hover:pl-2 delay-${i}`}>
                  <span className="font-fraunces text-3xl font-bold text-terra/35 leading-none w-12 flex-shrink-0 select-none transition-colors group-hover:text-terra">
                    {String(i+1).padStart(2,"0")}
                  </span>
                  <div className="flex-1">
                    <h3 className="font-fraunces text-2xl lg:text-3xl font-bold text-verde-mata mb-2 leading-tight">{d.t}</h3>
                    <p className="text-foreground/55 text-sm leading-relaxed max-w-md">{d.d}</p>
                  </div>
                  <ChevRight className="w-5 h-5 text-terra/30 group-hover:text-terra group-hover:translate-x-1 transition-all flex-shrink-0 mt-2"/>
                </div>
              ))}
            </div>

            <div className="hidden lg:block sticky top-24 h-[400px] reveal">
              <div className="relative w-full h-full rounded-3xl overflow-hidden bg-verde-mata">
                <Image src="https://images.unsplash.com/photo-1500595046743-cd271d694d30?auto=format&fit=crop&w=1200&q=80" fill sizes="(max-width: 1200px) 100vw, 50vw" className="object-cover opacity-80" alt="Campo"/>
                <div className="absolute inset-0 bg-gradient-to-tr from-verde-mata/95 via-verde-mata/60 to-transparent"/>
                <div className="absolute bottom-8 left-8 right-8 text-white">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-verde-musgo mb-3">{"// no coração do paraná"}</p>
                  <p className="font-fraunces text-3xl font-bold leading-tight">Aqui o campo<br/>tem voz e <em className="italic text-verde-musgo">tem rosto</em>.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── LOCALIZAÇÃO ── */}
      <section id="localizacao" className="py-24 lg:py-32 bg-bege relative overflow-hidden">
        <div className="absolute -bottom-40 -right-20 w-[500px] h-[500px] rounded-full bg-verde-mata/5 blur-3xl pointer-events-none"/>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <div className="reveal mb-12 max-w-2xl">
            <p className="sec-num mb-3">— 05 / Onde estamos</p>
            <h2 className="font-fraunces text-4xl md:text-6xl font-bold text-verde-mata leading-[0.95]">
              Venha tomar<br/>um café <em className="italic text-terra">com a gente</em>.
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-4 reveal">
              <div className="bg-white rounded-3xl p-7 border border-bege/80 border-glow">
                <p className="font-mono text-[10px] text-terra uppercase tracking-[0.22em] mb-3">{"// endereço"}</p>
                <p className="font-fraunces text-2xl font-bold text-verde-mata leading-tight">Av. Fernandes Andrade, 1545</p>
                <p className="text-foreground/55 text-sm mt-1">fundos · Quitandinha — PR</p>
                <p className="text-foreground/40 text-xs mt-1 font-mono">CEP 83840-000</p>
              </div>
              <div className="bg-white rounded-3xl p-7 border border-bege/80">
                <p className="font-mono text-[10px] text-terra uppercase tracking-[0.22em] mb-3">{"// horários"}</p>
                <div className="space-y-2.5">
                  {[["Segunda a sexta","08h–18h"],["Sábado","08h–15h"]].map(([d,h]) => (
                    <div key={d} className="flex items-center justify-between">
                      <span className="text-foreground/65 text-sm">{d}</span>
                      <span className="font-fraunces font-bold text-verde-mata">{h}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between">
                    <span className="text-foreground/35 text-sm">Domingo</span>
                    <span className="text-foreground/35 text-sm">Fechado</span>
                  </div>
                </div>
              </div>
              <a href={MAPS} target="_blank" rel="noopener"
                className="block bg-verde-mata text-white rounded-3xl p-6 hover:bg-verde-mata-2 transition group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-[10px] text-verde-musgo uppercase tracking-[0.22em] mb-2">{"// como chegar"}</p>
                    <p className="font-fraunces text-xl font-bold">Abrir no Google Maps</p>
                  </div>
                  <span className="w-12 h-12 rounded-full bg-verde-musgo text-verde-mata flex items-center justify-center group-hover:rotate-45 transition-transform duration-500">
                    <ArrowIcon className="w-5 h-5"/>
                  </span>
                </div>
              </a>
            </div>

            <div className="lg:col-span-8 reveal delay-2">
              <div className="relative rounded-3xl overflow-hidden border border-bege/80 shadow-2xl bg-white h-[460px] lg:h-full min-h-[500px]">
                <iframe src={MAPS_EMBED} width="100%" height="100%"
                  style={{border:0, filter:"saturate(0.85) contrast(1.05)"} as React.CSSProperties}
                  allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                  title="Localização Campo Sul" className="absolute inset-0 w-full h-full"/>
                <div className="absolute top-5 left-5 bg-white rounded-2xl p-4 shadow-2xl border border-bege max-w-xs pointer-events-none">
                  <div className="flex items-start gap-3">
                    <div className="relative w-11 h-11 rounded-2xl bg-verde-mata flex items-center justify-center flex-shrink-0">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#b8e096" strokeWidth="2" className="w-5 h-5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                      <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-verde-folha pulse-dot"/>
                    </div>
                    <div className="leading-tight min-w-0">
                      <p className="font-fraunces font-bold text-verde-mata text-base">Campo Sul</p>
                      <p className="text-[11px] text-foreground/55">Agropecuária · Quitandinha</p>
                    </div>
                  </div>
                </div>
                <div className="absolute bottom-5 right-5 bg-verde-mata text-white rounded-2xl p-4 shadow-2xl hidden md:block">
                  <p className="font-mono text-[10px] text-verde-musgo uppercase tracking-[0.22em] mb-1">{"// raio de atendimento"}</p>
                  <p className="font-fraunces text-3xl font-bold">80km</p>
                  <p className="text-white/55 text-xs">Quitandinha · Rio Negro · Lapa · Mafra</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section id="contato" className="relative py-32 lg:py-44 bg-verde-mata-2 text-white overflow-hidden grain">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[800px] h-[800px] rounded-full sun-anim" style={{background:"radial-gradient(circle, rgba(184,224,150,0.18), transparent 60%)"}}/>
        </div>
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <p className="sec-num mb-6 reveal" style={{color:"#b8e096"}}>— 06 / Vamos conversar?</p>
          <h2 className="font-fraunces font-bold leading-[0.92] mb-8 reveal delay-1" style={{fontSize:"clamp(2.5rem,7vw,6rem)"}}>
            Pronto pra<br/><em className="italic shimmer-text">simplificar</em><br/>sua propriedade?
          </h2>
          <p className="text-white/65 text-lg max-w-xl mx-auto mb-12 reveal delay-2">
            Manda mensagem no WhatsApp — respondemos rapidinho, indicamos o produto certo e separamos pra você buscar ou entregamos na região.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 reveal delay-3">
            <a href={WA} target="_blank" rel="noopener"
              className="group inline-flex items-center gap-3 bg-[#25D366] hover:bg-white text-white hover:text-verde-mata font-bold px-9 py-5 rounded-full text-base transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-[#25D366]/40">
              <WAIcon className="w-5 h-5"/> Falar no WhatsApp
              <ChevRight className="w-4 h-4 transition-transform group-hover:translate-x-1"/>
            </a>
            <a href="tel:41988819166"
              className="inline-flex items-center gap-2 bg-white/[0.08] hover:bg-white/15 backdrop-blur border border-white/15 text-white font-bold px-7 py-5 rounded-full text-base transition">
              (41) 98881-9166
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-verde-mata-2 text-white/60 pt-20 pb-10 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-white/[0.08]">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-5">
                <Image src="/logo.jpg" alt="Campo Sul" width={56} height={44} className="h-11 w-auto object-contain opacity-80"/>
                <div className="leading-tight">
                  <p className="font-fraunces font-bold text-white text-xl">Campo Sul</p>
                  <p className="text-[10px] text-verde-musgo uppercase tracking-[0.22em] font-semibold">Agropecuária</p>
                </div>
              </div>
              <p className="text-white/45 text-sm leading-relaxed max-w-md">
                Há 14 anos servindo o produtor rural do Paraná com produtos de qualidade e atendimento de quem entende do campo.
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] text-verde-musgo uppercase tracking-[0.22em] mb-4">{"// navegar"}</p>
              <div className="space-y-2.5">
                {[["#produtos","Produtos"],["#depoimentos","Depoimentos"],["#diferenciais","Por que nós?"],["#localizacao","Localização"]].map(([href,label]) => (
                  <a key={href} href={href} className="block text-white/55 hover:text-white text-sm">{label}</a>
                ))}
              </div>
            </div>
            <div>
              <p className="font-mono text-[10px] text-verde-musgo uppercase tracking-[0.22em] mb-4">{"// contato"}</p>
              <div className="space-y-2.5">
                <a href="tel:41988819166" className="block text-white/55 hover:text-white text-sm">(41) 98881-9166</a>
                <p className="text-white/55 text-sm">Av. Fernandes Andrade, 1545</p>
                <p className="text-white/40 text-xs">Quitandinha — PR · 83840-000</p>
                <div className="flex gap-4 pt-1">
                  <a href={INSTA} target="_blank" rel="noopener" className="text-white/35 hover:text-white/75 transition">Instagram</a>
                  <a href={FB} target="_blank" rel="noopener" className="text-white/35 hover:text-white/75 transition">Facebook</a>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-8">
            <p className="text-white/30 text-xs">© {new Date().getFullYear()} Campo Sul Agropecuária. Todos os direitos reservados.</p>
            <Link href="/login" className="text-white/30 hover:text-verde-musgo text-xs font-mono">Acessar sistema ↗</Link>
          </div>
        </div>
      </footer>

      {/* ── FABs ── */}
      <Link href="/login" className="fab-sistema" aria-label="Acessar sistema">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><rect x="3" y="4" width="18" height="12" rx="1"/><path d="M2 20h20"/></svg>
        <span>Sistema</span>
        <ArrowIcon className="w-3 h-3 opacity-60"/>
      </Link>
      <a href={WA} target="_blank" rel="noopener" className="fab-whats" aria-label="Falar no WhatsApp">
        <WAIcon className="w-7 h-7"/>
      </a>
    </div>
  );
}
