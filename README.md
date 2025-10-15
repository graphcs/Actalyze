# Actalyze - US Legislation Document Intelligence

An AI-powered assistant for US federal and state legislation, regulations, case law, and legal documents. Built with Next.js, Supabase, and OpenAI.

## Features

- 🤖 **AI-Powered Chat** - Ask questions about US legislation and get informed responses
- 📄 **Document Upload** - Upload PDF, DOCX, TXT, or MD files
- 🔍 **RAG System** - Retrieval-Augmented Generation for accurate, source-based answers
- 🏛️ **Legislation Focus** - Specialized for federal/state laws, regulations, case law, and bills
- 📚 **Source Attribution** - Every answer cites its sources with document references
- 🌐 **No Authentication** - Publicly accessible for easy collaboration

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Supabase (PostgreSQL + pgvector)
- **AI**: OpenAI GPT-4 + text-embedding-3-small
- **Storage**: Supabase Storage
- **Styling**: Tailwind CSS
- **Language**: TypeScript

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- OpenAI API key

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Copy environment variables
cp .env.example .env.local

# 3. Edit .env.local with your credentials
# 4. Set up Supabase (see below)
# 5. Run development server
npm run dev
```

## Supabase Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create new project
2. Note your project URL and anon key from Settings > API

### 2. Run Database Schema

1. Navigate to SQL Editor in Supabase dashboard
2. Copy contents of `lib/rag-database-schema.sql`
3. Paste and execute

This creates:
- `documents` table
- `document_chunks` table with vector embeddings
- `document_processing_jobs` table
- Vector similarity search function

### 3. Create Storage Bucket

1. Go to Storage in Supabase dashboard
2. Create bucket: `legislation-documents`
3. Set to Public access
4. Configure CORS if needed

## Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
OPENAI_API_KEY=sk-your-key
```

## Usage

### Upload Documents

1. Click "Upload Documents"
2. Choose file or paste text
3. Fill metadata (jurisdiction, year, category, etc.)
4. Submit

### Chat with AI

1. Ask questions about legislation
2. Get answers with inline citations [1], [2]
3. View source documents

## Project Structure

```
app/
├── api/
│   ├── chatbot/          # AI chat endpoint
│   └── documents/        # Document management
├── chatbot/              # Chat UI
├── upload/               # Upload UI
lib/
├── document-processor.ts # RAG processing
├── rag-database-schema.sql
types/
└── rag.ts               # TypeScript definitions
```

## Deployment

### Vercel

1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy

## License

MIT
