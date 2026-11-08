"use client";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent,
} from "react";
import Moveable from "react-moveable";
import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    Bold,
    BringToFront,
    Copy,
    Italic,
    SendToBack,
    TextCursorInput,
    Trash2,
    type LucideIcon,
} from "lucide-react";
import { buildBoxBorderStyles } from "@/lib/preview/box-style";
import { DEFAULT_DESIGN_BORDER, type DesignElement } from "@/lib/design";
import { useTranslation } from "@/lib/i18n";

type OverlayRect = Pick<DesignElement, "x" | "y" | "width" | "height">;
type OverlayLayerDirection = "front" | "back";

export function applyOverlayTextTransform(text: string, transform: "none" | "uppercase" | "capitalize" | "lowercase") {
    if (transform === "uppercase") return text.toUpperCase();
    if (transform === "lowercase") return text.toLowerCase();
    if (transform === "capitalize") {
        return text.replace(/\b\w/g, (char) => char.toUpperCase());
    }
    return text;
}

export function clampOverlayValue(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

export function resolveOverlayFillStyles(element: DesignElement): CSSProperties {
    if (element.type !== "image" && element.style.fillMode === "gradient") {
        return {
            backgroundImage: `linear-gradient(${element.style.gradientAngle}deg, ${element.style.gradientFrom} 0%, ${element.style.gradientTo} 100%)`,
        };
    }

    return {
        backgroundColor: element.style.backgroundColor || undefined,
    };
}

function isBoldWeight(weight: DesignElement["style"]["fontWeight"]) {
    if (["bold", "semibold", "extrabold"].includes(weight)) return true;
    const numericWeight = Number.parseInt(weight, 10);
    return Number.isFinite(numericWeight) && numericWeight >= 600;
}

function toolbarPosition(
    element: DesignElement,
    pageWidth: number,
    pageHeight: number,
    toolbarWidth: number,
    pageScale: number,
) {
    const safeScale = Math.max(pageScale, 0.2);
    const scaledToolbarWidth = toolbarWidth / safeScale;
    const toolbarHeight = 44 / safeScale;
    const edgeInset = 8 / safeScale;
    const centeredX = element.x + element.width / 2;
    const left = scaledToolbarWidth >= pageWidth
        ? pageWidth / 2
        : clampOverlayValue(
            centeredX,
            scaledToolbarWidth / 2 + edgeInset,
            pageWidth - scaledToolbarWidth / 2 - edgeInset,
        );
    const top = element.y >= toolbarHeight + edgeInset
        ? element.y - toolbarHeight - edgeInset
        : Math.min(pageHeight - toolbarHeight - edgeInset, element.y + element.height + edgeInset);

    return { left, top };
}

function ToolbarButton({
    label,
    Icon,
    active = false,
    danger = false,
    onClick,
}: {
    label: string;
    Icon: LucideIcon;
    active?: boolean;
    danger?: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active || undefined}
            className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffaa8d] ${
                active
                    ? "bg-[#ffaa8d] text-[#24120c]"
                    : danger
                        ? "text-red-300 hover:bg-red-500/20 hover:text-red-200"
                        : "text-zinc-100 hover:bg-white/12"
            }`}
            onClick={onClick}
        >
            <Icon className="h-4 w-4" strokeWidth={1.9} />
        </button>
    );
}

function DesignOverlayQuickToolbar({
    element,
    pageWidth,
    pageHeight,
    pageScale,
    onEditText,
    onUpdateStyle,
    onDuplicate,
    onMoveLayer,
    onDelete,
}: {
    element: DesignElement;
    pageWidth: number;
    pageHeight: number;
    pageScale: number;
    onEditText: () => void;
    onUpdateStyle: (updates: Partial<DesignElement["style"]>) => void;
    onDuplicate: () => void;
    onMoveLayer: (direction: OverlayLayerDirection) => void;
    onDelete: () => void;
}) {
    const { t } = useTranslation();
    const isText = element.type === "text";
    const alignmentOrder: Array<DesignElement["style"]["textAlign"]> = ["left", "center", "right"];
    const nextAlignment = alignmentOrder[(alignmentOrder.indexOf(element.style.textAlign) + 1) % alignmentOrder.length];
    const AlignmentIcon = element.style.textAlign === "center"
        ? AlignCenter
        : element.style.textAlign === "right"
            ? AlignRight
            : AlignLeft;
    const safeScale = Math.max(pageScale, 0.2);
    const toolbarWidth = isText ? 292 : 146;
    const position = toolbarPosition(element, pageWidth, pageHeight, toolbarWidth, safeScale);

    return (
        <div
            data-design-toolbar
            data-testid={`design-toolbar-${element.id}`}
            className="pointer-events-none absolute z-[10000]"
            style={{
                left: position.left,
                top: position.top,
            }}
            onPointerDown={(event) => event.stopPropagation()}
        >
            <div
                role="toolbar"
                aria-label={t("customize.designInspector")}
                className="pointer-events-auto absolute flex items-center gap-0.5 rounded-[10px] border border-white/10 bg-zinc-950/95 p-1.5 shadow-[0_12px_35px_rgba(0,0,0,0.35)] backdrop-blur-sm"
                style={{
                    left: -toolbarWidth / (2 * safeScale),
                    width: toolbarWidth,
                    transform: `scale(${1 / safeScale})`,
                    transformOrigin: "top left",
                    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
                }}
            >
                {isText && (
                    <>
                        <ToolbarButton label={t("customize.designTextContent")} Icon={TextCursorInput} onClick={onEditText} />
                        <ToolbarButton
                            label={t("editor.fontBold")}
                            Icon={Bold}
                            active={isBoldWeight(element.style.fontWeight)}
                            onClick={() => onUpdateStyle({ fontWeight: isBoldWeight(element.style.fontWeight) ? "400" : "700" })}
                        />
                        <ToolbarButton
                            label={t("customize.italic")}
                            Icon={Italic}
                            active={element.style.fontStyle === "italic"}
                            onClick={() => onUpdateStyle({ fontStyle: element.style.fontStyle === "italic" ? "normal" : "italic" })}
                        />
                        <ToolbarButton
                            label={t("customize.alignment")}
                            Icon={AlignmentIcon}
                            onClick={() => onUpdateStyle({ textAlign: nextAlignment })}
                        />
                        <span aria-hidden="true" className="mx-1 h-5 w-px bg-white/15" />
                    </>
                )}
                <ToolbarButton label={t("customize.designDuplicate")} Icon={Copy} onClick={onDuplicate} />
                <ToolbarButton label={t("customize.designBringToFront")} Icon={BringToFront} onClick={() => onMoveLayer("front")} />
                <ToolbarButton label={t("customize.designSendToBack")} Icon={SendToBack} onClick={() => onMoveLayer("back")} />
                <ToolbarButton label={t("customize.designDelete")} Icon={Trash2} danger onClick={onDelete} />
            </div>
        </div>
    );
}

export function DesignOverlayElementView({
    element,
    accentColor,
    pageWidth,
    pageHeight,
    pageScale,
    isSelected,
    interactive,
    onSelect,
    onCommit,
    onUpdateStyle,
    onDuplicate,
    onMoveLayer,
    onDelete,
}: {
    element: DesignElement;
    accentColor: string;
    pageWidth: number;
    pageHeight: number;
    pageScale: number;
    isSelected: boolean;
    interactive: boolean;
    onSelect: () => void;
    onCommit: (id: string, updates: Partial<Pick<DesignElement, "x" | "y" | "width" | "height" | "text">>) => void;
    onUpdateStyle: (id: string, updates: Partial<DesignElement["style"]>) => void;
    onDuplicate: (id: string) => void;
    onMoveLayer: (id: string, direction: OverlayLayerDirection) => void;
    onDelete: (id: string) => void;
}) {
    const { t } = useTranslation();
    const editableRef = useRef<HTMLDivElement | null>(null);
    const draftRectRef = useRef<OverlayRect | null>(null);
    const moveableRef = useRef<Moveable | null>(null);
    const cancelEditRef = useRef(false);
    const [target, setTarget] = useState<HTMLDivElement | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isTransforming, setIsTransforming] = useState(false);
    const [draftText, setDraftText] = useState(element.text || "");
    const editing = isEditing && isSelected;
    const handleTargetRef = useCallback((node: HTMLDivElement | null) => setTarget(node), []);

    useEffect(() => {
        if (!editing || !editableRef.current) return;

        const editable = editableRef.current;
        editable.focus({ preventScroll: true });
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editable);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
    }, [editing]);

    useEffect(() => {
        if (!isSelected) return;
        moveableRef.current?.updateRect();
    }, [element.height, element.width, element.x, element.y, isSelected]);

    const selectTarget = useCallback(() => {
        if (interactive) onSelect();
    }, [interactive, onSelect]);

    const startTextEditing = useCallback(() => {
        if (!interactive || element.type !== "text") return;
        onSelect();
        setDraftText(element.text || "");
        setIsEditing(true);
    }, [element.text, element.type, interactive, onSelect]);

    const finishTextEditing = useCallback(() => {
        if (!editing) return;
        setIsEditing(false);
        if (cancelEditRef.current) {
            cancelEditRef.current = false;
            return;
        }
        if (draftText !== element.text) onCommit(element.id, { text: draftText });
    }, [draftText, editing, element.id, element.text, onCommit]);

    const cancelTextEditing = useCallback(() => {
        cancelEditRef.current = true;
        setDraftText(element.text || "");
        setIsEditing(false);
    }, [element.text]);

    const handleTextKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            cancelTextEditing();
            editableRef.current?.blur();
            return;
        }

        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            editableRef.current?.blur();
        }
    }, [cancelTextEditing]);

    const elementGuidelines = useMemo(() => {
        if (!target?.parentElement) return [];
        return Array.from(target.parentElement.querySelectorAll<HTMLElement>("[data-design-element]"))
            .filter((candidate) => candidate !== target);
    }, [target]);

    const borderColor = element.style.border.color || accentColor;
    const insetTop = element.style.marginTop ?? 0;
    const insetRight = element.style.marginRight ?? 0;
    const insetBottom = element.style.marginBottom ?? 0;
    const insetLeft = element.style.marginLeft ?? 0;
    const overlayFrameStyle: CSSProperties = {
        position: "absolute",
        inset: 0,
        top: insetTop,
        right: insetRight,
        bottom: insetBottom,
        left: insetLeft,
        boxSizing: "border-box",
        paddingTop: `${element.style.paddingTop ?? 0}px`,
        paddingRight: `${element.style.paddingRight ?? 0}px`,
        paddingBottom: `${element.style.paddingBottom ?? 0}px`,
        paddingLeft: `${element.style.paddingLeft ?? 0}px`,
        overflow: "hidden",
        opacity: (element.style.opacity ?? 100) / 100,
        color: element.style.color,
        ...buildBoxBorderStyles(element.style.border ?? DEFAULT_DESIGN_BORDER, borderColor),
        ...resolveOverlayFillStyles(element),
    };

    if (element.shape === "ellipse" && element.type !== "image" && element.type !== "text") {
        overlayFrameStyle.borderRadius = "9999px";
    }

    const minWidth = element.type === "text" ? 96 : 24;
    const minHeight = element.type === "text" ? 56 : 24;
    return (
        <>
            <div
                ref={handleTargetRef}
                data-design-element
                data-design-element-type={element.type}
                data-testid={`design-element-${element.id}`}
                className={interactive ? "pointer-events-auto cursor-move" : "pointer-events-none"}
                style={{
                    position: "absolute",
                    left: element.x,
                    top: element.y,
                    width: element.width,
                    height: element.height,
                    zIndex: element.zIndex,
                    boxSizing: "border-box",
                    touchAction: interactive ? "none" : undefined,
                }}
                onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
                    event.stopPropagation();
                    selectTarget();
                }}
                onDoubleClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    startTextEditing();
                }}
            >
                <div style={overlayFrameStyle}>
                    {element.type === "text" ? (
                        <div
                            ref={editableRef}
                            data-design-text-editor={editing || undefined}
                            contentEditable={editing}
                            suppressContentEditableWarning
                            spellCheck={editing}
                            role={editing ? "textbox" : undefined}
                            aria-label={editing ? t("customize.designOverlayText") : undefined}
                            className={`h-full w-full outline-none ${editing ? "cursor-text select-text" : "select-none"}`}
                            style={{
                                fontFamily: element.style.fontFamily || undefined,
                                fontSize: `${element.style.fontSize}pt`,
                                fontWeight: element.style.fontWeight,
                                fontStyle: element.style.fontStyle,
                                textDecoration: element.style.textDecoration === "none" ? undefined : element.style.textDecoration,
                                textTransform: editing && element.style.textTransform !== "none" ? element.style.textTransform : undefined,
                                lineHeight: element.style.lineHeight,
                                letterSpacing: `${element.style.letterSpacing}px`,
                                textAlign: element.style.textAlign,
                                whiteSpace: "pre-wrap",
                                overflowWrap: "anywhere",
                            }}
                            onPointerDown={(event) => {
                                if (editing) event.stopPropagation();
                            }}
                            onInput={(event) => setDraftText(event.currentTarget.textContent || "")}
                            onBlur={finishTextEditing}
                            onKeyDown={handleTextKeyDown}
                        >
                            {editing
                                ? draftText
                                : applyOverlayTextTransform(element.text || "", element.style.textTransform)}
                        </div>
                    ) : element.type === "image" ? (
                        element.imageSrc ? (
                            <img
                                src={element.imageSrc}
                                alt={t("customize.designImage")}
                                draggable={false}
                                className="h-full w-full select-none"
                                style={{ objectFit: element.style.objectFit }}
                            />
                        ) : (
                            <div className="flex h-full w-full select-none items-center justify-center text-[11px] uppercase tracking-[0.18em] text-faint">
                                {t("customize.designImage")}
                            </div>
                        )
                    ) : null}
                </div>
            </div>

            {isSelected && interactive && target && (
                <Moveable
                    ref={moveableRef}
                    className="enginecv-design-moveable"
                    target={target}
                    rootContainer={document.body}
                    draggable={!editing}
                    resizable={!editing}
                    renderDirections={["nw", "n", "ne", "e", "se", "s", "sw", "w"]}
                    origin={false}
                    edge={false}
                    snappable
                    snapContainer={target.parentElement}
                    elementGuidelines={elementGuidelines}
                    horizontalGuidelines={[pageHeight / 2]}
                    verticalGuidelines={[pageWidth / 2]}
                    snapThreshold={5}
                    isDisplaySnapDigit={false}
                    zoom={1 / Math.max(pageScale, 0.2)}
                    useResizeObserver
                    useAccuratePosition
                    preventDefault={!editing}
                    stopPropagation
                    onDragStart={(event) => {
                        event.set([0, 0]);
                        draftRectRef.current = { x: element.x, y: element.y, width: element.width, height: element.height };
                        setIsTransforming(true);
                    }}
                    onDrag={(event) => {
                        const nextX = clampOverlayValue(element.x + event.beforeTranslate[0], 0, Math.max(0, pageWidth - element.width));
                        const nextY = clampOverlayValue(element.y + event.beforeTranslate[1], 0, Math.max(0, pageHeight - element.height));
                        draftRectRef.current = { x: nextX, y: nextY, width: element.width, height: element.height };
                        event.target.style.transform = `translate(${nextX - element.x}px, ${nextY - element.y}px)`;
                    }}
                    onDragEnd={(event) => {
                        const nextRect = draftRectRef.current;
                        event.target.style.transform = "";
                        draftRectRef.current = null;
                        setIsTransforming(false);
                        if (nextRect) onCommit(element.id, nextRect);
                    }}
                    onResizeStart={(event) => {
                        event.set([element.width, element.height]);
                        event.setMin([minWidth, minHeight]);
                        event.setMax([pageWidth, pageHeight]);
                        if (event.dragStart) event.dragStart.set([0, 0]);
                        draftRectRef.current = { x: element.x, y: element.y, width: element.width, height: element.height };
                        setIsTransforming(true);
                    }}
                    onResize={(event) => {
                        const nextWidth = clampOverlayValue(event.width, minWidth, pageWidth);
                        const nextHeight = clampOverlayValue(event.height, minHeight, pageHeight);
                        const nextX = clampOverlayValue(element.x + event.drag.beforeTranslate[0], 0, Math.max(0, pageWidth - nextWidth));
                        const nextY = clampOverlayValue(element.y + event.drag.beforeTranslate[1], 0, Math.max(0, pageHeight - nextHeight));
                        draftRectRef.current = { x: nextX, y: nextY, width: nextWidth, height: nextHeight };
                        event.target.style.width = `${nextWidth}px`;
                        event.target.style.height = `${nextHeight}px`;
                        event.target.style.transform = `translate(${nextX - element.x}px, ${nextY - element.y}px)`;
                    }}
                    onResizeEnd={(event) => {
                        const nextRect = draftRectRef.current;
                        event.target.style.transform = "";
                        event.target.style.width = nextRect ? `${nextRect.width}px` : `${element.width}px`;
                        event.target.style.height = nextRect ? `${nextRect.height}px` : `${element.height}px`;
                        draftRectRef.current = null;
                        setIsTransforming(false);
                        if (nextRect) onCommit(element.id, nextRect);
                    }}
                />
            )}

            {isSelected && interactive && !isTransforming && (
                <DesignOverlayQuickToolbar
                    element={element}
                    pageWidth={pageWidth}
                    pageHeight={pageHeight}
                    pageScale={pageScale}
                    onEditText={startTextEditing}
                    onUpdateStyle={(updates) => onUpdateStyle(element.id, updates)}
                    onDuplicate={() => onDuplicate(element.id)}
                    onMoveLayer={(direction) => onMoveLayer(element.id, direction)}
                    onDelete={() => onDelete(element.id)}
                />
            )}

            {isSelected && interactive && (
                <style>{`
                    .enginecv-design-moveable {
                        z-index: 9999 !important;
                        pointer-events: auto !important;
                    }
                    .enginecv-design-moveable .moveable-line { background: #7c6cff !important; }
                    .enginecv-design-moveable .moveable-control {
                        width: 9px !important;
                        height: 9px !important;
                        margin-top: -4.5px !important;
                        margin-left: -4.5px !important;
                        border: 1.5px solid #7c6cff !important;
                        background: #ffffff !important;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.22);
                    }
                    .enginecv-design-moveable .moveable-guideline { background: #ff7e67 !important; }
                `}</style>
            )}
        </>
    );
}
