"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────
type Theme = "dark" | "light";

// ─── Easing ───────────────────────────────────────────────────────────────────
const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 22 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-60px" },
    transition: { duration: 0.75, delay, ease: EASE },
  };
}

// ─── DATA ─────────────────────────────────────────────────────────────────────
const DATA_SOURCES = [
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4" />
        <line x1="8" y1="2" x2="8" y2="5.5" stroke="currentColor" strokeWidth="1.4" />
        <line x1="8" y1="10.5" x2="8" y2="14" stroke="currentColor" strokeWidth="1.4" />
        <line x1="2" y1="8" x2="5.5" y2="8" stroke="currentColor" strokeWidth="1.4" />
        <line x1="10.5" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
    title: "Wafer Lots",
    sub: "12,400 dies / lot",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="3" y="3" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
    title: "Equipment Sensors",
    sub: "1,200+ parameters",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2 L14 13 L2 13 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
        <line x1="8" y1="7" x2="8" y2="10" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="8" cy="11.5" r="0.7" fill="currentColor" />
      </svg>
    ),
    title: "Process Parameters",
    sub: "Etch · Litho · CMP",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
        <rect x="5" y="5" width="2.5" height="2.5" fill="currentColor" opacity="0.6" />
        <rect x="8.5" y="5" width="2.5" height="2.5" fill="currentColor" opacity="0.6" />
        <rect x="5" y="8.5" width="2.5" height="2.5" fill="currentColor" opacity="0.6" />
        <rect x="8.5" y="8.5" width="2.5" height="2.5" fill="currentColor" opacity="0.3" />
      </svg>
    ),
    title: "Defect Maps",
    sub: "Spatial pattern scan",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 12 L6 7 L9.5 10 L13 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 4 L14 4 L14 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
    title: "Yield Loss",
    sub: "Revenue-critical output",
  },
];

const STAT_CARDS = [
  { value: "3nm", label: "Process node" },
  { value: "240+", label: "Variables tracked" },
  { value: "17", label: "Correlated tools" },
  { value: "Real-time", label: "Analysis speed" },
];

// ─── PRNG (exact LCG) ─────────────────────────────────────────────────────────
function makePRNG(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ─── Defect patterns data ─────────────────────────────────────────────────────
const PATTERNS = [
  { id: "edge", label: "Edge Ring", confidence: 94.2, lots: 14, correlation: "Etch Temp" },
  { id: "center", label: "Center Cluster", confidence: 88.5, lots: 8, correlation: "Deposition" },
  { id: "scratch", label: "Scratch Pattern", confidence: 99.1, lots: 3, correlation: "Robot Handling" },
  { id: "random", label: "Random Defects", confidence: 64.0, lots: 42, correlation: "Particle Count" },
  { id: "local", label: "Localized Cluster", confidence: 91.8, lots: 6, correlation: "Litho Focus" },
  { id: "repeat", label: "Repeating Spatial", confidence: 87.4, lots: 11, correlation: "Reticle Flaw" },
];

const ROOT_CAUSES = [
  { label: "Etch Chamber Temperature", prob: 87, color: "#d4433a" },
  { label: "Lithography Focus Drift", prob: 64, color: "#c97a2a" },
  { label: "Chamber Pressure Variation", prob: 42, color: "#c97a2a" },
  { label: "CMP Removal Rate", prob: 28, color: "#3a8a5a" },
  { label: "Deposition Thickness", prob: 15, color: "#3a8a5a" },
];

const LOTS = [
  { id: "LOT-20481", risk: 87, status: "critical" as const },
  { id: "LOT-20482", risk: 64, status: "warning" as const },
  { id: "LOT-20483", risk: 42, status: "warning" as const },
  { id: "LOT-20484", risk: 12, status: "good" as const },
];

const KPI_CARDS = [
  { label: "Overall Yield", value: "94.7%", delta: "+1.2%", up: true },
  { label: "Active Lots", value: "1,284", delta: "+38", up: true },
  { label: "Open Excursions", value: "5.63%", delta: "-0.8%", up: false },
  { label: "Avg Defect Density", value: "81.3%", delta: "+2.1%", up: true },
];

// ─── Three Gold Dots ───────────────────────────────────────────────────────────
function ThreeDots() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          style={{
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: "var(--gold)",
          }}
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{
            duration: 1.6,
            delay: i * 0.22,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// ─── Theme Toggle ──────────────────────────────────────────────────────────────
function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const isDark = theme === "dark";
  return (
    <button
      suppressHydrationWarning
      onClick={onToggle}
      aria-label="Toggle theme"
      style={{
        position: "relative",
        width: 42,
        height: 22,
        borderRadius: 11,
        border: "none",
        background: isDark ? "#2a2010" : "#c9963a",
        cursor: "pointer",
        transition: "background 0.3s ease",
        flexShrink: 0,
        outline: "none",
      }}
    >
      <motion.div
        style={{
          position: "absolute",
          top: 3,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: isDark ? "#c9963a" : "#fff8ee",
        }}
        animate={{ left: isDark ? 3 : 23 }}
        transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
      />
    </button>
  );
}

// ─── Bell Icon ─────────────────────────────────────────────────────────────────
function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ color: "var(--text-secondary)" }}>
      <path
        d="M9 1.5C6.515 1.5 4.5 3.515 4.5 6v4.5L3 12h12l-1.5-1.5V6c0-2.485-2.015-4.5-4.5-4.5z"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
      />
      <path d="M7.5 12v.5a1.5 1.5 0 003 0V12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// ─── Moon Icon ─────────────────────────────────────────────────────────────────
function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: "var(--text-secondary)" }}>
      <path
        d="M13.5 10.5A6 6 0 015.5 2.5a6 6 0 008 8z"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Navbar ────────────────────────────────────────────────────────────────────
function Navbar({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const isDark = theme === "dark";

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <nav
      suppressHydrationWarning
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0,
        zIndex: 100,
        height: 52,
        display: "flex",
        alignItems: "center",
        padding: "0 28px",
        background: scrolled
          ? isDark ? "rgba(8,8,8,0.92)" : "rgba(240,240,240,0.94)"
          : isDark ? "rgba(8,8,8,0.6)" : "rgba(240,240,240,0.7)",
        backdropFilter: "blur(14px)",
        borderBottom: `1px solid ${scrolled ? "var(--border-card)" : "transparent"}`,
        transition: "background 0.3s ease, border-color 0.3s ease",
      }}
    >
      {/* Logo */}
      <div style={{ fontWeight: 800, fontSize: "0.82rem", letterSpacing: "0.04em", color: "var(--text-primary)", marginRight: "auto", userSelect: "none" }}>
        YIELD<span style={{ color: "var(--text-secondary)" }}>//</span>INTELLIGENCE
      </div>

      {/* Nav links */}
      <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
        {["Overview", "Defects", "Root Causes", "Predictions", "Analytics"].map((l) => (
          <a
            key={l}
            href={`#${l.toLowerCase().replace(" ", "-")}`}
            style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none", transition: "color 0.18s", whiteSpace: "nowrap" }}
            onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "var(--text-primary)")}
            onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "var(--text-secondary)")}
            className="hidden md:block"
          >
            {l}
          </a>
        ))}
      </div>

      {/* Right controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginLeft: 32 }}>
        <BellIcon />
        <ThemeToggle theme={theme} onToggle={onToggle} />
        <MoonIcon />
        <a
          href="/dashboard"
          style={{
            background: "var(--gold)",
            color: "#09090b",
            borderRadius: 6,
            fontSize: "0.72rem",
            fontWeight: 700,
            padding: "6px 16px",
            cursor: "pointer",
            whiteSpace: "nowrap",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            transition: "opacity 0.18s",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.82")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
        >
          Launch Analyzer →
        </a>
      </div>
    </nav>
  );
}

// ─── Hero (scroll-scrubbed canvas) ────────────────────────────────────────────
function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgs = useRef<HTMLImageElement[]>([]);
  const rafRef = useRef<number>(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });
  const textOpacity = useTransform(scrollYProgress, [0, 0.18], [1, 0]);
  const textY = useTransform(scrollYProgress, [0, 0.18], [0, -36]);

  const drawFrame = useCallback((idx: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = imgs.current[idx - 1];
    if (!img?.complete) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    const iAR = img.naturalWidth / img.naturalHeight;
    const cAR = width / height;
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
    if (iAR > cAR) { sw = img.naturalHeight * cAR; sx = (img.naturalWidth - sw) / 2; }
    else { sh = img.naturalWidth / cAR; sy = (img.naturalHeight - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const load = (i: number): Promise<void> => new Promise((res) => {
      const img = new Image();
      img.src = `/frames/frame-${String(i).padStart(4, "0")}.jpg`;
      img.onload = () => { imgs.current[i - 1] = img; res(); };
      img.onerror = () => res();
    });
    Promise.all(Array.from({ length: 30 }, (_, i) => load(i + 1))).then(() => drawFrame(1));
    let fi = 31;
    const next = () => {
      if (fi > 240) return;
      load(fi++).then(() => {
        if ("requestIdleCallback" in window) (window as any).requestIdleCallback(next);
        else setTimeout(next, 16);
      });
    };
    if ("requestIdleCallback" in window) (window as any).requestIdleCallback(next);
    else setTimeout(next, 16);
  }, [drawFrame]);

  useEffect(() => {
    const unsub = scrollYProgress.on("change", (v) => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        drawFrame(Math.min(Math.max(Math.round(v * 239) + 1, 1), 240));
      });
    });
    return () => { unsub(); cancelAnimationFrame(rafRef.current); };
  }, [scrollYProgress, drawFrame]);

  return (
    <div ref={containerRef} style={{ height: "420vh", position: "relative" }}>
      <div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden" }}>
        <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(8,8,8,0.25) 0%, rgba(8,8,8,0.05) 30%, rgba(8,8,8,0.65) 80%, rgba(8,8,8,1) 100%)" }} />
        <motion.div style={{ position: "absolute", left: "clamp(28px,5vw,72px)", bottom: "clamp(72px,13vh,150px)", opacity: textOpacity, y: textY }}>
          <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.4, ease: EASE }}>
            <h1 style={{ fontSize: "clamp(2.4rem,5.5vw,4.2rem)", fontWeight: 900, letterSpacing: "-0.035em", lineHeight: 1.08, color: "var(--text-primary)", maxWidth: 560 }}>
              Find the failure.<br />
              <span style={{ color: "var(--gold)" }}>Before it costs</span><br />
              millions.
            </h1>
            <p style={{ marginTop: 18, fontSize: "0.88rem", color: "var(--text-secondary)", maxWidth: 400, lineHeight: 1.65 }}>
              AI-powered semiconductor yield intelligence that pinpoints root causes before defects propagate across your fab.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 26, flexWrap: "wrap" }}>
              <a href="/dashboard" style={{ background: "var(--gold)", color: "#080808", borderRadius: 6, fontSize: "0.72rem", fontWeight: 700, padding: "10px 22px", textDecoration: "none", display: "inline-block", transition: "opacity 0.18s" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = "0.82")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = "1")}>
                Launch Analyzer →
              </a>
              <button style={{ background: "transparent", color: "var(--text-secondary)", borderRadius: 6, fontSize: "0.72rem", fontWeight: 500, padding: "10px 20px", border: "1px solid var(--border-card)", cursor: "pointer", transition: "color 0.18s" }}>
                See How It Works ↓
              </button>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Problem Section (Overview) ───────────────────────────────────────────────
function ProblemSection() {
  return (
    <section id="overview" style={{ background: "var(--bg-base)", padding: "clamp(64px,9vw,110px) clamp(28px,5vw,72px)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Eyebrow */}
        <motion.div {...fadeUp()}>
          <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 18 }}>
            The Industry Problem
          </div>

          {/* Big heading */}
          <h2 style={{ fontSize: "clamp(2.8rem,5.5vw,5rem)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.05, color: "var(--text-primary)", marginBottom: 20, maxWidth: 720 }}>
            A 1% yield drop isn't<br />a small{" "}
            <span style={{ color: "var(--gold)" }}>problem.</span>
          </h2>

          <p style={{ fontSize: "0.88rem", lineHeight: 1.7, color: "var(--text-secondary)", maxWidth: 480, marginBottom: 52 }}>
            At advanced 3nm/5nm nodes, yield analysis spans hundreds of correlated variables. Manual investigation is too slow and too fragmented.
          </p>
        </motion.div>

        {/* Two column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr clamp(260px,30vw,340px)", gap: 24, alignItems: "start" }}>

          {/* Left — data source rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {DATA_SOURCES.map((ds, i) => (
              <motion.div
                key={ds.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.65, delay: i * 0.09, ease: EASE }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 16px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-card)",
                  borderRadius: 10,
                }}
              >
                {/* Icon box */}
                <div style={{
                  width: 34, height: 34, borderRadius: 8, background: "var(--bg-icon)",
                  border: "1px solid var(--border)", display: "flex", alignItems: "center",
                  justifyContent: "center", color: "var(--gold)", flexShrink: 0,
                }}>
                  {ds.icon}
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>{ds.title}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: 2 }}>{ds.sub}</div>
                </div>

                {/* Three gold dots */}
                <ThreeDots />
              </motion.div>
            ))}
          </div>

          {/* Right — 1% metric + stat cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* 1% hero card */}
            <motion.div
              {...fadeUp(0.15)}
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-card)",
                borderRadius: 12,
                padding: "36px 28px 28px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "clamp(4.5rem,9vw,6.5rem)", fontWeight: 900, color: "var(--gold)", letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 8 }}>
                1%
              </div>
              <div style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 14 }}>
                Yield Loss
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--gold)", fontWeight: 500, lineHeight: 1.45 }}>
                Millions in potential<br />monthly revenue impact
              </div>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 8 }}>
                (Illustrative estimate)
              </div>
            </motion.div>

            {/* 2×2 stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {STAT_CARDS.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, scale: 0.93 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.55, delay: 0.2 + i * 0.08, ease: EASE }}
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-card)",
                    borderRadius: 10,
                    padding: "18px 16px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1 }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)", marginTop: 5 }}>
                    {s.label}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Intelligence Pipeline Section ───────────────────────────────────────────
const PIPELINE_STEPS = [
  { id: "01", title: "Detect", desc: "Find abnormal wafer and defect patterns across spatial, temporal, and equipment dimensions." },
  { id: "02", title: "Correlate", desc: "Connect detected defects with equipment sensor readings and process parameter deviations." },
  { id: "03", title: "Rank", desc: "Calculate and rank probable root causes by statistical confidence and correlation strength." },
  { id: "04", title: "Recommend", desc: "Suggest targeted corrective actions — parameter adjustments, chamber cleans, calibration." },
  { id: "05", title: "Predict", desc: "Flag upcoming wafer batches at statistical risk before they enter the chamber." },
];

function PipelineSection() {
  return (
    <section
      id="pipeline"
      style={{
        background: "var(--bg-base)",
        borderTop: "1px solid var(--border)",
        padding: "clamp(64px,9vw,110px) clamp(28px,5vw,72px)",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <motion.div {...fadeUp()}>
          <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 20 }}>
            Intelligence Pipeline
          </div>
          <h2 style={{ fontSize: "clamp(3rem,6vw,5.2rem)", fontWeight: 900, letterSpacing: "-0.035em", lineHeight: 1.04, marginBottom: 52, maxWidth: 680 }}>
            From data to root{" "}
            <br />
            <span style={{ color: "var(--gold)" }}>cause.</span>
          </h2>
        </motion.div>

        {/* Pipeline container — single bordered card */}
        <motion.div
          {...fadeUp(0.1)}
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            borderRadius: 14,
          }}
        >
          {PIPELINE_STEPS.map((step, i) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: EASE }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                padding: "22px 28px",
                borderBottom: i < PIPELINE_STEPS.length - 1 ? "1px solid var(--border)" : "none",
                borderRadius: i === 0 ? "14px 14px 0 0" : i === PIPELINE_STEPS.length - 1 ? "0 0 14px 14px" : 0,
              }}
            >
              {/* Number badge */}
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "var(--bg-icon)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: "0.65rem", fontWeight: 800, color: "var(--gold)", letterSpacing: "0.04em" }}>
                  {step.id}
                </span>
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--gold)", marginBottom: 4 }}>
                  {step.title}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.55 }}>
                  {step.desc}
                </div>
              </div>

              {/* Three animated gold dots */}
              <ThreeDots />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ─── Wafer Map ────────────────────────────────────────────────────────────────
function generateDefectPoints(patternId: string) {
  const rng = makePRNG(0xab1234cd);
  const pIdx = ["edge", "center", "scratch", "random", "local", "repeat"].indexOf(patternId);
  for (let i = 0; i < pIdx * 50; i++) rng();
  const cx = 140, cy = 140, r = 128;
  const pts: { x: number; y: number }[] = [];
  if (patternId === "edge") {
    for (let i = 0; i < 28; i++) { const a = rng() * Math.PI * 2, d = 110 + rng() * 18, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d; if (Math.hypot(x - cx, y - cy) < r) pts.push({ x, y }); }
  } else if (patternId === "center") {
    for (let i = 0; i < 20; i++) { const a = rng() * Math.PI * 2, d = rng() * 35; pts.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d }); }
  } else if (patternId === "scratch") {
    const a = rng() * Math.PI;
    for (let i = 0; i < 18; i++) { const t = (i / 17) * 240 - 120; pts.push({ x: cx + Math.cos(a) * t + (rng() - 0.5) * 6, y: cy + Math.sin(a) * t + (rng() - 0.5) * 6 }); }
  } else if (patternId === "random") {
    for (let i = 0; i < 40; i++) { const x = cx + (rng() - 0.5) * 240, y = cy + (rng() - 0.5) * 240; if (Math.hypot(x - cx, y - cy) < r) pts.push({ x, y }); }
  } else if (patternId === "local") {
    const lx = cx + (rng() - 0.5) * 80, ly = cy + (rng() - 0.5) * 80;
    for (let i = 0; i < 22; i++) { const a = rng() * Math.PI * 2, d = rng() * 28, x = lx + Math.cos(a) * d, y = ly + Math.sin(a) * d; if (Math.hypot(x - cx, y - cy) < r) pts.push({ x, y }); }
  } else {
    for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) { if (rng() > 0.45) { const x = cx - 80 + col * 40 + (rng() - 0.5) * 8, y = cy - 80 + row * 40 + (rng() - 0.5) * 8; if (Math.hypot(x - cx, y - cy) < r) pts.push({ x, y }); } }
  }
  return pts;
}

function WaferMap({ patternId }: { patternId: string }) {
  const pts = generateDefectPoints(patternId);
  const cx = 140, cy = 140;

  // Grid cells clipped inside wafer circle
  const gridCells: { x: number; y: number }[] = [];
  for (let row = 0; row < 34; row++) for (let col = 0; col < 34; col++) {
    const x = col * 8 + 3, y = row * 8 + 3;
    if (Math.hypot(x + 4 - cx, y + 4 - cy) < 127) gridCells.push({ x, y });
  }

  return (
    <svg viewBox="0 0 280 280" style={{ width: "100%", height: "100%", display: "block" }}>
      <defs>
        {/* Navy blue radial fill — dark center brightening outward */}
        <radialGradient id="waferFill" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#0d1a2e" />
          <stop offset="60%"  stopColor="#102030" />
          <stop offset="100%" stopColor="#162840" />
        </radialGradient>
        {/* Subtle warm glow from centre */}
        <radialGradient id="waferGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(201,150,58,0.08)" />
          <stop offset="55%"  stopColor="rgba(201,150,58,0.02)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        <clipPath id="wc"><circle cx={cx} cy={cy} r={128} /></clipPath>
      </defs>

      {/* Outer gold ring */}
      <circle cx={cx} cy={cy} r={131} fill="none" stroke="#c9963a" strokeWidth={2} />

      {/* Navy fill */}
      <circle cx={cx} cy={cy} r={129} fill="url(#waferFill)" />
      <circle cx={cx} cy={cy} r={129} fill="url(#waferGlow)" />

      {/* Blue-tinted grid cells */}
      <g clipPath="url(#wc)">
        {gridCells.map((c, i) => (
          <rect key={i} x={c.x} y={c.y} width={7} height={7}
            fill="rgba(80,140,200,0.07)" stroke="rgba(80,140,200,0.12)" strokeWidth={0.4} />
        ))}
      </g>

      {/* Concentric rings — visible white/grey */}
      {[100, 76, 50, 26].map((r) => (
        <circle key={r} cx={cx} cy={cy} r={r} stroke="rgba(255,255,255,0.18)" strokeWidth={0.8} fill="none" />
      ))}

      {/* Defect dots */}
      <AnimatePresence mode="wait">
        <motion.g key={patternId}>
          {pts.map((p, i) => (
            <motion.circle key={i} cx={p.x} cy={p.y} r={4.5} fill="#e03030"
              filter="url(#dotGlow)"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.35, delay: i * 0.014, type: "spring", stiffness: 260, damping: 18 }}
              style={{ originX: `${p.x}px`, originY: `${p.y}px` }} />
          ))}
        </motion.g>
      </AnimatePresence>

      {/* Red glow filter for dots */}
      <defs>
        <filter id="dotGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
    </svg>
  );
}

// ─── Defects Section ──────────────────────────────────────────────────────────
function DefectsSection() {
  const [active, setActive] = useState("edge");
  const pat = PATTERNS.find((p) => p.id === active)!;

  // Map correlation to a readable tool name
  const TOOL_NAMES: Record<string, string> = {
    "Etch Temp": "Etch Chamber Temperature",
    "Deposition": "CVD Deposition Tool",
    "Robot Handling": "Wafer Robot Handler",
    "Particle Count": "Particle Counter",
    "Litho Focus": "Lithography Scanner",
    "Reticle Flaw": "Reticle Inspection System",
  };

  return (
    <section id="defects" style={{ background: "var(--bg-surface)", borderTop: "1px solid var(--border)", padding: "clamp(64px,9vw,110px) clamp(28px,5vw,72px)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Heading */}
        <motion.div {...fadeUp()}>
          <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 14 }}>Pattern Recognition</div>
          <h2 style={{ fontSize: "clamp(2rem,4vw,2.8rem)", fontWeight: 900, letterSpacing: "-0.025em", lineHeight: 1.1, marginBottom: 12 }}>
            See what others <span style={{ color: "var(--gold)" }}>miss.</span>
          </h2>
          <p style={{ fontSize: "0.82rem", lineHeight: 1.65, color: "var(--text-secondary)", maxWidth: 460, marginBottom: 40 }}>
            Our wafer map classification engine identifies 40+ defect signatures and maps them directly to equipment parameters.
          </p>
        </motion.div>

        {/* Two-column layout: wafer left, controls right */}
        <div style={{ display: "grid", gridTemplateColumns: "clamp(260px,28vw,320px) 1fr", gap: 24, alignItems: "start" }}>

          {/* ── LEFT: Wafer map ── */}
          <motion.div {...fadeUp(0.08)}>
            <div style={{
              background: "#080e18",
              border: "1px solid rgba(201,150,58,0.25)",
              borderRadius: 16,
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}>
              {/* SVG wafer */}
              <div style={{ aspectRatio: "1/1", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <WaferMap patternId={active} />
              </div>

              {/* Mini info strip */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={active + "-mini"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#f0f0f0" }}>{pat.label}</div>
                    <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{pat.confidence}% confidence</div>
                  </div>
                  <div style={{
                    background: "rgba(201,150,58,0.15)",
                    border: "1px solid #c9963a",
                    color: "#c9963a",
                    fontSize: "0.55rem",
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    padding: "4px 9px",
                    borderRadius: 5,
                  }}>
                    Active
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>

          {/* ── RIGHT: pattern grid + detail panel ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* 2×3 pattern selection grid */}
            <motion.div
              {...fadeUp(0.1)}
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
            >
              {PATTERNS.map((p, i) => (
                <motion.button
                  key={p.id}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.5, delay: i * 0.07, ease: EASE }}
                  onClick={() => setActive(p.id)}
                  style={{
                    background: "var(--bg-card)",
                    border: `1px solid ${active === p.id ? "var(--gold)" : "var(--border-card)"}`,
                    borderRadius: 12,
                    padding: "16px 16px 14px",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "border-color 0.18s",
                    outline: "none",
                  }}
                >
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
                    {p.label}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>{p.confidence}%</span>
                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{p.lots} lots</span>
                  </div>
                </motion.button>
              ))}
            </motion.div>

            {/* Pattern Match detail panel */}
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3, ease: EASE }}
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-card)",
                  borderRadius: 16,
                  padding: "20px 20px 18px",
                }}
              >
                {/* Header row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 5 }}>
                      Pattern Match
                    </div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                      {pat.label}
                    </div>
                  </div>
                  <div style={{
                    background: "var(--gold-muted)",
                    border: "1px solid var(--gold)",
                    color: "var(--gold)",
                    fontSize: "0.55rem",
                    fontWeight: 800,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    padding: "4px 10px",
                    borderRadius: 6,
                    marginTop: 2,
                    flexShrink: 0,
                  }}>
                    Active
                  </div>
                </div>

                {/* Two stat cards */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                  <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1 }}>
                      {pat.confidence}%
                    </div>
                    <div style={{ fontSize: "0.62rem", color: "var(--text-secondary)", marginTop: 5 }}>Confidence</div>
                  </div>
                  <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1 }}>
                      {pat.lots}
                    </div>
                    <div style={{ fontSize: "0.62rem", color: "var(--text-secondary)", marginTop: 5 }}>Affected Lots</div>
                  </div>
                </div>

                {/* Top correlated tool */}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                  <div style={{ fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 5 }}>
                    Top Correlated Tool
                  </div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>
                    {TOOL_NAMES[pat.correlation] ?? pat.correlation}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                    Correlation: <span style={{ color: "var(--gold)" }}>{pat.correlation}</span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

          </div>{/* end right column */}
        </div>{/* end two-col grid */}
      </div>
    </section>
  );
}

// ─── Root Causes Section ──────────────────────────────────────────────────────
function RootCausesSection() {
  return (
    <section id="root-causes" style={{ background: "var(--bg-base)", borderTop: "1px solid var(--border)", padding: "clamp(64px,9vw,110px) clamp(28px,5vw,72px)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <motion.div {...fadeUp()}>
          <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 14 }}>AI Correlation Engine</div>
          <h2 style={{ fontSize: "clamp(2rem,4vw,2.8rem)", fontWeight: 900, letterSpacing: "-0.025em", lineHeight: 1.1, marginBottom: 12 }}>
            Probable Root <span style={{ color: "var(--gold)" }}>Causes</span>
          </h2>
          <p style={{ fontSize: "0.82rem", lineHeight: 1.65, color: "var(--text-secondary)", maxWidth: 460, marginBottom: 40 }}>
            Bayesian probability scores ranked by historical correlation with your current defect signature cluster.
          </p>
        </motion.div>
        <div style={{ maxWidth: 660 }}>
          {ROOT_CAUSES.map((rc, i) => (
            <motion.div key={rc.label}
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.65, delay: i * 0.09, ease: EASE }}
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: 9, padding: "14px 16px", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-primary)" }}>{rc.label}</span>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: rc.color, minWidth: 34, textAlign: "right" }}>{rc.prob}%</span>
              </div>
              <div style={{ height: 6, background: "var(--bg-base)", borderRadius: 3, overflow: "hidden" }}>
                <motion.div initial={{ width: 0 }} whileInView={{ width: `${rc.prob}%` }} viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 1.2, ease: EASE, delay: i * 0.07 }}
                  style={{ height: "100%", background: rc.color, borderRadius: 3 }} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pulsing dot ──────────────────────────────────────────────────────────────
function PulsingDot({ color }: { color: string }) {
  return (
    <div style={{ position: "relative", width: 10, height: 10, flexShrink: 0 }}>
      <motion.div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color }}
        animate={{ scale: [1, 2.8], opacity: [0.6, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }} />
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, position: "relative" }} />
    </div>
  );
}

// ─── Predictions Section ──────────────────────────────────────────────────────
function PredictionsSection() {
  const cfg = { critical: { color: "#d4433a", label: "Critical", bg: "rgba(212,67,58,0.09)" }, warning: { color: "#c97a2a", label: "Warning", bg: "rgba(201,122,42,0.09)" }, good: { color: "#3a8a5a", label: "Good", bg: "rgba(58,138,90,0.09)" } };
  return (
    <section id="predictions" style={{ background: "var(--bg-surface)", borderTop: "1px solid var(--border)", padding: "clamp(64px,9vw,110px) clamp(28px,5vw,72px)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <motion.div {...fadeUp()}>
          <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 14 }}>Predictive Risk Engine</div>
          <h2 style={{ fontSize: "clamp(2rem,4vw,2.8rem)", fontWeight: 900, letterSpacing: "-0.025em", lineHeight: 1.1, marginBottom: 12 }}>
            Before the next <span style={{ color: "var(--gold)" }}>batch</span> runs.
          </h2>
          <p style={{ fontSize: "0.82rem", lineHeight: 1.65, color: "var(--text-secondary)", maxWidth: 460, marginBottom: 40 }}>
            Real-time risk scoring on every active lot. Intercept failures before the next critical process step.
          </p>
        </motion.div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          {LOTS.map((lot, i) => {
            const c = cfg[lot.status];
            return (
              <motion.div key={lot.id}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.65, delay: i * 0.09, ease: EASE }}
                style={{ background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: 11, padding: "20px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)" }}>{lot.id}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <PulsingDot color={c.color} />
                    <span style={{ fontSize: "0.58rem", fontWeight: 700, color: c.color, background: c.bg, padding: "2px 7px", borderRadius: 4 }}>{c.label}</span>
                  </div>
                </div>
                <div style={{ fontSize: "2rem", fontWeight: 900, color: c.color, letterSpacing: "-0.02em", lineHeight: 1, marginBottom: 4 }}>{lot.risk}%</div>
                <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", marginBottom: 10 }}>Risk Score</div>
                <div style={{ height: 4, background: "var(--bg-base)", borderRadius: 2, overflow: "hidden" }}>
                  <motion.div initial={{ width: 0 }} whileInView={{ width: `${lot.risk}%` }} viewport={{ once: true }}
                    transition={{ duration: 1.2, ease: EASE, delay: i * 0.1 }}
                    style={{ height: "100%", background: c.color, borderRadius: 2 }} />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Sparkline path helper ────────────────────────────────────────────────────
function sparkPath(data: number[], w = 300, h = 72): string {
  const mn = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - mn) / rng) * (h - 10) - 5}`);
  return "M " + pts.join(" L ");
}

// ─── Analytics Section ────────────────────────────────────────────────────────
const YIELD_DATA = [78, 80, 77, 82, 85, 83, 87, 86, 90, 89, 91, 94];
const EQ_HEALTH = [
  { name: "Etch Chamber A", v: 92, color: "#3a8a5a" },
  { name: "CMP Tool 3", v: 78, color: "#c97a2a" },
  { name: "Litho Scanner 2", v: 65, color: "#c97a2a" },
  { name: "Deposition CVD1", v: 88, color: "#3a8a5a" },
  { name: "Robot Handler 4", v: 43, color: "#d4433a" },
];

function AnalyticsSection() {
  const yPath = sparkPath(YIELD_DATA, 320, 80);
  return (
    <section id="analytics" style={{ background: "var(--bg-base)", borderTop: "1px solid var(--border)", padding: "clamp(64px,9vw,110px) clamp(28px,5vw,72px)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <motion.div {...fadeUp()}>
          <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 14 }}>Analytics</div>
          <h2 style={{ fontSize: "clamp(2rem,4vw,2.8rem)", fontWeight: 900, letterSpacing: "-0.025em", lineHeight: 1.1, marginBottom: 40 }}>
            Intelligence at a <span style={{ color: "var(--gold)" }}>glance.</span>
          </h2>
        </motion.div>

        {/* KPI row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
          {KPI_CARDS.map((k, i) => (
            <motion.div key={k.label}
              initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, delay: i * 0.07, ease: EASE }}
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: 10, padding: "16px 15px" }}>
              <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", marginBottom: 6 }}>{k.label}</div>
              <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: "0.62rem", fontWeight: 600, color: k.up ? "#3a8a5a" : "#d4433a", marginTop: 5 }}>{k.delta}</div>
            </motion.div>
          ))}
        </div>

        {/* Charts row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <motion.div {...fadeUp(0.1)} style={{ background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: 11, padding: "18px 16px" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>Yield Trend</div>
            <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", marginBottom: 12 }}>12-month rolling average</div>
            <svg viewBox="0 0 320 80" style={{ width: "100%", height: 80 }}>
              <motion.path d={yPath} fill="none" stroke="var(--gold)" strokeWidth={2}
                initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }}
                transition={{ duration: 1.4, ease: "easeInOut" }} />
            </svg>
          </motion.div>
          <motion.div {...fadeUp(0.15)} style={{ background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: 11, padding: "18px 16px" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>Equipment Health</div>
            <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", marginBottom: 14 }}>Current status by tool</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {EQ_HEALTH.map((eq, i) => (
                <div key={eq.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>{eq.name}</span>
                    <span style={{ fontSize: "0.65rem", fontWeight: 700, color: eq.color }}>{eq.v}%</span>
                  </div>
                  <div style={{ height: 4, background: "var(--bg-base)", borderRadius: 2, overflow: "hidden" }}>
                    <motion.div initial={{ width: 0 }} whileInView={{ width: `${eq.v}%` }} viewport={{ once: true }}
                      transition={{ duration: 1.1, delay: i * 0.09, ease: EASE }}
                      style={{ height: "100%", background: eq.color, borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── Recommendation Section ───────────────────────────────────────────────────
const STEPS = [
  { n: 1, label: "What failed?" },
  { n: 2, label: "Why did it fail?" },
  { n: 3, label: "What should change?", tag: "← What should change?" },
];

function RecommendationSection() {
  const [activeStep, setActiveStep] = useState(3);

  return (
    <section
      style={{
        background: "var(--bg-base)",
        borderTop: "1px solid var(--border)",
        padding: "clamp(64px,9vw,110px) clamp(28px,5vw,72px)",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "clamp(32px,5vw,72px)", alignItems: "center" }}>

          {/* ── LEFT ── */}
          <motion.div {...fadeUp()}>
            {/* Eyebrow */}
            <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 20 }}>
              AI Recommendation Engine
            </div>

            {/* Heading */}
            <h2 style={{ fontSize: "clamp(2.4rem,4.5vw,3.6rem)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.06, marginBottom: 22 }}>
              Not just what<br />
              failed —{" "}
              <span style={{ color: "var(--gold)" }}>what to<br />fix.</span>
            </h2>

            {/* Body */}
            <p style={{ fontSize: "0.85rem", lineHeight: 1.7, color: "var(--text-secondary)", marginBottom: 36, maxWidth: 360 }}>
              Every anomaly call is paired with a precise corrective action, an expected yield impact, and a measured outcome trace.
            </p>

            {/* 3 steps */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {STEPS.map((s, i) => {
                const isActive = activeStep === s.n;
                return (
                  <motion.button
                    key={s.n}
                    initial={{ opacity: 0, x: -14 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.55, delay: i * 0.1, ease: EASE }}
                    onClick={() => setActiveStep(s.n)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "13px 16px",
                      background: isActive ? "var(--gold-muted)" : "var(--bg-card)",
                      border: `1px solid ${isActive ? "var(--gold)" : "var(--border-card)"}`,
                      borderRadius: 10,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.2s",
                      outline: "none",
                    }}
                  >
                    {/* Number badge */}
                    <div style={{
                      width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                      background: isActive ? "var(--gold)" : "var(--bg-icon)",
                      border: `1px solid ${isActive ? "var(--gold)" : "var(--border)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{ fontSize: "0.6rem", fontWeight: 800, color: isActive ? "#080808" : "var(--text-secondary)" }}>
                        {s.n}
                      </span>
                    </div>

                    {/* Label */}
                    <span style={{ fontSize: "0.82rem", fontWeight: isActive ? 700 : 500, color: isActive ? "var(--text-primary)" : "var(--text-secondary)", flex: 1 }}>
                      {s.label}
                    </span>

                    {/* Tag shown when active */}
                    {isActive && s.tag && (
                      <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--gold)" }}>
                        {s.tag}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* ── RIGHT: Recommendation card ── */}
          <motion.div {...fadeUp(0.15)}>
            <div style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-card)",
              borderRadius: 16,
              padding: "22px 22px 18px",
            }}>
              {/* Card header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 6 }}>
                    Recommended Corrective Action
                  </div>
                  <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.01em", lineHeight: 1.25 }}>
                    Reduce Etch Chamber Temperature
                  </div>
                </div>
                {/* Apply button */}
                <button style={{
                  background: "rgba(58,138,90,0.15)",
                  border: "1px solid #3a8a5a",
                  color: "#3a8a5a",
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  padding: "5px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  marginLeft: 12,
                  marginTop: 2,
                  transition: "background 0.18s",
                }}
                  onMouseEnter={(e) => ((e.currentTarget).style.background = "rgba(58,138,90,0.28)")}
                  onMouseLeave={(e) => ((e.currentTarget).style.background = "rgba(58,138,90,0.15)")}
                >
                  Apply →
                </button>
              </div>

              {/* 2×2 stat grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                {/* Current temp — red */}
                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 16px" }}>
                  <div style={{ fontSize: "1.9rem", fontWeight: 900, color: "#d4433a", letterSpacing: "-0.03em", lineHeight: 1 }}>
                    472°C
                  </div>
                  <div style={{ fontSize: "0.62rem", color: "var(--text-secondary)", marginTop: 5 }}>Current</div>
                </div>

                {/* Target range — green */}
                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 16px" }}>
                  <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#3a8a5a", letterSpacing: "-0.02em", lineHeight: 1 }}>
                    465–468°C
                  </div>
                  <div style={{ fontSize: "0.62rem", color: "var(--text-secondary)", marginTop: 5 }}>Target range</div>
                </div>

                {/* Yield gain — green */}
                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 16px" }}>
                  <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#3a8a5a", letterSpacing: "-0.02em", lineHeight: 1 }}>
                    +2.8–4.1%
                  </div>
                  <div style={{ fontSize: "0.62rem", color: "var(--text-secondary)", marginTop: 5 }}>Expected yield gain</div>
                </div>

                {/* Confidence */}
                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 16px" }}>
                  <div style={{ fontSize: "1.9rem", fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1 }}>
                    89%
                  </div>
                  <div style={{ fontSize: "0.62rem", color: "var(--text-secondary)", marginTop: 5 }}>Confidence</div>
                </div>
              </div>

              {/* Why link */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                <button style={{
                  background: "none", border: "none", padding: 0, cursor: "pointer",
                  fontSize: "0.72rem", fontWeight: 600, color: "var(--gold)",
                  display: "flex", alignItems: "center", gap: 4,
                  transition: "opacity 0.18s",
                }}
                  onMouseEnter={(e) => ((e.currentTarget).style.opacity = "0.7")}
                  onMouseLeave={(e) => ((e.currentTarget).style.opacity = "1")}
                >
                  ↓ Why this recommendation?
                </button>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}

// ─── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--border)", background: "var(--bg-base)", padding: "clamp(36px,5vw,56px) clamp(28px,5vw,72px)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: 32, justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ maxWidth: 220 }}>
          <div style={{ fontWeight: 800, fontSize: "0.82rem", letterSpacing: "0.04em", color: "var(--text-primary)", marginBottom: 10 }}>
            YIELD<span style={{ color: "var(--text-secondary)" }}>//</span>INTELLIGENCE
          </div>
          <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)", lineHeight: 1.65 }}>
            Semiconductor yield intelligence powered by AI. Find failures before they cost millions.
          </p>
        </div>
        {[
          { h: "Product", links: ["Platform", "Integrations", "Changelog", "Pricing"] },
          { h: "Company", links: ["About", "Blog", "Careers", "Press"] },
          { h: "Support", links: ["Docs", "API Reference", "Status", "Contact"] },
        ].map((col) => (
          <div key={col.h}>
            <div style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>{col.h}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {col.links.map((l) => (
                <a key={l} href="#" style={{ fontSize: "0.7rem", color: "var(--text-secondary)", textDecoration: "none", transition: "color 0.18s" }}
                  onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "var(--text-primary)")}
                  onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "var(--text-secondary)")}>{l}</a>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ maxWidth: 1100, margin: "28px auto 0", paddingTop: 20, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>© 2026 YieldIQ, Inc. All rights reserved.</span>
        <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>Privacy · Terms · Security</span>
      </div>
    </footer>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [theme, mounted]);

  // Render a shell with no theme-dependent content until client has mounted.
  // This guarantees SSR output matches the initial client render (avoids hydration mismatch).
  if (!mounted) {
    return (
      <div style={{ background: "#080808", color: "#f0f0f0", minHeight: "100vh" }} />
    );
  }

  return (
    <div style={{ background: "var(--bg-base)", color: "var(--text-primary)", minHeight: "100vh", transition: "background 0.35s ease, color 0.35s ease" }}>
      <Navbar theme={theme} onToggle={() => setTheme((t) => t === "dark" ? "light" : "dark")} />
      <HeroSection />
      <ProblemSection />
      <PipelineSection />
      <DefectsSection />
      <RootCausesSection />
      <PredictionsSection />
      <RecommendationSection />
      <AnalyticsSection />
      <Footer />
    </div>
  );
}
