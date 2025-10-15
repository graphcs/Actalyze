"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push("/chatbot");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-center">
        <div className="inline-flex items-center space-x-2 mb-4">
          <div
            className="w-3 h-3 bg-blue-600 rounded-full animate-bounce"
            style={{ animationDelay: "0ms" }}
          ></div>
          <div
            className="w-3 h-3 bg-blue-600 rounded-full animate-bounce"
            style={{ animationDelay: "150ms" }}
          ></div>
          <div
            className="w-3 h-3 bg-blue-600 rounded-full animate-bounce"
            style={{ animationDelay: "300ms" }}
          ></div>
        </div>
        <p className="text-slate-600">Loading Actalyze...</p>
      </div>
    </div>
  );
}
