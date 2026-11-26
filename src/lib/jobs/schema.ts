import { z } from "zod";

/**
 * Job tracker records (see the Job Tracker design). One `JobApplication` is one role at one company in one
 * hiring process; its small child lists live inside it so a single row (and later a single file) is the
 * transactional boundary. Frozen submission evidence lives in its own table, referenced by id and hash.
 *
 * Every schema is built twice from one definition: `internal` keeps timestamps as epoch milliseconds (the
 * database), `portable` reads and writes them as ISO 8601 UTC strings (backups and folder files). Records
 * are whole: a missing required list is invalid, never an instruction to empty it.
 */

export const APPLICATION_STAGES = ["saved", "preparing", "applied", "interviewing", "offer", "accepted", "rejected", "withdrawn"] as const;
export type ApplicationStage = (typeof APPLICATION_STAGES)[number];
export const ACTIVE_STAGES = ["saved", "preparing", "applied", "interviewing", "offer"] as const satisfies readonly ApplicationStage[];
export const TERMINAL_STAGES = ["accepted", "rejected", "withdrawn"] as const satisfies readonly ApplicationStage[];

export function isTerminalStage(stage: ApplicationStage): boolean {
    return (TERMINAL_STAGES as readonly ApplicationStage[]).includes(stage);
}

export const WORK_MODES = ["onsite", "hybrid", "remote", "unspecified"] as const;
export const PAY_PERIODS = ["hour", "month", "year"] as const;
export const SUBMISSION_CHANNELS = ["website", "email", "referral", "other", "unknown"] as const;
export const INTERVIEW_OUTCOMES = ["scheduled", "completed", "cancelled"] as const;
export const EVENT_SOURCES = ["user", "import", "workspace"] as const;

export const SUBMISSION_PACKET_FORMAT = "enginecv.submission/v1";

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A calendar date with no time or zone (`YYYY-MM-DD`); it never shifts when the viewer's zone changes. */
export const dateOnlySchema = z.string().refine((value) => {
    const match = DATE_ONLY.exec(value);
    if (!match) return false;
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}, "Expected a calendar date as YYYY-MM-DD");

export function isValidTimeZone(zone: string): boolean {
    try {
        new Intl.DateTimeFormat("en", { timeZone: zone });
        return true;
    } catch {
        return false;
    }
}

/** Only http(s) links are kept: anything else (javascript:, data:, file:) could run or read on click. */
export function isSafeWebUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

const webUrlSchema = z.string().trim().max(2048).refine(isSafeWebUrl, "Only http and https links are allowed");
const idSchema = z.string().min(1).max(128);
const optionalText = (max: number) => z.string().max(max).nullable();
const requiredText = (max: number) => z.string().trim().min(1).max(max);
const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/, "Expected a lowercase hex SHA-256");

const epochMs = z.number().int().nonnegative();
const isoTimestamp = z.codec(z.iso.datetime(), epochMs, {
    decode: (iso) => Date.parse(iso),
    encode: (ms) => new Date(ms).toISOString(),
});

// One parameter, not a generic: zod cannot infer the refinements' input through an unresolved type parameter.
function buildSchemas(timestamp: typeof epochMs | typeof isoTimestamp) {
    const contact = z.object({
        id: idSchema,
        name: requiredText(200),
        role: optionalText(200),
        email: optionalText(320),
        phone: optionalText(64),
        notes: optionalText(5000),
    });

    const task = z
        .object({
            id: idSchema,
            title: requiredText(500),
            dueOn: dateOnlySchema.nullable(),
            completedAt: timestamp.nullable(),
            cancelledAt: timestamp.nullable(),
            createdAt: timestamp,
        })
        .refine((value) => value.completedAt === null || value.cancelledAt === null, {
            message: "A task cannot be both completed and cancelled",
            path: ["cancelledAt"],
        });

    const interview = z
        .object({
            id: idSchema,
            label: requiredText(200),
            startsAt: timestamp.nullable(),
            endsAt: timestamp.nullable(),
            timeZone: z.string().refine(isValidTimeZone, "Unknown IANA time zone"),
            location: optionalText(500),
            link: webUrlSchema.nullable(),
            contactIds: z.array(idSchema),
            notes: z.string().max(20000),
            outcome: z.enum(INTERVIEW_OUTCOMES),
            createdAt: timestamp,
            updatedAt: timestamp,
        })
        .refine((value) => value.endsAt === null || (value.startsAt !== null && value.endsAt > value.startsAt), {
            message: "An interview must end after it starts",
            path: ["endsAt"],
        });

    /** What was sent in one slot: nothing, not recorded, or a frozen copy inside the submission's packet. */
    const documentSelection = z.discriminatedUnion("status", [
        z.object({ status: z.literal("none") }),
        z.object({ status: z.literal("unknown") }),
        z.object({
            status: z.literal("captured"),
            /** The live document it was captured from; null for evidence that came from elsewhere. */
            sourceId: idSchema.nullable(),
            capturedTitle: z.string().max(500),
            sourceUpdatedAt: timestamp.nullable(),
            snapshotId: idSchema,
        }),
    ]);

    const submission = z
        .object({
            id: idSchema,
            /** The date the person says it was sent. A date-only entry never becomes an invented midnight. */
            sentOn: dateOnlySchema,
            sentAt: timestamp.nullable(),
            channel: z.enum(SUBMISSION_CHANNELS),
            reference: optionalText(500),
            cv: documentSelection,
            letter: documentSelection,
            packetId: idSchema.nullable(),
            packetSha256: sha256Schema.nullable(),
            recordedAt: timestamp,
        })
        .refine((value) => (value.packetId === null) === (value.packetSha256 === null), {
            message: "A packet reference needs both its id and its hash",
            path: ["packetSha256"],
        })
        .refine((value) => value.packetId !== null || (value.cv.status !== "captured" && value.letter.status !== "captured"), {
            message: "A captured document needs a submission packet",
            path: ["packetId"],
        });

    const eventBase = {
        id: idSchema,
        recordedAt: timestamp,
        /** When the person says it happened, if that differs from when it was recorded. */
        occurredOn: dateOnlySchema.nullable(),
        occurredAt: timestamp.nullable(),
        source: z.enum(EVENT_SOURCES),
    };
    const stage = z.enum(APPLICATION_STAGES);
    const event = z.discriminatedUnion("type", [
        z.object({ ...eventBase, type: z.literal("created"), duplicatedFrom: idSchema.nullable() }),
        z.object({ ...eventBase, type: z.literal("stage-changed"), from: stage, to: stage }),
        z.object({ ...eventBase, type: z.literal("submission-recorded"), submissionId: idSchema }),
        z.object({ ...eventBase, type: z.literal("task-completed"), taskId: idSchema }),
        z.object({ ...eventBase, type: z.literal("task-cancelled"), taskId: idSchema }),
        z.object({ ...eventBase, type: z.literal("interview-changed"), interviewId: idSchema, outcome: z.enum(INTERVIEW_OUTCOMES) }),
        z.object({ ...eventBase, type: z.literal("note"), text: requiredText(20000) }),
        z.object({ ...eventBase, type: z.literal("archived") }),
        z.object({ ...eventBase, type: z.literal("unarchived") }),
        z.object({ ...eventBase, type: z.literal("trashed") }),
        z.object({ ...eventBase, type: z.literal("restored") }),
        z.object({ ...eventBase, type: z.literal("correction"), submissionId: idSchema, fields: z.array(z.string().min(1)).min(1) }),
    ]);

    const compensation = z
        .object({
            min: z.number().nonnegative().nullable(),
            max: z.number().nonnegative().nullable(),
            currency: z.string().regex(/^[A-Z]{3}$/, "Expected an ISO 4217 currency code"),
            period: z.enum(PAY_PERIODS),
        })
        .refine((value) => value.min !== null || value.max !== null, { message: "Give a minimum or a maximum", path: ["min"] })
        .refine((value) => value.min === null || value.max === null || value.min <= value.max, {
            message: "The minimum cannot be above the maximum",
            path: ["max"],
        });

    const application = z
        .object({
            id: idSchema,
            company: requiredText(200),
            role: requiredText(200),
            jobUrl: webUrlSchema.nullable(),
            source: optionalText(200),
            location: optionalText(200),
            workMode: z.enum(WORK_MODES),
            employmentType: optionalText(100),
            compensation: compensation.nullable(),
            descriptionMarkdown: z.string().max(100_000),
            notesMarkdown: z.string().max(100_000),
            tags: z.array(requiredText(60)).max(50),
            stage,
            workingCvId: idSchema.nullable(),
            workingLetterId: idSchema.nullable(),
            deadline: dateOnlySchema.nullable(),
            contacts: z.array(contact),
            tasks: z.array(task),
            interviews: z.array(interview),
            submissions: z.array(submission),
            events: z.array(event),
            archivedAt: timestamp.nullable(),
            trashedAt: timestamp.nullable(),
            createdAt: timestamp,
            updatedAt: timestamp,
            revision: z.number().int().positive(),
        })
        .superRefine((value, ctx) => {
            const unique = (ids: string[], path: string) => {
                if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: `Duplicate ids in ${path}`, path: [path] });
            };
            unique(value.contacts.map((item) => item.id), "contacts");
            unique(value.tasks.map((item) => item.id), "tasks");
            unique(value.interviews.map((item) => item.id), "interviews");
            unique(value.submissions.map((item) => item.id), "submissions");
            unique(value.events.map((item) => item.id), "events");
            const packets = value.submissions.flatMap((item) => (item.packetId ? [item.packetId] : []));
            unique(packets, "submissions");
            const contactIds = new Set(value.contacts.map((item) => item.id));
            value.interviews.forEach((interview, index) => {
                if (interview.contactIds.some((id) => !contactIds.has(id))) {
                    ctx.addIssue({ code: "custom", message: "Interview names a contact that does not exist", path: ["interviews", index, "contactIds"] });
                }
            });
        });

    return { contact, task, interview, documentSelection, submission, event, compensation, application };
}

const internal = buildSchemas(epochMs);
const portable = buildSchemas(isoTimestamp);

export const contactSchema = internal.contact;
export const taskSchema = internal.task;
export const interviewSchema = internal.interview;
export const documentSelectionSchema = internal.documentSelection;
export const submissionSchema = internal.submission;
export const applicationEventSchema = internal.event;
export const compensationSchema = internal.compensation;
export const jobApplicationSchema = internal.application;

/** The same application, with ISO 8601 UTC timestamps. `z.decode` reads a file; `z.encode` writes one. */
export const portableJobApplicationSchema = portable.application;

export type ApplicationContact = z.infer<typeof contactSchema>;
export type ApplicationTask = z.infer<typeof taskSchema>;
export type ApplicationInterview = z.infer<typeof interviewSchema>;
export type DocumentSelection = z.infer<typeof documentSelectionSchema>;
export type ApplicationSubmission = z.infer<typeof submissionSchema>;
export type ApplicationEvent = z.infer<typeof applicationEventSchema>;
export type ApplicationEventType = ApplicationEvent["type"];
export type Compensation = z.infer<typeof compensationSchema>;
export type JobApplication = z.infer<typeof jobApplicationSchema>;

/**
 * One stored submission packet. `text` is the exact UTF-8 JSON that was hashed; it is kept verbatim so a
 * later serializer can never change what the hash claims. The other fields are copied out of it for indexing.
 */
export interface SubmissionPacketRecord {
    id: string;
    applicationId: string;
    submissionId: string;
    capturedAt: number;
    sha256: string;
    text: string;
}

/**
 * The envelope inside a packet's text. The document payloads are owned by the capture code (and checked
 * against the CV and letter schemas there); here they only have to be objects.
 */
export const submissionPacketEnvelopeSchema = z.object({
    format: z.literal(SUBMISSION_PACKET_FORMAT),
    id: idSchema,
    applicationId: idSchema,
    submissionId: idSchema,
    capturedAt: z.iso.datetime(),
    renderer: z.object({ appVersion: z.string().min(1) }).catchall(z.unknown()),
    cv: z.record(z.string(), z.unknown()).nullable(),
    letter: z.record(z.string(), z.unknown()).nullable(),
});
export type SubmissionPacketEnvelope = z.infer<typeof submissionPacketEnvelopeSchema>;

/** A restore point taken before an outside change (a folder edit or a backup restore) replaces an application. */
export interface JobApplicationHistoryEntry {
    id?: number;
    applicationId: string;
    createdAt: number;
    trigger: "file-sync" | "restore";
    application: JobApplication;
}
