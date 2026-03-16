import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function verifyHmac(body: string, receivedHmac: string, secret: string): Promise<boolean> {
  if (!receivedHmac || !secret) return false;
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(body);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
    const hashArray = Array.from(new Uint8Array(signature));
    const computedHmac = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    return computedHmac.toLowerCase() === receivedHmac.toLowerCase();
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const HMAC_SECRET = Deno.env.get("PAYMOB_HMAC_SECRET");
    if (!HMAC_SECRET) throw new Error("PAYMOB_HMAC_SECRET not configured");

    const url = new URL(req.url);
    const receivedHmac = url.searchParams.get("hmac") || "";

    const body = await req.text();
    let payload: any;

    // ── Verify HMAC before processing ──────────────────────────────────────
    const isValid = await verifyHmac(body, receivedHmac, HMAC_SECRET);
    if (!isValid) {
      console.error("Paymob webhook HMAC verification failed");
      return new Response(JSON.stringify({ status: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Paymob may send as form data or JSON
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      payload = JSON.parse(body);
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(body);
      const dataStr = params.get("data") || params.get("obj") || body;
      try { payload = JSON.parse(dataStr); } catch { payload = Object.fromEntries(params); }
    } else {
      try { payload = JSON.parse(body); } catch { payload = {}; }
    }

    // Extract transaction data from Paymob callback
    const obj = payload.obj || payload;
    const transactionId = String(obj.id || obj.transaction_id || "");
    const success = obj.success === true || obj.success === "true";
    const orderId = String(obj.order?.id || obj.order_id || "");
    const intentionId = String(obj.payment_intent?.id || obj.intention_id || "");
    const amountCents = obj.amount_cents || obj.amount || 0;
    const paymentMethod = obj.source_data?.type || obj.payment_method || "card";

    // Extract extras (user_id, points, package)
    const extras = obj.order?.extras || obj.extras || {};
    const userId = extras.user_id || "";
    const points = parseInt(extras.points || "0", 10);

    console.log("Paymob webhook received:", {
      transactionId, success, orderId, intentionId, userId, points, paymentMethod,
    });

    if (!userId || !points) {
      console.error("Missing user_id or points in webhook extras");
      return new Response(JSON.stringify({ status: "ignored", reason: "missing_data" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (success) {
      // Update payment order status
      const { data: existingOrders } = await adminSupabase
        .from("payment_orders")
        .select("id, status")
        .eq("user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1);

      if (existingOrders && existingOrders.length > 0) {
        await adminSupabase
          .from("payment_orders")
          .update({
            status: "paid",
            paymob_transaction_id: transactionId,
            paymob_order_id: orderId,
            payment_method: paymentMethod,
          })
          .eq("id", existingOrders[0].id);

        // Only credit points if not already credited
        if (existingOrders[0].status === "pending") {
          await adminSupabase.from("point_transactions").insert({
            user_id: userId,
            amount: points,
            type: "purchase",
            description: `Purchased ${points} points via Paymob (TX: ${transactionId})`,
          });
          console.log(`Credited ${points} points to user ${userId}`);
        }
      }
    } else {
      // Mark as failed
      await adminSupabase
        .from("payment_orders")
        .update({
          status: "failed",
          paymob_transaction_id: transactionId,
          error_message: obj.data?.message || "Payment failed",
        })
        .match({ user_id: userId, status: "pending" });

      console.log(`Payment failed for user ${userId}`);
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("paymob-webhook error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
