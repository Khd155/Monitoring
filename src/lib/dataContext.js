// src/lib/dataContext.js
// ─────────────────────────────────────────────────────────────
//  Context مشترك — يجلب /api/students مرة واحدة فقط
//  ويشارك البيانات بين كل الصفحات بدون تكرار
// ─────────────────────────────────────────────────────────────
"use client";
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const fetchingRef = useRef(false); // منع الطلبات المتزامنة

  const CACHE_MS = 5 * 60 * 1000; // 5 دقائق

  const load = useCallback(async (force = false) => {
    // إذا في طلب جاري → تجاهل
    if (fetchingRef.current) return;

    // إذا البيانات موجودة ولم تنته صلاحيتها → تجاهل
    if (!force && data && lastFetch && Date.now() - lastFetch < CACHE_MS) return;

    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const res  = await fetch("/api/students", {
        // browser cache: يستخدم الكاش إذا لم يمر وقت كافٍ
        next: { revalidate: 300 },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastFetch(Date.now());
    } catch (e) {
      console.error("❌ فشل جلب البيانات:", e);
      setError(e.message);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [data, lastFetch]);

  // جلب البيانات مرة واحدة عند التحميل
  useEffect(() => { load(); }, []);

  const refresh = () => load(true); // تحديث يدوي

  return (
    <DataContext.Provider value={{ data, loading, error, refresh, lastFetch }}>
      {children}
    </DataContext.Provider>
  );
}

// Hook للاستخدام في أي صفحة
export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}