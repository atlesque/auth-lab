// Every email the app sends: verification, password reset, magic link and team invitation.
export interface Mail {
  kind: 'verify-email' | 'reset-password' | 'magic-link' | 'invitation';
  to: string;
  subject: string;
  heading: string;
  body: string;
  action: { label: string; url: string };
}

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

export function renderText(mail: Mail): string {
  return `${mail.heading}\n\n${mail.body}\n\n${mail.action.label}: ${mail.action.url}\n\nAuth Lab, a better-auth proof of concept.`;
}

export function renderHtml(mail: Mail): string {
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px;background:#fff6e3;font-family:ui-rounded,'SF Pro Rounded',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2a1f4e">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:2px solid #241a47;border-radius:24px;padding:28px;box-shadow:0 6px 0 #241a47">
    <p style="margin:0 0 20px;font-size:20px;font-weight:800"><span style="color:#ff4f9a">A</span><span style="color:#ff8a3d">u</span><span style="color:#f2b600">t</span><span style="color:#22b573">h</span> <span style="color:#2f9bff">L</span><span style="color:#8b5cf6">a</span><span style="color:#ff4f9a">b</span></p>
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#241a47">${escape(mail.heading)}</h1>
    <p style="margin:0 0 22px;font-size:16px;line-height:1.55;color:#463b6e">${escape(mail.body)}</p>
    <p style="margin:0 0 22px"><a href="${escape(mail.action.url)}" style="display:inline-block;background:#6a35ff;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:12px 22px;border-radius:999px;border:2px solid #241a47;box-shadow:0 3px 0 #241a47">${escape(mail.action.label)}</a></p>
    <p style="margin:0;font-size:12px;line-height:1.5;color:#7d70a8;word-break:break-all">Or open this link: ${escape(mail.action.url)}</p>
  </div>
</body>
</html>`;
}
