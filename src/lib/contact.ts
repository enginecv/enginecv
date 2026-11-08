import { FEEDBACK_MAILTO, FEEDBACK_REPO } from "@/lib/feedback/constants";

export const CONTACT_EMAILS = {
    hello: "hello@enginecv.app",
    support: FEEDBACK_MAILTO,
    founder: "safet@enginecv.app",
    jobs: "jobs@enginecv.app",
} as const;

export const FEEDBACK_REPO_URL = `https://github.com/${FEEDBACK_REPO}`;
export const FEEDBACK_ISSUES_URL = `${FEEDBACK_REPO_URL}/issues`;
