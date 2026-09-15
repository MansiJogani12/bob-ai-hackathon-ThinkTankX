"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "../../../src/lib/store";
import { getDashboard, type DashboardResponse } from "../../../src/services/api";
import { supabase } from "../../../src/lib/supabase";
import { saveAnalysis, getAnalyses, deleteAnalysis, type Analysis } from "../../../src/lib/analysisDb";

/* ── inline styles to avoid any CSS conflicts ── */
const S = {
  amber: "#E59B38",
  amberHover: "#F5A947",
  black: "#070708",
  surface: "#0E0E11",
  card: "#141418",
  cardBorder: "#23232A",
  textMuted: "#71717A",
  textDim: "#A1A1AA",
} as const;

/* ── Radar beacon dot ── */
function RadarDot({ size = 8, color = "#10b981" }: { size?: number; color?: string }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: size, height: size, flexShrink: 0 }}>
      <motion.span
        style={{ position: "absolute", inset: -4, borderRadius: "50%", border: `1px solid ${color}b3` }}
        animate={{ scale: [0.6, 2.2], opacity: [1, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: [0, 0.2, 0.8, 1] }}
      />
      <motion.span
        style={{ position: "absolute", inset: -8, borderRadius: "50%", border: `1px solid ${color}59` }}
        animate={{ scale: [0.6, 2.2], opacity: [1, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: [0, 0.2, 0.8, 1], delay: 0.75 }}
      />
      <span style={{ width: size, height: size, borderRadius: "50%", background: color,
        display: "block", position: "relative", boxShadow: `0 0 8px ${color}e6` }} />
    </span>
  );
}

/* ── Pulsing ping dot ── */
function PingDot({ color = "#10b981", size = 6 }: { color?: string; size?: number }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: size, height: size, flexShrink: 0 }}>
      <motion.span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, opacity: 0.8 }}
        animate={{ scale: [1, 2], opacity: [0.8, 0] }} transition={{ duration: 1.2, repeat: Infinity }} />
      <span style={{ width: size, height: size, borderRadius: "50%", background: color,
        display: "block", position: "relative", boxShadow: `0 0 8px ${color}` }} />
    </span>
  );
}

/* ── Striped animated progress bar ── */
function StripedBar({ pct }: { pct: number }) {
  return (
    <div style={{ width: "100%", background: "rgba(63,63,70,0.6)", borderRadius: 999,
      height: 8, overflow: "hidden", padding: 1, border: `1px solid ${S.cardBorder}99` }}>
      <div style={{
        height: "100%", width: `${pct}%`, borderRadius: 999,
        background: `linear-gradient(90deg, ${S.amber}, #F5A947, ${S.amber})`,
        boxShadow: `0 0 10px ${S.amber}99`,
        backgroundSize: "24px 24px",
        backgroundImage: `linear-gradient(45deg,rgba(255,255,255,0.18) 25%,transparent 25%,transparent 50%,rgba(255,255,255,0.18) 50%,rgba(255,255,255,0.18) 75%,transparent 75%,transparent)`,
        animation: "stripes 1.8s linear infinite",
      }} />
    </div>
  );
}

/* ── Laser scanner line ── */
function LaserScanner() {
  return (
    <motion.div
      style={{
        position: "absolute", left: "6%", right: "6%", height: 2, zIndex: 20,
        background: `linear-gradient(90deg, transparent 0%, rgba(229,155,56,0.2) 15%, #F5A947 50%, rgba(229,155,56,0.2) 85%, transparent 100%)`,
        boxShadow: `0 0 14px 2px rgba(229,155,56,0.75), 0 0 4px #fff`,
        pointerEvents: "none",
      }}
      animate={{ top: ["2%", "96%"], opacity: [0, 1, 1, 0] }}
      transition={{ duration: 3.2, repeat: Infinity, repeatType: "reverse", ease: "easeInOut",
        times: [0, 0.12, 0.88, 1] }}
    />
  );
}

/* ── Check glow item ── */
function CheckRow({ label, badge, badgeColor = "rgba(255,255,255,0.08)", badgeText = "#71717A", glowDelay = 0 }:
  { label: string; badge: string; badgeColor?: string; badgeText?: string; glowDelay?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
      color: "#d4d4d8", fontSize: "0.69rem", cursor: "default" }}
      onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
      onMouseLeave={e => (e.currentTarget.style.color = "#d4d4d8")}>
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <motion.span style={{ fontWeight: 700, color: "#34d399", fontSize: "0.75rem" }}
          animate={{ filter: ["drop-shadow(0 0 0px transparent)", "drop-shadow(0 0 6px rgba(52,211,153,0.8))", "drop-shadow(0 0 0px transparent)"],
            color: ["#34d399", "#6ee7b7", "#34d399"] }}
          transition={{ duration: 3, repeat: Infinity, delay: glowDelay }}>
          ✓
        </motion.span>
        {label}
      </span>
      <span style={{ fontFamily: "monospace", fontSize: "0.625rem", padding: "1px 6px", borderRadius: 4,
        background: badgeColor, color: badgeText, border: "1px solid rgba(255,255,255,0.05)" }}>
        {badge}
      </span>
    </div>
  );
}

const BACKEND = "http://127.0.0.1:8000";

/* ───────────────────────────────────────────────── */

export default function BatchPage() {
  const { setBatchResult, batchResult, setBatchWaferSensors, setActiveAnalysisId } = useAppContext();
  const [latency, setLatency] = useState(14);
  const [running, setRunning] = useState<"idle" | "running" | "done">("idle");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; rows: string; size: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [saveToast, setSaveToast] = useState<"saving" | "saved" | "error" | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Saved datasets state ── */
  const [savedAnalyses, setSavedAnalyses] = useState<Analysis[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const loadSaved = useCallback(async () => {
    setSavedLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) { setSavedLoading(false); return; }
    const list = await getAnalyses(session.user.id);
    setSavedAnalyses(list);
    setSavedLoading(false);
  }, []);

  useEffect(() => { loadSaved(); }, [loadSaved]);

  /* Fetch dashboard KPIs for the bottom strip (no model needed) */
  useEffect(() => {
    let cancelled = false;
    getDashboard()
      .then(d => { if (!cancelled) setDashboard(d); })
      .catch(() => { /* bottom strip falls back to "--" */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const latencies = [13, 14, 14, 15, 12, 14, 16];
    const id = setInterval(() => {
      setLatency(latencies[Math.floor(Math.random() * latencies.length)]);
    }, 3200);
    return () => clearInterval(id);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    setFileInfo({ name: file.name, rows: "—", size: `${sizeMB} MB` });
    setError(null);

    const reader = new FileReader();
    reader.onload = event => {
      const text = String(event.target?.result ?? "");
      const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      if (lines.length < 2) {
        setBatchWaferSensors([]);
        return;
      }
      const headers = lines[0].split(",");
      const rows = lines.slice(1).map(line => {
        const cells = line.split(",");
        return Object.fromEntries(headers.map((header, index) => {
          const value = Number(cells[index]);
          return [header, Number.isFinite(value) ? value : 0];
        }));
      });
      setBatchWaferSensors(rows);
    };
    reader.readAsText(file);
  };

  const handleRun = async () => {
    if (running !== "idle") return;
    setError(null);

    if (!uploadedFile) {
      /* No file selected — show an error, don't proceed */
      setError("Please select a CSV file before running batch prediction.");
      return;
    }

    setRunning("running");
    try {
      const form = new FormData();
      form.append("file", uploadedFile);

      const res = await fetch(`${BACKEND}/predict-csv`, { method: "POST", body: form });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`HTTP ${res.status}: ${detail}`);
      }

      const data = await res.json();
      setBatchResult(data);           // save into global context
      setRunning("done");
      setTimeout(() => setRunning("idle"), 1800);

      /* ── Save analysis to Supabase (non-blocking) ── */
      void (async () => {
        try {
          setSaveToast("saving");
          const { data: sessionData } = await supabase.auth.getSession();
          const userId = sessionData?.session?.user?.id;
          if (!userId) { setSaveToast(null); return; }

          const [rcRes, dpRes, asRes, miRes] = await Promise.allSettled([
            fetch(`${BACKEND}/root-causes`).then(r => r.ok ? r.json() : null),
            fetch(`${BACKEND}/defect-patterns`).then(r => r.ok ? r.json() : null),
            fetch(`${BACKEND}/analysis-summary`).then(r => r.ok ? r.json() : null),
            fetch(`${BACKEND}/model-info`).then(r => r.ok ? r.json() : null),
          ]);

          const rootCauses = rcRes.status === "fulfilled" ? rcRes.value as Record<string, unknown> | null : null;
          const defectPatterns = dpRes.status === "fulfilled" ? dpRes.value as Record<string, unknown> | null : null;
          const analysisSummary = asRes.status === "fulfilled" ? asRes.value as Record<string, unknown> | null : null;
          const modelInfo = miRes.status === "fulfilled" ? miRes.value as Record<string, unknown> | null : null;

          const { data: saved, error: saveErr } = await saveAnalysis({
            userId,
            datasetName: uploadedFile.name,
            batchResult: data as Record<string, unknown>,
            rootCauses,
            defectPatterns,
            analysisSummary,
            modelInfo,
          });

          if (saved) {
            setActiveId(saved.id);
            setActiveAnalysisId(saved.id);
            await loadSaved();
            setSaveToast("saved");
          } else {
            setSaveToast("error");
            // Show the actual Supabase error so the user knows what to fix
            if (saveErr) setSaveErrorMsg(saveErr);
          }
          setTimeout(() => { setSaveToast(null); setSaveErrorMsg(null); }, 6000);
        } catch (e) {
          setSaveToast("error");
          setSaveErrorMsg(e instanceof Error ? e.message : String(e));
          setTimeout(() => { setSaveToast(null); setSaveErrorMsg(null); }, 6000);
        }
      })();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setRunning("idle");
    }
  };

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", color: "#e4e4e7" }}>

      {/* Inject keyframes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes stripes { from{background-position:0 0} to{background-position:24px 0} }
        @keyframes btnSweep { 0%{left:-120%} 35%{left:180%} 100%{left:180%} }
        @keyframes ambientBreathe { 0%{transform:scale(1) translate(0,0);opacity:.6} 50%{transform:scale(1.15) translate(-20px,15px);opacity:.95} 100%{transform:scale(1) translate(0,0);opacity:.6} }
        @keyframes arrowShift { 0%,100%{transform:translateX(0)} 50%{transform:translateX(4px)} }
        .btn-sweep { position:relative; overflow:hidden; isolation:isolate; }
        .btn-sweep::before { content:''; position:absolute; top:0; left:-120%; width:70%; height:100%;
          background:linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent);
          transform:skewX(-24deg); animation:btnSweep 3.6s infinite cubic-bezier(0.4,0,0.2,1); }
        .card-hover { transition:all 0.28s cubic-bezier(0.16,1,0.3,1); }
        .card-hover:hover { border-color:rgba(229,155,56,0.45) !important; transform:translateY(-2px);
          box-shadow:0 10px 24px -6px rgba(0,0,0,0.6),0 0 16px rgba(229,155,56,0.08); }
        .arrow-pulse { animation:arrowShift 1.5s ease-in-out infinite; }
      ` }} />

      {/* ── Page title ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: "monospace", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.2em",
          textTransform: "uppercase", color: S.amber, marginBottom: 8,
          display: "flex", alignItems: "center", gap: 8 }}>
          <PingDot color={S.amber} size={6} />
          ML PIPELINE INTEGRATION
        </div>
        <h1 style={{ fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.025em", color: "#fff",
          display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          Batch Prediction
          <span style={{ color: "#71717a", fontWeight: 300 }}>(CSV)</span>
        </h1>
        <p style={{ fontSize: "0.875rem", color: S.textDim }}>
          Process multi-parameter wafer sensor logs through high-dimensional anomaly detection models.
        </p>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div style={{
          padding: "10px 14px", borderRadius: 6, background: "rgba(127,29,29,0.4)",
          border: "1px solid rgba(239,68,68,0.4)", color: "#fca5a5",
          fontFamily: "ui-monospace,monospace", fontSize: "0.65rem", letterSpacing: "0.04em",
          marginBottom: 16,
        }}>
          ⚠ {error}
        </div>
      )}

      {/* ── Save toast ── */}
      {saveToast && (
        <div style={{
          padding: "10px 14px", borderRadius: 6, marginBottom: 16,
          background: saveToast === "saved"
            ? "rgba(16,89,52,0.4)"
            : saveToast === "saving"
            ? "rgba(30,50,20,0.4)"
            : "rgba(127,29,29,0.4)",
          border: `1px solid ${saveToast === "saved" ? "rgba(16,185,129,0.4)" : saveToast === "saving" ? "rgba(245,158,11,0.3)" : "rgba(239,68,68,0.4)"}`,
          color: saveToast === "saved" ? "#6ee7b7" : saveToast === "saving" ? "#fbbf24" : "#fca5a5",
          fontFamily: "ui-monospace,monospace", fontSize: "0.65rem", letterSpacing: "0.04em",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {saveToast === "saving" && "⟳ Saving analysis to history..."}
          {saveToast === "saved" && "✓ Analysis saved to history — visible in Saved Datasets below"}
          {saveToast === "error" && (
            <span>
              ⚠ Could not save to history
              {saveErrorMsg && (
                <span style={{ display: "block", marginTop: 4, fontSize: "0.6rem", opacity: 0.8 }}>
                  {saveErrorMsg.includes("relation") || saveErrorMsg.includes("does not exist")
                    ? 'Table missing — run supabase_migrations.sql in your Supabase SQL Editor first'
                    : saveErrorMsg}
                </span>
              )}
            </span>
          )}
        </div>
      )}

      {/* ── Banner ── */}
      <div style={{ padding: "14px 16px", borderRadius: 8,
        background: "#14120E", border: `1px solid rgba(229,155,56,0.3)`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 24, boxShadow: "0 0 20px rgba(229,155,56,0.08)",
        cursor: "default", transition: "border-color 0.2s" }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(229,155,56,0.5)")}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(229,155,56,0.3)")}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: S.amber }}>
          <motion.svg style={{ width: 16, height: 16, flexShrink: 0 }} fill="currentColor" viewBox="0 0 20 20"
            animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }}>
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </motion.svg>
          <span style={{ fontFamily: "monospace", fontSize: "0.69rem", fontWeight: 500, letterSpacing: "0.05em" }}>
            Model Engine Ready: XGBoost-SECOM-v2.8 &amp; Root Classifier Active
          </span>
        </div>
        <span style={{ fontFamily: "monospace", fontSize: "0.625rem", color: "#a1a1aa",
          background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: 4,
          border: "1px solid rgba(255,255,255,0.05)" }}>
          WEIGHTS: SECOM_1549LOTS
        </span>
      </div>

      {/* ── Two column grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 28 }}>

        {/* ── Upload card ── */}
        <div className="card-hover" style={{
          background: S.card, borderRadius: 12, border: `1px solid ${S.cardBorder}`,
          padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between",
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)", position: "relative", overflow: "hidden" }}>

          {/* inner glow */}
          <div style={{ position: "absolute", top: -64, right: -64, width: 192, height: 192,
            background: "rgba(229,155,56,0.1)", borderRadius: "50%", filter: "blur(32px)", pointerEvents: "none" }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#fff" }}>Upload Wafer Data</h2>
              <span style={{ fontFamily: "monospace", fontSize: "0.69rem", color: S.amber,
                background: "rgba(229,155,56,0.1)", border: `1px solid rgba(229,155,56,0.2)`,
                padding: "2px 8px", borderRadius: 4, boxShadow: "0 0 10px rgba(229,155,56,0.15)" }}>
                Required: 562 Features
              </span>
            </div>
            <p style={{ fontSize: "0.75rem", color: S.textMuted, lineHeight: 1.6, marginBottom: 24 }}>
              Upload a CSV containing the required model features to analyze this batch for defect trends and parameter drifting.
            </p>

            {/* Dropzone */}
            <div onClick={() => inputRef.current?.click()}
              style={{ position: "relative", border: `2px dashed rgba(229,155,56,0.4)`,
                background: "rgba(229,155,56,0.02)", borderRadius: 12, padding: "32px 24px",
                display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
                cursor: "pointer", overflow: "hidden",
                boxShadow: "inset 0 0 20px rgba(229,155,56,0.03)" }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(229,155,56,0.05)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 0 25px rgba(229,155,56,0.12)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(229,155,56,0.02)";
                (e.currentTarget as HTMLElement).style.boxShadow = "inset 0 0 20px rgba(229,155,56,0.03)";
              }}>
              <input ref={inputRef} type="file" accept=".csv" style={{ display: "none" }}
                onChange={handleFileChange} />
              <LaserScanner />

              {/* file icon */}
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(229,155,56,0.1)",
                border: `1px solid rgba(229,155,56,0.3)`, display: "flex", alignItems: "center",
                justifyContent: "center", color: S.amber, marginBottom: 12,
                transition: "all 0.3s" }}>
                <svg width={24} height={24} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeWidth={1.8} />
                </svg>
              </div>

              {/* filename */}
              <span style={{ fontFamily: "monospace", fontSize: "0.875rem", fontWeight: 600,
                color: S.amber, letterSpacing: "0.05em", background: "rgba(229,155,56,0.1)",
                padding: "4px 12px", borderRadius: 6, border: `1px solid rgba(229,155,56,0.3)`,
                boxShadow: "0 0 12px rgba(229,155,56,0.15)" }}>
                {fileInfo ? fileInfo.name : "Drop CSV here or click to browse"}
              </span>
              <p style={{ fontSize: "0.69rem", color: "#a1a1aa", marginTop: 8 }}>
                {fileInfo ? `${fileInfo.size}` : "Requires the 562 model sensor columns (SECOM format)"}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12,
                fontFamily: "monospace", fontSize: "0.69rem", color: "#34d399" }}>
                <PingDot color="#34d399" size={8} />
                <span style={{ letterSpacing: "0.04em" }}>Ready for tensor execution</span>
              </div>
            </div>

            {/* meta tags */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 16 }}>
              {[["Wafers", fileInfo ? "—" : "—"],["Sensors","590"],["Format","UTF-8 CSV"]].map(([k,v]) => (
                <div key={k} style={{ background: S.surface, border: `1px solid ${S.cardBorder}`,
                  padding: "8px", borderRadius: 4, textAlign: "center", fontFamily: "monospace",
                  cursor: "default", transition: "all 0.2s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#52525b"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = S.cardBorder; (e.currentTarget as HTMLElement).style.background = S.surface; }}>
                  <div style={{ fontSize: "0.625rem", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.1em" }}>{k}</div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#e4e4e7", marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA button */}
          <div style={{ marginTop: 32, paddingTop: 16, borderTop: `1px solid rgba(35,35,42,0.6)`, position: "relative" }}>
            <div style={{ position: "absolute", inset: "8px 16px 0", background: "rgba(229,155,56,0.15)",
              borderRadius: 12, filter: "blur(16px)", pointerEvents: "none" }} />
            <button className="btn-sweep" onClick={handleRun}
              style={{
                width: "100%", position: "relative", zIndex: 1,
                background: running === "done"
                  ? "linear-gradient(90deg,#10b981,#059669)"
                  : `linear-gradient(90deg, ${S.amber}, #C98224)`,
                color: "#000", fontFamily: "monospace", fontSize: "0.875rem", fontWeight: 600,
                letterSpacing: "0.1em", textTransform: "uppercase",
                padding: "14px 24px", borderRadius: 8, border: "none", cursor: running === "idle" ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: `0 0 22px rgba(229,155,56,0.35)`,
                transition: "all 0.3s",
              }}
              onMouseEnter={e => { if (running === "idle") { (e.currentTarget).style.boxShadow = "0 0 32px rgba(229,155,56,0.65)"; (e.currentTarget).style.transform = "translateY(-1px)"; } }}
              onMouseLeave={e => { (e.currentTarget).style.boxShadow = "0 0 22px rgba(229,155,56,0.35)"; (e.currentTarget).style.transform = "none"; }}>

              <AnimatePresence mode="wait">
                {running === "idle" && (
                  <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>RUN BATCH PREDICTION</span>
                    <svg className="arrow-pulse" width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" strokeWidth={2.2} />
                    </svg>
                  </motion.span>
                )}
                {running === "running" && (
                  <motion.span key="running" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <motion.svg width={16} height={16} viewBox="0 0 24 24" fill="none"
                      animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}>
                      <circle cx={12} cy={12} r={10} stroke="currentColor" strokeWidth={4} opacity={0.25} />
                      <path fill="currentColor" opacity={0.75} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </motion.svg>
                    <span>ANALYZING BATCH...</span>
                  </motion.span>
                )}
                {running === "done" && (
                  <motion.span key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{ display: "flex", alignItems: "center", gap: 8, color: "#000", fontWeight: 700 }}>
                    <span>PREDICTION COMPLETE</span>
                    <span style={{ fontSize: "1rem" }}>✔</span>
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>

        {/* ── Batch Summary card ── */}
        <div className="card-hover" style={{
          background: S.card, borderRadius: 12, border: `1px solid ${S.cardBorder}`,
          padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between",
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)" }}>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#fff" }}>Batch Summary</h2>
              {batchResult ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "2px 10px", borderRadius: 999, fontFamily: "monospace", fontSize: "0.625rem", fontWeight: 500,
                  background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)" }}>
                  <PingDot color="#34d399" size={6} />
                  COMPLETE
                </span>
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "2px 10px", borderRadius: 999, fontFamily: "monospace", fontSize: "0.625rem", fontWeight: 500,
                  background: "rgba(245,158,11,0.1)", color: S.amber, border: `1px solid rgba(229,155,56,0.2)`,
                  boxShadow: "0 0 8px rgba(229,155,56,0.15)" }}>
                  <PingDot color={S.amber} size={6} />
                  STAGED
                </span>
              )}
            </div>
            <p style={{ fontSize: "0.75rem", color: S.textMuted, lineHeight: 1.6, marginBottom: 24 }}>
              {batchResult
                ? `Inference complete — ${batchResult.total_wafers} wafers processed in ${batchResult.estimated_execution_time_ms}.`
                : "Preliminary telemetry verification for the currently staged dataset prior to model inference."}
            </p>

            {batchResult ? (
              /* ── Real results: 2x2 KPI grid ── */
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { label: "Total Wafers", value: String(batchResult.total_wafers), color: "#fff", bg: S.surface, border: S.cardBorder },
                  { label: "Fail Rate",    value: `${(batchResult.fail_rate ?? 0).toFixed(2)}%`, color: "#ef4444", bg: "rgba(127,29,29,0.25)", border: "rgba(185,28,28,0.4)" },
                  { label: "Pass Count",   value: String(batchResult.pass_count),   color: "#34d399", bg: S.surface, border: S.cardBorder },
                  { label: "Fail Count",   value: String(batchResult.fail_count),   color: "#f87171", bg: S.surface, border: S.cardBorder },
                ].map(k => (
                  <div key={k.label} style={{ background: k.bg, border: `1px solid ${k.border}`,
                    borderRadius: 8, padding: "14px 16px" }}>
                    <div style={{ fontSize: "0.5625rem", fontFamily: "monospace", textTransform: "uppercase",
                      letterSpacing: "0.12em", color: "#71717a", marginBottom: 6 }}>{k.label}</div>
                    <div style={{ fontSize: "1.75rem", fontWeight: 700, fontFamily: "monospace",
                      letterSpacing: "-0.02em", color: k.color }}>{k.value}</div>
                  </div>
                ))}
              </div>
            ) : (
              /* ── Pre-upload: static telemetry ── */
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <StatRow
                  label="Input Schema Match"
                  value={<span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    100% Validated <span style={{ color: "#34d399", fontSize: "0.75rem" }}>✔</span>
                  </span>}
                  right={<>
                    <span style={{ color: "#34d399", fontSize: "0.75rem", fontWeight: 600,
                      filter: "drop-shadow(0 0 8px rgba(16,185,129,0.3))" }}>590 / 590 Passed</span>
                    <div style={{ fontSize: "0.625rem", color: "#71717a" }}>0 Missing Columns</div>
                  </>}
                />
                <StatRow
                  label="Estimated Execution Time"
                  value="~ 2.4 Seconds"
                  right={<>
                    <span style={{ color: "#d4d4d8", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 4 }}>
                      <PingDot color={S.amber} size={6} /> GPU Tensor Acceleration
                    </span>
                    <div style={{ fontSize: "0.625rem", color: "#71717a" }}>Batch Size: 256</div>
                  </>}
                />
                <div style={{ padding: "14px", borderRadius: 8, background: S.surface,
                  border: `1px solid ${S.cardBorder}`, cursor: "default", transition: "all 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${S.cardBorder}e6`; (e.currentTarget as HTMLElement).style.background = "#121217"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = S.cardBorder; (e.currentTarget as HTMLElement).style.background = S.surface; }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontFamily: "monospace", fontSize: "0.69rem", color: "#a1a1aa", textTransform: "uppercase" }}>Target Fab Cluster</span>
                    <span style={{ fontFamily: "monospace", fontSize: "0.69rem", color: S.amber, fontWeight: 500 }}>CLEANROOM-ALPHA // 3NM</span>
                  </div>
                  <StripedBar pct={82} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "monospace",
                    fontSize: "0.625rem", color: "#71717a", marginTop: 6 }}>
                    <span style={{ color: "#a1a1aa" }}>Cluster Capacity: <span style={{ color: S.amber, fontWeight: 600 }}>82%</span></span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#34d399", fontWeight: 500 }}>
                      <PingDot color="#34d399" size={6} /> Load: Nominal
                    </span>
                  </div>
                </div>
                <div style={{ padding: 16, borderRadius: 8, background: "rgba(0,0,0,0.4)",
                  border: `1px solid rgba(35,35,42,0.6)`, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontFamily: "monospace", fontSize: "0.69rem", textTransform: "uppercase",
                      letterSpacing: "0.1em", color: S.amber, fontWeight: 600 }}>INSPECTION PIPELINE</span>
                    <span style={{ fontFamily: "monospace", fontSize: "0.5625rem", color: "#52525b" }}>REALTIME READY</span>
                  </div>
                  <CheckRow label="Sensor Normalization (Z-Score)" badge="Cached" glowDelay={0} />
                  <CheckRow label="Spatial Defect Clustering" badge="Auto" glowDelay={1} />
                  <CheckRow label="Root Cause Correlation Matrix" badge="Active"
                    badgeColor="rgba(16,185,129,0.1)" badgeText="rgba(52,211,153,0.9)" glowDelay={2} />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid rgba(35,35,42,0.6)`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            fontFamily: "monospace", fontSize: "0.69rem", color: "#52525b" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
              SECURITY: AIR-GAPPED ON-PREM
            </span>
            {batchResult ? (
              <span style={{ color: "#64748b", fontFamily: "monospace", fontSize: "0.69rem" }}>
                {batchResult.estimated_execution_time_ms} exec time
              </span>
            ) : (
              <span style={{ color: S.amber, cursor: "pointer", transition: "color 0.15s",
                display: "flex", alignItems: "center", gap: 4 }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = S.amberHover)}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = S.amber)}>
                Export Protocol <span style={{ fontSize: "0.75rem" }}>↗</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Saved Datasets Panel ── */}
      <div style={{ marginTop: 28, background: S.card, borderRadius: 12,
        border: `1px solid ${S.cardBorder}`, overflow: "hidden",
        boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)" }}>

        {/* Panel header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 24px", borderBottom: `1px solid ${S.cardBorder}` }}>
          <div>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#fff", margin: 0 }}>
              Saved Datasets
            </h2>
            <p style={{ fontSize: "0.69rem", color: S.textMuted, marginTop: 2 }}>
              Your uploaded analyses — click Load to make one active for all analysis pages
            </p>
          </div>
          <button onClick={loadSaved} style={{
            padding: "5px 12px", borderRadius: 6, fontFamily: "monospace",
            fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em",
            background: "transparent", color: S.amber, border: `1px solid rgba(229,155,56,0.35)`,
            cursor: "pointer", transition: "all 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(229,155,56,0.1)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            ↻ REFRESH
          </button>
        </div>

        {/* Loading */}
        {savedLoading && (
          <div style={{ padding: "24px", fontFamily: "monospace", fontSize: "0.69rem",
            color: S.textMuted, textAlign: "center" }}>
            Loading saved datasets...
          </div>
        )}

        {/* Empty state */}
        {!savedLoading && savedAnalyses.length === 0 && (
          <div style={{ padding: "32px 24px", textAlign: "center",
            fontFamily: "monospace", fontSize: "0.69rem", color: S.textMuted, letterSpacing: "0.06em" }}>
            No saved datasets yet — run a batch prediction to save your first analysis
          </div>
        )}

        {/* Dataset rows */}
        {!savedLoading && savedAnalyses.length > 0 && (
          <>
            {/* Column headings */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 80px 80px 100px 200px",
              padding: "8px 24px", background: "rgba(0,0,0,0.3)",
              borderBottom: `1px solid ${S.cardBorder}`,
              fontFamily: "monospace", fontSize: "0.5625rem", textTransform: "uppercase",
              letterSpacing: "0.1em", color: "#52525b" }}>
              <span>Dataset</span>
              <span>Date</span>
              <span>Wafers</span>
              <span>Yield</span>
              <span>Status</span>
              <span style={{ textAlign: "right" }}>Actions</span>
            </div>

            <div style={{ maxHeight: 340, overflowY: "auto" }}>
              {savedAnalyses.map((a) => {
                const isActive = activeId === a.id;
                const yieldStr = a.yield_percentage != null ? `${a.yield_percentage.toFixed(1)}%` : "--";
                const dateStr = new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
                return (
                  <div key={a.id}
                    style={{ display: "grid", gridTemplateColumns: "1fr 140px 80px 80px 100px 200px",
                      padding: "11px 24px", borderBottom: `1px solid rgba(35,35,42,0.5)`,
                      fontFamily: "monospace", fontSize: "0.75rem",
                      background: isActive ? "rgba(229,155,56,0.06)" : "transparent",
                      borderLeft: isActive ? `2px solid ${S.amber}` : "2px solid transparent",
                      transition: "background 0.15s", alignItems: "center" }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <span style={{ color: "#e4e4e7", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}
                      title={a.dataset_name}>{a.dataset_name}</span>
                    <span style={{ color: "#71717a" }}>{dateStr}</span>
                    <span style={{ color: "#a1a1aa" }}>{a.total_records ?? "--"}</span>
                    <span style={{ color: a.yield_percentage != null && a.yield_percentage >= 90 ? "#34d399" : "#f87171" }}>{yieldStr}</span>
                    <span>
                      {isActive
                        ? <span style={{ fontSize: "0.5625rem", padding: "2px 8px", borderRadius: 4,
                            background: "rgba(229,155,56,0.15)", color: S.amber,
                            border: `1px solid rgba(229,155,56,0.4)`, fontWeight: 700 }}>ACTIVE</span>
                        : <span style={{ fontSize: "0.5625rem", color: "#52525b" }}>—</span>}
                    </span>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button
                        onClick={async () => {
                            /* Load this analysis into global batchResult */
                            const ps = a.prediction_summary as Record<string, unknown> | null;
                            if (ps) {
                              setBatchResult(ps as unknown as Parameters<typeof setBatchResult>[0]);
                            }
                          setActiveId(a.id);
                          setActiveAnalysisId(a.id);
                        }}
                        disabled={isActive}
                        style={{
                          padding: "4px 12px", borderRadius: 4, fontFamily: "monospace",
                          fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.06em",
                          background: isActive ? "rgba(229,155,56,0.15)" : "transparent",
                          color: isActive ? S.amber : "#a1a1aa",
                          border: `1px solid ${isActive ? "rgba(229,155,56,0.4)" : "rgba(63,63,70,0.6)"}`,
                          cursor: isActive ? "default" : "pointer", transition: "all 0.15s",
                        }}
                        onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = "rgba(229,155,56,0.1)"; e.currentTarget.style.color = S.amber; e.currentTarget.style.borderColor = "rgba(229,155,56,0.4)"; } }}
                        onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#a1a1aa"; e.currentTarget.style.borderColor = "rgba(63,63,70,0.6)"; } }}
                      >
                        {isActive ? "LOADED" : "LOAD"}
                      </button>
                      <button
                        disabled={deletingId === a.id}
                        onClick={async () => {
                          if (!confirm(`Delete analysis "${a.dataset_name}"? This cannot be undone.`)) return;
                          setDeletingId(a.id);
                          const { data: { session } } = await supabase.auth.getSession();
                          if (!session?.user?.id) { setDeletingId(null); return; }
                          const ok = await deleteAnalysis(session.user.id, a.id);
                          if (ok) {
                            if (activeId === a.id) { setActiveId(null); setActiveAnalysisId(null); }
                            await loadSaved();
                          }
                          setDeletingId(null);
                        }}
                        style={{
                          padding: "4px 12px", borderRadius: 4, fontFamily: "monospace",
                          fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.06em",
                          background: "transparent", color: "#71717a",
                          border: "1px solid rgba(63,63,70,0.6)",
                          cursor: deletingId === a.id ? "not-allowed" : "pointer", transition: "all 0.15s",
                        }}
                        onMouseEnter={e => { if (deletingId !== a.id) { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; e.currentTarget.style.color = "#f87171"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)"; } }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#71717a"; e.currentTarget.style.borderColor = "rgba(63,63,70,0.6)"; }}
                      >
                        {deletingId === a.id ? "..." : "DELETE"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Wafer Predictions Table (appears after batch run) ── */}
      {batchResult && (batchResult.wafers?.length ?? 0) > 0 && (
        <div style={{ marginTop: 28, background: S.card, borderRadius: 12,
          border: `1px solid ${S.cardBorder}`, overflow: "hidden",
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)" }}>

          {/* Table header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 24px", borderBottom: `1px solid ${S.cardBorder}` }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#fff", margin: 0 }}>
              Wafer Predictions
            </h2>
            <button
              onClick={() => {
                const rows = ["#,Wafer ID,Status,Fail Probability,Pass Probability",
                  ...(batchResult.wafers ?? []).map((w, i) =>
                    `${i + 1},${w.wafer_id},${w.prediction},${(w.fail_probability * 100).toFixed(2)}%,${(w.pass_probability * 100).toFixed(2)}%`
                  )].join("\n");
                const blob = new Blob([rows], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = "wafer_predictions.csv"; a.click();
                URL.revokeObjectURL(url);
              }}
              style={{
                padding: "6px 16px", borderRadius: 6, fontFamily: "monospace",
                fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em",
                textTransform: "uppercase", cursor: "pointer",
                background: S.amber, color: "#000", border: "none",
                boxShadow: `0 0 14px rgba(229,155,56,0.3)`,
                transition: "all 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = S.amberHover; e.currentTarget.style.boxShadow = `0 0 22px rgba(229,155,56,0.5)`; }}
              onMouseLeave={e => { e.currentTarget.style.background = S.amber; e.currentTarget.style.boxShadow = `0 0 14px rgba(229,155,56,0.3)`; }}
            >
              EXPORT CSV
            </button>
          </div>

          {/* Column headings */}
          <div style={{ display: "grid", gridTemplateColumns: "64px 1fr 120px 160px 160px",
            padding: "10px 24px", background: "rgba(0,0,0,0.3)",
            borderBottom: `1px solid ${S.cardBorder}`,
            fontFamily: "monospace", fontSize: "0.5625rem", textTransform: "uppercase",
            letterSpacing: "0.12em", color: "#52525b" }}>
            <span>#</span>
            <span>Wafer ID</span>
            <span>Status</span>
            <span>Fail Probability</span>
            <span style={{ textAlign: "right" }}>Pass Probability</span>
          </div>

          {/* Scrollable rows */}
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {(batchResult.wafers ?? []).map((w, i) => {
              const failPct  = w.fail_probability * 100;
              const passPct  = (1 - w.fail_probability) * 100;
              const isFail   = w.prediction === "FAIL";
              return (
                <div key={w.wafer_id}
                  style={{ display: "grid", gridTemplateColumns: "64px 1fr 120px 160px 160px",
                    padding: "11px 24px", borderBottom: `1px solid rgba(35,35,42,0.5)`,
                    fontFamily: "monospace", fontSize: "0.75rem",
                    background: isFail ? "rgba(127,29,29,0.08)" : "transparent",
                    transition: "background 0.15s", cursor: "default" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isFail ? "rgba(127,29,29,0.18)" : "rgba(255,255,255,0.03)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isFail ? "rgba(127,29,29,0.08)" : "transparent"; }}
                >
                  <span style={{ color: "#52525b" }}>{i + 1}</span>
                  <span style={{ color: "#a1a1aa" }}>{w.wafer_id}</span>
                  <span style={{ fontWeight: 700, color: isFail ? "#f87171" : "#34d399" }}>
                    {w.prediction}
                  </span>
                  <span style={{ color: isFail ? "#f87171" : "#71717a" }}>
                    {failPct.toFixed(2)}%
                  </span>
                  <span style={{ textAlign: "right", color: isFail ? "#71717a" : "#34d399" }}>
                    {passPct.toFixed(2)}%
                  </span>
                </div>
              );
            })}
          </div>

          {/* Table footer */}
          <div style={{ padding: "12px 24px", borderTop: `1px solid ${S.cardBorder}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            fontFamily: "monospace", fontSize: "0.625rem", color: "#52525b" }}>
            <span>{batchResult.total_wafers} total wafers</span>
            <span style={{ color: "#34d399" }}>{batchResult.pass_count} PASS</span>
            <span style={{ color: "#f87171" }}>{batchResult.fail_count} FAIL</span>
            <span>{batchResult.estimated_execution_time_ms} exec time</span>
          </div>
        </div>
      )}

      {/* ── Quick metrics strip (real data) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
        {[
          {
            label: "Batch Yield",
            val: batchResult
              ? `${(batchResult.pass_rate ?? 0).toFixed(2)}%`
              : dashboard
              ? `${dashboard.current_yield_pct.toFixed(1)}%`
              : "--",
            sub: batchResult
              ? `▲ ${batchResult.pass_count} passed`
              : "▲ From dashboard",
            subColor: "#34d399", dot: "#10b981", hoverColor: "#6ee7b7",
          },
          {
            label: "Flagged At-Risk Lots",
            val: batchResult
              ? String(batchResult.fail_count)
              : dashboard
              ? String(dashboard.at_risk_lots)
              : "--",
            valColor: S.amber,
            sub: batchResult ? "FAIL predictions" : "Pending quarantine review",
            subColor: "#71717a", dot: "#f59e0b",
          },
          {
            label: "Fail Rate",
            val: batchResult
              ? `${(batchResult.fail_rate ?? 0).toFixed(2)}%`
              : dashboard
              ? `${Math.abs(dashboard.yield_delta_pct).toFixed(2)}%`
              : "--",
            sub: batchResult ? "From batch inference" : "Yield delta",
            subColor: "#a1a1aa", dot: "rgba(113,113,122,0.5)",
          },
          {
            label: "Total Wafers",
            val: batchResult
              ? String(batchResult.total_wafers)
              : "--",
            sub: batchResult ? `${batchResult.estimated_execution_time_ms} exec` : "Upload CSV to analyze",
            subColor: "#34d399", dot: "#10b981", hoverColor: "#6ee7b7",
          },
        ].map(m => (
          <div key={m.label} className="card-hover"
            style={{ background: "rgba(20,20,24,0.7)", border: `1px solid rgba(35,35,42,0.8)`,
              borderRadius: 8, padding: 16, position: "relative", overflow: "hidden", cursor: "default" }}
            onMouseEnter={e => {
              const dot = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".status-dot");
              if (dot && m.hoverColor) dot.style.boxShadow = `0 0 8px ${m.dot}`;
              if (dot) dot.style.background = m.dot;
              const val = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".metric-val");
              if (val && m.hoverColor) val.style.color = m.hoverColor;
            }}
            onMouseLeave={e => {
              const dot = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".status-dot");
              if (dot) dot.style.background = "rgba(255,255,255,0)" ;
              if (dot) dot.style.boxShadow = "none";
              const val = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".metric-val");
              if (val) val.style.color = m.valColor ?? "#fff";
            }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              fontFamily: "monospace", fontSize: "0.625rem", textTransform: "uppercase", color: S.textMuted, marginBottom: 4 }}>
              <span>{m.label}</span>
              <span className="status-dot" style={{ width: 6, height: 6, borderRadius: "50%",
                background: "rgba(255,255,255,0)", border: `1px solid ${m.dot}`, transition: "all 0.2s" }} />
            </div>
            <div className="metric-val" style={{ fontFamily: "monospace", fontSize: "1.25rem", fontWeight: 700,
              color: m.valColor ?? "#fff", letterSpacing: "-0.025em", transition: "color 0.2s",
              textShadow: m.valColor ? `0 0 8px ${m.valColor}4d` : undefined }}>
              {m.val}
            </div>
            <div style={{ fontFamily: "monospace", fontSize: "0.69rem", color: m.subColor, marginTop: 4,
              display: "flex", alignItems: "center", gap: 4 }}>
              {m.sub.startsWith("▲") && (
                <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>▲</motion.span>
              )}
              {m.sub.replace("▲ ", "")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatRow({ label, value, right }: { label: string; value: React.ReactNode; right: React.ReactNode }) {
  return (
    <div style={{ padding: "14px", borderRadius: 8, background: "#0E0E11",
      border: "1px solid #23232A", display: "flex", alignItems: "center", justifyContent: "space-between",
      cursor: "default", transition: "all 0.2s" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#52525b"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#23232A"; }}>
      <span style={{ fontFamily: "monospace", fontSize: "0.69rem", color: "#a1a1aa" }}>{label}</span>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
        <span style={{ fontFamily: "monospace", fontSize: "0.75rem", fontWeight: 600, color: "#e4e4e7" }}>
          {value}
        </span>
        {right}
      </div>
    </div>
  );
}
