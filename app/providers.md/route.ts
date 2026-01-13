import { providerService } from '@/lib/services/providers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const providers = providerService.getProviders();
    const body = `# Providers

${providers.map((p) => `- ${p.displayName || p.name}: https://aistatusdashboard.com/provider/${p.id}`).join('\n')}
`;
    return new Response(body, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=600',
      },
    });
  } catch {
    const body = `# Providers

- OpenAI: https://aistatusdashboard.com/provider/openai
- Anthropic: https://aistatusdashboard.com/provider/anthropic
- Google Gemini: https://aistatusdashboard.com/provider/google-ai
`;
    return new Response(body, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=120',
        'X-Providers-Status': 'fallback',
      },
    });
  }
}
