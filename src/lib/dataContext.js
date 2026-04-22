// src/lib/dataContext.js
// ─────────────────────────────────────────────────────────────
//  Context مشترك — يجلب /api/students مرة واحدة فقط
//  ويشارك البيانات بين كل الصفحات بدون تكرار
// ─────────────────────────────────────────────────────────────
"use client";
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [data,       setData]      = useState(null);
  const [loading,    setLoading]   = useState(true);
  const [refreshing, setRefreshing]= useState(false);
  const [error,      setError]     = useState(null);
  const [lastFetch,  setLastFetch] = useState(null);
  const fetchingRef = useRef(false); // منع الطلبات المتزامنة

  const CACHE_MS = 30 * 1000; // 30 ثانية فقط

  const load = useCallback(async (force = false) => {
    if (fetchingRef.current) return;
    if (!force && data && lastFetch && Date.now() - lastFetch < CACHE_MS) return;

    fetchingRef.current = true;
    if (force) setRefreshing(true);
    setLoading(!data);
    setError(null);

    try {
      // cache-busting: نضيف timestamp لمنع المتصفح من كاش القديم
      const res  = await fetch(`/api/students?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
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
      setRefreshing(false);
      fetchingRef.current = false;
    }
  }, [data, lastFetch]);

  useEffect(() => { load(); }, []);

  const refresh = () => load(true);

  return (
    <DataContext.Provider value={{ data, loading, refreshing, error, refresh, lastFetch }}>
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
