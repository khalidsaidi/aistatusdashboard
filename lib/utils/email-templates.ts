export type EmailTemplateId = 'confirmation' | 'status_change';

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function renderEmailTemplate(
  template: string,
  data: Record<string, any>
): { subject: string; html: string } | null {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const safeSiteUrl = escapeHtml(siteUrl);

  if (template === 'confirmation') {
    const link = typeof data.link === 'string' ? data.link : `${siteUrl}/`;
    const safeLink = escapeHtml(link);

    return {
      subject: 'Confirm your AI Status Dashboard subscription',
      html: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Confirm subscription</title>
  </head>
  <body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;color:#111;">
    <div style="max-width:640px;margin:0 auto;padding:24px;">
      <h2 style="margin:0 0 12px;">Confirm your subscription</h2>
      <p style="margin:0 0 16px;">
        Click the button below to confirm your email subscription.
      </p>
      <p style="margin:0 0 24px;">
        <a href="${safeLink}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 16px;border-radius:8px;">
          Confirm subscription
        </a>
      </p>
      <p style="margin:0 0 8px;color:#555;font-size:13px;">
        If the button doesn’t work, paste this URL into your browser:
      </p>
      <p style="margin:0 0 24px;font-size:13px;word-break:break-all;">
        <a href="${safeLink}">${safeLink}</a>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
      <p style="margin:0;color:#666;font-size:12px;">
        AI Status Dashboard • <a href="${safeSiteUrl}">${safeSiteUrl}</a>
      </p>
    </div>
  </body>
</html>`,
    };
  }

  if (template === 'status_change') {
    const providerName = typeof data.providerName === 'string' ? data.providerName : 'A provider';
    const previousStatus = typeof data.previousStatus === 'string' ? data.previousStatus : 'unknown';
    const currentStatus = typeof data.currentStatus === 'string' ? data.currentStatus : 'unknown';
    const statusPageUrl = typeof data.statusPageUrl === 'string' ? data.statusPageUrl : siteUrl;

    const safeProviderName = escapeHtml(providerName);
    const safePrev = escapeHtml(previousStatus);
    const safeCurr = escapeHtml(currentStatus);
    const safeStatusPageUrl = escapeHtml(statusPageUrl);

    const subject = `AI Status Alert: ${providerName} is ${currentStatus}`;

    const badgeColor =
      currentStatus === 'operational'
        ? '#16a34a'
        : currentStatus === 'degraded'
          ? '#ca8a04'
          : currentStatus === 'down'
            ? '#dc2626'
            : '#6b7280';

    return {
      subject,
      html: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;color:#111;">
    <div style="max-width:640px;margin:0 auto;padding:24px;">
      <h2 style="margin:0 0 12px;">Status change detected</h2>
      <p style="margin:0 0 16px;">
        <strong>${safeProviderName}</strong> changed from <strong>${safePrev}</strong> to
        <strong>${safeCurr}</strong>.
      </p>
      <div style="margin:0 0 20px;padding:14px 16px;border-radius:10px;background:#f8fafc;border:1px solid #e5e7eb;">
        <span style="display:inline-block;padding:6px 10px;border-radius:999px;background:${badgeColor};color:#fff;font-weight:600;font-size:12px;">
          ${safeCurr.toUpperCase()}
        </span>
      </div>
      <p style="margin:0 0 24px;">
        <a href="${safeStatusPageUrl}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 16px;border-radius:8px;">
          View provider status page
        </a>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
      <p style="margin:0;color:#666;font-size:12px;">
        AI Status Dashboard • <a href="${safeSiteUrl}">${safeSiteUrl}</a>
      </p>
    </div>
  </body>
</html>`,
    };
  }

  return null;
}

