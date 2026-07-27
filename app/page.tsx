"use client";

import { useState, useEffect } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  MapPin,
  BarChart3,
  Zap,
  MessageSquare,
  Shield,
  Users,
  AlertCircle,
  LogIn,
  LogOut,
  User,
} from "lucide-react";
import DistrictSearch from "./components/DistrictSearch";
import Sidebar from "./components/Sidebar";

interface AuthSettings {
  mode: "restricted" | "public" | "guest";
  // GET /api/admin/settings only returns the allow-lists to a signed-in admin.
  // Anonymous callers get `{ mode }` alone, so these are optional and every read
  // must be optionally chained.
  authorizedEmails?: string[];
  adminEmails?: string[];
}

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
  const [authSettings, setAuthSettings] = useState<AuthSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Fetch auth settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/admin/settings");
        if (response.ok) {
          const data = await response.json();
          setAuthSettings(data);
        } else {
          // Fail open: the home page is public, a settings blip must not gate it.
          setAuthSettings({ mode: "public" });
        }
      } catch (error) {
        console.error("Failed to fetch auth settings:", error);
        setAuthSettings({ mode: "public" });
      } finally {
        setSettingsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  // Access mode. Unknown (settings still loading / unreachable) is treated as
  // "public" so the home page is never gated by a failure to read settings.
  const mode = authSettings?.mode ?? "public";
  const isPublicMode = mode === "public";
  const isRestrictedMode = mode === "restricted";
  const isGuestModeAllowed = mode === "guest";

  // Show the login modal for unauthenticated users after settings load, but ONLY
  // when the site is not in public mode. In public mode the home page is open and
  // signing in is an optional action in the header.
  useEffect(() => {
    if (!settingsLoading && status === "unauthenticated" && !isPublicMode) {
      setShowLoginModal(true);
    }
  }, [settingsLoading, status, isPublicMode]);

  const handleGuestAccess = () => {
    // Set the guest cookie client-side before navigating
    // This ensures the middleware will allow access
    document.cookie = "guest_mode_enabled=true; path=/; max-age=86400; SameSite=Lax";
    setShowLoginModal(false);
    router.push("/dashboard");
  };

  const handleSignIn = () => {
    setShowLoginModal(false);
    signIn("google", { callbackUrl: "/" });
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: "/" });
  };

  // Check if current user is authorized (for restricted mode).
  // `authorizedEmails` is only present for signed-in admins, hence the `?.` on
  // the array itself - reading it unguarded throws for everyone else.
  const isUserAuthorized =
    session?.user?.email && authSettings?.authorizedEmails?.includes(session.user.email);

  // Popular/swing districts to feature
  const featuredDistricts = [
    { code: "PA01", label: "PA-1", desc: "Philadelphia suburbs" },
    { code: "GA06", label: "GA-6", desc: "Atlanta metro" },
    { code: "AZ01", label: "AZ-1", desc: "Phoenix area" },
    { code: "MI07", label: "MI-7", desc: "South-central Michigan" },
    { code: "NV03", label: "NV-3", desc: "Las Vegas suburbs" },
    { code: "WI03", label: "WI-3", desc: "Western Wisconsin" },
  ];

  // No loading gate: the home page is public, so it renders immediately for
  // anonymous visitors. The header simply shows the signed-out affordance until
  // the session resolves.

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-zinc-50 to-white dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && !session && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md mx-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
            >
              {/* Modal content */}
              <div className="p-8">
                {/* Logo/Header */}
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-900 dark:from-zinc-600 dark:to-zinc-800 mb-4">
                    <Zap className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                    Welcome to Actalyze
                  </h2>
                  <p className="text-zinc-600 dark:text-zinc-400 mt-2">
                    {isRestrictedMode
                      ? "Private Beta - Sign in to continue"
                      : isGuestModeAllowed
                      ? "Choose how you'd like to continue"
                      : "Sign in to continue"}
                  </p>
                </div>

                {/* Auth buttons */}
                <div className="space-y-3">
                  {/* Google Sign In */}
                  <button
                    onClick={handleSignIn}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 rounded-xl font-medium text-zinc-900 dark:text-zinc-100 transition-colors"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Sign in with Google
                  </button>

                  {/* Guest Access - only show if admin enabled it */}
                  {isGuestModeAllowed && (
                    <>
                      <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-zinc-200 dark:border-zinc-700"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-4 bg-white dark:bg-zinc-900 text-zinc-500">or</span>
                        </div>
                      </div>

                      <button
                        onClick={handleGuestAccess}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl font-medium text-zinc-700 dark:text-zinc-300 transition-colors"
                      >
                        <Users className="w-5 h-5" />
                        Continue as Guest
                      </button>
                    </>
                  )}
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-zinc-500 mt-6">
                  By continuing, you agree to our Terms of Service
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content with sidebar offset */}
      <div className="ml-64 transition-all duration-300">
        {/* Navigation */}
        <nav className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-end gap-2">
            {session?.user ? (
              // Signed in: identity + an explicit way back out.
              <>
                {isRestrictedMode && !isUserAuthorized ? (
                  <span className="text-sm text-zinc-500">Not authorized</span>
                ) : (
                  <button
                    onClick={() => router.push("/dashboard")}
                    className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors text-sm font-medium"
                  >
                    Dashboard
                  </button>
                )}

                <div
                  className="hidden sm:flex items-center gap-2 min-w-0 max-w-[14rem] px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
                  title={session.user.email ?? undefined}
                >
                  <User className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
                    {session.user.name || session.user.email}
                  </span>
                </div>

                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </>
            ) : (
              // Signed out: signing in is optional, never a gate.
              <>
                {isGuestModeAllowed && (
                  <button
                    onClick={handleGuestAccess}
                    className="px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  >
                    Continue as Guest
                  </button>
                )}
                <button
                  onClick={handleSignIn}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors text-sm font-medium"
                >
                  <LogIn className="w-4 h-4" />
                  Sign in
                </button>
              </>
            )}
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
          {session?.user ? (
            // User is logged in
            isRestrictedMode && !isUserAuthorized ? (
              // Logged in but not authorized in restricted mode
              <>
                <div className="flex justify-center mb-4">
                  <AlertCircle className="w-12 h-12 text-amber-400" />
                </div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Access Restricted
                </h2>
                <p className="text-xl mb-4 text-zinc-300">
                  Actalyze is currently in private beta.
                </p>
                <p className="text-lg mb-8 text-zinc-400">
                  Your email ({session.user.email}) is not on the authorized list.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button
                    onClick={() => router.push("/waitlist")}
                    className="px-8 py-4 bg-white text-zinc-900 hover:bg-zinc-100 rounded-xl font-semibold text-lg shadow-lg transition-colors"
                  >
                    Join the Waitlist
                  </button>
                  <button
                    onClick={() => signIn("google", { callbackUrl: "/" })}
                    className="px-8 py-4 bg-zinc-800 border-2 border-zinc-600 hover:border-zinc-400 text-white rounded-xl font-semibold text-lg transition-colors"
                  >
                    Try Different Account
                  </button>
                </div>
              </>
            ) : (
              // Authorized user
              <>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Welcome back, {session.user.name?.split(' ')[0] || 'there'}!
                </h2>
                <p className="text-xl mb-8 text-zinc-300">
                  Continue exploring congressional district intelligence
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button
                    onClick={() => router.push("/dashboard")}
                    className="px-8 py-4 bg-white text-zinc-900 hover:bg-zinc-100 rounded-xl font-semibold text-lg shadow-lg transition-colors"
                  >
                    Go to Dashboard
                  </button>
                  <button
                    onClick={() => router.push("/nationwide")}
                    className="px-8 py-4 bg-zinc-800 border-2 border-zinc-600 hover:border-zinc-400 text-white rounded-xl font-semibold text-lg transition-colors"
                  >
                    Explore Districts
                  </button>
                </div>
              </>
            )
          ) : (
            // User is not logged in
            <>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to get started?
              </h2>
              <p className="text-xl mb-8 text-zinc-300">
                {isRestrictedMode
                  ? "Sign in to access Actalyze"
                  : "Join congressional staffers and policy professionals using Actalyze"}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={() => signIn("google", { callbackUrl: "/" })}
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
                {isGuestModeAllowed && (
                  <button
                    onClick={handleGuestAccess}
                    className="px-8 py-4 bg-zinc-800 border-2 border-zinc-600 hover:border-zinc-400 text-white rounded-xl font-semibold text-lg transition-colors"
                  >
                    Continue as Guest
                  </button>
                )}
                {isRestrictedMode && (
                  <button
                    onClick={() => router.push("/waitlist")}
                    className="px-8 py-4 bg-zinc-800 border-2 border-zinc-600 hover:border-zinc-400 text-white rounded-xl font-semibold text-lg transition-colors"
                  >
                    Join Waitlist
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
          <p>Actalyze &copy; {new Date().getFullYear()} - AI-powered intelligence for modern governance</p>
        </div>
      </footer>
      </div>
    </div>
  );
}
