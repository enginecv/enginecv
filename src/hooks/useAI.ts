"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { generateResumeContent, streamResumeContent, type Provider } from "@/lib/llm";

export function useAI() {
    const worker = useRef<Worker | null>(null);
    const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
    const [modelProgress, setModelProgress] = useState<Record<string, number>>({});
    const [readyModels, setReadyModels] = useState<Record<string, boolean>>({});
    const [workerError, setWorkerError] = useState<string | null>(null);

    useEffect(() => {
        if (!worker.current) {
            worker.current = new Worker(new URL("../lib/worker.ts", import.meta.url), { type: "module" });
        }

        // Surface worker-level errors (failed to load, module errors, etc.)
        const onWorkerError = (e: ErrorEvent) => {
            console.error("[Worker] Fatal error:", e.message);
            setWorkerError(e.message || "Worker failed to load");
            setDownloadingModel(null);
        };

        const onMessageReceived = (e: MessageEvent) => {
            switch (e.data.status) {
                case "progress":
                    if (e.data.model) {
                        setDownloadingModel(e.data.model);
                        if (e.data.progress && typeof e.data.progress.progress === "number") {
                            setModelProgress(prev => ({ ...prev, [e.data.model]: e.data.progress.progress }));
                        }
                    }
                    break;
                case "model_ready":
                    if (e.data.model) {
                        setReadyModels(prev => ({ ...prev, [e.data.model]: true }));
                        setDownloadingModel(null);
                    }
                    break;
                case "complete":
                    setDownloadingModel(null);
                    break;
                case "error":
                    console.error("[Worker] Task error:", e.data.error);
                    setWorkerError(e.data.error || "Model loading failed");
                    setDownloadingModel(null);
                    break;
            }
        };
        worker.current.addEventListener("message", onMessageReceived);
        worker.current.addEventListener("error", onWorkerError);
        return () => {
            worker.current?.removeEventListener("message", onMessageReceived);
            worker.current?.removeEventListener("error", onWorkerError);
        };
    }, []);

    const extractKeywords = useCallback((text: string): Promise<number[]> => {
        return new Promise((resolve, reject) => {
            if (!worker.current) return reject(new Error("Worker not initialized"));
            const id = Date.now().toString();
            const handleMessage = (e: MessageEvent) => {
                if (e.data.id === id) {
                    if (e.data.status === "complete") {
                        worker.current?.removeEventListener("message", handleMessage);
                        resolve(e.data.result);
                    } else if (e.data.status === "error") {
                        worker.current?.removeEventListener("message", handleMessage);
                        reject(new Error(e.data.error));
                    }
                }
            };
            worker.current.addEventListener("message", handleMessage);
            worker.current.postMessage({ type: "extract", text, id });
        });
    }, []);

    const loadModel = useCallback((modelId: string) => {
        setDownloadingModel(modelId);
        return new Promise<void>((resolve, reject) => {
            if (!worker.current) return reject(new Error("Worker not initialized"));
            const id = Date.now().toString();
            const handleMessage = (e: MessageEvent) => {
                if (e.data.id === id) {
                    if (e.data.status === "model_ready") {
                        worker.current?.removeEventListener("message", handleMessage);
                        resolve();
                    } else if (e.data.status === "error") {
                        worker.current?.removeEventListener("message", handleMessage);
                        reject(new Error(e.data.error));
                    }
                }
            };
            worker.current.addEventListener("message", handleMessage);
            worker.current.postMessage({ type: "load_model", id, model: modelId });
        });
    }, []);

    const generateAIContent = useCallback(
        async (messages: import("@/lib/llm").ChatMessage[], provider: Provider, apiKey?: string, model?: string) => {
            if (provider === "local") {
                return new Promise<string>((resolve, reject) => {
                    if (!worker.current) return reject(new Error("Worker not initialized"));
                    const id = Date.now().toString();
                    const handleMessage = (e: MessageEvent) => {
                        if (e.data.id === id) {
                            if (e.data.status === "complete") {
                                worker.current?.removeEventListener("message", handleMessage);
                                resolve(e.data.result);
                            } else if (e.data.status === "error") {
                                worker.current?.removeEventListener("message", handleMessage);
                                reject(new Error(e.data.error));
                            }
                        }
                    };
                    worker.current.addEventListener("message", handleMessage);
                    worker.current.postMessage({ type: "generate", messages, id, model });
                });
            }
            return generateResumeContent(messages, { provider, apiKey, model });
        },
        []
    );

    const streamAIContent = useCallback(
        async (
            messages: import("@/lib/llm").ChatMessage[],
            provider: Provider,
            onToken: (chunk: string) => void,
            apiKey?: string,
            model?: string
        ): Promise<void> => {
            if (provider === "local") {
                const result = await new Promise<string>((resolve, reject) => {
                    if (!worker.current) return reject(new Error("Worker not initialized"));
                    const id = Date.now().toString();
                    const handleMessage = (e: MessageEvent) => {
                        if (e.data.id === id) {
                            if (e.data.status === "complete") {
                                worker.current?.removeEventListener("message", handleMessage);
                                resolve(e.data.result);
                            } else if (e.data.status === "error") {
                                worker.current?.removeEventListener("message", handleMessage);
                                reject(new Error(e.data.error));
                            }
                        }
                    };
                    worker.current.addEventListener("message", handleMessage);
                    worker.current.postMessage({ type: "generate", messages, id, model });
                });
                onToken(result);
                return;
            }
            for await (const chunk of streamResumeContent(messages, { provider, apiKey, model })) {
                onToken(chunk);
            }
        },
        []
    );

    return { extractKeywords, generateAIContent, streamAIContent, loadModel, downloadingModel, modelProgress, readyModels, workerError };
}
