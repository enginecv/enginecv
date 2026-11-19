"use client";

import { use } from "react";
import { LetterEditor } from "@/components/letters/LetterEditor";

export default function LetterEditorPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    return <LetterEditor letterId={id} />;
}
