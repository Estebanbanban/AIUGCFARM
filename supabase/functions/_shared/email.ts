const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM = "Cinerads <noreply@cinerads.com>";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface ResendResponse {
  id: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<ResendResponse> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      ...(opts.text ? { text: opts.text } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend API error ${res.status}: ${err}`);
  }

  return res.json() as Promise<ResendResponse>;
}
