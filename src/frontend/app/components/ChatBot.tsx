"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "../../src/lib/supabase";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const WELCOME: Message = {
  role: "assistant",
  content:
    "Hi! I'm YieldSentinel Assistant. Ask me anything about semiconductor yield, wafers, defects, or the application.",
};

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get user session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user.id ?? null);
    });
  }, []);

  // Scroll to bottom whenever messages change or chat opens
  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  // Focus input when chat opens
  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    // History to send = all messages except the welcome (index 0) and the one we just added
    const history = nextMessages.slice(1, -1);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history, userId }),
      });
      const data = await res.json();
      const reply: string =
        data.reply ??
        data.error ??
        "Sorry, I couldn't process that request right now. Please try again.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I couldn't process that request right now. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {/* ── Floating chat window ── */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 84,
            right: 20,
            width: "min(380px, calc(100vw - 40px))",
            height: "min(520px, calc(100vh - 120px))",
            background: "#0d1117",
            border: "1px solid rgba(201,150,58,0.25)",
            borderRadius: 14,
            boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,150,58,0.08)",
            display: "flex",
            flexDirection: "column",
            zIndex: 9999,
            fontFamily: "Inter, system-ui, -apple-system, sans-serif",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(10,13,18,0.95)",
              flexShrink: 0,
            }}
          >
            {/* AI icon */}
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "linear-gradient(135deg, #c9963a 0%, #e8b96a 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                {/* Head */}
                <rect x="3" y="7" width="18" height="13" rx="2.5" stroke="#080808" strokeWidth="2" />
                {/* Antenna */}
                <line x1="12" y1="2" x2="12" y2="7" stroke="#080808" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="2" r="1.2" fill="#080808" />
                {/* Eyes */}
                <circle cx="8.5" cy="13" r="1.6" fill="#080808" />
                <circle cx="15.5" cy="13" r="1.6" fill="#080808" />
                {/* Mouth */}
                <path d="M8.5 16.5 Q12 18.5 15.5 16.5" stroke="#080808" strokeWidth="1.6" strokeLinecap="round" fill="none" />
                {/* Ear bolts */}
                <line x1="3" y1="12" x2="1" y2="12" stroke="#080808" strokeWidth="1.8" strokeLinecap="round" />
                <line x1="21" y1="12" x2="23" y2="12" stroke="#080808" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "#f0f0f0",
                  letterSpacing: "0.02em",
                }}
              >
                YieldSentinel Assistant
              </div>
              <div
                style={{
                  fontSize: "0.6rem",
                  color: loading ? "#f59e0b" : "#10b981",
                  letterSpacing: "0.08em",
                  fontFamily: "ui-monospace, monospace",
                  marginTop: 1,
                }}
              >
                {loading ? "THINKING..." : "ONLINE"}
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                border: "none",
                background: "rgba(255,255,255,0.05)",
                color: "#888899",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1rem",
                lineHeight: 1,
                flexShrink: 0,
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                e.currentTarget.style.color = "#f0f0f0";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.color = "#888899";
              }}
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "14px 14px 8px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(255,255,255,0.08) transparent",
            }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "82%",
                    padding: "8px 12px",
                    borderRadius: msg.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                    background:
                      msg.role === "user"
                        ? "linear-gradient(135deg, #c9963a, #a07028)"
                        : "rgba(20,26,36,0.9)",
                    border: msg.role === "user" ? "none" : "1px solid rgba(255,255,255,0.06)",
                    color: msg.role === "user" ? "#080808" : "#d4d8e0",
                    fontSize: "0.8rem",
                    lineHeight: 1.55,
                    fontWeight: msg.role === "user" ? 500 : 400,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    padding: "8px 14px",
                    borderRadius: "12px 12px 12px 4px",
                    background: "rgba(20,26,36,0.9)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: "#c9963a",
                        display: "inline-block",
                        animation: `ysChatDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: "10px 12px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(10,13,18,0.8)",
              flexShrink: 0,
              display: "flex",
              gap: 8,
              alignItems: "flex-end",
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              disabled={loading}
              rows={1}
              style={{
                flex: 1,
                resize: "none",
                background: "rgba(20,26,36,0.8)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                color: "#f0f0f0",
                fontSize: "0.8rem",
                padding: "8px 10px",
                fontFamily: "inherit",
                lineHeight: 1.5,
                maxHeight: 100,
                overflowY: "auto",
                outline: "none",
                transition: "border-color 0.15s",
                scrollbarWidth: "none",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(201,150,58,0.45)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              aria-label="Send message"
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                border: "none",
                background:
                  loading || !input.trim()
                    ? "rgba(201,150,58,0.2)"
                    : "linear-gradient(135deg, #c9963a, #a07028)",
                color: loading || !input.trim() ? "rgba(201,150,58,0.4)" : "#080808",
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "background 0.15s",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Launcher button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: "1px solid rgba(201,150,58,0.35)",
          background: open
            ? "linear-gradient(135deg, #c9963a, #a07028)"
            : "rgba(13,17,23,0.95)",
          boxShadow: open
            ? "0 4px 24px rgba(201,150,58,0.4)"
            : "0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,150,58,0.12)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          transition: "background 0.2s, box-shadow 0.2s, transform 0.15s",
          color: open ? "#080808" : "#c9963a",
        }}
        onMouseEnter={(e) => {
          if (!open) {
            e.currentTarget.style.boxShadow =
              "0 4px 24px rgba(201,150,58,0.3), 0 0 0 1px rgba(201,150,58,0.3)";
            e.currentTarget.style.transform = "scale(1.06)";
          }
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.style.boxShadow =
              "0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,150,58,0.12)";
            e.currentTarget.style.transform = "scale(1)";
          }
        }}
      >
        {open ? (
          /* X icon when open */
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          /* Robot / bot face icon when closed */
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            {/* Head */}
            <rect x="3" y="7" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
            {/* Antenna */}
            <line x1="12" y1="2" x2="12" y2="7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="12" cy="2" r="1.2" fill="currentColor" />
            {/* Eyes */}
            <circle cx="8.5" cy="13" r="1.6" fill="currentColor" />
            <circle cx="15.5" cy="13" r="1.6" fill="currentColor" />
            {/* Mouth */}
            <path d="M8.5 16.5 Q12 18.5 15.5 16.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
            {/* Ear bolts */}
            <line x1="3" y1="12" x2="1" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Typing dot keyframe — injected once */}
      <style>{`
        @keyframes ysChatDot {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}
