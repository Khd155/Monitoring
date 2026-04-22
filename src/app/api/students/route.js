// src/app/api/students/route.js  ── SERVER ONLY ──
import { NextResponse } from "next/server";
import { getProcessedData } from "@/lib/sheets";

export const revalidate = 300; // cache 5 دقائق

export async function GET() {
  try {
    const data = await getProcessedData();
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "فشل في جلب البيانات" }, { status: 500 });
  }
}
