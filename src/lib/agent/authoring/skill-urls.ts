/** Where the generated skill is served. A small module so the UI does not import the generator. */
export const SKILL_PUBLIC_DIR = "agent/enginecv";
export const SKILL_URL = "https://enginecv.app/agent/enginecv/SKILL.md";
export const LLMS_TXT_URL = "https://enginecv.app/agent/enginecv/llms.txt";
/** The folder-based flow: the same files EngineCV writes into a workspace folder, served for agents that are told about it before the folder exists. */
export const FOLDER_PUBLIC_DIR = `${SKILL_PUBLIC_DIR}/folder`;
export const FOLDER_AGENTS_URL = "https://enginecv.app/agent/enginecv/folder/AGENTS.md";
export const FOLDER_REFERENCE_URL = "https://enginecv.app/agent/enginecv/folder/reference";
