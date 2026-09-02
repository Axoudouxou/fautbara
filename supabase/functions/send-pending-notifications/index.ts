// Traite la file d'attente d'emails pour les notifications in-app (voir la
// migration qui capture recipient_email/email_status à la création de
// CHAQUE notification, quel que soit l'endroit de l'app qui l'a créée).
// Appelée chaque minute par pg_cron via pg_net — jamais depuis le client,
// d'où --no-verify-jwt au déploiement et aucune vérification d'auth ici :
// un appel prématuré ou répété ne fait que traiter la file plus vite.
import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 25;

interface PendingNotification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  recipient_email: string;
  dispatch_attempts: number;
}

function renderHtml(n: PendingNotification, appUrl: string): string {
  const cta = n.link
    ? `<p style="margin-top:24px"><a href="${appUrl}${n.link}" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Voir sur BARA</a></p>`
    : "";
  return `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <p style="font-size:12px;font-weight:700;letter-spacing:.04em;color:#f97316;text-transform:uppercase">BARA</p>
      <h1 style="font-size:20px;color:#0f172a;margin:8px 0 16px">${n.title}</h1>
      ${n.body ? `<p style="font-size:14px;line-height:1.6;color:#475569">${n.body}</p>` : ""}
      ${cta}
    </div>
  `;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Méthode non autorisée", { status: 405 });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.error("send-pending-notifications: RESEND_API_KEY manquant");
    return new Response("Configuration serveur manquante", { status: 500 });
  }
  const fromAddress = Deno.env.get("RESEND_FROM_EMAIL") || "BARA <onboarding@resend.dev>";
  const appUrl = (Deno.env.get("PUBLIC_APP_URL") || "").replace(/\/$/, "");

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: pending, error: fetchError } = await serviceClient
    .from("notifications")
    .select("id, kind, title, body, link, recipient_email, dispatch_attempts")
    .eq("email_status", "pending")
    .lt("dispatch_attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchError) {
    console.error("send-pending-notifications: lecture impossible", fetchError);
    return new Response("Erreur serveur", { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const n of (pending ?? []) as PendingNotification[]) {
    if (!n.recipient_email) {
      // Ne devrait pas arriver (le déclencheur met email_status='skipped'
      // quand il n'y a pas d'email), mais on ne laisse jamais une ligne
      // pending sans destinataire tourner en boucle.
      await serviceClient
        .from("notifications")
        .update({ email_status: "skipped" })
        .eq("id", n.id);
      continue;
    }

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: n.recipient_email,
          subject: n.title,
          html: renderHtml(n, appUrl),
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Resend ${res.status}: ${errorText.slice(0, 300)}`);
      }

      await serviceClient
        .from("notifications")
        .update({ email_status: "sent", email_sent_at: new Date().toISOString(), email_error: null })
        .eq("id", n.id);
      sent++;
    } catch (err) {
      const attempts = n.dispatch_attempts + 1;
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      await serviceClient
        .from("notifications")
        .update({
          dispatch_attempts: attempts,
          email_status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
          email_error: message.slice(0, 500),
        })
        .eq("id", n.id);
      failed++;
      console.error(`send-pending-notifications: échec pour ${n.id}`, message);
    }
  }

  return new Response(JSON.stringify({ processed: pending?.length ?? 0, sent, failed }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
