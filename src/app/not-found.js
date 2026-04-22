// src/app/not-found.js
"use client";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 20,
      background: "var(--ink)",
      fontFamily: "Tajawal, sans-serif",
      textAlign: "center",
      padding: "2rem",
    }}>
      <div style={{
        width: 80, height: 80,
        borderRadius: 20,
        background: "var(--surface)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 36,
        border: "1px solid var(--rim)",
      }}>🔍</div>
      <div>
        <h1 style={{ fontFamily: "Cairo, sans-serif", fontWeight: 800, fontSize: 22, marginBottom: 8 }}>
          الصفحة غير موجودة
        </h1>
        <p style={{ color: "var(--text-3)", fontSize: 14 }}>
          تحقق من الرابط أو عد إلى الصفحة الرئيسية
        </p>
      </div>
      <button
        onClick={() => router.push("/")}
        style={{
          padding: "10px 28px",
          borderRadius: 10,
          background: "#4f8ef7",
          color: "#fff",
          fontSize: 14,
          fontFamily: "Cairo, sans-serif",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        العودة للرئيسية
      </button>
    </div>
  );
}
