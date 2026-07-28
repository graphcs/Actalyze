"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, FileText, MessageSquare, ShieldCheck } from "lucide-react";
import { PkAppLayout } from "../components/PkAppLayout";
import { Ltr, LtrNumber } from "../components/Ltr";
import { useLocale } from "../i18n/LocaleProvider";

/**
 * What the assistant can actually read.
 *
 * A RAG product's credibility rests on this page more than on the chat itself: the
 * first question a parliamentarian asks about an AI answer is "where did that come
 * from", and the answer has to be a list of documents they recognise, from institutions
 * they recognise, with a link to the original.
 *
 * The chunk count is the honest measure of whether a document is really in the index.
 * A scanned PDF ingests without error and lands here with a title, a source and zero
 * chunks — present in the library and invisible to retrieval. Showing the count makes
 * that failure impossible to miss, which is why the ingestion script refuses scanned
 * documents up front and why the number is on the card rather than buried.
 *
 * There is no PK-specific documents API in this build — `/api/documents/list` is a US
 * route and must not be touched — so the Pakistani corpus is identified by the
 * `metadata.country` stamp the ingestion script writes, and filtered client-side.
 */

interface ApiDocument {
  id: string;
  title: string;
  source_type: string;
  category: string | null;
  jurisdiction: string | null;
  year: number | null;
  file_url: string | null;
  created_at: string;
  metadata: {
    country?: string;
    publisher?: string;
    language?: string;
    source_url?: string;
    pages?: number;
    chunk_count?: number;
  } | null;
}

function languageKey(language?: string) {
  if (language === "ur") return "documents.languageUr" as const;
  if (language === "ur-en") return "documents.languageMixed" as const;
  return "documents.languageEn" as const;
}

/** `federal_law` → `Federal law`. The five source types are a US enum this build maps
 *  onto; the meaningful provenance is in `jurisdiction` and `publisher`. */
function humanise(value: string): string {
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export default function PkDocumentsPage() {
  const { t, locale } = useLocale();
  const [documents, setDocuments] = useState<ApiDocument[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/documents/list?limit=200")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        const all: ApiDocument[] = data.documents ?? [];
        const pk = all.filter(
          (d) =>
            d.metadata?.country === "PK" ||
            /pakistan|punjab|sindh|khyber|balochistan|islamabad/i.test(d.jurisdiction ?? "")
        );
        setDocuments(
          pk.sort((a, b) => (b.metadata?.chunk_count ?? 0) - (a.metadata?.chunk_count ?? 0))
        );
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setDocuments([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!documents) return null;
    const q = filter.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((d) =>
      [d.title, d.metadata?.publisher, d.category, d.jurisdiction]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q))
    );
  }, [documents, filter]);

  const totalChunks = (documents ?? []).reduce(
    (sum, d) => sum + (d.metadata?.chunk_count ?? 0),
    0
  );

  return (
    <PkAppLayout>
      <div className="max-w-6xl mx-auto px-4 pt-10 pb-16">
        <header className="mb-8">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            {t("documents.title")}
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-2 max-w-2xl urdu-prose">
            {t("documents.subtitle")}
          </p>
          <Link
            href="/pk/chat"
            className="inline-flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400 hover:underline mt-3"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {t("chat.title")}
          </Link>
        </header>

        {documents !== null && documents.length > 0 && (
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-3">
              <div className="text-xl font-bold">
                <LtrNumber value={documents.length} />
              </div>
              <div className="text-xs text-zinc-500">{t("documents.count")}</div>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-3">
              <div className="text-xl font-bold">
                <LtrNumber value={totalChunks} />
              </div>
              <div className="text-xs text-zinc-500">{t("documents.totalChunks")}</div>
            </div>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("documents.searchPlaceholder")}
              className="flex-1 min-w-56 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-start focus:outline-none focus:ring-2 focus:ring-green-600/40"
            />
          </div>
        )}

        {documents === null && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 animate-pulse"
              />
            ))}
          </div>
        )}

        {documents !== null && documents.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 px-6 py-12 text-center">
            <FileText className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-700 mb-3" />
            <p className="text-sm text-zinc-500">
              {failed ? t("documents.loadFailed") : t("documents.empty")}
            </p>
          </div>
        )}

        {filtered !== null && filtered.length === 0 && (documents?.length ?? 0) > 0 && (
          <p className="text-sm text-zinc-500">{t("documents.noMatch")}</p>
        )}

        <div className="space-y-3">
          {(filtered ?? []).map((doc) => {
            const chunks = doc.metadata?.chunk_count ?? 0;
            const url = doc.metadata?.source_url || doc.file_url;
            return (
              <article
                key={doc.id}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-start leading-snug">{doc.title}</h2>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-zinc-500">
                      {doc.metadata?.publisher && (
                        <span>
                          <span className="text-zinc-400">{t("documents.publisher")}</span>{" "}
                          <Ltr className="text-zinc-700 dark:text-zinc-300">
                            {doc.metadata.publisher}
                          </Ltr>
                        </span>
                      )}
                      {doc.jurisdiction && (
                        <span>
                          <Ltr>{doc.jurisdiction}</Ltr>
                        </span>
                      )}
                      {/* A year is a label, not a quantity: `LtrNumber` would render
                          1973 as "1,973". */}
                      {doc.year && (
                        <span>
                          <Ltr>{String(doc.year)}</Ltr>
                        </span>
                      )}
                      <span>{t(languageKey(doc.metadata?.language))}</span>
                      {doc.metadata?.pages ? (
                        <span>
                          <LtrNumber value={doc.metadata.pages} /> {t("documents.pages")}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        <Ltr>{humanise(doc.source_type)}</Ltr>
                      </span>
                      {doc.category && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          <Ltr>{humanise(doc.category)}</Ltr>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="text-end">
                      <div
                        className={`text-xl font-bold ${
                          chunks > 0 ? "text-green-700 dark:text-green-400" : "text-amber-600"
                        }`}
                      >
                        <LtrNumber value={chunks} />
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {t("documents.chunksLabel")}
                      </div>
                    </div>
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-green-700 dark:hover:text-green-400"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {t("documents.openOriginal")}
                      </a>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-10 flex items-start gap-2 text-xs text-zinc-400 max-w-3xl">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
          <p className={locale === "ur" ? "urdu-prose" : ""}>{t("documents.provenance")}</p>
        </div>
      </div>
    </PkAppLayout>
  );
}
