"use client";

import { useState } from "react";
import { FileUpload } from "@/components/ui/file-upload";
import { InputWithLabel } from "@/components/ui/input-with-label";
import { SummaryView } from "@/components/summary-view";
import { Loader2, BookOpen } from "lucide-react";
import { motion } from "framer-motion";

type Provider = "gemini" | "openai";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [pageNumber, setPageNumber] = useState<string>("");
  const [provider, setProvider] = useState<Provider>("gemini");
  const [apiKey, setApiKey] = useState<string>("");
  const [summary, setSummary] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
  };

  const handleReset = () => {
    setFile(null);
    setPageNumber("");
    setSummary("");
    setError(null);
    setApiKey("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !pageNumber || !apiKey) {
      setError("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSummary("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("page", pageNumber);
      formData.append("provider", provider);
      formData.append("apiKey", apiKey);

      const response = await fetch("/api/summarize", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate summary");
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        setSummary((prev) => prev + text);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans selection:bg-blue-100 dark:selection:bg-blue-900/50">
      <div className="flex flex-col h-screen">
        {/* Header */}
        <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="container mx-auto px-4 py-4">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3"
            >
              <div className="inline-flex items-center justify-center p-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                <BookOpen className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                BookMark
              </h1>
            </motion.div>
          </div>
        </header>

        {/* Main Content - Split Layout */}
        <main className="flex-1 flex overflow-hidden">
          {/* Left Side - Form */}
          <div className="w-full md:w-1/2 border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto">
            <div className="p-6 md:p-8">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="max-w-lg mx-auto"
              >
                <h2 className="text-2xl font-semibold mb-3">Generate Summary</h2>
                <p className="text-zinc-600 dark:text-zinc-400 mb-6 text-sm leading-relaxed">
                  When you leave reading a book after a long time, you may forget the characters, key events, and plot details. 
                  With this tool, you can enter the page number up to which you've finished reading, get a summary of everything 
                  that happened so far, and seamlessly pick up where you left off.
                </p>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Upload your book</h3>
                    <FileUpload
                      onFileSelect={handleFileSelect}
                      selectedFile={file}
                    />
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Where are you?</h3>
                    <InputWithLabel
                      label="Page Number"
                      id="page"
                      type="number"
                      placeholder="e.g. 42"
                      value={pageNumber}
                      onChange={(e) => setPageNumber(e.target.value)}
                      min="1"
                    />
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">AI Provider</h3>
                    <div className="space-y-2">
                      <label htmlFor="provider" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Select Provider
                      </label>
                      <select
                        id="provider"
                        value={provider}
                        onChange={(e) => setProvider(e.target.value as Provider)}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="gemini">Google Gemini</option>
                        <option value="openai">OpenAI</option>
                      </select>
                    </div>
                    <InputWithLabel
                      label={provider === "gemini" ? "Gemini API Key" : "OpenAI API Key"}
                      id="apiKey"
                      type="password"
                      placeholder={provider === "gemini" ? "Enter your Google AI API Key" : "Enter your OpenAI API Key"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Your key is never stored and only used for this session.
                    </p>
                  </div>

                  {error && (
                    <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || !file || !pageNumber || !apiKey}
                    className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-blue-500/20"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Reading your book...
                      </>
                    ) : (
                      "Generate Summary"
                    )}
                  </button>
                </form>
              </motion.div>
            </div>
          </div>

          {/* Right Side - Summary */}
          <div className="w-full md:w-1/2 overflow-y-auto bg-zinc-50 dark:bg-black">
            <div className="p-6 md:p-8">
              {summary ? (
                <SummaryView summary={summary} onReset={handleReset} />
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center h-full text-center text-zinc-400 dark:text-zinc-600"
                >
                  <BookOpen className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-lg font-medium">Summary will appear here</p>
                  <p className="text-sm mt-2">Fill out the form and click "Generate Summary" to get started</p>
                </motion.div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
