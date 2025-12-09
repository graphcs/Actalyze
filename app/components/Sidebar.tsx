"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Landmark,
  MapPin,
  MessageSquare,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  User,
  LogOut,
  LogIn,
  Settings,
  Home,
  FileText,
  CheckSquare,
  Database,
  Users,
  Briefcase,
  Shield,
} from "lucide-react";
import { signIn } from "next-auth/react";

interface SidebarProps {
  onChatClick?: () => void;
  onUploadClick?: () => void;
}

// State data with district counts
const STATES_DATA: { code: string; name: string; districts: number }[] = [
  { code: "AL", name: "Alabama", districts: 7 },
  { code: "AK", name: "Alaska", districts: 1 },
  { code: "AZ", name: "Arizona", districts: 9 },
  { code: "AR", name: "Arkansas", districts: 4 },
  { code: "CA", name: "California", districts: 52 },
  { code: "CO", name: "Colorado", districts: 8 },
  { code: "CT", name: "Connecticut", districts: 5 },
  { code: "DE", name: "Delaware", districts: 1 },
  { code: "FL", name: "Florida", districts: 28 },
  { code: "GA", name: "Georgia", districts: 14 },
  { code: "HI", name: "Hawaii", districts: 2 },
  { code: "ID", name: "Idaho", districts: 2 },
  { code: "IL", name: "Illinois", districts: 17 },
  { code: "IN", name: "Indiana", districts: 9 },
  { code: "IA", name: "Iowa", districts: 4 },
  { code: "KS", name: "Kansas", districts: 4 },
  { code: "KY", name: "Kentucky", districts: 6 },
  { code: "LA", name: "Louisiana", districts: 6 },
  { code: "ME", name: "Maine", districts: 2 },
  { code: "MD", name: "Maryland", districts: 8 },
  { code: "MA", name: "Massachusetts", districts: 9 },
  { code: "MI", name: "Michigan", districts: 13 },
  { code: "MN", name: "Minnesota", districts: 8 },
  { code: "MS", name: "Mississippi", districts: 4 },
  { code: "MO", name: "Missouri", districts: 8 },
  { code: "MT", name: "Montana", districts: 2 },
  { code: "NE", name: "Nebraska", districts: 3 },
  { code: "NV", name: "Nevada", districts: 4 },
  { code: "NH", name: "New Hampshire", districts: 2 },
  { code: "NJ", name: "New Jersey", districts: 12 },
  { code: "NM", name: "New Mexico", districts: 3 },
  { code: "NY", name: "New York", districts: 26 },
  { code: "NC", name: "North Carolina", districts: 14 },
  { code: "ND", name: "North Dakota", districts: 1 },
  { code: "OH", name: "Ohio", districts: 15 },
  { code: "OK", name: "Oklahoma", districts: 5 },
  { code: "OR", name: "Oregon", districts: 6 },
  { code: "PA", name: "Pennsylvania", districts: 17 },
  { code: "RI", name: "Rhode Island", districts: 2 },
  { code: "SC", name: "South Carolina", districts: 7 },
  { code: "SD", name: "South Dakota", districts: 1 },
  { code: "TN", name: "Tennessee", districts: 9 },
  { code: "TX", name: "Texas", districts: 38 },
  { code: "UT", name: "Utah", districts: 4 },
  { code: "VT", name: "Vermont", districts: 1 },
  { code: "VA", name: "Virginia", districts: 11 },
  { code: "WA", name: "Washington", districts: 10 },
  { code: "WV", name: "West Virginia", districts: 2 },
  { code: "WI", name: "Wisconsin", districts: 8 },
  { code: "WY", name: "Wyoming", districts: 1 },
];

export default function Sidebar({ onChatClick, onUploadClick }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDistrictsExpanded, setIsDistrictsExpanded] = useState(false);
  const [expandedState, setExpandedState] = useState<string | null>(null);
  const [isToolsExpanded, setIsToolsExpanded] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!session?.user?.email) {
        setIsAdmin(false);
        return;
      }

      try {
        const response = await fetch("/api/admin/settings");
        if (response.ok) {
          const settings = await response.json();
          setIsAdmin(settings.adminEmails?.includes(session.user.email) || false);
        }
      } catch (error) {
        console.error("Failed to check admin status:", error);
        setIsAdmin(false);
      }
    };

    checkAdminStatus();
  }, [session?.user?.email]);

  // Auto-expand districts and state based on current path
  useEffect(() => {
    if (pathname?.startsWith("/district/")) {
      // Extract state code from district path (e.g., /district/ca01 -> CA)
      const districtCode = pathname.split("/")[2]?.toUpperCase();
      if (districtCode && districtCode.length >= 2) {
        const stateCode = districtCode.substring(0, 2);
        setIsDistrictsExpanded(true);
        setExpandedState(stateCode);
      }
    } else if (pathname?.startsWith("/state/")) {
      // Extract state code from state path (e.g., /state/ca -> CA)
      const stateCode = pathname.split("/")[2]?.toUpperCase();
      if (stateCode) {
        setIsDistrictsExpanded(true);
        setExpandedState(stateCode);
      }
    }
  }, [pathname]);

  const handleNavigation = (href: string) => {
    // Add guest=true parameter to allow access without sign-in
    const url = new URL(href, window.location.origin);
    url.searchParams.set("guest", "true");
    router.push(url.pathname + url.search);
  };

  const toggleState = (stateCode: string) => {
    setExpandedState(expandedState === stateCode ? null : stateCode);
  };

  // Generate district codes for a state
  const getDistrictCodes = (stateCode: string, count: number) => {
    return Array.from({ length: count }, (_, i) => {
      const num = (i + 1).toString().padStart(2, "0");
      return `${stateCode}${num}`;
    });
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300 z-40 flex flex-col ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Logo / Brand */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
        >
          <Landmark className="w-7 h-7 text-zinc-900 dark:text-zinc-100 flex-shrink-0" />
          {!isCollapsed && (
            <span className="font-extrabold tracking-tight text-xl text-zinc-900 dark:text-zinc-100">
              Actalyze
            </span>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {/* Home */}
        <div className="px-2 mb-1">
          <button
            onClick={() => router.push("/")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              pathname === "/"
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <Home className="w-5 h-5" />
            {!isCollapsed && <span className="text-sm font-medium">Home</span>}
          </button>
        </div>

        {/* Districts - Expandable */}
        <div className="px-2 mb-1">
          <button
            onClick={() => setIsDistrictsExpanded(!isDistrictsExpanded)}
            className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              pathname?.startsWith("/district") || pathname?.startsWith("/state")
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5" />
              {!isCollapsed && <span className="text-sm font-medium">Districts</span>}
            </div>
            {!isCollapsed && (
              <ChevronDown
                className={`w-4 h-4 transition-transform ${isDistrictsExpanded ? "" : "-rotate-90"}`}
              />
            )}
          </button>

          {/* States List */}
          {isDistrictsExpanded && !isCollapsed && (
            <div className="mt-1 ml-4 max-h-80 overflow-y-auto border-l border-zinc-200 dark:border-zinc-700">
              {STATES_DATA.map((state) => (
                <div key={state.code}>
                  <button
                    onClick={() => toggleState(state.code)}
                    className={`w-full flex items-center justify-between pl-4 pr-2 py-1.5 text-sm transition-colors ${
                      pathname?.startsWith(`/state/${state.code.toLowerCase()}`) ||
                      pathname?.startsWith(`/district/${state.code.toLowerCase()}`)
                        ? "text-zinc-900 dark:text-zinc-100 font-medium"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    <span>{state.name}</span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${
                        expandedState === state.code ? "" : "-rotate-90"
                      }`}
                    />
                  </button>

                  {/* Districts for this state */}
                  {expandedState === state.code && (
                    <div className="ml-4 border-l border-zinc-200 dark:border-zinc-700">
                      {getDistrictCodes(state.code, state.districts).map((districtCode) => (
                        <button
                          key={districtCode}
                          onClick={() => handleNavigation(`/district/${districtCode.toLowerCase()}`)}
                          className={`w-full text-left pl-4 pr-2 py-1 text-xs transition-colors ${
                            pathname === `/district/${districtCode.toLowerCase()}`
                              ? "text-zinc-900 dark:text-zinc-100 font-medium bg-zinc-100 dark:bg-zinc-800"
                              : "text-zinc-500 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                          }`}
                        >
                          {state.code}-{districtCode.slice(2)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trending */}
        <div className="px-2 mb-1">
          <button
            onClick={() => handleNavigation("/nationwide")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              pathname === "/nationwide" || pathname?.startsWith("/topic")
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            {!isCollapsed && <span className="text-sm font-medium">Trending</span>}
          </button>
        </div>

        {/* Tools Section */}
        {!isCollapsed && (
          <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => setIsToolsExpanded(!isToolsExpanded)}
              className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Tools
              <ChevronDown
                className={`w-4 h-4 transition-transform ${isToolsExpanded ? "" : "-rotate-90"}`}
              />
            </button>
          </div>
        )}

        {(isCollapsed || isToolsExpanded) && (
          <div className="px-2 space-y-1">
            <button
              onClick={() => (onChatClick ? onChatClick() : handleNavigation("/chatbot"))}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                pathname === "/chatbot"
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              {!isCollapsed && <span className="text-sm font-medium">Chat</span>}
            </button>

            <button
              onClick={() => handleNavigation("/draft-memo")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                pathname === "/draft-memo"
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <FileText className="w-5 h-5" />
              {!isCollapsed && <span className="text-sm font-medium">Draft Memo</span>}
            </button>

            <button
              onClick={() => handleNavigation("/constituent-meetings")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                pathname === "/constituent-meetings"
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <Users className="w-5 h-5" />
              {!isCollapsed && <span className="text-sm font-medium">Meetings</span>}
            </button>

            <button
              onClick={() => handleNavigation("/casework")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                pathname === "/casework"
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <Briefcase className="w-5 h-5" />
              {!isCollapsed && <span className="text-sm font-medium">Casework</span>}
            </button>

            <button
              onClick={() => handleNavigation("/ethics-compliance")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                pathname === "/ethics-compliance"
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <Shield className="w-5 h-5" />
              {!isCollapsed && <span className="text-sm font-medium">Ethics Copilot</span>}
            </button>

            <button
              onClick={() => handleNavigation("/standards-checker")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                pathname === "/standards-checker"
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <CheckSquare className="w-5 h-5" />
              {!isCollapsed && <span className="text-sm font-medium">Standards Checker</span>}
            </button>

            <button
              onClick={() => handleNavigation("/connect-cdp")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                pathname === "/connect-cdp"
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <Database className="w-5 h-5" />
              {!isCollapsed && <span className="text-sm font-medium">Connect CDP</span>}
            </button>
          </div>
        )}

        {/* Admin Section */}
        {isAdmin && (
          <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 px-2">
            <button
              onClick={() => router.push("/admin")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                pathname === "/admin"
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <Settings className="w-5 h-5" />
              {!isCollapsed && <span className="text-sm font-medium">Admin</span>}
            </button>
          </div>
        )}
      </nav>

      {/* User Section */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 p-3">
        {session?.user ? (
          // Logged in user
          !isCollapsed ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <User className="w-4 h-4 text-zinc-500" />
                <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
                  {session.user.email?.split("@")[0]}
                </span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="w-full flex items-center justify-center p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )
        ) : (
          // Not logged in - show login button
          !isCollapsed ? (
            <button
              onClick={() => signIn("google")}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </button>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="w-full flex items-center justify-center p-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              title="Sign In"
            >
              <LogIn className="w-5 h-5" />
            </button>
          )
        )}
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full flex items-center justify-center shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
        )}
      </button>
    </aside>
  );
}
