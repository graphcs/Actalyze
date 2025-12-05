"use client";

import Sidebar from "./Sidebar";
import CacheToggle from "./CacheToggle";

interface AppLayoutProps {
  children: React.ReactNode;
  onChatClick?: () => void;
  onUploadClick?: () => void;
  showTopBar?: boolean;
}

export default function AppLayout({
  children,
  onChatClick,
  onUploadClick,
  showTopBar = true
}: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900">
      <Sidebar onChatClick={onChatClick} onUploadClick={onUploadClick} />

      {/* Main content area with left margin for sidebar */}
      <div className="ml-64 transition-all duration-300">
        {/* Top bar - minimal, just cache toggle */}
        {showTopBar && (
          <div className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800">
            <div className="px-6 py-3 flex items-center justify-end">
              <CacheToggle />
            </div>
          </div>
        )}

        {/* Page content */}
        <main className="text-zinc-900 dark:text-zinc-100">
          {children}
        </main>
      </div>
    </div>
  );
}
