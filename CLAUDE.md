# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
npm install        # Install dependencies
npm run dev        # Start development server (http://localhost:3000)
npm run build      # Build for production
npm run lint       # Run ESLint
```

### Running Tests

```bash
npx jest src/trending/__tests__/trending.test.ts  # Run specific test file
npx jest src/trending/__tests__                    # Run trending tests
```

## Architecture Overview

Actalyze is a Next.js 15 (App Router) application for US political intelligence that combines:
1. **RAG System** - Document upload, embedding, and semantic search for legislation
2. **AI Chat** - Chatbot powered by OpenAI/OpenRouter with document-grounded responses
3. **Political Intelligence** - Social media analysis for congressional district insights
4. **Trending Topics** - Real-time political trends via SERPAPI

### Core Data Flow

```
Document Upload → Text Extraction → Chunking → OpenAI Embeddings → Supabase (pgvector)
                                                                           ↓
User Query → Query Embedding → Vector Similarity Search → Context → LLM Response
```

### Key Directories

- `app/api/` - Next.js API routes (chatbot, documents, trending, district intel)
- `app/components/` - React components including maps, charts, and UI elements
- `lib/` - Core processing logic:
  - `document-processor.ts` - RAG pipeline (file extraction, chunking, embeddings, search)
  - `ai-intel.ts` - Political intelligence from social media classification
- `src/trending/` - Trending topics module using SERPAPI
- `types/` - TypeScript definitions (rag.ts, charts.ts, wordcloud.ts)

### External Services

- **Supabase**: PostgreSQL database with pgvector for embeddings, plus storage
- **OpenAI**: chat + text-embedding-3-large (1536 dims) for embeddings. Primary LLM provider.
- **OpenRouter**: secondary LLM provider (Perplexity sonar, which can search the web)
- **SERPAPI**: Google Trends and News for trending topics, and tweet recovery

### LLM provider selection

Routes must not read `process.env.OPENROUTER_API_KEY` directly. Import from
`lib/ai-provider.ts` instead:

- `OPENROUTER_KEY` — for routes using the OpenAI SDK. It is `undefined` whenever
  `OPENAI_API_KEY` is set, so the existing `OPENROUTER_KEY || process.env.OPENAI_API_KEY`
  pattern resolves to OpenAI.
- `chatCompletions({ webSearch })` — for routes calling `/chat/completions` with raw
  `fetch`. Returns the URL, headers and model for whichever provider is active.

Why: these routes were written as `OPENROUTER_API_KEY || OPENAI_API_KEY`, so a key
that is *present but revoked* silently shadowed a working OpenAI key and every AI
route failed. OpenAI is now primary; set `USE_OPENROUTER=true` to force OpenRouter
back on once its key is healthy.

### Social data

X's free API tier does not permit `/2/tweets/search/recent`, so the live Twitter
path returns 403. `lib/serpapi-tweets.ts` recovers genuine tweets via SerpAPI —
real handles, status ids, text, and engagement counts where Google surfaced them.
Unknown values are omitted, never synthesised. Reddit is blocked at the IP level
and its UI components are unused.

### Database Schema

Defined in `lib/rag-database-schema.sql`:
- `documents` - Document metadata and content
- `document_chunks` - Text chunks with vector embeddings
- `document_processing_jobs` - Background job tracking

The search uses `search_documents` RPC function for vector similarity search.

### Access control

`middleware.ts` gates page routes only — it does **not** match `/api/*`, so API routes
are reachable unauthenticated unless they check a session themselves.

Access mode lives in Supabase `app_settings` under the `auth_settings` key:
- `public` — open to everyone, no sign-in (current setting)
- `guest` — allowed via the `guest_mode_enabled` cookie
- `restricted` — allowlisted emails only

`AUTH_MODE` overrides the stored value without a database write.

Routes that mutate data or spend money must gate themselves. Already gated:
`POST /api/admin/settings` (admin session), `DELETE /api/documents/delete` (session),
`/api/admin/cron/check-alerts` (fails closed without `CRON_SECRET`), and
`/api/chatbot` (per-IP rate limit, `lib/rate-limit.ts`). The rate limiter is
per-instance; an edge WAF rule is the durable fix.

### Environment Variables

Required in `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# AI APIs
OPENAI_API_KEY=sk-...                    # Embeddings and chat
OPENROUTER_API_KEY=sk-or-v1-...          # AI with web access (Perplexity)

# Auth
NEXTAUTH_URL=http://localhost:3000       # Or production URL
NEXTAUTH_SECRET=...                      # Generate with: openssl rand -base64 32
GOOGLE_CLIENT_ID=...                     # Google OAuth
GOOGLE_CLIENT_SECRET=...

# Social/Trends APIs
TWITTER_API_KEY=...
TWITTER_API_SECRET=...
APIFY_API_TOKEN=...                      # For social media scraping
SERPAPI_KEY=...                          # Trending topics
TREND_MIN_SCORE=0
TREND_MAX_ITEMS=20

# App URL
NEXT_PUBLIC_URL=http://localhost:3000
```
