import { providerService } from '@/lib/services/providers';

export const dynamic = 'force-dynamic';

export async function GET() {
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
}
