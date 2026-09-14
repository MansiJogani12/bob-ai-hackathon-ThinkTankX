"use client";
import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════
   SHARED PRIMITIVES
═══════════════════════════════════════════════════ */

// ── Chip / Badge ──
export function Chip({ label, color = "#d4af37" }: { label: string; color?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px",
      borderRadius: 3, border: `1px solid ${color}33`, background: `${color}14`,
      fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", fontWeight: 600,
      color, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
      {label}
    </span>
  );
}

// ── Section label ──
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", fontWeight: 600,
      letterSpacing: "0.2em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const,
      marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 16, height: 1, background: "rgba(255,255,255,0.15)", display: "inline-block" }} />
      {children}
    </div>
  );
}

// ── Card ──
export function Card({ children, style, glow }: { children: React.ReactNode; style?: React.CSSProperties; glow?: string }) {
  return (
    <div style={{
      background: "#0f0f12",
      border: `1px solid ${glow ? glow + "33" : "rgba(255,255,255,0.08)"}`,
      borderRadius: 6,
      boxShadow: glow ? `0 0 20px ${glow}0d` : undefined,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── KPI Card ──
export function KPICard({ label, value, delta, deltaUp, unit, mono = true }:
  { label: string; value: string | number; delta?: string; deltaUp?: boolean; unit?: string; mono?: boolean }) {
  return (
    <Card style={{ padding: "14px 16px" }}>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.52rem", letterSpacing: "0.18em",
        color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
        <span style={{
          fontFamily: mono ? "'JetBrains Mono',monospace" : undefined,
          fontSize: "1.7rem", fontWeight: 700, color: "#f4f4f5", lineHeight: 1, letterSpacing: "-0.02em",
        }}>{value}</span>
        {unit && <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.65rem",
          color: "rgba(255,255,255,0.4)", marginBottom: 3 }}>{unit}</span>}
      </div>
      {delta && (
        <div style={{ marginTop: 6, fontFamily: "'JetBrains Mono',monospace", fontSize: "0.58rem",
          color: deltaUp ? "#10b981" : "#ef4444", display: "flex", alignItems: "center", gap: 4 }}>
          <span>{deltaUp ? "▲" : "▼"}</span>{delta}
        </div>
      )}
    </Card>
  );
}

// ── Progress Bar ──
export function ProgressBar({ value, max = 100, color = "#d4af37", height = 4, animate: doAnim = true }:
  { value: number; max?: number; color?: string; height?: number; animate?: boolean }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ height, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
      <motion.div
        initial={doAnim ? { width: 0 } : undefined}
        whileInView={doAnim ? { width: `${pct}%` } : undefined}
        animate={doAnim ? undefined : { width: `${pct}%` }}
        viewport={{ once: true }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        style={{ height: "100%", background: color, borderRadius: 2,
          boxShadow: `0 0 6px ${color}66` }} />
    </div>
  );
}

// ── Slider Input ──
export function SliderInput({ label, value, min, max, step = 1, unit = "", onChange, warn, danger }:
  { label: string; value: number; min: number; max: number; step?: number; unit?: string;
    onChange: (v: number) => void; warn?: number; danger?: number }) {
  const pct = ((value - min) / (max - min)) * 100;
  const color = danger && value > danger ? "#ef4444" : warn && value > warn ? "#f59e0b" : "#10b981";
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem",
          color: "rgba(255,255,255,0.5)", letterSpacing: "0.06em" }}>{label}</span>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.72rem",
          fontWeight: 700, color }}>{value}{unit}</span>
      </div>
      <div style={{ position: "relative", height: 24, display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", left: 0, right: 0, height: 4,
          background: "rgba(255,255,255,0.07)", borderRadius: 2 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: color,
            borderRadius: 2, boxShadow: `0 0 6px ${color}66` }} />
        </div>
        {warn && <div style={{ position: "absolute", left: `${((warn - min) / (max - min)) * 100}%`,
          width: 1, height: 12, background: "#f59e0b66", top: "50%", transform: "translateY(-50%)" }} />}
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.48rem",
          color: "rgba(255,255,255,0.2)" }}>{min}{unit}</span>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.48rem",
          color: "rgba(255,255,255,0.2)" }}>{max}{unit}</span>
      </div>
    </div>
  );
}

// ── Terminal Log ──
export function TerminalLog({ lines, title = "TENSOR EXECUTION LOG" }:
  { lines: string[]; title?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);
  return (
    <Card style={{ overflow: "hidden" }} glow="#10b981">
      <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.52rem",
          color: "#10b981", letterSpacing: "0.15em" }}>{title}</span>
      </div>
      <div ref={ref} style={{ padding: "10px 12px", maxHeight: 140, overflowY: "auto",
        fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", lineHeight: 1.7,
        color: "#10b981" }}>
        {lines.map((l, i) => (
          <div key={i}>
            <span style={{ color: "rgba(16,185,129,0.45)", marginRight: 8 }}>&gt;</span>{l}
          </div>
        ))}
        <span style={{ borderLeft: "2px solid #10b981" }}>&nbsp;</span>
      </div>
    </Card>
  );
}

// ── Severity Bar Item ──
export function SeverityItem({ rank, label, value, pct, correlation, color }:
  { rank: string; label: string; value: string; pct: number; correlation: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0",
      borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem",
        color: "rgba(255,255,255,0.25)", width: 20, flexShrink: 0 }}>{rank}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ fontSize: "0.7rem", fontWeight: 500, color: "#f4f4f5" }}>{label}</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.62rem",
            fontWeight: 700, color }}>{value}</span>
        </div>
        <ProgressBar value={pct} color={color} height={3} />
        <div style={{ marginTop: 4, fontFamily: "'JetBrains Mono',monospace", fontSize: "0.52rem",
          color: "rgba(255,255,255,0.3)" }}>r = {correlation}</div>
      </div>
    </div>
  );
}

// ── Checklist item ──
export function CheckItem({ label, ok = true }: { label: string; ok?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
      <span style={{ fontSize: "0.68rem", color: ok ? "#10b981" : "rgba(255,255,255,0.3)" }}>
        {ok ? "✓" : "○"}
      </span>
      <span style={{ fontSize: "0.68rem", color: ok ? "#f4f4f5" : "rgba(255,255,255,0.4)" }}>{label}</span>
    </div>
  );
}

// ── Alert Box ──
export function AlertBox({ lotId, impact, message }: { lotId: string; impact: string; message: string }) {
  return (
    <Card style={{ border: "1px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.05)", padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <motion.span style={{ fontSize: "0.8rem" }} animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.4, repeat: Infinity }}>⚠</motion.span>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem",
          color: "#ef4444", letterSpacing: "0.15em" }}>ACTIVE EXCURSION</span>
        <Chip label="HIGH" color="#ef4444" />
      </div>
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.8rem",
          fontWeight: 700, color: "#ef4444" }}>{lotId}</span>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem",
          color: "rgba(255,255,255,0.4)", marginLeft: 10 }}>Yield Impact: </span>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem",
          color: "#ef4444" }}>{impact}</span>
      </div>
      <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>{message}</div>
      <button style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", fontWeight: 600,
        letterSpacing: "0.1em", color: "#ef4444", background: "rgba(239,68,68,0.12)",
        border: "1px solid rgba(239,68,68,0.3)", borderRadius: 4, padding: "6px 14px", cursor: "pointer" }}>
        INVESTIGATE LOT →
      </button>
    </Card>
  );
}

// ── Sparkline SVG ──
export function Sparkline({ data, color = "#d4af37", height = 60, width = 280 }:
  { data: number[]; color?: string; height?: number; width?: number }) {
  if (data.length < 2) return null;
  const mn = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1;
  const pts = data.map((v, i) =>
    `${(i / (data.length - 1)) * width},${height - ((v - mn) / rng) * (height - 8) - 4}`);
  const d = "M " + pts.join(" L ");
  const areaD = `${d} L ${width},${height} L 0,${height} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#sg-${color.replace("#","")})`} />
      <motion.path d={d} fill="none" stroke={color} strokeWidth={1.5}
        style={{ filter: `drop-shadow(0 0 4px ${color}88)` }}
        initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }}
        viewport={{ once: true }} transition={{ duration: 1.4, ease: "easeInOut" }} />
    </svg>
  );
}
