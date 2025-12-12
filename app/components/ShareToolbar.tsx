"use client";

import { useState } from "react";
import {
  Share2,
  Twitter,
  Facebook,
  Linkedin,
  Mail,
  FileText,
  Download,
  Copy,
  Check,
  X,
} from "lucide-react";

interface ShareToolbarProps {
  content: string;
  title?: string;
  onClose?: () => void;
}

export default function ShareToolbar({ content, title = "Document", onClose }: ShareToolbarProps) {
  const [copied, setCopied] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);

  const showNotification = (message: string) => {
    setShowToast(message);
    setTimeout(() => setShowToast(null), 2000);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      showNotification("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      showNotification("Failed to copy");
    }
  };

  const handleTwitterShare = () => {
    const text = content.length > 250 ? content.slice(0, 247) + "..." : content;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "width=550,height=420");
  };

  const handleFacebookShare = () => {
    // Facebook requires a URL to share, so we'll use the current page
    const url = `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(content.slice(0, 500))}`;
    window.open(url, "_blank", "width=550,height=420");
  };

  const handleLinkedInShare = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`;
    window.open(url, "_blank", "width=550,height=420");
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(content);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleGoogleDocs = () => {
    // Create a Google Docs document with the content
    const docContent = encodeURIComponent(content);
    const url = `https://docs.google.com/document/create?title=${encodeURIComponent(title)}&body=${docContent}`;
    window.open(url, "_blank");
    showNotification("Opening Google Docs...");
  };

  const handleDownloadWord = () => {
    // Create a simple HTML document that Word can open
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
      <head><meta charset="utf-8"><title>${title}</title></head>
      <body>
        <h1>${title}</h1>
        ${content.split('\n').map(p => `<p>${p}</p>`).join('')}
      </body>
      </html>
    `;
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification("Downloaded as Word document");
  };

  const handleDownloadPDF = () => {
    // Use browser print to PDF
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Georgia, serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 20px; }
            h1 { font-size: 24px; margin-bottom: 20px; }
            p { margin-bottom: 12px; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          ${content.split('\n').map(p => `<p>${p}</p>`).join('')}
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
    showNotification("Opening print dialog for PDF");
  };

  return (
    <div className="relative">
      {/* Toast notification */}
      {showToast && (
        <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-1.5 rounded-lg text-sm font-medium shadow-lg z-50 whitespace-nowrap">
          {showToast}
        </div>
      )}

      <div className="flex items-center gap-1 p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
        {/* Social Share */}
        <button
          onClick={handleTwitterShare}
          className="p-2 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-400 hover:text-[#1DA1F2]"
          title="Share on Twitter/X"
        >
          <Twitter className="w-4 h-4" />
        </button>
        <button
          onClick={handleFacebookShare}
          className="p-2 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-400 hover:text-[#4267B2]"
          title="Share on Facebook"
        >
          <Facebook className="w-4 h-4" />
        </button>
        <button
          onClick={handleLinkedInShare}
          className="p-2 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-400 hover:text-[#0077B5]"
          title="Share on LinkedIn"
        >
          <Linkedin className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-600 mx-1" />

        {/* Email */}
        <button
          onClick={handleEmailShare}
          className="p-2 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          title="Share via Email"
        >
          <Mail className="w-4 h-4" />
        </button>

        {/* Copy */}
        <button
          onClick={handleCopy}
          className="p-2 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          title="Copy to clipboard"
        >
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </button>

        <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-600 mx-1" />

        {/* Export */}
        <button
          onClick={handleGoogleDocs}
          className="p-2 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-400 hover:text-[#4285F4]"
          title="Open in Google Docs"
        >
          <FileText className="w-4 h-4" />
        </button>
        <button
          onClick={handleDownloadWord}
          className="p-2 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-400 hover:text-[#2B579A]"
          title="Download as Word"
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          onClick={handleDownloadPDF}
          className="p-2 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-400 hover:text-red-600"
          title="Download as PDF"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <path d="M9 15h6M9 11h6" />
          </svg>
        </button>

        {onClose && (
          <>
            <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-600 mx-1" />
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-400"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
