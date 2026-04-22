// src/lib/sheets.js  ─── SERVER ONLY ───
import { google } from "googleapis";

// ─────────────────────────────────────────────────────────────
//  أسماء الشهور — عدّلها إذا تغيّرت أسماء الشيتات
// ─────────────────────────────────────────────────────────────
export const MONTHS = [
  { key: "month1", label: "شهر 1", sheetName: "إنجاز الترم الثاني شهر 1" },
  { key: "month2", label: "شهر 2", sheetName: "إنجاز الترم الثاني شهر 2" },
  { key: "month3", label: "شهر 3", sheetName: "إنجاز الترم الثاني شهر 3" },
];

// ─────────────────────────────────────────────────────────────
//  STEP 1: جلب شيت واحد
// ─────────────────────────────────────────────────────────────
async function fetchSheet(sheets, spreadsheetId, sheetName) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:ZZ500`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    return res.data.values || [];
  } catch (err) {
    console.warn(`⚠️  فشل جلب الشيت "${sheetName}":`, err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
//  STEP 2: جلب كل الشهور بالتوازي
// ─────────────────────────────────────────────────────────────
export async function fetchAllSheets() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets        = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    const results = await Promise.all(
      MONTHS.map((m) => fetchSheet(sheets, spreadsheetId, m.sheetName))
    );

    const data = {};
    MONTHS.forEach((m, i) => { data[m.key] = results[i]; });
    return data;
  } catch (err) {
    console.warn("⚠️  Google Sheets unavailable — using mock data:", err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
//  STEP 3: تحويل Wide Format → Structured لشهر واحد
//
//  هيكل الجدول المتوقع:
//  الصف 0: م | الاسم | الأسبوع الثامن |   |   |   |   | الأسبوع التاسع | ...
//  الصف 1:   |       | الحضور | الحفظ | الصغرى | الكبرى | النسبة | ...
//  الصف 2+:  بيانات الطلاب
//  ...
//  الصف قبل الأخير: مجاميع (النسبة / الحساب الأسبوعي)
//  الصف الأخير أو قريب منه: تفعيل | TRUE | | | | | FALSE | | | | | TRUE ...
//
//  قواعد التفعيل:
//  - TRUE (بأي شكل: true / TRUE / 1 / نعم) = الأسبوع مفعّل → يظهر
//  - أي شيء آخر (FALSE / فارغ / 0)          = الأسبوع معطّل → يختفي كلياً
// ─────────────────────────────────────────────────────────────
export function transformWideToStructured(rawRows, monthLabel) {
  if (!rawRows || rawRows.length < 3) return [];

  // ── اكتشاف تلقائي لصفوف العناوين ───────────────────────
  // نبحث عن الصف الذي يحتوي على أسماء الأسابيع
  // والصف الذي يحتوي على: الحضور، الحفظ، الصغرى...
  let weekRow   = -1; // الصف الذي فيه أسماء الأسابيع
  let headerRow = -1; // الصف الذي فيه الحضور/الحفظ/...
  let dataStart = 2;  // أول صف بيانات

  for (let r = 0; r < Math.min(5, rawRows.length); r++) {
    const row     = rawRows[r] || [];
    const rowText = row.join(" ");

    // هل هذا الصف يحتوي على اسم أسبوع؟
    if (weekRow === -1 && row.some((c) => isWeekName(String(c || "").trim()))) {
      weekRow = r;
    }
    // هل هذا الصف يحتوي على عناوين الأعمدة؟
    if (headerRow === -1 && (
      rowText.includes("الحضور") || rowText.includes("حضور") ||
      rowText.includes("الحفظ")  || rowText.includes("النسبة")
    )) {
      headerRow = r;
    }
  }

  // إذا ما لقينا → افتراضي
  if (weekRow   === -1) weekRow   = 0;
  if (headerRow === -1) headerRow = weekRow + 1;
  dataStart = Math.max(weekRow, headerRow) + 1;

  const row0 = rawRows[weekRow]   || [];
  const row1 = rawRows[headerRow] || [];

  // ── اكتشاف عمود الاسم ──────────────────────────────────
  let nameCol = 1;
  for (let c = 0; c < row1.length; c++) {
    const cell = String(row1[c] || "").trim();
    if (cell === "الاسم" || cell === "اسم الطالب" || cell === "الطالب") {
      nameCol = c;
      break;
    }
  }
  // إذا ما لقينا في headerRow، ابحث في weekRow
  if (nameCol === 1) {
    for (let c = 0; c < row0.length; c++) {
      const cell = String(row0[c] || "").trim();
      if (cell === "الاسم" || cell === "اسم الطالب" || cell === "الطالب") {
        nameCol = c;
        break;
      }
    }
  }

  // ── 2. اكتشاف الأسابيع وأعمدتها ────────────────────────
  // نجمع أولاً كل مواقع أسماء الأسابيع
  const rawWeekCols = [];
  for (let c = nameCol + 1; c < row0.length; c++) {
    const cell = String(row0[c] || "").trim();
    if (cell && isWeekName(cell)) {
      rawWeekCols.push({ weekName: cell, col: c });
    }
  }

  // لكل أسبوع: نحدد أين تبدأ أعمدته الـ 5 بالبحث عن العناوين في row1
  const colNames = {
    "الحضور": "attendance", "حضور": "attendance",
    "الحفظ":  "hifz",       "حفظ":  "hifz",
    "الصغرى": "sughra",     "صغرى": "sughra",
    "الكبرى": "kubra",      "كبرى": "kubra",
    "النسبة": "percentage", "نسبة": "percentage", "النسبه": "percentage",
  };

  const weekHeaders = rawWeekCols.map(({ weekName, col }) => {
    // ابحث في نطاق ±1 من موقع اسم الأسبوع لإيجاد أعمدة البيانات
    const colOrder = {
      attendance: col,
      hifz:       col + 1,
      sughra:     col + 2,
      kubra:      col + 3,
      percentage: col + 4,
    };

    // نبحث في نطاق -4 إلى +5 من موقع اسم الأسبوع
    for (let o = -4; o <= 5; o++) {
      const c = col + o;
      if (c < 0) continue;
      const v = String(row1[c] || "").trim();
      const mapped = colNames[v];
      if (mapped) colOrder[mapped] = c;
    }

    return { weekName, colStart: col, colOrder };
  });

  // ── 3. قراءة صف TRUE/FALSE لكل أسبوع ───────────────────
  const enabledWeeks = new Set();

  for (let r = rawRows.length - 1; r >= dataStart; r--) {
    const row       = rawRows[r];
    const firstCell = String(row[nameCol] || "").trim().toLowerCase();

    const isToggleRow =
      firstCell === "تفعيل"         ||
      firstCell === "تفعيل الأسبوع" ||
      firstCell === "إظهار"         ||
      firstCell === "show"          ||
      firstCell === "enable"        ||
      weekHeaders.some((wh) => {
        const v = String(row[wh.colStart] || "").trim().toLowerCase();
        return v === "true" || v === "false";
      });

    if (isToggleRow) {
      weekHeaders.forEach(({ weekName, colStart }) => {
        const raw = String(row[colStart] || "").trim().toLowerCase();
        const isEnabled = raw === "true" || raw === "1" || raw === "نعم" || raw === "yes";
        if (isEnabled) enabledWeeks.add(weekName);
      });
      break;
    }
  }

  const hasToggleRow = enabledWeeks.size > 0;

  // ── 4. فلترة الأسابيع: TRUE + فيه بيانات فعلية ──────────
  const weeksWithRealData = new Set();
  for (let r = dataStart; r < rawRows.length; r++) {
    const row  = rawRows[r];
    const name = String(row[nameCol] || "").trim();
    if (!name || isSummaryRow(name) || /^\d+$/.test(name)) continue;
    weekHeaders.forEach(({ weekName, colOrder }) => {
      const pct = parsePercentage(row[colOrder.percentage]);
      if (pct !== null && pct > 0) weeksWithRealData.add(weekName);
    });
  }

  const activeWeeks = weekHeaders.filter((wh) => {
    const toggleOk = !hasToggleRow || enabledWeeks.has(wh.weekName); // TRUE أو لا يوجد صف تفعيل
    const dataOk   = weeksWithRealData.has(wh.weekName);             // فيه بيانات حقيقية
    return toggleOk && dataOk;
  });

  // ── 5. تحويل بيانات الطلاب للأسابيع المفعّلة فقط ────────
  const structured = [];
  for (let r = dataStart; r < rawRows.length; r++) {
    const row  = rawRows[r];
    const name = String(row[nameCol] || "").trim();
    if (!name || isSummaryRow(name) || /^\d+$/.test(name)) continue;

    activeWeeks.forEach(({ weekName, colOrder }) => {
      const attendance = parseValue(row[colOrder.attendance]);
      const hifz       = parseValue(row[colOrder.hifz]);
      const sughra     = parseValue(row[colOrder.sughra]);
      const kubra      = parseValue(row[colOrder.kubra]);
      const percentage = parsePercentage(row[colOrder.percentage]);
      const hasData    = [attendance, hifz, sughra, kubra, percentage].some((v) => v !== null);

      structured.push({
        name,
        month: monthLabel,
        week: weekName,
        weekOrder: extractWeekOrder(weekName),
        attendance, hifz, sughra, kubra,
        percentage: hasData ? (percentage ?? 0) : 0,
        hasData,
      });
    });
  }

  return structured;
}

// ─────────────────────────────────────────────────────────────
//  STEP 4: بناء كائنات الطلاب
// ─────────────────────────────────────────────────────────────
export function buildStudentsFromStructured(records) {
  const map = {};
  records.forEach((rec) => {
    if (!map[rec.name]) map[rec.name] = { name: rec.name, weeks: [] };
    map[rec.name].weeks.push(rec);
  });

  return Object.values(map).map((student) => {
    const monthOrder = { "شهر 1": 1, "شهر 2": 2, "شهر 3": 3 };
    student.weeks.sort((a, b) =>
      ((monthOrder[a.month] || 0) - (monthOrder[b.month] || 0)) || (a.weekOrder - b.weekOrder)
    );

    const validPcts = student.weeks
      .filter((w) => w.hasData)
      .map((w) => w.percentage)
      .filter((p) => p > 0);

    const avgPct     = validPcts.length ? Math.round(validPcts.reduce((s, v) => s + v, 0) / validPcts.length) : 0;
    const latestData = [...student.weeks].reverse().find((w) => w.hasData);
    const currentPct = latestData?.percentage ?? 0;

    return { ...student, avgPercentage: avgPct, currentPercentage: currentPct, status: getStatus(currentPct) };
  });
}

// ─────────────────────────────────────────────────────────────
//  STEP 5: Entry Point الرئيسي
// ─────────────────────────────────────────────────────────────
export async function getProcessedData() {
  let sheetsData = await fetchAllSheets();

  if (!sheetsData) {
    sheetsData = {
      month1: generateMockWideFormat("شهر 1"),
      month2: generateMockWideFormat("شهر 2"),
      month3: generateMockWideFormat("شهر 3"),
    };
  }

  // تحويل كل شهر
  const allStructured = [];
  MONTHS.forEach((m) => {
    if (sheetsData[m.key]) {
      allStructured.push(...transformWideToStructured(sheetsData[m.key], m.label));
    }
  });

  const students = buildStudentsFromStructured(allStructured);

  const availableMonths = MONTHS
    .filter((m) => sheetsData[m.key])
    .map((m) => ({ key: m.key, label: m.label }));

  // إحصائيات كل أسبوع — مع تجاهل الأسابيع التي لم تُرصد بعد
  const seen = new Set();
  const weekStats = [];
  allStructured.forEach((rec) => {
    const key = `${rec.month}__${rec.week}`;
    if (seen.has(key)) return;
    seen.add(key);

    const weekRecs = allStructured.filter((r) => r.week === rec.week && r.month === rec.month && r.hasData);
    const nonZero  = weekRecs.filter((r) => r.percentage > 0);

    // ← تجاهل الأسبوع كلياً إذا كان الجميع صفر (لم يُرصد بعد)
    if (nonZero.length === 0) return;

    const pcts = nonZero.map((r) => r.percentage);
    const avg  = Math.round(pcts.reduce((s, v) => s + v, 0) / pcts.length);

    weekStats.push({
      week: rec.week, month: rec.month, key,
      weekLabel: `${rec.month} — ${rec.week}`,
      avg,
      excellent:      pcts.filter((p) => p >= 80).length,
      average:        pcts.filter((p) => p >= 50 && p < 80).length,
      needsAttention: pcts.filter((p) => p > 0 && p < 50).length,
      top3: [...nonZero].sort((a, b) => b.percentage - a.percentage).slice(0, 5)
        .map((r) => ({ name: r.name, percentage: r.percentage })),
    });
  });

  // أسابيع كل شهر — فقط الأسابيع المرصودة
  const weeksByMonth = {};
  availableMonths.forEach(({ label }) => {
    weeksByMonth[label] = weekStats
      .filter((ws) => ws.month === label)
      .map((ws) => ws.week);
  });

  return { students, structured: allStructured, availableMonths, weeksByMonth, weekStats };
}

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────
export function getStatus(pct) {
  if (pct >= 80) return "excellent";
  if (pct >= 50) return "average";
  return "weak";
}

export const STATUS_CONFIG = {
  excellent: { label: "ممتاز",        color: "#10b981", light: "#d1fae5", dark: "#065f46" },
  average:   { label: "متوسط",        color: "#f59e0b", light: "#fef3c7", dark: "#92400e" },
  weak:      { label: "يحتاج متابعة", color: "#ef4444", light: "#fee2e2", dark: "#991b1b" },
};

function detectColumnOrder(headerRow, colStart) {
  // الترتيب الافتراضي: حضور(+0) حفظ(+1) صغرى(+2) كبرى(+3) نسبة(+4)
  const defaults = {
    attendance: colStart,
    hifz:       colStart + 1,
    sughra:     colStart + 2,
    kubra:      colStart + 3,
    percentage: colStart + 4,
  };

  const colNames = {
    "الحضور": "attendance", "حضور": "attendance",
    "الحفظ":  "hifz",       "حفظ":  "hifz",
    "الصغرى": "sughra",     "صغرى": "sughra",
    "الكبرى": "kubra",      "كبرى": "kubra",
    "النسبة": "percentage", "نسبة": "percentage", "النسبه": "percentage",
  };

  const result = { ...defaults };
  let foundCount = 0;

  // نبحث في نطاق 6 أعمدة ابتداءً من colStart
  for (let o = 0; o < 6; o++) {
    const colIdx  = colStart + o;
    const cellVal = String(headerRow[colIdx] || "").trim();
    const mapped  = colNames[cellVal];
    if (mapped) {
      result[mapped] = colIdx;
      foundCount++;
    }
  }

  // إذا ما لقينا العناوين → جرب البحث قبل colStart (الجدول معكوس)
  // مثال: النسبة أول عمود ثم الكبرى ثم الصغرى ثم الحفظ ثم الحضور
  if (foundCount < 3) {
    for (let o = -4; o < 6; o++) {
      const colIdx  = colStart + o;
      if (colIdx < 0) continue;
      const cellVal = String(headerRow[colIdx] || "").trim();
      const mapped  = colNames[cellVal];
      if (mapped) result[mapped] = colIdx;
    }
  }

  return result;
}

function parseValue(v) {
  if (v === undefined || v === null || String(v).trim() === "") return null;
  const n = parseFloat(String(v).replace(/[^\d.]/g, ""));
  return isNaN(n) ? null : n;
}

function parsePercentage(v) {
  if (v === undefined || v === null || String(v).trim() === "") return null;
  const n = parseFloat(String(v).replace(/%/g, "").trim());
  if (isNaN(n)) return null;
  const pct = n > 1 ? n : n * 100;
  // تقريب لمنزلتين عشريتين للقضاء على 133.33333...
  return Math.round(pct * 100) / 100;
}

function isWeekName(s) { return /أسبوع|week/i.test(s); }

function isSummaryRow(name) {
  return /النسبة|الحساب|المجموع|إجمالي|الحساب الأسبوعي|تفعيل|إظهار|show|enable/i.test(name);
}

function extractWeekOrder(weekName) {
  const nums = {
    الأول:1, الثاني:2, الثالث:3, الرابع:4, الخامس:5,
    السادس:6, السابع:7, الثامن:8, التاسع:9, العاشر:10,
    "الحادي عشر":11, "الثاني عشر":12, "الثالث عشر":13,
    "الرابع عشر":14, "الخامس عشر":15,
  };
  for (const [w, n] of Object.entries(nums)) {
    if (weekName.includes(w)) return n;
  }
  const m = String(weekName).match(/\d+/);
  return m ? parseInt(m[0]) : 99;
}

// ─────────────────────────────────────────────────────────────
//  بيانات تجريبية
// ─────────────────────────────────────────────────────────────
function generateMockWideFormat(monthLabel) {
  const weeksByMonth = {
    "شهر 1": ["الأسبوع الأول","الأسبوع الثاني","الأسبوع الثالث","الأسبوع الرابع"],
    "شهر 2": ["الأسبوع الخامس","الأسبوع السادس","الأسبوع السابع","الأسبوع الثامن"],
    "شهر 3": ["الأسبوع التاسع","الأسبوع العاشر","الأسبوع الحادي عشر","الأسبوع الثاني عشر"],
  };
  const weeks = weeksByMonth[monthLabel] || weeksByMonth["شهر 1"];
  const boost = { "شهر 1": 0, "شهر 2": 8, "شهر 3": 15 }[monthLabel] || 0;

  const names = [
    "أبوبكر يحيى روزي","إبراهيم عبدالله الظاهري","إبراهيم القثامي","بشر بلال الشنو",
    "تركي عواض السلمي","حمد هاني الحماش","خالد خرمي","عبدالرحمن إبراهيم الزرعي",
    "عبدالرحمن المباركي","عبدالعزيز حرداني","عبدالعزيز محمد حاف","عبدالله شادي مكي",
    "عبدالملك هشام الجويرم","عصام عتقاد","عماد علقاد","محمد الشيخ",
    "محمد الغامدي","محمد سامر بركات","محمد فايز الماياني","محمود المصابوني",
    "محمود محمد زاهر","هاشم زياد فلمبان","ياسر الزعيدي","ياسر حلبولي",
    "يوسف الطلواني","يوسف ناجي شرقاوي",
  ];

  const header1 = ["م","الاسم"];
  weeks.forEach((w) => header1.push(w,"","","",""));
  const header2 = ["",""];
  weeks.forEach(() => header2.push("الحضور","الحفظ","الصغرى","الكبرى","النسبة"));
  const rows = [header1, header2];

  names.forEach((name, ni) => {
    const base = 30 + (ni % 5) * 14 + boost;
    const row  = [ni + 1, name];
    weeks.forEach((_, wi) => {
      const pct    = Math.min(100, Math.max(0, Math.round(base + wi*3 + (Math.random()-0.3)*15)));
      const attend = Math.random() < 0.08 ? 0 : Math.min(4, Math.round(3 + Math.random()));
      row.push(attend, Math.min(4,Math.round(pct/25)), Math.min(4,Math.round(pct/25)), Math.min(4,Math.round(pct/25)), pct);
    });
    rows.push(row);
  });

  rows.push(["","النسبة",...weeks.flatMap(()=>[900,40,38,42,48])]);
  rows.push(["","الحساب الأسبوعي",...weeks.flatMap(()=>[38,10,10,11,51])]);

  // صف التفعيل: TRUE للأسابيع المكتملة، FALSE للأخير (محاكاة واقعية)
  const toggleRow = ["", "تفعيل"];
  weeks.forEach((_, wi) => {
    // آخر أسبوع في شهر 3 = FALSE (لم يُرصد بعد)
    const enabled = !(monthLabel === "شهر 3" && wi === weeks.length - 1);
    toggleRow.push(enabled ? "TRUE" : "FALSE", "", "", "", "");
  });
  rows.push(toggleRow);

  return rows;
}
