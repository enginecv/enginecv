import { letterDocumentSchema, type LetterDocument } from "./schema";

/**
 * What happens to a CV's letters when the CV is deleted. No letter is ever deleted as
 * a side effect: sent and frozen letters keep their frozen copy and simply lose the
 * link; each draft needs a choice, to follow another CV or to become a frozen snapshot
 * of what it last showed.
 */
export type DeletionDecision =
    | { letterId: string; action: "link"; cvId: string }
    | { letterId: string; action: "snapshot" };

export interface DeletionPlan {
    /** Already frozen (sent or snapshot): kept as they are, only unlinked. */
    frozen: LetterDocument[];
    /** Live drafts: each one needs a decision. */
    drafts: LetterDocument[];
}

export class MissingDecisionError extends Error {
    constructor(readonly letterId: string) {
        super(`No decision for letter ${letterId}`);
        this.name = "MissingDecisionError";
    }
}

/** Splits the letters linked to `cvId` into those that need a choice and those that do not. */
export function planCvDeletion(letters: readonly LetterDocument[], cvId: string): DeletionPlan {
    const linked = letters.filter((letter) => letter.cvId === cvId);
    return {
        frozen: linked.filter((letter) => letter.status !== "draft"),
        drafts: linked.filter((letter) => letter.status === "draft"),
    };
}

/**
 * A draft as a frozen snapshot, built from what it last showed (its cache), without its
 * CV. Not "sent": the person never said they sent it.
 */
export function snapshotLetter(letter: LetterDocument, now: number): LetterDocument {
    const cached = letter.lastResolved;
    return letterDocumentSchema.parse({
        ...letter,
        status: "snapshot",
        cvId: null,
        lastResolved: null,
        frozen: {
            at: now,
            sender: cached?.sender ?? {},
            design: cached?.design ?? {},
            tokens: cached?.tokens ?? {},
            photo: letter.showPhoto ? (cached?.photo ?? "") : "",
            cvTitle: cached?.cvTitle ?? "",
        },
        updatedAt: Math.max(now, letter.updatedAt + 1),
    });
}

/**
 * The rows to write so that no letter points at the deleted CV. Throws when a draft has no
 * decision, so a half-resolved deletion can never go ahead.
 */
export function applyDeletionDecisions(plan: DeletionPlan, decisions: readonly DeletionDecision[], now: number): LetterDocument[] {
    const byLetter = new Map(decisions.map((decision) => [decision.letterId, decision]));
    const updated: LetterDocument[] = plan.frozen.map((letter) => letterDocumentSchema.parse({ ...letter, cvId: null, updatedAt: Math.max(now, letter.updatedAt + 1) }));
    for (const draft of plan.drafts) {
        const decision = byLetter.get(draft.id);
        if (!decision) throw new MissingDecisionError(draft.id);
        updated.push(
            decision.action === "snapshot"
                ? snapshotLetter(draft, now)
                : letterDocumentSchema.parse({ ...draft, cvId: decision.cvId, updatedAt: Math.max(now, draft.updatedAt + 1) }),
        );
    }
    return updated;
}
