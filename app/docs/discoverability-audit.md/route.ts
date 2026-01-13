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
    return new Response('Not found', { status: 404 });
  }
}
