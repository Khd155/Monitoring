// src/app/layout.js
import "./globals.css";
import { DataProvider } from "@/lib/dataContext";

export const metadata = {
  title: "لوحة متابعة الطلاب",
  description: "لوحة تحكم لمتابعة إنجاز طلاب تحفيظ القرآن الكريم أسبوعياً",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Tajawal:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* DataProvider يجلب البيانات مرة واحدة ويشاركها بين كل الصفحات */}
        <DataProvider>
          {children}
        </DataProvider>
      </body>
    </html>
  );
}