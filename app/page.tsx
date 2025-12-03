"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  TrendingUp,
  MapPin,
  BarChart3,
  Globe,
  Zap,
  MessageSquare,
  Shield,
  Users,
} from "lucide-react";
import DistrictSearch from "./components/DistrictSearch";

// State code to name mapping for display
const STATE_NAMES: Record<string, string> = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
};

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const handleGuestAccess = () => {
    router.push("/dashboard?guest=true");
  };

  // Popular/swing districts to feature
  const featuredDistricts = [
    { code: "PA01", label: "PA-1", desc: "Philadelphia suburbs" },
    { code: "GA06", label: "GA-6", desc: "Atlanta metro" },
    { code: "AZ01", label: "AZ-1", desc: "Phoenix area" },
    { code: "MI07", label: "MI-7", desc: "South-central Michigan" },
    { code: "NV03", label: "NV-3", desc: "Las Vegas suburbs" },
    { code: "WI03", label: "WI-3", desc: "Western Wisconsin" },
  ];

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900">
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 mb-4">
            <div className="w-3 h-3 bg-zinc-700 dark:bg-zinc-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
            <div className="w-3 h-3 bg-zinc-700 dark:bg-zinc-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
            <div className="w-3 h-3 bg-zinc-700 dark:bg-zinc-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
          </div>
          <p className="text-zinc-600 dark:text-zinc-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-zinc-50 to-white dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      {/* Navigation */}
      <nav className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-900 dark:from-zinc-600 dark:to-zinc-800 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Actalyze
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/nationwide")}
              className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors flex items-center gap-2"
            >
              <Globe className="w-4 h-4" />
              Nationwide
            </button>
            {session?.user ? (
              <button
                onClick={() => router.push("/dashboard")}
                className="px-6 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors text-sm font-medium"
              >
                Dashboard
              </button>
            ) : (
              <>
                <button
                  onClick={handleGuestAccess}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                >
                  Continue as Guest
                </button>
                <button
                  onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                  className="px-6 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors text-sm font-medium"
                >
                  Sign In
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-7xl mx-auto px-4 pt-16 pb-12 md:pt-24 md:pb-16"
      >
        <div className="text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium mb-6"
          >
            <Zap className="w-4 h-4" />
            AI-Powered Congressional District Intelligence
          </motion.div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 text-zinc-900 dark:text-zinc-100">
            Real-Time Political
            <br />
            Intelligence
          </h1>

          <p className="text-lg md:text-xl text-zinc-600 dark:text-zinc-300 mb-10 leading-relaxed max-w-2xl mx-auto">
            AI-powered analysis of social media sentiment, polling data, and local news for every congressional district. Built for policy professionals.
          </p>

          {/* District Search Section */}
          <div className="max-w-xl mx-auto mb-8">
            <DistrictSearch />
          </div>
        </div>
      </motion.div>

      {/* Featured Districts */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="max-w-7xl mx-auto px-4 py-12"
      >
        <h2 className="text-center text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-6">
          Featured Swing Districts
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {featuredDistricts.map((district) => (
            <button
              key={district.code}
              onClick={() => router.push(`/district/${district.code.toLowerCase()}`)}
              className="group p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-zinc-500" />
                <span className="font-bold text-zinc-900 dark:text-zinc-100">{district.label}</span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{district.desc}</p>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Features Grid */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="max-w-7xl mx-auto px-4 py-16"
      >
        <div className="grid md:grid-cols-3 gap-8">
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-900 dark:from-zinc-600 dark:to-zinc-800 flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-2">AI Polling Estimates</h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              Machine learning analysis of social media sentiment blended with traditional polling data
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-900 dark:from-zinc-600 dark:to-zinc-800 flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-2">Issue Tracking</h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              Monitor top issues and voter concerns in real-time across your district
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-900 dark:from-zinc-600 dark:to-zinc-800 flex items-center justify-center mb-4">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-2">AI Chat Assistant</h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              Ask questions and get instant analysis on any political topic or district
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-900 dark:from-zinc-600 dark:to-zinc-800 flex items-center justify-center mb-4">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-2">District Intelligence</h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              Deep insights into every congressional district with local news and polling data
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-900 dark:from-zinc-600 dark:to-zinc-800 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-2">Secure & Private</h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              Enterprise-grade security with role-based access for your team
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-900 dark:from-zinc-600 dark:to-zinc-800 flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-2">Team Collaboration</h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              Share insights and coordinate strategy with your team in real-time
            </p>
          </div>
        </div>
      </motion.div>

      {/* Browse by State */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="max-w-7xl mx-auto px-4 py-12"
      >
        <h2 className="text-center text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-6">
          Browse by State
        </h2>
        <div className="flex flex-wrap justify-center gap-2">
          {Object.entries(STATE_NAMES).slice(0, 20).map(([code]) => (
            <button
              key={code}
              onClick={() => router.push(`/state/${code.toLowerCase()}`)}
              className="px-3 py-1.5 text-sm rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
            >
              {code}
            </button>
          ))}
          <button
            onClick={() => router.push("/nationwide")}
            className="px-3 py-1.5 text-sm rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium"
          >
            View All States
          </button>
        </div>
      </motion.div>

      {/* CTA Section */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        className="max-w-7xl mx-auto px-4 py-20"
      >
        <div className="rounded-3xl bg-gradient-to-br from-zinc-900 to-zinc-800 dark:from-zinc-800 dark:to-zinc-900 p-12 text-center text-white border border-zinc-700 dark:border-zinc-800">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to get started?
          </h2>
          <p className="text-xl mb-8 text-zinc-300">
            Join congressional staffers and policy professionals using Actalyze
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
              className="px-8 py-4 bg-white text-zinc-900 hover:bg-zinc-100 rounded-xl font-semibold text-lg shadow-lg transition-colors flex items-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign In with Google
            </button>
            <button
              onClick={handleGuestAccess}
              className="px-8 py-4 bg-zinc-800 border-2 border-zinc-600 hover:border-zinc-400 text-white rounded-xl font-semibold text-lg transition-colors"
            >
              Continue as Guest
            </button>
          </div>
        </div>
      </motion.div>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
          <p>Actalyze &copy; {new Date().getFullYear()} - AI-powered intelligence for modern governance</p>
        </div>
      </footer>
    </div>
  );
}
