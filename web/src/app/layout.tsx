import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Escudo Digital — Prevención de Estafas Digitales",
  description: "Ecosistema de detección temprana de fraudes, llamadas sospechosas y phishing orientado a adultos mayores y a la comunidad.",
  keywords: ["seguridad", "ciberseguridad", "estafas digitales", "phishing", "prevención", "FormosaHack"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen antialiased bg-[#080d1a] text-slate-100 selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
