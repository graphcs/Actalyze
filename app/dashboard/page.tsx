"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import Nav from "../components/Nav";
import Hero from "../components/Hero";
import TrendingGrid from "../components/TrendingGrid";

interface Topic {
  id: string;
  title: string;
  tags: string[];
  mentions: number;
  momentum: number;
  cost: number;
  color: string;
}

export default function Dashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }

    if (status === "authenticated") {
      // Fetch trending topics
      fetch("/api/trending")
      .then((res) => res.json())
      .then((data) => {
        setTopics(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching trending topics:", error);
        setLoading(false);
      });
    }
  }, [status, router]);

  const handleExplore = () => {
    window.scrollTo({ top: window.innerHeight, behavior: "smooth" });
  };

  const handleUpload = () => {
    router.push("/upload");
  };

  const handleChat = () => {
    router.push("/chatbot");
  };

  const handleTopicOpen = (topic: Topic) => {
    router.push(`/topic/${topic.id}`);
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900">
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 mb-4">
            <div
              className="w-3 h-3 bg-zinc-900 dark:bg-zinc-100 rounded-full animate-bounce"
              style={{ animationDelay: "0ms" }}
            ></div>
            <div
              className="w-3 h-3 bg-zinc-900 dark:bg-zinc-100 rounded-full animate-bounce"
              style={{ animationDelay: "150ms" }}
            ></div>
            <div
              className="w-3 h-3 bg-zinc-900 dark:bg-zinc-100 rounded-full animate-bounce"
              style={{ animationDelay: "300ms" }}
            ></div>
          </div>
          <p className="text-zinc-600 dark:text-zinc-300">Loading Actalyze...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900 text-zinc-900 dark:text-zinc-100">
      <Nav
        onChatClick={handleChat}
        onUploadClick={handleUpload}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key="home"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
        >
          <Hero
            onExplore={handleExplore}
            onUpload={handleUpload}
            onChat={handleChat}
          />
          <TrendingGrid topics={topics} onOpen={handleTopicOpen} />
        </motion.div>
      </AnimatePresence>
      <footer className="max-w-7xl mx-auto px-4 py-10 text-sm text-zinc-500">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>Actalyze © {new Date().getFullYear()}</div>
          <div>Trusted by congressional staffers and policy professionals</div>
          <div>AI-powered intelligence for modern governance</div>
        </div>
      </footer>
    </div>
  );
}
