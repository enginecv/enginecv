"use client";

import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    pointerWithin,
    useDroppable,
    useSensor,
    useSensors,
    type Announcements,
    type CollisionDetection,
    type DragEndEvent,
    type DragOverEvent,
    type DragStartEvent,
    type Modifier,
    type UniqueIdentifier,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { useTranslation } from "@/lib/i18n";

// A short travel before a drag starts keeps clicks on handles (and on rows
// that are also buttons) working as clicks.
const POINTER_ACTIVATION = { distance: 5 };
const VERTICAL: Modifier[] = [restrictToVerticalAxis];

export interface SortableHandleProps extends HTMLAttributes<HTMLElement> {
    ref: (element: HTMLElement | null) => void;
}

export interface SortableItemState {
    /** Spread on the element that should move. */
    itemProps: { ref: (element: HTMLElement | null) => void; style: CSSProperties };
    /** Spread on the grip button: pointer, touch and keyboard (Space/Enter, arrows) dragging. */
    handleProps: SortableHandleProps;
    isDragging: boolean;
}

/** Sensors and screen-reader text shared by every sortable list in the app. */
export function useSortableSetup(describe?: (id: UniqueIdentifier) => string) {
    const { t } = useTranslation();
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: POINTER_ACTIVATION }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const accessibility = useMemo(() => {
        const name = (id: UniqueIdentifier) => describe?.(id) || t("sortable.item");
        const announcements: Announcements = {
            onDragStart: ({ active }) => t("sortable.pickedUp", { item: name(active.id) }),
            onDragOver: ({ active, over }) =>
                over ? t("sortable.over", { item: name(active.id), target: name(over.id) }) : t("sortable.notOver", { item: name(active.id) }),
            onDragEnd: ({ active, over }) =>
                over ? t("sortable.dropped", { item: name(active.id), target: name(over.id) }) : t("sortable.cancelled", { item: name(active.id) }),
            onDragCancel: ({ active }) => t("sortable.cancelled", { item: name(active.id) }),
        };
        return { announcements, screenReaderInstructions: { draggable: t("sortable.instructions") } };
    }, [describe, t]);

    return { sensors, accessibility };
}

interface SortableListProps<T> {
    items: readonly T[];
    getId: (item: T, index: number) => string;
    onReorder: (from: number, to: number) => void;
    /** Item name for screen-reader announcements. */
    describe?: (item: T) => string;
    disabled?: boolean;
    children: (item: T, index: number, state: SortableItemState) => ReactNode;
}

/** A vertical list reordered by dragging each item's handle (or by keyboard). */
export function SortableList<T>({ items, getId, onReorder, describe, disabled, children }: SortableListProps<T>) {
    const ids = useMemo(() => items.map((item, index) => getId(item, index)), [items, getId]);
    const { sensors, accessibility } = useSortableSetup(
        describe ? (id) => {
            const index = ids.indexOf(String(id));
            return index >= 0 ? describe(items[index]) : "";
        } : undefined,
    );

    const handleDragEnd = ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) return;
        const from = ids.indexOf(String(active.id));
        const to = ids.indexOf(String(over.id));
        if (from >= 0 && to >= 0) onReorder(from, to);
    };

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={VERTICAL} accessibility={accessibility} onDragEnd={handleDragEnd}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy} disabled={disabled}>
                {items.map((item, index) => (
                    <SortableRow key={ids[index]} id={ids[index]}>
                        {(state) => children(item, index, state)}
                    </SortableRow>
                ))}
            </SortableContext>
        </DndContext>
    );
}

interface SortableRowProps {
    id: string;
    /** Extra data read back in a multi-list DndContext (for example the owning group). */
    data?: Record<string, unknown>;
    children: (state: SortableItemState) => ReactNode;
}

export function SortableRow({ id, data, children }: SortableRowProps) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, data });
    const style: CSSProperties = {
        transform: CSS.Translate.toString(transform),
        transition,
        position: "relative",
        zIndex: isDragging ? 20 : undefined,
        opacity: isDragging ? 0.85 : undefined,
    };

    return children({
        itemProps: { ref: setNodeRef, style },
        handleProps: {
            ref: setActivatorNodeRef,
            ...attributes,
            ...listeners,
            // Touch screens scroll the page unless the grip opts out.
            style: { touchAction: "none" },
        },
        isDragging,
    });
}

interface DropZoneProps {
    id: string;
    children: (ref: (element: HTMLElement | null) => void, isOver: boolean) => ReactNode;
}

/** A drop target that is not itself sortable, such as a group that may be empty. */
export function DropZone({ id, children }: DropZoneProps) {
    const { setNodeRef, isOver } = useDroppable({ id });
    return children(setNodeRef, isOver);
}

export { closestCenter, DndContext, pointerWithin, SortableContext, verticalListSortingStrategy, VERTICAL as verticalOnly };
export { arrayMove } from "@dnd-kit/sortable";
export type { CollisionDetection, DragEndEvent, DragOverEvent, DragStartEvent, UniqueIdentifier };
