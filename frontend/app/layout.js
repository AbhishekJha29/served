import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import {neobrutalism} from '@clerk/themes'
import { Toaster } from "@/components/ui/sonner";
import Header from "@/components/Header";

const inter = Inter({subsets: ["latin"]});

export const metadata = {
  title: "Served - AI Recipes Platform",
  description: "AI-powered recipe platform for developers",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider appearance={{baseTheme: neobrutalism}}>
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className}`}>
        <Header/>
        <main className="min-h-screen">
        {children}
        </main>

        <Toaster richColors/>
        {/* Footer */}
        <footer className="py-8 px-4 border-t">
          <div className="max-w-6xl mx-auto flex justify-center items-center">
            <p className="text-stone-500 text-sm">
              Made With ❤️ By Abhishek Jha
            </p>
          </div>
        </footer>
      </body>
    </html>
    </ClerkProvider>
  );
}
