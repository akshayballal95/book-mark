"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "framer-motion";
import { BookOpen, RefreshCw } from "lucide-react";

interface SummaryViewProps {
    summary: string;
    onReset: () => void;
}

export function SummaryView({ summary, onReset }: SummaryViewProps) {
    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full space-y-6"
        >
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
                <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                    <BookOpen className="w-6 h-6" />
                    <h2 className="text-2xl font-semibold">Book Summary</h2>
                </div>
                <button
                    onClick={onReset}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                    <RefreshCw className="w-4 h-4" />
                    Clear
                </button>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8">
                <div className="markdown-content text-zinc-900 dark:text-zinc-100">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {summary}
                    </ReactMarkdown>
                </div>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200 text-center">
                    You are all caught up! You can now resume reading from your specified page.
                </p>
            </div>
        </motion.div>
    );
}
