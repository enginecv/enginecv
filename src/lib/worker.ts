import "./worker-polyfill";
import { pipeline, env } from "@xenova/transformers";

type PipelineType = "feature-extraction" | "text-generation";

// Disable local models since we are fetching from HF hub, unless we want to cache locally via IndexedDB
(env as { allowLocalModels: boolean }).allowLocalModels = false;

class PipelineSingleton {
    static task: PipelineType = "feature-extraction";
    static model = "Xenova/all-MiniLM-L6-v2";
    static instance: any = null;

    static async getInstance(progress_callback?: Function) {
        if (this.instance === null) {
            this.instance = await pipeline(this.task, this.model, {
                progress_callback,
            });
        }
        return this.instance;
    }
}

class TextGenerationPipeline {
    static task: PipelineType = "text-generation";
    static instances: Record<string, any> = {};

    static async getInstance(model: string, progress_callback?: Function) {
        if (!this.instances[model]) {
            this.instances[model] = await pipeline(this.task, model, {
                progress_callback,
            });
        }
        return this.instances[model];
    }
}

// Listen for messages from the main thread
self.addEventListener("message", async (event) => {
    const { text, type, id } = event.data;

    try {
        if (type === "extract") {
            const extractor = await PipelineSingleton.getInstance((x: any) => {
                // Send progress to UI
                self.postMessage({ id, status: "progress", progress: x });
            });
            // Generate embeddings
            const output = await extractor(text, { pooling: "mean", normalize: true });
            self.postMessage({
                id,
                status: "complete",
                result: Array.from(output.data),
            });
        } else if (type === "generate") {
            // Need model from event.data, fallback to tinyllama
            const model_id = event.data.model || "Xenova/TinyLlama-1.1B-Chat-v1.0";
            const generator = await TextGenerationPipeline.getInstance(model_id, (x: any) => {
                // Send progress to UI
                self.postMessage({ id, status: "progress", progress: x, model: model_id });
            });

            // Format prompt
            let prompt = "";
            if (event.data.messages && Array.isArray(event.data.messages)) {
                prompt = event.data.messages.map((m: any) => {
                    const role = m.role === "ai" ? "assistant" : m.role;
                    return `<|${role}|>\n${m.content}\n`;
                }).join("") + "<|assistant|>\n";
            } else {
                prompt = `<|system|>\nYou are a helpful AI resume assistant. Keep responses concise.\n<|user|>\n${event.data.text}\n<|assistant|>\n`;
            }

            const output = await generator(prompt, {
                max_new_tokens: 256,
                temperature: 0.7,
                do_sample: true,
            });

            self.postMessage({
                id,
                status: "complete",
                result: output[0].generated_text.replace(prompt, "").trim(),
            });
        } else if (type === "load_model") {
            const model_id = event.data.model || "Xenova/TinyLlama-1.1B-Chat-v1.0";
            await TextGenerationPipeline.getInstance(model_id, (x: any) => {
                // Send progress to UI
                self.postMessage({ id, status: "progress", progress: x, model: model_id });
            });
            self.postMessage({ id, status: "model_ready", model: model_id });
        }
    } catch (error: any) {
        self.postMessage({ id, status: "error", error: error.message });
    }
});
