"use client";
import { createContext, useContext, useState, useCallback, ReactNode } from "react";

/* ── Types matching POST /predict-csv response ── */
export interface WaferResult {
  wafer_id: string;
  prediction: string;       // "PASS" | "FAIL"
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

interface AppContextValue {
  batchResult: BatchResult | null;
  setBatchResult: (r: BatchResult | null) => void;
}

const AppContext = createContext<AppContextValue>({
  batchResult: null,
  setBatchResult: () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [batchResult, setBatchResultState] = useState<BatchResult | null>(null);

  const setBatchResult = useCallback((r: BatchResult | null) => {
    setBatchResultState(r);
  }, []);

  return (
    <AppContext.Provider value={{ batchResult, setBatchResult }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
