// src/app/api/students/route.js  ── SERVER ONLY ──
import { NextResponse } from "next/server";
import { getProcessedData } from "@/lib/sheets";

export const revalidate = 0;        // لا cache على السيرفر
export const dynamic   = "force-dynamic"; // دائماً fresh

export async function GET() {
  try {
    const data = await getProcessedData();
    const res  = NextResponse.json(data);
    // منع أي cache في المتصفح أو CDN
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.headers.set("Pragma",        "no-cache");
    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "فشل في جلب البيانات" }, { status: 500 });
  }
}
