"use client";
// src/app/students/[id]/page.js
import { useRouter, useParams } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  ArrowRight, TrendingUp, TrendingDown,
  Minus, Calendar, BarChart2,
} from "lucide-react";
import { useData } from "@/lib/dataContext";

// ── تنسيق النسبة ──────────────────────────────────────────
function fmt(pct) {
  if (pct === null || pct === undefined) return "—";
  const n = Number(pct);
  return Number.isInteger(n) ? `${n}%` : `${n.toFixed(2)}%`;
}

// ── تحويل اسم الأسبوع لرقم ───────────────────────────────
function weekLabel(name) {
  const nums = {
    الأول:1, الثاني:2, الثالث:3, الرابع:4, الخامس:5,
    السادس:6, السابع:7, الثامن:8, التاسع:9, العاشر:10,
    "الحادي عشر":11, "الثاني عشر":12, "الثالث عشر":13,
    "الرابع عشر":14, "الخامس عشر":15,
  };
  for (const [w, n] of Object.entries(nums)) {
    if (name.includes(w)) return String(n);
  }
  const m = name.match(/\d+/);
  return m ? m[0] : name.replace(/الأسبوع\s*/g, "").trim();
}
const STATUS = {
  excellent: { label: "ممتاز",        color: "#10b981", dim: "rgba(16,185,129,0.12)" },
  average:   { label: "متوسط",        color: "#f59e0b", dim: "rgba(245,158,11,0.12)" },
  weak:      { label: "يحتاج متابعة", color: "#ef4444", dim: "rgba(239,68,68,0.12)"  },
};
function getStatus(p) { return p >= 80 ? "excellent" : p >= 50 ? "average" : "weak"; }

function LineTooltip({ active, payload, label }) {
  if (!active || !payload?.[0]) return null;
  const pct = payload[0].value;
  const st  = STATUS[getStatus(pct)];
  return (
    <div style={{ background:"var(--surface-2)",border:"1px solid var(--rim)",borderRadius:10,padding:"10px 14px" }}>
      <p style={{ color:"var(--text-2)",fontSize:12,marginBottom:4 }}>{label}</p>
      <p style={{ color:st.color,fontWeight:800,fontSize:22,fontFamily:"Cairo, sans-serif" }}>{fmt(pct)}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
export default function StudentPage() {
  const router = useRouter();
  const { id } = useParams();
  const name   = decodeURIComponent(id);

  // ← بيانات مشتركة من الـ Context — لا fetch هنا
  const { data, loading } = useData();

  if (loading) return (
    <div style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16 }}>
      <div style={{ width:40,height:40,border:"3px solid #4f8ef7",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite" }}/>
      <p style={{ color:"var(--text-2)" }}>جاري التحميل…</p>
    </div>
  );

  const student = data?.students?.find((s) => s.name === name) ?? null;

  if (!student) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <p style={{ fontSize: 48 }}>🔍</p>
      <p style={{ color: "var(--text-2)" }}>الطالب غير موجود</p>
      <button onClick={() => router.push("/")}
        style={{ padding: "8px 20px", borderRadius: 8, background: "#4f8ef7", color: "#fff", cursor: "pointer", fontFamily: "Cairo" }}>
        العودة
      </button>
    </div>
  );

  // ── كل الأسابيع المفعّلة (مرصودة + غير مرصودة بصفر)
  const allStudentWeeks = student.weeks; // لا فلتر — كلها تُحسب

  // ── الأسابيع المرصودة فقط (للمقارنة إذا احتجنا)
  const activeWeeks = student.weeks.filter((w) => w.percentage > 0);

  // المتوسط = مجموع كل الأسابيع المفعّلة ÷ عددها (الصفر يُحسب)
  const avgPctRaw = allStudentWeeks.length
    ? allStudentWeeks.reduce((s, w) => s + w.percentage, 0) / allStudentWeeks.length
    : 0;
  const avgPct = Math.round(avgPctRaw * 100) / 100;

  // الحالة والألوان بناءً على المتوسط
  const st    = STATUS[getStatus(avgPct)];
  const ringPct = Math.min(100, avgPct); // للـ ring فقط
  const r     = 44, circ = 2 * Math.PI * r, fill = (ringPct / 100) * circ;

  // الرسم البياني — كل الأسابيع المفعّلة (بما فيها الصفر)
  const chartData = allStudentWeeks.map((w) => ({
    week:     weekLabel(w.week),
    pct:      Math.round((w.percentage ?? 0) * 100) / 100,
    fullWeek: w.week,
  }));

  // اتجاه التطور (آخر أسبوعين مفعّلين)
  const last2      = allStudentWeeks.slice(-2);
  const trendRaw   = last2.length === 2 ? last2[1].percentage - last2[0].percentage : 0;
  const trend      = Math.round(trendRaw * 100) / 100;
  const TrendIcon  = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend > 0 ? "#10b981"  : trend < 0 ? "#ef4444"   : "var(--text-3)";

  // إحصائيات من كل الأسابيع المفعّلة
  const allPcts = allStudentWeeks.map((w) => w.percentage);
  const maxPct  = allPcts.length ? Math.round(Math.max(...allPcts) * 100) / 100 : 0;
  const minPct  = allPcts.length ? Math.round(Math.min(...allPcts) * 100) / 100 : 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--ink)" }}>

      {/* Header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(13,17,23,0.88)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--rim)", padding: "0 1.5rem",
      }}>
        <div style={{ maxWidth: 960, margin: "0 auto", height: 60, display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.push("/")}
            style={{ width: 36, height: 36, borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--rim)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-2)", flexShrink: 0 }}>
            <ArrowRight size={15} />
          </button>
          <div>
            <h1 style={{ fontFamily: "Cairo, sans-serif", fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>{student.name}</h1>
            <p style={{ color: "var(--text-3)", fontSize: 11 }}>ملف الطالب التفصيلي</p>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        {/* ── Hero card ──────────────────────────────── */}
        <div className="card anim-scale-in" style={{ padding: "1.75rem", borderRight: `4px solid ${st.color}` }}>
          <div className="hero-flex">

            {/* Progress ring */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <svg width={110} height={110} style={{ transform: "rotate(-90deg)" }}>
                <circle cx={55} cy={55} r={r} className="ring-track" strokeWidth={7} />
                <circle cx={55} cy={55} r={r} className="ring-fill"
                  stroke={st.color} strokeWidth={7}
                  strokeDasharray={`${fill} ${circ}`}
                  style={{ filter: `drop-shadow(0 0 10px ${st.color}70)` }}
                />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "Cairo, sans-serif", fontWeight: 800, fontSize: 20, color: st.color, lineHeight: 1 }}>
                  {fmt(avgPct)}
                </span>
                <span style={{ color: "var(--text-3)", fontSize: 10 }}>المتوسط</span>
              </div>
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 200 }}>
              {/* Status badge */}
              <span style={{ display: "inline-block", padding: "4px 14px", borderRadius: 99, background: st.dim, color: st.color, fontSize: 13, fontWeight: 700, fontFamily: "Cairo", marginBottom: 14 }}>
                {st.label}
              </span>

              {/* Mini stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 10 }}>
                <MiniStat label="المتوسط"  value={fmt(avgPct)}          color="#4f8ef7" />
                <MiniStat label="الأعلى"   value={fmt(maxPct)}          color="#10b981" />
                <MiniStat label="الأدنى"   value={fmt(minPct)}          color="#ef4444" />
                <MiniStat label="الأسابيع" value={allStudentWeeks.length} color="var(--text-2)" />
                <div style={{ background: "var(--surface-2)", borderRadius: 10, padding: "10px 12px" }}>
                  <p style={{ color: "var(--text-3)", fontSize: 11, marginBottom: 4 }}>الاتجاه</p>
                  <p style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "Cairo", fontWeight: 700, fontSize: 14, color: trendColor }}>
                    <TrendIcon size={15} />
                    {trend > 0 ? `+${fmt(trend)}` : trend < 0 ? fmt(trend) : "ثابت"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Line chart ─────────────────────────────── */}
        <div className="card anim-fade-up d1" style={{ padding: "1.5rem" }}>
          <h2 style={{ fontFamily: "Cairo, sans-serif", fontSize: 14, fontWeight: 600, marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: 8 }}>
            <BarChart2 size={16} color="#4f8ef7" />
            تطور النسبة عبر الأسابيع
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--rim)" vertical={false} />
              <XAxis dataKey="week" tick={{ fill: "var(--text-3)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "var(--text-3)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <ReferenceLine y={80} stroke="#10b98140" strokeDasharray="5 4"
                label={{ value: "80%", fill: "#10b98160", fontSize: 10, position: "right" }} />
              <ReferenceLine y={50} stroke="#f59e0b40" strokeDasharray="5 4"
                label={{ value: "50%", fill: "#f59e0b60", fontSize: 10, position: "right" }} />
              <Tooltip content={<LineTooltip />} />
              <Line type="monotone" dataKey="pct" stroke={st.color} strokeWidth={2.5}
                dot={{ r: 5, fill: st.color, stroke: "var(--ink)", strokeWidth: 2 }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ── Weekly breakdown ───────────────────────── */}
        <div>
          <h2 style={{ fontFamily: "Cairo, sans-serif", fontSize: 14, fontWeight: 600, marginBottom: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
            <Calendar size={16} color="#4f8ef7" />
            تفاصيل كل أسبوع
            <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "Tajawal", fontWeight: 400 }}>
              ({allStudentWeeks.length} أسبوع)
            </span>
          </h2>
          <div className="weeks-grid">
            {allStudentWeeks.map((week, i) => (
              <WeekCard key={week.week} week={week} delay={`d${Math.min(i % 6 + 1, 6)}`} />
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────

function MiniStat({ label, value, color }) {
  return (
    <div style={{ background: "var(--surface-2)", borderRadius: 10, padding: "10px 12px" }}>
      <p style={{ color: "var(--text-3)", fontSize: 11, marginBottom: 4 }}>{label}</p>
      <p style={{ fontFamily: "Cairo, sans-serif", fontWeight: 800, fontSize: 16, color }}>{value}</p>
    </div>
  );
}

function WeekCard({ week, delay }) {
  const pct    = week.percentage ?? 0;
  const st     = STATUS[getStatus(pct)];
  const barPct = Math.min(100, pct);
  const fields = [
    { label: "الحضور", val: week.attendance, icon: "👤" },
    { label: "الحفظ",  val: week.hifz,       icon: "📖" },
    { label: "الصغرى", val: week.sughra,     icon: "📝" },
    { label: "الكبرى", val: week.kubra,      icon: "📋" },
  ];

  // كل القيم أصفار أو فارغة = لم يُرصد بعد
  const isUnrecorded = pct === 0 &&
    [week.attendance, week.hifz, week.sughra, week.kubra]
      .every((v) => v === null || v === 0);

  if (isUnrecorded) {
    return (
      <div className={`card anim-fade-up ${delay}`} style={{ padding: "1.25rem", position: "relative", overflow: "hidden" }}>
        {/* البيانات في الخلفية */}
        <div style={{ opacity: 0.25 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontFamily: "Cairo, sans-serif", fontWeight: 600, fontSize: 13, color: "var(--text-2)" }}>
              {week.week}
            </span>
            <span style={{ fontFamily: "Cairo, sans-serif", fontWeight: 800, fontSize: 16, color: "var(--text-3)" }}>
              0%
            </span>
          </div>
          <div style={{ height: 5, borderRadius: 99, background: "var(--rim)", marginBottom: 14 }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {fields.map(({ label, val, icon }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface-2)", borderRadius: 8, padding: "6px 10px" }}>
                <span style={{ fontSize: 14 }}>{icon}</span>
                <div>
                  <p style={{ fontSize: 10, color: "var(--text-3)" }}>{label}</p>
                  <p style={{ fontFamily: "Cairo", fontWeight: 700, fontSize: 14 }}>{val ?? 0}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* طبقة "لم يُرصد" فوق البيانات */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 8,
          background: "rgba(13,17,23,0.55)",
          backdropFilter: "blur(2px)",
          borderRadius: 14,
        }}>
          <span style={{ fontSize: 26 }}>⏳</span>
          <span style={{ fontFamily: "Cairo, sans-serif", fontWeight: 600, fontSize: 12, color: "var(--text-2)" }}>
            لم يُرصد بعد
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`card anim-fade-up ${delay}`} style={{ padding: "1.25rem" }}>
      {/* Week header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontFamily: "Cairo, sans-serif", fontWeight: 600, fontSize: 13, color: "var(--text-2)" }}>
          {week.week}
        </span>
        <span style={{ fontFamily: "Cairo, sans-serif", fontWeight: 800, fontSize: 16, color: st.color }}>
          {fmt(pct)}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 5, borderRadius: 99, background: "var(--rim)", marginBottom: 14 }}>
        <div style={{ height: 5, borderRadius: 99, width: `${barPct}%`, background: st.color, boxShadow: `0 0 8px ${st.color}60` }} />
      </div>

      {/* Fields */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {fields.map(({ label, val, icon }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface-2)", borderRadius: 8, padding: "6px 10px" }}>
            <span style={{ fontSize: 14 }}>{icon}</span>
            <div>
              <p style={{ fontSize: 10, color: "var(--text-3)" }}>{label}</p>
              <p style={{ fontFamily: "Cairo", fontWeight: 700, fontSize: 14 }}>{val ?? "—"}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Status badge */}
      <div style={{ marginTop: 10, textAlign: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 12px", borderRadius: 99, background: st.dim, color: st.color }}>
          {st.label}
        </span>
      </div>
    </div>
  );
}
