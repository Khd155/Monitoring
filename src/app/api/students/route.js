// src/app/api/students/route.js  ── SERVER ONLY ──
import { NextResponse } from "next/server";
import { getProcessedData } from "@/lib/sheets";

export const revalidate = 0;
export const dynamic   = "force-dynamic";

export async function GET() {
  try {
    const data = await getProcessedData();
    const res  = NextResponse.json(data);
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.headers.set("Pragma", "no-cache");
    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "فشل في جلب البيانات" }, { status: 500 });
  }
}
