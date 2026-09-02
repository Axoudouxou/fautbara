import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

type JekoTransaction = {
  id?: string;
  status?: string;
  paymentMethod?: string;
  transactionType?: string;
  transactionDetails?: { id?: string; reference?: string };
};

export const Route = createFileRoute("/api/public/webhooks/jeko")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["JEKO_WEBHOOK_SECRET"];
        if (!secret) return new Response("Webhook not configured", { status: 503 });

        const body = await request.text();
        const received = (request.headers.get("Jeko-Signature") ?? "").trim().toLowerCase();
        const expected = createHmac("sha256", secret).update(body).digest("hex");
        const a = Buffer.from(received);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: JekoTransaction;
        try {
          payload = JSON.parse(body) as JekoTransaction;
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        if (payload.transactionType && payload.transactionType !== "PaymentRequest") {
          return new Response("ignored", { status: 200 });
        }

        const { findPaymentByProviderRefs, markJekoPaymentPaid } = await import(
          "@/lib/payments.server"
        );
        const payment = await findPaymentByProviderRefs({
          reference: payload.transactionDetails?.reference ?? null,
          requestId: payload.transactionDetails?.id ?? null,
        });
        if (!payment) return new Response("ignored", { status: 200 });

        if (payload.status === "success") {
          await markJekoPaymentPaid({
            paymentId: payment.id,
            providerStatus: payload.status,
            ...(payload.paymentMethod ? { method: payload.paymentMethod } : {}),
          });
        } else {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin
            .from("payments")
            .update({
              provider_status: payload.status ?? "error",
              provider_notified_at: new Date().toISOString(),
            })
            .eq("id", payment.id);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
