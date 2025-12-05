"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Landmark,
  MapPin,
  Globe,
  Cloud,
  MessageSquare,
  Upload,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  User,
  LogOut,
  Settings,
  Home,
} from "lucide-react";

interface SidebarProps {
  onChatClick?: () => void;
  onUploadClick?: () => void;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  active?: boolean;
}

export default function Sidebar({ onChatClick, onUploadClick }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(["Navigation", "Tools"]);
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

  const toggleSection = (title: string) => {
    setExpandedSections((prev) =>
      prev.includes(title)
        ? prev.filter((s) => s !== title)
        : [...prev, title]
    );
  };

  const sections: NavSection[] = [
    {
      title: "Navigation",
      items: [
        {
          label: "Home",
          icon: <Home className="w-5 h-5" />,
          href: "/",
          active: pathname === "/",
        },
        {
          label: "Districts",
          icon: <MapPin className="w-5 h-5" />,
          href: "/dashboard",
          active: pathname === "/dashboard" || pathname?.startsWith("/district"),
        },
        {
          label: "Nationwide",
          icon: <Globe className="w-5 h-5" />,
          href: "/nationwide",
          active: pathname === "/nationwide" || pathname?.startsWith("/state"),
        },
        {
          label: "Trending",
          icon: <TrendingUp className="w-5 h-5" />,
          href: "/dashboard",
          active: pathname?.startsWith("/topic"),
        },
      ],
    },
    {
      title: "Tools",
      items: [
        {
          label: "Word Cloud",
          icon: <Cloud className="w-5 h-5" />,
          href: "/wordcloud",
          active: pathname?.startsWith("/wordcloud"),
        },
        {
          label: "Chat",
          icon: <MessageSquare className="w-5 h-5" />,
          onClick: onChatClick || (() => router.push("/chatbot")),
          active: pathname === "/chatbot",
        },
        {
          label: "Upload Bill",
          icon: <Upload className="w-5 h-5" />,
          onClick: onUploadClick || (() => router.push("/upload")),
          active: pathname === "/upload",
        },
      ],
    },
  ];

  // Add admin section if user is admin
  if (isAdmin) {
    sections.push({
      title: "Admin",
      items: [
        {
          label: "Settings",
          icon: <Settings className="w-5 h-5" />,
          href: "/admin",
          active: pathname === "/admin",
        },
      ],
    });
  }

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300 z-40 flex flex-col ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Logo / Brand */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <Landmark className="w-7 h-7 text-zinc-900 dark:text-zinc-100 flex-shrink-0" />
          {!isCollapsed && (
            <span className="font-extrabold tracking-tight text-xl text-zinc-900 dark:text-zinc-100">
              Actalyze
            </span>
          )}
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto py-4">
        {sections.map((section) => (
          <div key={section.title} className="mb-2">
            {/* Section Header */}
            {!isCollapsed && (
              <button
                onClick={() => toggleSection(section.title)}
                className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                {section.title}
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    expandedSections.includes(section.title) ? "" : "-rotate-90"
                  }`}
                />
              </button>
            )}

            {/* Section Items */}
            {(isCollapsed || expandedSections.includes(section.title)) && (
              <div className="space-y-1 px-2">
                {section.items.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      if (item.onClick) {
                        item.onClick();
                      } else if (item.href) {
                        router.push(item.href);
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      item.active
                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    {item.icon}
                    {!isCollapsed && (
                      <span className="text-sm font-medium">{item.label}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* User Section */}
      {session?.user && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 p-3">
          {!isCollapsed ? (
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
          )}
        </div>
      )}

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
