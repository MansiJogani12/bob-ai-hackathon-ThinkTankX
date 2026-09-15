"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../src/lib/supabase";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{
    name?: string; email?: string; password?: string; confirm?: string; form?: string;
  }>({});
  const [focused, setFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function validate() {
    const errs: { name?: string; email?: string; password?: string; confirm?: string } = {};
    if (!name.trim()) errs.name = "Name is required.";
    if (!email) errs.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Enter a valid email address.";
    if (!password) errs.password = "Password is required.";
    else if (password.length < 8) errs.password = "Password must be at least 8 characters.";
    if (!confirm) errs.confirm = "Please confirm your password.";
    else if (confirm !== password) errs.confirm = "Passwords do not match.";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name.trim() },
      },
    });
    setLoading(false);

    if (error) {
      setErrors({ form: error.message });
      return;
    }

    // Supabase sends a confirmation email by default.
    // Show success state; user can click through to login.
    setSuccess(true);
  }

  const inputStyle = (field: string): React.CSSProperties => ({
    width: "100%",
    background: "rgba(15,18,24,0.8)",
    border: `1px solid ${focused === field ? "rgba(245,158,11,0.6)" : errors[field as keyof typeof errors] ? "rgba(239,68,68,0.5)" : "rgba(30,38,52,0.8)"}`,
    borderRadius: 6,
    padding: "10px 14px",
    fontSize: "0.82rem",
    color: "#e2e8f0",
    fontFamily: "Inter, system-ui, sans-serif",
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
  });

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontFamily: "ui-monospace, monospace",
    fontSize: "0.6rem",
    fontWeight: 600,
    letterSpacing: "0.15em",
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    marginBottom: 6,
  };

  const errorStyle: React.CSSProperties = {
    marginTop: 5,
    fontFamily: "ui-monospace, monospace",
    fontSize: "0.58rem",
    color: "#ef4444",
    letterSpacing: "0.04em",
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#07090d",
      backgroundImage:
        "linear-gradient(to right,rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.02) 1px,transparent 1px)",
      backgroundSize: "32px 32px",
      fontFamily: "Inter, system-ui, sans-serif",
      padding: "24px 16px",
    }}>
      {/* Brand watermark top-left */}
      <Link href="/" style={{
        position: "fixed", top: 20, left: 28,
        fontSize: "0.95rem", letterSpacing: "-0.01em", fontWeight: 800,
        color: "#fff",
        textDecoration: "none",
        display: "inline-block",
      }}>
        YieldSentinel <span style={{ color: "#f59e0b" }}>AI</span>
      </Link>

      {/* Card */}
      <div style={{
        width: "100%",
        maxWidth: 400,
        background: "rgba(9,13,19,0.95)",
        border: "1px solid rgba(30,38,52,0.8)",
        borderRadius: 12,
        padding: "36px 32px",
        backdropFilter: "blur(12px)",
      }}>

        {/* ── Success state ── */}
        {success ? (
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%", margin: "0 auto 20px",
              background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.4rem",
            }}>✓</div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f4f4f5", marginBottom: 10 }}>
              Account created
            </h2>
            <p style={{ fontSize: "0.75rem", color: "#64748b", lineHeight: 1.6, marginBottom: 24 }}>
              Check your email for a confirmation link, then sign in.
            </p>
            <Link href="/login" style={{
              display: "inline-block",
              background: "#f59e0b", color: "#09090b", borderRadius: 6,
              padding: "10px 24px", fontSize: "0.75rem", fontWeight: 700,
              fontFamily: "ui-monospace, monospace", letterSpacing: "0.08em",
              textDecoration: "none", textTransform: "uppercase",
            }}>
              Go to Login →
            </Link>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
              <div style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.52rem",
                fontWeight: 600,
                letterSpacing: "0.2em",
                color: "rgba(245,158,11,0.7)",
                textTransform: "uppercase",
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}>
                <span style={{ width: 16, height: 1, background: "rgba(245,158,11,0.3)", display: "inline-block" }} />
                NEW OPERATOR
              </div>
              <h1 style={{
                fontSize: "1.35rem",
                fontWeight: 700,
                color: "#f4f4f5",
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
              }}>
                Create account
              </h1>
              <p style={{ marginTop: 6, fontSize: "0.78rem", color: "#64748b", lineHeight: 1.5 }}>
                Register to access the YieldIQ platform.
              </p>
            </div>

            {/* Form-level error */}
            {errors.form && (
              <div style={{
                marginBottom: 18, padding: "10px 14px", borderRadius: 6,
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
                fontFamily: "ui-monospace, monospace", fontSize: "0.62rem",
                color: "#ef4444", letterSpacing: "0.02em",
              }}>
                {errors.form}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate>
              {/* Name */}
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>Name</label>
                <input
                  type="text"
                  autoComplete="name"
                  placeholder="Operator name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setFocused("name")}
                  onBlur={() => setFocused(null)}
                  style={inputStyle("name")}
                />
                {errors.name && <div style={errorStyle}>{errors.name}</div>}
              </div>

              {/* Email */}
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="operator@fab.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocused("email")}
                  onBlur={() => setFocused(null)}
                  style={inputStyle("email")}
                />
                {errors.email && <div style={errorStyle}>{errors.email}</div>}
              </div>

              {/* Password */}
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>Password</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocused("password")}
                  onBlur={() => setFocused(null)}
                  style={inputStyle("password")}
                />
                {errors.password && <div style={errorStyle}>{errors.password}</div>}
              </div>

              {/* Confirm Password */}
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Confirm Password</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onFocus={() => setFocused("confirm")}
                  onBlur={() => setFocused(null)}
                  style={inputStyle("confirm")}
                />
                {errors.confirm && <div style={errorStyle}>{errors.confirm}</div>}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  background: loading ? "rgba(245,158,11,0.5)" : "#f59e0b",
                  color: "#09090b",
                  border: "none",
                  borderRadius: 6,
                  padding: "11px 0",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "0.08em",
                  cursor: loading ? "not-allowed" : "pointer",
                  transition: "opacity 0.18s, background 0.18s",
                  textTransform: "uppercase",
                }}
                onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
                onMouseLeave={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.opacity = "1"; }}
              >
                {loading ? "CREATING ACCOUNT..." : "Register →"}
              </button>
            </form>

            {/* Footer link */}
            <div style={{
              marginTop: 20,
              textAlign: "center",
              fontFamily: "ui-monospace, monospace",
              fontSize: "0.6rem",
              color: "#4a5568",
              letterSpacing: "0.04em",
            }}>
              Already have an account?{" "}
              <Link href="/login" style={{ color: "rgba(245,158,11,0.8)", textDecoration: "none" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#f59e0b")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(245,158,11,0.8)")}
              >
                Login →
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
