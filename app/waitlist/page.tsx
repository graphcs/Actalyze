"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { TrendingUp, Mail, ArrowLeft } from "lucide-react";

export default function WaitlistPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
            <TrendingUp className="w-7 h-7 text-white" />
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Actalyze
          </span>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 flex items-center justify-center mb-6 mx-auto">
            <Mail className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>

          <h1 className="text-2xl font-bold text-center mb-3">
            Join the Waitlist
          </h1>

          <p className="text-center text-zinc-600 dark:text-zinc-400 mb-6">
            Actalyze is currently available by invitation only to congressional staffers and policy professionals.
          </p>

          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                <span className="font-semibold">Not authorized?</span> Your email address is not on our authorized list.
              </p>
            </div>

            <div className="text-sm text-zinc-600 dark:text-zinc-400 text-center">
              To request access, please contact us at:
              <br />
              <a
                href="mailto:dan@datasyinc.com"
                className="text-purple-600 dark:text-purple-400 hover:underline font-medium"
              >
                dan@datasyinc.com
              </a>
            </div>
          </div>

          <button
            onClick={() => router.push("/")}
            className="w-full mt-6 px-6 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
        </div>

        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mt-6">
          Actalyze © {new Date().getFullYear()}
        </p>
      </motion.div>
    </div>
  );
}
