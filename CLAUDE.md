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
- **OpenAI**: GPT-4 for chat, text-embedding-3-large (1536 dims) for embeddings
- **OpenRouter**: Alternative LLM provider (Perplexity sonar for web access)
- **SERPAPI**: Google Trends and News for trending political topics

### Database Schema

Defined in `lib/rag-database-schema.sql`:
- `documents` - Document metadata and content
- `document_chunks` - Text chunks with vector embeddings
- `document_processing_jobs` - Background job tracking

The search uses `search_documents` RPC function for vector similarity search.

### API Authentication

The chatbot and document APIs are publicly accessible (no auth required). Some APIs use Twitter/Reddit credentials for social data.

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
