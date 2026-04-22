"use client";
// src/app/page.js
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Users, TrendingUp, Star, AlertTriangle,
  Search, RefreshCw, ChevronLeft, Activity,
  BookOpen, Award, CalendarDays,
} from "lucide-react";
import { useData } from "@/lib/dataContext";

// ── تنسيق النسبة: يُظهر منزلتين عشريتين فقط إذا كان في كسر ──
function fmt(pct) {
  if (pct === null || pct === undefined) return "—";
  const n = Number(pct);
  return Number.isInteger(n) ? `${n}%` : `${n.toFixed(2)}%`;
}

// ── Status helpers ───────────────────────────────────────────
const STATUS = {
  excellent: { label: "ممتاز",        color: "#10b981", dim: "rgba(16,185,129,0.12)" },
  average:   { label: "متوسط",        color: "#f59e0b", dim: "rgba(245,158,11,0.12)" },
  weak:      { label: "يحتاج متابعة", color: "#ef4444", dim: "rgba(239,68,68,0.12)"  },
};
function getStatus(p) { return p >= 80 ? "excellent" : p >= 50 ? "average" : "weak"; }

// ── Tooltip ──────────────────────────────────────────────────
function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.[0]) return null;
  return (
    <div style={{ background:"var(--surface-2)", border:"1px solid var(--rim)", borderRadius:10, padding:"10px 14px", minWidth:130 }}>
      <p style={{ color:"var(--text-2)", fontSize:12, marginBottom:4 }}>{label}</p>
      <p style={{ color:"#4f8ef7", fontWeight:700, fontSize:18, fontFamily:"Cairo, sans-serif" }}>{payload[0].value}%</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
export default function Dashboard() {
  const router = useRouter();

  // ← بيانات مشتركة — لا fetch هنا، مجلوبة مرة واحدة من الـ Provider
  const { data, loading, refreshing, refresh } = useData();

  const [search,   setSearch]  = useState("");
  const [selMonth, setMonth]   = useState("__all__");
  const [selWeek,  setWeek]    = useState("__all__");
  const [sortBy,   setSortBy]  = useState("name");

  // إعادة ضبط فلتر الأسبوع عند تغيير الشهر
  const prevMonth = useState("__all__")[0];
  useMemo(() => { setWeek("__all__"); }, [selMonth]);

  // ── قائمة الأسابيع المتاحة حسب الشهر المختار ─────────────
  const weeksForMonth = useMemo(() => {
    if (!data) return [];
    if (selMonth === "__all__") {
      // كل الأسابيع من كل الشهور
      return (data.weekStats || []).map((ws) => ({ key: ws.key, label: ws.weekLabel }));
    }
    const monthLabel = data.availableMonths?.find((m) => m.key === selMonth)?.label;
    return (data.weeksByMonth?.[monthLabel] || []).map((w) => ({
      key: `${monthLabel}__${w}`,
      label: w,
    }));
  }, [data, selMonth]);

  // ── إحصائيات الفلتر المختار ──────────────────────────────
  const filtered = useMemo(() => {
    if (!data) return null;

    let weekStatsList = data.weekStats || [];

    // فلتر الشهر
    if (selMonth !== "__all__") {
      const monthLabel = data.availableMonths?.find((m) => m.key === selMonth)?.label;
      weekStatsList = weekStatsList.filter((ws) => ws.month === monthLabel);
    }

    // فلتر الأسبوع
    if (selWeek !== "__all__") {
      weekStatsList = weekStatsList.filter((ws) => ws.key === selWeek);
    }

    // ── حساب نسبة كل طالب = مجموع أسابيعه ÷ عددها ──────────
    const activeWeekKeys = new Set(weekStatsList.map((ws) => `${ws.month}__${ws.week}`));

    const students = data.students.map((s) => {
      // الأسابيع المفعّلة فقط لهذا الطالب
      const activeRecs = s.weeks.filter((w) =>
        activeWeekKeys.has(`${w.month}__${w.week}`) && w.hasData && w.percentage > 0
      );

      if (selWeek !== "__all__") {
        // أسبوع واحد محدد
        const ws  = weekStatsList[0];
        const rec = ws
          ? data.structured?.find((r) => r.name === s.name && r.week === ws.week && r.month === ws.month)
          : null;
        return { ...s, displayPct: rec?.percentage ?? null, weekRecord: rec };
      }

      // متعدد أسابيع: المتوسط = مجموع النسب ÷ عدد الأسابيع المفعّلة
      const pcts = activeRecs.map((w) => w.percentage);
      const avg  = pcts.length
        ? Math.round(pcts.reduce((s, v) => s + v, 0) / pcts.length)
        : null;

      return { ...s, displayPct: avg };
    }).filter((s) => s.displayPct !== null && s.displayPct > 0);

    // ── الإحصائيات بعدد الطلاب (لا بعدد السجلات) ────────────
    const avg      = students.length
      ? Math.round(students.reduce((s, st) => s + st.displayPct, 0) / students.length)
      : 0;
    const excellent = students.filter((s) => s.displayPct >= 80).length;
    const average   = students.filter((s) => s.displayPct >= 50 && s.displayPct < 80).length;
    const weak      = students.filter((s) => s.displayPct > 0  && s.displayPct < 50).length;

    // أفضل 3
    const top3 = [...students]
      .sort((a, b) => b.displayPct - a.displayPct)
      .slice(0, 3)
      .map((s) => ({ name: s.name, percentage: s.displayPct }));

    // بيانات الرسم البياني
    const chartData = weekStatsList.map((ws) => ({
      week:  ws.week.replace(/الأسبوع\s+/, "أ"),
      avg:   ws.avg,
      key:   ws.key,
      month: ws.month,
    }));

    return { avg, excellent, average, weak, top3, chartData, students, total: students.length };
  }, [data, selMonth, selWeek]);

  // ── بحث + ترتيب ──────────────────────────────────────────
  const visible = useMemo(() => {
    if (!filtered) return [];
    let list = filtered.students.filter((s)=>s.name.includes(search)||!search);
    if (sortBy==="pct_desc") list=[...list].sort((a,b)=>b.displayPct-a.displayPct);
    if (sortBy==="pct_asc")  list=[...list].sort((a,b)=>a.displayPct-b.displayPct);
    if (sortBy==="name")     list=[...list].sort((a,b)=>a.name.localeCompare(b.name,"ar"));
    return list;
  }, [filtered, search, sortBy]);

  // ── Loading ───────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}>
      <div style={{ width:44,height:44,border:"3px solid var(--blue)",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite" }}/>
      <p style={{ color:"var(--text-2)" }}>جاري التحميل…</p>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"var(--ink)" }}>

      {/* Header */}
      <header style={{ position:"sticky",top:0,zIndex:50,background:"rgba(13,17,23,0.88)",backdropFilter:"blur(16px)",borderBottom:"1px solid var(--rim)",padding:"0 1.5rem" }}>
        <div style={{ maxWidth:1280,margin:"0 auto",height:64,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <div style={{ width:38,height:38,borderRadius:10,background:"var(--blue)",display:"flex",alignItems:"center",justifyContent:"center" }}>
              <BookOpen size={18} color="#fff"/>
            </div>
            <div>
              <h1 style={{ fontFamily:"Cairo, sans-serif",fontWeight:700,fontSize:16,lineHeight:1.2 }}>لوحة متابعة الطلاب</h1>
              <p style={{ color:"var(--text-3)",fontSize:11 }}>تحفيظ القرآن الكريم</p>
            </div>
          </div>
          <button onClick={()=>refresh()} disabled={refreshing}
            style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:8,background:"var(--surface-2)",border:"1px solid var(--rim)",color:"var(--text-2)",fontSize:13,cursor:"pointer" }}>
            <RefreshCw size={14} style={{ animation:refreshing?"spin 0.8s linear infinite":"none" }}/>
            تحديث
          </button>
        </div>
      </header>

      <main style={{ maxWidth:1280,margin:"0 auto",padding:"2rem 1.5rem",display:"flex",flexDirection:"column",gap:"2rem" }}>

        {/* ── فلاتر ─────────────────────────────────────── */}
        <div className="filters-row anim-fade-up">

          {/* بحث */}
          <div style={{ position:"relative",flex:"1 1 180px",minWidth:160 }}>
            <Search size={14} style={{ position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:"var(--text-3)" }}/>
            <input className="inp" style={{ width:"100%",paddingRight:36 }}
              placeholder="ابحث عن طالب…" value={search}
              onChange={(e)=>setSearch(e.target.value)}/>
          </div>

          {/* فلتر الشهر */}
          <select className="inp" style={{ cursor:"pointer",flex:"0 0 auto" }}
            value={selMonth} onChange={(e)=>setMonth(e.target.value)}>
            <option value="__all__">📅 جميع الشهور</option>
            {data?.availableMonths?.map((m)=>(
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>

          {/* فلتر الأسبوع */}
          <select className="inp" style={{ cursor:"pointer",flex:"0 0 auto" }}
            value={selWeek} onChange={(e)=>setWeek(e.target.value)}>
            <option value="__all__">جميع الأسابيع</option>
            {weeksForMonth.map((w)=>(
              <option key={w.key} value={w.key}>{w.label}</option>
            ))}
          </select>

          {/* ترتيب */}
          <select className="inp" style={{ cursor:"pointer",flex:"0 0 auto" }}
            value={sortBy} onChange={(e)=>setSortBy(e.target.value)}>
            <option value="name">ترتيب: الاسم</option>
            <option value="pct_desc">ترتيب: الأعلى</option>
            <option value="pct_asc">ترتيب: الأدنى</option>
          </select>
        </div>

        {/* ── تبويبات الشهور (اختصار سريع) ──────────────── */}
        {data?.availableMonths?.length > 1 && (
          <div style={{ display:"flex",gap:8,flexWrap:"wrap" }} className="anim-fade-up">
            <MonthTab label="الكل" active={selMonth==="__all__"} onClick={()=>setMonth("__all__")} color="var(--blue)"/>
            {data.availableMonths.map((m)=>(
              <MonthTab key={m.key} label={m.label} active={selMonth===m.key}
                onClick={()=>setMonth(m.key)}
                color={m.key==="month1"?"#8b5cf6":m.key==="month2"?"#f59e0b":"#10b981"}
              />
            ))}
          </div>
        )}

        {/* ── KPI ──────────────────────────────────────── */}
        {filtered && (
          <div className="kpi-grid">
            <KpiCard icon={<Activity size={20}/>}      label="متوسط النسبة"   value={fmt(filtered.avg)}        accent="#4f8ef7"       delay="d1"/>
            <KpiCard icon={<Award size={20}/>}         label="ممتاز ≥ 80%"    value={filtered.excellent}       accent="#10b981"       delay="d2"/>
            <KpiCard icon={<Users size={20}/>}         label="متوسط 50–79%"   value={filtered.average}         accent="#f59e0b"       delay="d3"/>
            <KpiCard icon={<AlertTriangle size={20}/>} label="يحتاج متابعة"   value={filtered.weak}            accent="#ef4444"       delay="d4"/>
            <KpiCard icon={<Users size={20}/>}         label="إجمالي الطلاب"  value={filtered.total}           accent="var(--text-2)" delay="d5"/>
          </div>
        )}

        {/* ── الرسم + أفضل 3 ───────────────────────────── */}
        <div className="lg-grid">
          <div className="card anim-fade-up d2" style={{ padding:"1.5rem" }}>
            <h2 style={{ fontFamily:"Cairo, sans-serif",fontSize:14,fontWeight:600,marginBottom:"1.25rem",display:"flex",alignItems:"center",gap:8 }}>
              <TrendingUp size={16} color="var(--blue)"/>
              متوسط النسبة
              {selMonth!=="__all__" && (
                <span style={{ fontSize:11,padding:"2px 10px",borderRadius:99,background:"var(--surface-3)",color:"var(--text-2)" }}>
                  {data?.availableMonths?.find((m)=>m.key===selMonth)?.label}
                </span>
              )}
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={filtered?.chartData||[]} margin={{ top:4,right:4,left:-18,bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--rim)" vertical={false}/>
                <XAxis dataKey="week" tick={{ fill:"var(--text-3)",fontSize:11 }} axisLine={false} tickLine={false}/>
                <YAxis domain={[0,100]} tick={{ fill:"var(--text-3)",fontSize:12 }} axisLine={false} tickLine={false}/>
                <Tooltip content={<BarTooltip/>}/>
                <Bar dataKey="avg" radius={[6,6,0,0]} maxBarSize={44}>
                  {(filtered?.chartData||[]).map((entry,i)=>(
                    <Cell key={i}
                      fill={entry.key===selWeek?"#4f8ef7":
                            entry.month==="شهر 1"?"#8b5cf6":
                            entry.month==="شهر 2"?"#f59e0b":"#10b981"}
                      opacity={selWeek==="__all__"?1:entry.key===selWeek?1:0.35}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {/* مفتاح ألوان الشهور */}
            {selMonth==="__all__" && (
              <div style={{ display:"flex",gap:14,marginTop:12,justifyContent:"center",flexWrap:"wrap" }}>
                {[{label:"شهر 1",c:"#8b5cf6"},{label:"شهر 2",c:"#f59e0b"},{label:"شهر 3",c:"#10b981"}].map(({label,c})=>(
                  <span key={label} style={{ display:"flex",alignItems:"center",gap:5,fontSize:11,color:"var(--text-3)" }}>
                    <span style={{ width:10,height:10,borderRadius:99,background:c,display:"inline-block" }}/>
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* أفضل 3 */}
          <div className="card anim-fade-up d3" style={{ padding:"1.5rem" }}>
            <h2 style={{ fontFamily:"Cairo, sans-serif",fontSize:14,fontWeight:600,marginBottom:"1.25rem",display:"flex",alignItems:"center",gap:8 }}>
              <Star size={16} color="#f59e0b" fill="#f59e0b"/>
              أفضل 3 طلاب
            </h2>
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
              {filtered?.top3?.map((s,i)=>(
                <Top3Row key={s.name} student={s} rank={i+1}
                  onClick={()=>router.push(`/students/${encodeURIComponent(s.name)}`)}/>
              ))}
              {!filtered?.top3?.length && (
                <p style={{ color:"var(--text-3)",fontSize:13 }}>لا توجد بيانات</p>
              )}
            </div>
          </div>
        </div>

        {/* ── قائمة الطلاب ─────────────────────────────── */}
        <div>
          <h2 style={{ fontFamily:"Cairo, sans-serif",fontSize:14,fontWeight:600,marginBottom:"1rem" }}>
            الطلاب ({visible.length})
          </h2>
          <div className="students-grid">
            {visible.map((s,i)=>(
              <StudentCard key={s.name} student={s} delay={`d${Math.min(i%6+1,6)}`}
                onClick={()=>router.push(`/students/${encodeURIComponent(s.name)}`)}/>
            ))}
          </div>
          {visible.length===0 && (
            <div style={{ textAlign:"center",padding:"4rem 0",color:"var(--text-3)" }}>
              <Users size={48} style={{ margin:"0 auto 12px",opacity:0.3 }}/>
              <p>لا توجد نتائج</p>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}

// ── مكوّنات ──────────────────────────────────────────────────

function MonthTab({ label, active, onClick, color }) {
  return (
    <button onClick={onClick}
      style={{
        padding:"6px 18px",borderRadius:99,fontSize:13,cursor:"pointer",
        fontFamily:"Cairo, sans-serif",fontWeight:600,
        background: active ? color : "var(--surface-2)",
        color: active ? "#fff" : "var(--text-2)",
        border:`1px solid ${active ? color : "var(--rim)"}`,
        transition:"all 0.2s",
      }}>
      {label}
    </button>
  );
}

function KpiCard({ icon, label, value, accent, delay }) {
  return (
    <div className={`card card-hover anim-fade-up ${delay}`}
      style={{ padding:"1.25rem",borderRight:`3px solid ${accent}` }}>
      <div style={{ width:36,height:36,borderRadius:9,background:`${accent}18`,display:"flex",alignItems:"center",justifyContent:"center",color:accent,marginBottom:12 }}>
        {icon}
      </div>
      <p style={{ fontFamily:"Cairo, sans-serif",fontWeight:800,fontSize:28,lineHeight:1,color:accent }}>{value}</p>
      <p style={{ color:"var(--text-3)",fontSize:12,marginTop:4 }}>{label}</p>
    </div>
  );
}

function Top3Row({ student, rank, onClick }) {
  const rankColors = ["#f59e0b","#94a3b8","#b45309"];
  const c   = rankColors[rank-1];
  const pct = student.percentage ?? 0;
  const st  = STATUS[getStatus(pct)];
  // نستخدم Math.min(100, pct) للـ progress bar فقط
  const barWidth = Math.min(100, pct);
  return (
    <div onClick={onClick}
      style={{ display:"flex",alignItems:"center",gap:12,cursor:"pointer",padding:"10px 12px",borderRadius:10,background:"var(--surface-2)",transition:"background 0.2s" }}
      onMouseEnter={(e)=>e.currentTarget.style.background="var(--surface-3)"}
      onMouseLeave={(e)=>e.currentTarget.style.background="var(--surface-2)"}>
      <span style={{ width:28,height:28,borderRadius:"50%",background:`${c}20`,color:c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,fontFamily:"Cairo",flexShrink:0 }}>{rank}</span>
      <div style={{ flex:1,minWidth:0 }}>
        <p style={{ fontSize:13,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{student.name}</p>
        <div style={{ height:4,borderRadius:99,background:"var(--rim)",marginTop:5 }}>
          <div style={{ height:4,borderRadius:99,width:`${barWidth}%`,background:st.color }}/>
        </div>
      </div>
      <span style={{ fontSize:14,fontWeight:700,color:st.color,fontFamily:"Cairo",flexShrink:0 }}>{fmt(pct)}</span>
    </div>
  );
}

function StudentCard({ student, onClick, delay }) {
  const pct     = student.displayPct ?? student.currentPercentage ?? 0;
  const st      = STATUS[getStatus(pct)];
  const barPct  = Math.min(100, pct); // للـ ring و progress bar فقط
  const r=24, circ=2*Math.PI*r, fill=(barPct/100)*circ;

  return (
    <div className={`card card-hover anim-fade-up ${delay}`} onClick={onClick}
      style={{ padding:"1.25rem",cursor:"pointer" }}
      onMouseEnter={(e)=>{ e.currentTarget.style.borderColor=st.color+"60"; }}
      onMouseLeave={(e)=>{ e.currentTarget.style.borderColor="var(--rim)"; }}>

      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,marginBottom:14 }}>
        <div style={{ flex:1,minWidth:0 }}>
          <p style={{ fontFamily:"Cairo, sans-serif",fontWeight:700,fontSize:14,lineHeight:1.4,marginBottom:6 }}>{student.name}</p>
          <span style={{ fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:99,background:st.dim,color:st.color }}>
            {st.label}
          </span>
        </div>
        {/* Ring */}
        <div style={{ position:"relative",flexShrink:0 }}>
          <svg width={60} height={60} style={{ transform:"rotate(-90deg)" }}>
            <circle cx={30} cy={30} r={r} className="ring-track" strokeWidth={5}/>
            <circle cx={30} cy={30} r={r} className="ring-fill"
              stroke={st.color} strokeWidth={5}
              strokeDasharray={`${fill} ${circ}`}
              style={{ filter:`drop-shadow(0 0 5px ${st.color}60)` }}/>
          </svg>
          <span style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Cairo, sans-serif",fontWeight:800,fontSize:11,color:st.color }}>
            {fmt(pct)}
          </span>
        </div>
      </div>

      {student.weekRecord && <WeekMiniTable rec={student.weekRecord}/>}

      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12,paddingTop:10,borderTop:"1px solid var(--rim)",color:"var(--text-3)",fontSize:11 }}>
        <span>{student.weeks?.length ?? 0} أسبوع</span>
        <span style={{ display:"flex",alignItems:"center",gap:3 }}>التفاصيل <ChevronLeft size={12}/></span>
      </div>
    </div>
  );
}

function WeekMiniTable({ rec }) {
  return (
    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 }}>
      {[{l:"الحضور",v:rec.attendance},{l:"الحفظ",v:rec.hifz},{l:"الصغرى",v:rec.sughra},{l:"الكبرى",v:rec.kubra}].map(({l,v})=>(
        <div key={l} style={{ background:"var(--surface-2)",borderRadius:8,padding:"6px 10px" }}>
          <p style={{ fontSize:10,color:"var(--text-3)",marginBottom:2 }}>{l}</p>
          <p style={{ fontFamily:"Cairo, sans-serif",fontWeight:700,fontSize:15 }}>{v??'—'}</p>
        </div>
      ))}
    </div>
  );
}