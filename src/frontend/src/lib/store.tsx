"use client";
/**
 * src/lib/store.tsx
 * ─────────────────
 * Single global React context for the entire app.
 *
 * Holds:
 *   batchResult     – response from POST /predict-csv, set by Batch page,
 *                     read by Command Center, Batch Risk, etc.
 *   isBackendOnline – live health-check result polled every 10 s,
 *                     read by the sidebar dot in DashboardLayout.
 *
 * The provider is mounted once in app/providers.tsx which is imported
 * by the root app/layout.tsx — so context survives ALL navigation.
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { checkHealth } from "../services/api";

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface WaferResult {
  wafer_id: string;
  prediction: string;          // "PASS" | "FAIL"
  pass_probability: number;
  fail_probability: number;
  anomaly_score: number;
}

export interface BatchResult {
  total_wafers: number;
  pass_count: number;
  fail_count: number;
  pass_rate: number;
  fail_rate: number;
  estimated_execution_time_ms: string;
  wafers: WaferResult[] | undefined;
}

export type WaferSensors = Record<string, number>;

/* ── Context shape ──────────────────────────────────────────────────────── */

interface StoreValue {
  /** Last successful POST /predict-csv response, or null if never run. */
  batchResult: BatchResult | null;
  setBatchResult: (r: BatchResult | null) => void;
  batchWaferSensors: WaferSensors[];
  setBatchWaferSensors: (sensors: WaferSensors[]) => void;
  selectedWaferSensors: WaferSensors | null;
  setSelectedWaferSensors: (sensors: WaferSensors | null) => void;

  /**
   * null  = first check not yet complete (sidebar shows amber "CONNECTING")
   * true  = /health returned 200
   * false = fetch failed or non-2xx
   */
  isBackendOnline: boolean | null;
}

const StoreContext = createContext<StoreValue>({
  batchResult: null,
  setBatchResult: () => {},
  batchWaferSensors: [],
  setBatchWaferSensors: () => {},
  selectedWaferSensors: null,
  setSelectedWaferSensors: () => {},
  isBackendOnline: null,
});

/* ── Provider ───────────────────────────────────────────────────────────── */

export function StoreProvider({ children }: { children: ReactNode }) {
  const [batchResult, setBatchResultState] = useState<BatchResult | null>(null);
  const [batchWaferSensors, setBatchWaferSensors] = useState<WaferSensors[]>([]);
  const [selectedWaferSensors, setSelectedWaferSensors] = useState<WaferSensors | null>(null);
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("yieldsentinel_batchResult");
      if (saved) setBatchResultState(JSON.parse(saved));
    } catch {
      // Ignore invalid or unavailable session storage.
    }
  }, []);

  const setBatchResult = useCallback((r: BatchResult | null) => {
    setBatchResultState(r);
    try {
      if (r) {
        sessionStorage.setItem("yieldsentinel_batchResult", JSON.stringify(r));
      } else {
        sessionStorage.removeItem("yieldsentinel_batchResult");
      }
    } catch {
      // Ignore storage quota error
    }
  }, []);

  /* Poll /health every 10 s */
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        await checkHealth();
        if (!cancelled) setIsBackendOnline(true);
      } catch {
        if (!cancelled) setIsBackendOnline(false);
      }
    }

    poll();
    const id = setInterval(poll, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <StoreContext.Provider value={{ batchResult, setBatchResult, batchWaferSensors, setBatchWaferSensors, selectedWaferSensors, setSelectedWaferSensors, isBackendOnline }}>
      {children}
    </StoreContext.Provider>
  );
}

/* ── Hook ───────────────────────────────────────────────────────────────── */

export function useStore() {
  return useContext(StoreContext);
}

/**
 * Backward-compat shim — existing pages call `useAppContext()`.
 * Redirect them to the new store so nothing else needs to change.
 */
export function useAppContext() {
  return useContext(StoreContext);
}
