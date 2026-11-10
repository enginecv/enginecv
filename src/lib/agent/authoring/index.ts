/**
 * `enginecv.authoring/v1`: the content-only CV format AIs read and write.
 * Everything else in the app goes through these exports, never the files
 * behind them.
 */
export { AUTHORING_FORMAT, AUTHORING_SCHEMA_URL, authoringV1Schema, type AuthoringDocument } from "./schema";
export { NOTICE_CODES, formatPath, type Notice, type NoticeCode, type NoticeKind } from "./notices";
export { authoringToResume, type ImportResult, type SectionCounts } from "./to-resume";
export { resumeToAuthoring, serializeAuthoring, type ResumeToAuthoringOptions } from "./from-resume";
export { parseAuthoringText, MAX_AUTHORING_TEXT_BYTES, type ParseResult, type ParseErrorCode } from "./parse-text";
export { isAuthoringDocument, isFullEngineCvExport, isJsonResumeDocument } from "./detect";
export { buildAuthoringJsonSchema } from "./json-schema";
export { buildAiInstructions, type Translate } from "./instructions";
export type { DesignApplied } from "./design-hints";
