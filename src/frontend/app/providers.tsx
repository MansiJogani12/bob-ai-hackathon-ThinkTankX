"use client";
/**
 * app/providers.tsx
 * ─────────────────
 * Thin client-boundary wrapper so the root app/layout.tsx
 * (a Server Component) can render client-side providers.
 *
 * Add any future client providers here (e.g. React Query, theme).
 */
import { StoreProvider } from "../src/lib/store";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <StoreProvider>{children}</StoreProvider>;
}
