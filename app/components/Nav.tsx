"use client";

import {
  Landmark,
  MessageSquare,
  Upload,
  LogOut,
  User,
  Cloud,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import CacheToggle from "./CacheToggle";

interface NavProps {
  onChatClick?: () => void;
  onUploadClick?: () => void;
}

export default function Nav({ onChatClick, onUploadClick }: NavProps) {
  const router = useRouter();
  const { data: session } = useSession();

  return (
    <div className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-white/50 dark:supports-[backdrop-filter]:bg-zinc-900/40 border-b border-zinc-200 dark:border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Landmark className="w-6 h-6" />
          <div
            className="font-extrabold tracking-tight text-xl cursor-pointer"
            onClick={() => router.push("/")}
          >
            Actalyze
          </div>
          <Badge className="ml-2 bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100">
            Platform
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <CacheToggle />
          <Button variant="ghost" onClick={() => router.push("/wordcloud")}>
            <Cloud className="w-4 h-4" />
            Word Cloud
          </Button>
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

          {/* User info and logout */}
          {session?.user && (
            <>
              {/* Admin link - only for johnmahan7@gmail.com */}
              {session.user.email === "johnmahan7@gmail.com" && (
                <Button
                  variant="outline"
                  onClick={() => router.push("/admin")}
                  className="border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <Landmark className="w-4 h-4" />
                  Admin
                </Button>
              )}

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                <User className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  {session.user.email?.split("@")[0]}
                </span>
              </div>
              <Button
                variant="ghost"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
