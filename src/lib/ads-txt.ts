/** No placeholder publisher record: an unconfigured deployment stays a 404. */
export function adsTxtContent(client: string): string | null {
    const match = /^ca-(pub-\d{16})$/.exec(client.trim());
    return match ? `google.com, ${match[1]}, DIRECT, f08c47fec0942fa0\n` : null;
}
