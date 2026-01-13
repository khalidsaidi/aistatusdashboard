import { promises as fs } from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const filePath = path.join(process.cwd(), 'docs', 'discoverability-audit.md');
  try {
    const body = await fs.readFile(filePath, 'utf8');
    return new Response(body, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=600',
      },
    });
  } catch {
    const fallback = `# Discoverability Audit\n\nThe markdown mirror is unavailable right now. Visit https://aistatusdashboard.com/docs/discoverability-audit for the live audit checklist.\n`;
    return new Response(fallback, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=120',
        'X-Audit-Status': 'fallback',
      },
    });
  }
}
