"use client";

import { useEffect, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import type { Resume } from "@/lib/schema";
import { Check, RotateCcw, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

type PhotoEditState = Resume["basics"]["photoEdit"];

interface PhotoCropModalProps {
    isOpen: boolean;
    imageSrc: string | null;
    initialEdit: PhotoEditState;
    onClose: () => void;
    onApply: (payload: { photo: string; photoEdit: NonNullable<PhotoEditState> }) => void;
}

function loadImage(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
    });
}

async function createCroppedPhoto(src: string, cropArea: Area) {
    const image = await loadImage(src);
    const canvas = document.createElement("canvas");
    const width = Math.max(1, Math.round(cropArea.width));
    const height = Math.max(1, Math.round(cropArea.height));

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Canvas context unavailable");
    }

    context.drawImage(
        image,
        Math.round(cropArea.x),
        Math.round(cropArea.y),
        width,
        height,
        0,
        0,
        width,
        height,
    );

    return canvas.toDataURL("image/png");
}

function degreesToRadians(value: number) {
    return (value * Math.PI) / 180;
}

function getRotatedSize(width: number, height: number, rotation: number) {
    const radians = degreesToRadians(rotation);
    return {
        width: Math.abs(Math.cos(radians) * width) + Math.abs(Math.sin(radians) * height),
        height: Math.abs(Math.sin(radians) * width) + Math.abs(Math.cos(radians) * height),
    };
}

async function createEditedPhoto(src: string, cropArea: Area, rotation: number) {
    if (rotation % 360 === 0) {
        return createCroppedPhoto(src, cropArea);
    }

    const image = await loadImage(src);
    const radians = degreesToRadians(rotation);
    const rotatedBounds = getRotatedSize(image.width, image.height, rotation);
    const rotationCanvas = document.createElement("canvas");
    rotationCanvas.width = Math.ceil(rotatedBounds.width);
    rotationCanvas.height = Math.ceil(rotatedBounds.height);

    const rotationContext = rotationCanvas.getContext("2d");
    if (!rotationContext) {
        throw new Error("Canvas context unavailable");
    }

    rotationContext.translate(rotationCanvas.width / 2, rotationCanvas.height / 2);
    rotationContext.rotate(radians);
    rotationContext.drawImage(image, -image.width / 2, -image.height / 2);

    const canvas = document.createElement("canvas");
    const width = Math.max(1, Math.round(cropArea.width));
    const height = Math.max(1, Math.round(cropArea.height));

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Canvas context unavailable");
    }

    context.drawImage(
        rotationCanvas,
        Math.round(cropArea.x),
        Math.round(cropArea.y),
        width,
        height,
        0,
        0,
        width,
        height,
    );

    return canvas.toDataURL("image/png");
}

export function PhotoCropModal({
    isOpen,
    imageSrc,
    initialEdit,
    onClose,
    onApply,
}: PhotoCropModalProps) {
    const { t } = useTranslation();
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!isOpen || !imageSrc) {
            return;
        }

        setCrop(initialEdit?.crop || { x: 0, y: 0 });
        setZoom(initialEdit?.zoom ?? 1);
        setRotation(initialEdit?.rotation ?? 0);
        setCroppedAreaPixels(initialEdit?.croppedAreaPixels || null);
        setIsSaving(false);
    }, [imageSrc, initialEdit, isOpen]);

    if (!isOpen || !imageSrc) {
        return null;
    }

    const handleReset = () => {
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setRotation(0);
        setCroppedAreaPixels(null);
    };

    const handleApply = async () => {
        if (!croppedAreaPixels || isSaving) {
            return;
        }

        setIsSaving(true);
        try {
            const photo = await createEditedPhoto(imageSrc, croppedAreaPixels, rotation);
            onApply({
                photo,
                photoEdit: {
                    original: initialEdit?.original || imageSrc,
                    crop,
                    zoom,
                    rotation,
                    croppedAreaPixels,
                },
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-3xl rounded-[1.25rem] border border-edge bg-surface-4 shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5 border-b border-edge">
                    <div>
                        <h3 className="text-lg font-semibold text-strong">{t("photoCrop.title")}</h3>
                        <p className="text-sm text-faint">{t("photoCrop.description")}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl border border-edge text-faint hover:text-strong hover:border-faint transition-colors flex items-center justify-center"
                        title={t("photoCrop.close")}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="relative h-[420px] rounded-[1rem] overflow-hidden bg-surface-1 border border-edge">
                        <Cropper
                            image={imageSrc}
                            crop={crop}
                            zoom={zoom}
                            rotation={rotation}
                            aspect={1}
                            cropShape="rect"
                            showGrid={false}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onRotationChange={setRotation}
                            onCropComplete={(_, areaPixels) => setCroppedAreaPixels(areaPixels)}
                        />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-strong/90">{t("photoCrop.zoom")}</span>
                                <span className="text-faint">{zoom.toFixed(2)}x</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="3"
                                step="0.01"
                                value={zoom}
                                onChange={(event) => setZoom(Number(event.target.value))}
                                className="w-full h-1.5 bg-edge rounded-full appearance-none cursor-pointer outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:rounded-full"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-strong/90">{t("photoCrop.rotation")}</span>
                                <span className="text-faint">{Math.round(rotation)}°</span>
                            </div>
                            <input
                                type="range"
                                min="-180"
                                max="180"
                                step="1"
                                value={rotation}
                                onChange={(event) => setRotation(Number(event.target.value))}
                                className="w-full h-1.5 bg-edge rounded-full appearance-none cursor-pointer outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:rounded-full"
                            />
                        </div>
                    </div>
                </div>

                <div className="px-6 py-5 border-t border-edge bg-surface-3 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={handleReset}
                        className="h-11 px-4 rounded-xl border border-edge text-faint hover:text-strong hover:border-faint transition-colors flex items-center gap-2"
                    >
                        <RotateCcw className="w-4 h-4" />
                        {t("photoCrop.reset")}
                    </button>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-11 px-4 rounded-xl border border-edge text-faint hover:text-strong hover:border-faint transition-colors"
                        >
                            {t("photoCrop.cancel")}
                        </button>
                        <button
                            type="button"
                            onClick={handleApply}
                            disabled={!croppedAreaPixels || isSaving}
                            className="h-11 px-4 rounded-xl bg-accent text-surface-1 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                        >
                            <Check className="w-4 h-4" />
                            {isSaving ? t("photoCrop.saving") : t("photoCrop.apply")}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
