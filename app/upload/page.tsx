"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DOCUMENT_CATEGORIES,
  SOURCE_TYPES,
  US_JURISDICTIONS,
} from "@/types/rag";

export default function DocumentUploadPage() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<"file" | "text">("file");

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    source_type: "regulation" as const,
    category: "",
    jurisdiction: "",
    year: new Date().getFullYear(),
    bill_number: "",
    case_citation: "",
    metadata: {} as Record<string, unknown>,
  });
  const [file, setFile] = useState<File | null>(null);

  const handleInputChange = (
    field: keyof typeof formData,
    value: string | number | string[]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);

    // Auto-fill title from filename if empty
    if (selectedFile && !formData.title) {
      const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
      setFormData((prev) => ({ ...prev, title: nameWithoutExt }));
    }
  };

  const handleFileRemove = () => {
    setFile(null);
    const fileInput = document.getElementById("fileInput") as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setUploading(true);

    try {
      // Validation
      if (!formData.title.trim()) {
        throw new Error("Title is required");
      }

      if (uploadMode === "file" && !file) {
        throw new Error("Please select a file to upload");
      }

      if (uploadMode === "text" && !formData.content.trim()) {
        throw new Error("Content is required");
      }

      // Prepare form data for upload
      const uploadFormData = new FormData();
      uploadFormData.append("title", formData.title.trim());
      uploadFormData.append("source_type", formData.source_type);
      uploadFormData.append("category", formData.category);
      uploadFormData.append("jurisdiction", formData.jurisdiction);
      uploadFormData.append("year", formData.year.toString());
      uploadFormData.append("bill_number", formData.bill_number);
      uploadFormData.append("case_citation", formData.case_citation);
      uploadFormData.append(
        "metadata",
        JSON.stringify({
          ...formData.metadata,
          uploaded_via: "web_interface",
          upload_date: new Date().toISOString(),
        })
      );

      if (uploadMode === "file" && file) {
        uploadFormData.append("file", file);
      } else {
        uploadFormData.append("content", formData.content.trim());
      }

      // Upload document
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: uploadFormData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Upload failed");
      }

      setSuccess(
        `Document "${formData.title}" uploaded successfully! It is now being processed and will be available for search shortly.`
      );

      // Reset form
      setFormData({
        title: "",
        content: "",
        source_type: "regulation",
        category: "",
        jurisdiction: "",
        year: new Date().getFullYear(),
        bill_number: "",
        case_citation: "",
        metadata: {},
      });
      setFile(null);

      // Reset file input
      const fileInput = document.getElementById(
        "fileInput"
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (error) {
      console.error("Upload error:", error);
      setError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-2xl font-bold text-slate-800">
            Actalyze
          </Link>
          <span className="text-slate-400">|</span>
          <span className="text-slate-600">Upload Documents</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/chatbot"
            className="px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Back to Chat
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            Upload Legislation Document
          </h1>
          <p className="text-slate-600 mb-6">
            Upload US legislation documents, regulations, case law, or bills to
            make them searchable by the AI assistant.
          </p>

          {/* Error/Success Messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <strong>Error:</strong> {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
              <strong>Success!</strong> {success}
            </div>
          )}

          {/* Upload Mode Toggle */}
          <div className="mb-6 flex gap-2">
            <button
              type="button"
              onClick={() => setUploadMode("file")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                uploadMode === "file"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Upload File
            </button>
            <button
              type="button"
              onClick={() => setUploadMode("text")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                uploadMode === "text"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Paste Text
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Document Title */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Document Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Clean Air Act of 1990"
                required
              />
            </div>

            {/* File Upload / Text Input */}
            {uploadMode === "file" ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Upload File *
                </label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
                  {!file ? (
                    <div>
                      <input
                        id="fileInput"
                        type="file"
                        onChange={handleFileChange}
                        accept=".pdf,.txt,.md,.docx"
                        className="hidden"
                      />
                      <label
                        htmlFor="fileInput"
                        className="cursor-pointer inline-flex flex-col items-center"
                      >
                        <svg
                          className="w-12 h-12 text-slate-400 mb-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                        <span className="text-blue-600 font-medium">
                          Click to upload
                        </span>
                        <span className="text-slate-500 text-sm mt-1">
                          PDF, TXT, MD, or DOCX (max 50MB)
                        </span>
                      </label>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-slate-50 p-4 rounded">
                      <div className="flex items-center gap-3">
                        <svg
                          className="w-8 h-8 text-blue-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <div className="text-left">
                          <div className="font-medium text-slate-800">
                            {file.name}
                          </div>
                          <div className="text-sm text-slate-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleFileRemove}
                        className="text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Document Content *
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => handleInputChange("content", e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={12}
                  placeholder="Paste the document text here..."
                  required
                />
              </div>
            )}

            {/* Source Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Source Type
              </label>
              <select
                value={formData.source_type}
                onChange={(e) =>
                  handleInputChange("source_type", e.target.value)
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {SOURCE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => handleInputChange("category", e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a category...</option>
                {DOCUMENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            {/* Jurisdiction and Year Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Jurisdiction
                </label>
                <select
                  value={formData.jurisdiction}
                  onChange={(e) =>
                    handleInputChange("jurisdiction", e.target.value)
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select jurisdiction...</option>
                  {US_JURISDICTIONS.map((jurisdiction) => (
                    <option key={jurisdiction} value={jurisdiction}>
                      {jurisdiction}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Year
                </label>
                <input
                  type="number"
                  value={formData.year}
                  onChange={(e) =>
                    handleInputChange(
                      "year",
                      parseInt(e.target.value) || new Date().getFullYear()
                    )
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1776"
                  max={new Date().getFullYear() + 10}
                />
              </div>
            </div>

            {/* Bill Number and Case Citation Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Bill Number (if applicable)
                </label>
                <input
                  type="text"
                  value={formData.bill_number}
                  onChange={(e) =>
                    handleInputChange("bill_number", e.target.value)
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., H.R. 1234, S. 5678"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Case Citation (if applicable)
                </label>
                <input
                  type="text"
                  value={formData.case_citation}
                  onChange={(e) =>
                    handleInputChange("case_citation", e.target.value)
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 123 U.S. 456"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={uploading}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {uploading ? "Uploading..." : "Upload Document"}
              </button>
              <Link
                href="/chatbot"
                className="px-6 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium text-center"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">
            📝 Upload Guidelines
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Supported formats: PDF, TXT, MD, DOCX (max 50MB)</li>
            <li>• Documents are automatically processed and made searchable</li>
            <li>• Add relevant metadata to improve search accuracy</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
