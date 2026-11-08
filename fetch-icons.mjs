import fs from 'fs';
import https from 'https';
import path from 'path';

const ICONS = [
    { name: 'Anthropic', url: 'https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/anthropic.svg' },
    { name: 'OpenAI', url: 'https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/openai.svg' },
    { name: 'Ollama', url: 'https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/ollama.svg' },
    { name: 'Gemini', url: 'https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/googlegemini.svg' },
    { name: 'Groq', url: 'https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/groq.svg' }
];

async function fetchIcon(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            if (res.statusCode !== 200) {
                resolve(null);
                return;
            }
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function main() {
    let fileContent = 'import React from "react";\n\n';

    for (const icon of ICONS) {
        const svgData = await fetchIcon(icon.url);
        if (svgData) {
            const match = svgData.match(/d="([^"]+)"/);
            if (match) {
                fileContent += `export const ${icon.name}Logo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="${match[1]}" />
  </svg>
);\n\n`;
            }
        }
    }

    // OpenRouter (a generic mesh icon or specific svg if we had it, but simple router icon is fine)
    fileContent += `export const OpenRouterLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M4 14a8 8 0 0 1 16 0" />
    <path d="M8 18a4 4 0 0 1 8 0" />
    <path d="M12 22v-4" />
    <path d="M12 10v4" />
    <path d="M4 14h16" />
  </svg>
);\n\n`;

    fs.writeFileSync('./src/components/ui/icons.tsx', fileContent);
    console.log('Icons generated successfully.');
}

main();
