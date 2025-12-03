# Project: Actalyze - US Legislation Document Intelligence

## Project Overview

Actalyze is an AI-powered assistant for US federal and state legislation, regulations, case law, and legal documents. It is built with Next.js, Supabase, and OpenAI. The application allows users to upload documents (PDF, DOCX, TXT, or MD) and ask questions about them. The core of the application is a Retrieval-Augmented Generation (RAG) system that provides accurate, source-based answers.

The main technologies used are:
- **Framework**: Next.js 15 (App Router)
- **Database**: Supabase (PostgreSQL + pgvector)
- **AI**: OpenAI GPT-4 + text-embedding-3-large
- **Storage**: Supabase Storage
- **Styling**: Tailwind CSS
- **Language**: TypeScript

The architecture is centered around a RAG pipeline:
1.  **Document Upload**: Users upload documents, which are processed to extract text.
2.  **Text Processing**: The extracted text is chunked into smaller pieces.
3.  **Embedding Generation**: OpenAI's embedding model (`text-embedding-3-large`) is used to create vector embeddings for each chunk.
4.  **Storage**: The document metadata, chunks, and their embeddings are stored in a Supabase PostgreSQL database.
5.  **AI Chat**: When a user asks a question, the application generates an embedding for the query and searches the database for the most relevant document chunks using vector similarity search.
6.  **Response Generation**: The relevant chunks are then passed to an OpenAI model (GPT-4 or a model from OpenRouter) along with the user's question to generate an informed response with source citations.

## Building and Running

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- OpenAI API key

### Installation and Running

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Set up environment variables:**
    Copy `.env.example` to `.env.local` and fill in your Supabase and OpenAI credentials.
    ```bash
    cp .env.example .env.local
    ```

3.  **Set up Supabase:**
    - Create a new Supabase project.
    - Run the SQL schema from `lib/rag-database-schema.sql` in the Supabase SQL Editor. This will create the necessary tables, indexes, and functions.
    - Create a Supabase Storage bucket named `legislation-documents` with public read access.

4.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:3000`.

### Other Commands

-   **Build for production:**
    ```bash
    npm run build
    ```

-   **Start the production server:**
    ```bash
    npm run start
    ```

-   **Lint the code:**
    ```bash
    npm run lint
    ```

## Development Conventions

-   **Coding Style**: The project uses TypeScript and follows standard React and Next.js conventions. ESLint is configured for linting.
-   **Testing**: The `src/trending/__tests__` directory suggests that there are some tests for the trending topics feature. However, a comprehensive testing strategy for the entire application is not immediately apparent.
-   **API Routes**: All backend logic is handled through Next.js API routes located in the `app/api` directory.
-   **RAG System**: The core of the document intelligence is located in `lib/document-processor.ts`, which handles everything from file validation and text extraction to embedding generation and document searching.
-   **Database**: The database schema is defined in `lib/rag-database-schema.sql`. Any changes to the database structure should be reflected in this file.
