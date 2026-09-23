import type { Metadata } from "next";
import { Nunito, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";

const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Chemistry Shot",
  description: "Estude química para a prova de hoje",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${nunito.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <NavBar />
        {/* pb-24 leaves room for the mobile bottom tab bar */}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 lg:pb-10">{children}</main>
      </body>
    </html>
  );
}
