"use client";

import { Landmark, Globe2, BookOpen, MessageSquare, Upload } from "lucide-react";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { useRouter, usePathname } from "next/navigation";
import CacheToggle from "./CacheToggle";

interface NavProps {
  onChatClick?: () => void;
  onUploadClick?: () => void;
}

export default function Nav({ onChatClick, onUploadClick }: NavProps) {
  const router = useRouter();
  const pathname = usePathname();

  const tabs = [
    { id: "home", label: "Home", icon: Globe2, path: "/" },
  ];

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  return (
    <div className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-white/50 dark:supports-[backdrop-filter]:bg-zinc-900/40 border-b border-zinc-200 dark:border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Landmark className="w-6 h-6" />
          <div className="font-extrabold tracking-tight text-xl cursor-pointer" onClick={() => router.push("/")}>
            Actalyze
          </div>
          <Badge className="ml-2 bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100">
            Platform
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <CacheToggle />
          {tabs.map((t) => (
            <Button
              key={t.id}
              variant={pathname === t.path ? "default" : "ghost"}
              onClick={() => handleNavigation(t.path)}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </Button>
          ))}
          <Button variant="ghost" onClick={onChatClick}>
            <MessageSquare className="w-4 h-4" />
            Chat
          </Button>
          <Button
            variant="outline"
            onClick={onUploadClick || (() => router.push("/upload"))}
          >
            <Upload className="w-4 h-4" />
            Upload Bill
          </Button>
        </div>
      </div>
    </div>
  );
}
