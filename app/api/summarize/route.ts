import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
// @ts-ignore
import { createRequire } from "module";

// Polyfill for pdf-parse which might depend on DOMMatrix
// @ts-ignore
if (typeof DOMMatrix === "undefined") {
    // @ts-ignore
    global.DOMMatrix = class DOMMatrix { };
}

const require = createRequire(import.meta.url);
// epub2 exports an object with EPub class
const epub2Module = require("epub2");
const EPub = epub2Module.EPub || epub2Module.default || epub2Module;

// Helper to parse PDF
async function parsePdf(buffer: Buffer, maxPage: number): Promise<string> {
    // pdf-parse v2.4.5 uses a class-based API
    const { PDFParse } = require("pdf-parse");
    
    // Create a new PDFParse instance with the buffer
    const parser = new PDFParse({
        data: buffer,
    });
    
    try {
        // Get text from the first N pages
        const result = await parser.getText({
            first: maxPage,
        });
        
        // result.text contains the concatenated text from all requested pages
        return result.text;
    } finally {
        // Clean up resources
        await parser.destroy();
    }
}

// Helper to parse EPUB
// Note: epub2 is a bit tricky with buffers, we might need to write to tmp file or use a different approach if possible.
// For Vercel serverless, writing to /tmp is allowed.
import fs from "fs";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";

async function parseEpub(buffer: Buffer, maxPage: number): Promise<string> {
    // Verify EPub is a constructor
    if (typeof EPub !== "function") {
        throw new Error("epub2 module did not export a constructor");
    }

    const tempFilePath = path.join(os.tmpdir(), `${uuidv4()}.epub`);
    await fs.promises.writeFile(tempFilePath, buffer);

    return new Promise((resolve, reject) => {
        const epub = new EPub(tempFilePath);
        epub.on("end", async () => {
            let text = "";
            // EPUBs don't map 1:1 to pages like PDFs.
            // We will approximate by chapters or just read the first N chapters.
            // For simplicity in this prototype, we'll read the first 'maxPage' chapters if available,
            // or just a chunk of text.
            // A better approach for EPUB is "percentage" or "chapter", but user asked for "page number".
            // We'll treat "page number" as "chapter index" for EPUBs or just try to get all text and truncate?
            // Let's try to get text from chapters.

            try {
                const chapters = epub.flow;
                const limit = Math.min(chapters.length, maxPage); // Treat page number as chapter count for EPUB roughly

                for (let i = 0; i < limit; i++) {
                    const chapterId = chapters[i].id;
                    const chapterText = await new Promise<string>((res, rej) => {
                        epub.getChapter(chapterId, (err: any, text: string) => {
                            if (err) rej(err);
                            else res(text);
                        });
                    });
                    // Strip HTML tags
                    text += chapterText.replace(/<[^>]*>/g, " ") + "\n";
                }

                resolve(text);
            } catch (err) {
                reject(err);
            }
        });
        epub.parse();
    });
}

// Helper function to generate summary with Gemini
async function generateWithGemini(apiKey: string, prompt: string): Promise<ReadableStream> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    const result = await model.generateContentStream(prompt);

    return new ReadableStream({
        async start(controller) {
            try {
                for await (const chunk of result.stream) {
                    const chunkText = chunk.text();
                    controller.enqueue(new TextEncoder().encode(chunkText));
                }
                controller.close();
            } catch (error) {
                controller.error(error);
            }
        },
    });
}

// Helper function to generate summary with OpenAI
async function generateWithOpenAI(apiKey: string, prompt: string): Promise<ReadableStream> {
    const openai = new OpenAI({ apiKey });
    
    const stream = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
            {
                role: "user",
                content: prompt,
            },
        ],
        stream: true,
    });

    return new ReadableStream({
        async start(controller) {
            try {
                for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content || "";
                    if (content) {
                        controller.enqueue(new TextEncoder().encode(content));
                    }
                }
                controller.close();
            } catch (error) {
                controller.error(error);
            }
        },
    });
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const pageNumber = parseInt(formData.get("page") as string);
        const provider = (formData.get("provider") as string) || "gemini";
        const apiKey = formData.get("apiKey") as string;

        if (!file || !pageNumber || !apiKey) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        if (provider !== "gemini" && provider !== "openai") {
            return NextResponse.json(
                { error: "Invalid provider. Must be 'gemini' or 'openai'" },
                { status: 400 }
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        let text = "";

        if (file.type === "application/pdf") {
            text = await parsePdf(buffer, pageNumber);
        } else if (file.type === "application/epub+zip") {
            text = await parseEpub(buffer, pageNumber);
        } else {
            return NextResponse.json(
                { error: "Unsupported file type" },
                { status: 400 }
            );
        }

        // Truncate text if it's too long for the model context window

        const prompt = `You are a helpful reading assistant. The user is reading a book and has reached page (or chapter) ${pageNumber}. 
    Below is the text of the book up to that point. 
    Please provide a comprehensive summary of the plot, key characters introduced, and major events that have happened so far. 
    Structure the summary so the user can easily recall what happened and resume reading comfortably.
    
    **IMPORTANT: Format your response using Markdown with the following structure:**
    - Use ## for main section headings (e.g., ## Summary, ## Key Characters, ## Major Events)
    - Use ### for subsections if needed
    - Use **bold** for emphasis on important terms, names, or concepts
    - Use bullet points (-) for lists
    - Use numbered lists (1., 2., 3.) for sequences of events
    - Keep paragraphs well-spaced and readable
    
    Book Content:
    ${text}`;

        // Generate summary based    on selected provider
        const stream = provider === "openai" 
            ? await generateWithOpenAI(apiKey, prompt)
            : await generateWithGemini(apiKey, prompt);

        return new NextResponse(stream, {
            headers: {
                "Content-Type": "text/markdown; charset=utf-8",
            },
        });
    } catch (error: any) {
        console.error("Error processing request:", error);
        return NextResponse.json(
            { error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
