import type { ToolProse } from "./types";

export const prose: ToolProse = {
    slug: "github-to-cv",
    overview: [
        "Developers often have more evidence on GitHub than on any CV. This tool turns the public part of your GitHub account into a first draft of a developer CV: your profile details, the repositories you choose as projects, and the languages you use.",
        "It does not judge your code or rank your repositories. You decide which ones belong on the CV, and the tool fills in names, descriptions, topics and dates from GitHub. The result opens in the normal editor, where you add work experience and education, which GitHub cannot know.",
        "What comes across: your display name, bio as the summary, location, website and GitHub link, your profile picture as the photo, the repositories you tick as projects with description, topics, languages and last activity, a note for repositories with ten or more stars, the programming languages across them as a skills group, and the organisations you pick.",
    ],
    formatsHeading: "What it reads",
    formats: [
        {
            name: "GitHub username",
            detail: "The username of a public profile. An email address or a repository link will not work here.",
        },
        {
            name: "Public profile and repositories",
            detail: "Your public profile, your 200 most recently pushed public repositories, your public organisations, and the language breakdown of up to ten of the repositories you select. One import makes at most 14 requests to GitHub.",
        },
    ],
    privacy: [
        "There is no EngineCV server in the path. Your browser talks directly to GitHub's public API, and nothing about your account is sent to us.",
        "This tool needs the network, unlike the other three. As you type a username, from three characters and after a short pause, your browser asks GitHub for matching public profiles to show a preview and suggestions. That means the characters you type reach GitHub as you type them.",
        "All traffic is between your browser and GitHub: the characters you type, the requests for your public data, and your profile picture, which is downloaded so it can be stored with the CV. EngineCV never asks you to sign in to GitHub and cannot see private repositories.",
    ],
    limits: [
        "Public data only. Private repositories, private organisation memberships and contribution graphs are not available.",
        "GitHub limits unauthenticated requests per hour for each network. One import uses few, but a shared network such as an office or a university may already have used the allowance. If so, the tool shows when it resets.",
        "Only the 200 most recently pushed repositories are considered, and language data comes from at most ten of the ones you select.",
        "Repository descriptions are whatever you wrote on GitHub, often a single line. Rewrite them for a CV reader: what it does, what you built and what it shows about your work.",
        "Forks and archived repositories are unticked by default, because they rarely show your own work.",
        "Pick fewer than you think. Three to six repositories that you can discuss in detail usually serve a CV better than a long list, because every project you include invites a question.",
        "A list of repositories is not a work history. Add your employment and education in the editor, and keep only the projects you can talk about.",
    ],
};
