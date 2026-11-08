"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, PenLine, Upload, Trash2, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface SignatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (dataUrl: string) => void;
}

const CANVAS_WIDTH = 700;
const CANVAS_HEIGHT = 240;
const STROKE_COLOR = "#111827";
const STROKE_WIDTH = 2.5;

type SignatureMode = "draw" | "upload";

export function SignatureModal({ isOpen, onClose, onSave }: SignatureModalProps) {
    const { t } = useTranslation();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const [mode, setMode] = useState<SignatureMode>("draw");
    const [hasDrawn, setHasDrawn] = useState(false);
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen || typeof document === "undefined") return null;

    const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        return {
            x: (event.clientX - rect.left) * (canvas.width / rect.width),
            y: (event.clientY - rect.top) * (canvas.height / rect.height),
        };
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.setPointerCapture(event.pointerId);
        drawingRef.current = true;
        lastPointRef.current = getCanvasPoint(event);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawingRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        const point = getCanvasPoint(event);
        const last = lastPointRef.current ?? point;
        ctx.strokeStyle = STROKE_COLOR;
        ctx.lineWidth = STROKE_WIDTH;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
        lastPointRef.current = point;
        if (!hasDrawn) setHasDrawn(true);
    };

    const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
        drawingRef.current = false;
        lastPointRef.current = null;
        canvasRef.current?.releasePointerCapture(event.pointerId);
    };

    const handleClear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasDrawn(false);
        setUploadedImage(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setUploadedImage(reader.result as string);
        reader.readAsDataURL(file);
    };

    const canSave = mode === "draw" ? hasDrawn : Boolean(uploadedImage);

    const handleSave = () => {
        if (mode === "upload") {
            if (uploadedImage) onSave(uploadedImage);
            return;
        }
        const canvas = canvasRef.current;
        if (!canvas || !hasDrawn) return;
        onSave(canvas.toDataURL("image/png"));
    };

    const tabClass = (active: boolean) =>
        `flex-1 h-11 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            active
                ? "border-accent bg-accent/10 text-accent"
                : "border-edge bg-surface-1 text-faint hover:text-strong hover:border-faint"
        }`;

    return createPortal(
        <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl rounded-[1.25rem] border border-edge bg-surface-4 shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5 border-b border-edge">
                    <h3 className="text-lg font-semibold text-strong">{t("signature.title")}</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl border border-edge text-faint hover:text-strong hover:border-faint transition-colors flex items-center justify-center"
                        title={t("signature.close")}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setMode("draw")} className={tabClass(mode === "draw")}>
                            <PenLine className="w-4 h-4" />
                            {t("signature.draw")}
                        </button>
                        <button type="button" onClick={() => setMode("upload")} className={tabClass(mode === "upload")}>
                            <Upload className="w-4 h-4" />
                            {t("signature.upload")}
                        </button>
                    </div>

                    {mode === "draw" ? (
                        <div className="rounded-[1rem] border border-edge bg-surface-1 overflow-hidden">
                            <canvas
                                ref={canvasRef}
                                width={CANVAS_WIDTH}
                                height={CANVAS_HEIGHT}
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerLeave={handlePointerUp}
                                className="w-full touch-none cursor-crosshair block"
                                style={{ height: CANVAS_HEIGHT, background: "#ffffff" }}
                            />
                        </div>
                    ) : (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="rounded-[1rem] border-2 border-dashed border-edge bg-surface-1 flex items-center justify-center cursor-pointer hover:border-faint transition-colors overflow-hidden"
                            style={{ height: CANVAS_HEIGHT }}
                        >
                            {uploadedImage ? (
                                <img src={uploadedImage} alt={t("editor.declarationSignature")} className="max-h-full max-w-full object-contain" style={{ background: "#ffffff" }} />
                            ) : (
                                <div className="flex flex-col items-center gap-2 text-faint">
                                    <Upload className="w-7 h-7 opacity-60" />
                                    <span className="text-sm">{t("signature.uploadHint")}</span>
                                </div>
                            )}
                            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleUpload} />
                        </div>
                    )}
                </div>

                <div className="px-6 py-5 border-t border-edge bg-surface-3 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={handleClear}
                        className="h-11 px-4 rounded-xl border border-edge text-faint hover:text-strong hover:border-faint transition-colors flex items-center gap-2"
                    >
                        <Trash2 className="w-4 h-4" />
                        {t("signature.clear")}
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!canSave}
                        className="h-11 px-5 rounded-xl bg-accent text-surface-1 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                        <Check className="w-4 h-4" />
                        {t("signature.save")}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
