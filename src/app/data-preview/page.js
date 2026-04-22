"use client";
// src/app/data-preview/page.js
// صفحة مساعدة: معاينة نتيجة تحويل البيانات من Google Sheets
// مفيدة للتشخيص — يمكن حذفها في الإنتاج
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle, XCircle, AlertCircle } from "lucide-react";

export default function DataPreview() {
  const router = useRouter();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]       = useState("summary"); // summary | structured | students | raw

  useEffect(() => {
    fetch("/api/students")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const th = { padding: "8px 12px", textAlign: "right", borderBottom: "1px solid var(--rim)", color: "var(--text-3)", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" };
  const td = { padding: "8px 12px", borderBottom: "1px solid var(--rim)", fontSize: 13, color: "var(--text-1)" };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 36, height: 36, border: "3px solid #4f8ef7", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    </div>
  );

  const studentsCount  = data?.students?.length ?? 0;
  const weeksCount     = data?.allWeeks?.length ?? 0;
  const recordsCount   = data?.structured?.length ?? 0;
  const expectedRecords = studentsCount * weeksCount;
  const missingRecords  = expectedRecords - recordsCount;

  return (
    <div style={{ minHeight: "100vh", background: "var(--ink)", fontFamily: "Tajawal, sans-serif" }}>

      {/* Header */}
      <header style={{ background: "rgba(13,17,23,0.9)", backdropFilter: "blur(16px)", borderBottom: "1px solid var(--rim)", padding: "0 1.5rem" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", height: 60, display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.push("/")}
            style={{ width: 34, height: 34, borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--rim)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-2)" }}>
            <ArrowRight size={14} />
          </button>
          <div>
            <h1 style={{ fontFamily: "Cairo, sans-serif", fontWeight: 700, fontSize: 15 }}>معاينة البيانات</h1>
            <p style={{ color: "var(--text-3)", fontSize: 11 }}>نتيجة تحويل Wide Format → Structured</p>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          {[
            { label: "الطلاب",       value: studentsCount,   ok: studentsCount > 0 },
            { label: "الأسابيع",     value: weeksCount,      ok: weeksCount > 0 },
            { label: "السجلات",      value: recordsCount,    ok: recordsCount > 0 },
            { label: "السجلات المتوقعة", value: expectedRecords, ok: true },
            { label: "سجلات ناقصة", value: missingRecords,   ok: missingRecords === 0 },
          ].map(({ label, value, ok }) => (
            <div key={label} className="card" style={{ padding: "1rem 1.25rem", borderRight: `3px solid ${ok ? "#10b981" : "#ef4444"}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                {ok
                  ? <CheckCircle size={14} color="#10b981" />
                  : <AlertCircle size={14} color="#f59e0b" />
                }
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>{label}</span>
              </div>
              <p style={{ fontFamily: "Cairo, sans-serif", fontWeight: 800, fontSize: 24, color: ok ? "#10b981" : "#f59e0b" }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Weeks list */}
        <div className="card" style={{ padding: "1.25rem" }}>
          <h2 style={{ fontFamily: "Cairo, sans-serif", fontSize: 13, fontWeight: 600, marginBottom: 12 }}>الأسابيع المكتشفة</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {data?.allWeeks?.map((w) => (
              <span key={w} style={{ padding: "4px 12px", borderRadius: 99, background: "var(--surface-2)", border: "1px solid var(--rim)", fontSize: 12, color: "var(--text-2)" }}>
                {w}
              </span>
            ))}
            {!data?.allWeeks?.length && (
              <span style={{ color: "var(--red)", fontSize: 13 }}>⚠️ لم يتم اكتشاف أي أسبوع — تحقق من هيكل الجدول</span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div>
          <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
            {[
              { key: "structured", label: `السجلات (${recordsCount})` },
              { key: "students",   label: `الطلاب (${studentsCount})` },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)}
                style={{
                  padding: "6px 16px", borderRadius: 8, fontSize: 13, cursor: "pointer",
                  background: tab === key ? "#4f8ef7" : "var(--surface-2)",
                  color: tab === key ? "#fff" : "var(--text-2)",
                  border: `1px solid ${tab === key ? "#4f8ef7" : "var(--rim)"}`,
                  fontFamily: "Cairo, sans-serif", fontWeight: 600,
                }}>
                {label}
              </button>
            ))}
          </div>

          {/* Structured records table */}
          {tab === "structured" && (
            <div className="card" style={{ overflow: "auto", maxHeight: 480 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ position: "sticky", top: 0, background: "var(--surface-2)" }}>
                  <tr>
                    {["الاسم", "الأسبوع", "الحضور", "الحفظ", "الصغرى", "الكبرى", "النسبة"].map((h) => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.structured?.slice(0, 200).map((rec, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                      <td style={{ ...td, fontWeight: 600 }}>{rec.name}</td>
                      <td style={{ ...td, color: "var(--text-2)" }}>{rec.week}</td>
                      <td style={td}>{rec.attendance ?? "—"}</td>
                      <td style={td}>{rec.hifz ?? "—"}</td>
                      <td style={td}>{rec.sughra ?? "—"}</td>
                      <td style={td}>{rec.kubra ?? "—"}</td>
                      <td style={{ ...td, fontFamily: "Cairo, sans-serif", fontWeight: 700, color: rec.percentage >= 80 ? "#10b981" : rec.percentage >= 50 ? "#f59e0b" : "#ef4444" }}>
                        {rec.percentage !== null ? `${rec.percentage}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(data?.structured?.length ?? 0) > 200 && (
                <p style={{ padding: "10px 16px", color: "var(--text-3)", fontSize: 12 }}>
                  يُعرض أول 200 سجل من {data.structured.length}
                </p>
              )}
            </div>
          )}

          {/* Students summary table */}
          {tab === "students" && (
            <div className="card" style={{ overflow: "auto", maxHeight: 480 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ position: "sticky", top: 0, background: "var(--surface-2)" }}>
                  <tr>
                    {["الاسم", "الأسابيع", "آخر نسبة", "المتوسط", "الحالة"].map((h) => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.students?.map((s, i) => {
                    const color = s.status === "excellent" ? "#10b981" : s.status === "average" ? "#f59e0b" : "#ef4444";
                    const label = s.status === "excellent" ? "ممتاز" : s.status === "average" ? "متوسط" : "يحتاج متابعة";
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)", cursor: "pointer" }}
                        onClick={() => router.push(`/students/${encodeURIComponent(s.name)}`)}>
                        <td style={{ ...td, fontWeight: 600 }}>{s.name}</td>
                        <td style={{ ...td, color: "var(--text-2)" }}>{s.weeks.length}</td>
                        <td style={{ ...td, fontFamily: "Cairo", fontWeight: 700, color }}>{s.currentPercentage}%</td>
                        <td style={{ ...td, color: "var(--text-2)" }}>{s.avgPercentage}%</td>
                        <td style={td}>
                          <span style={{ padding: "2px 10px", borderRadius: 99, background: `${color}18`, color, fontSize: 12, fontWeight: 600 }}>
                            {label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p style={{ color: "var(--text-3)", fontSize: 12, textAlign: "center" }}>
          💡 يمكنك حذف هذه الصفحة (<code style={{ background: "var(--surface-2)", padding: "1px 6px", borderRadius: 4 }}>src/app/data-preview/</code>) بعد التحقق من البيانات
        </p>
      </main>
    </div>
  );
}
