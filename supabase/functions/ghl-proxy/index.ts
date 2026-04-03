/**
 * ghl-proxy Edge Function
 *
 * Proxies requests to GoHighLevel API v2 using the coach's
 * stored API key and location ID from coach_settings.
 *
 * Actions: testConnection, getContacts, searchContacts,
 *          getPipelines, getOpportunities, sendSMS, sendEmail
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const GHL_BASE = "https://services.leadconnectorhq.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Authenticate the calling user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No authorization header" }, 401);

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    // Get the coach's GHL credentials
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: settings } = await supabaseAdmin
      .from("coach_settings")
      .select("ghl_api_key, ghl_location_id")
      .eq("coach_id", user.id)
      .single();

    if (!settings?.ghl_api_key || !settings?.ghl_location_id) {
      return json({ error: "GHL credentials not configured. Go to Settings to add your API key and Location ID." }, 400);
    }

    const apiKey = settings.ghl_api_key;
    const locationId = settings.ghl_location_id;
    const ghlHeaders = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    };

    const { action, params = {} } = await req.json();

    // ─── Route actions ────────────────────────────────────────────────

    if (action === "testConnection") {
      const res = await fetch(`${GHL_BASE}/locations/${locationId}`, {
        headers: ghlHeaders,
      });
      if (!res.ok) {
        const errText = await res.text();
        return json({ error: `GHL API returned ${res.status}: ${errText}` });
      }
      const data = await res.json();
      return json({ success: true, location_name: data.location?.name || data.name || "Connected" });
    }

    if (action === "getContacts" || action === "searchContacts") {
      const query = new URLSearchParams({ locationId, limit: "20" });
      if (params.query) query.set("query", params.query);
      const res = await fetch(`${GHL_BASE}/contacts/?${query}`, { headers: ghlHeaders });
      if (!res.ok) return json({ error: `GHL contacts error: ${res.status}` });
      return json(await res.json());
    }

    if (action === "getPipelines") {
      const res = await fetch(`${GHL_BASE}/opportunities/pipelines?locationId=${locationId}`, {
        headers: ghlHeaders,
      });
      if (!res.ok) return json({ error: `GHL pipelines error: ${res.status}` });
      return json(await res.json());
    }

    if (action === "getOpportunities") {
      const query = new URLSearchParams({ locationId, limit: "50" });
      if (params.pipelineId) query.set("pipelineId", params.pipelineId);
      if (params.stageId) query.set("stageId", params.stageId);
      const res = await fetch(`${GHL_BASE}/opportunities/search?${query}`, {
        method: "GET",
        headers: ghlHeaders,
      });
      if (!res.ok) return json({ error: `GHL opportunities error: ${res.status}` });
      return json(await res.json());
    }

    if (action === "sendSMS") {
      const { contactId, message } = params;
      if (!contactId || !message) return json({ error: "contactId and message required" }, 400);
      const res = await fetch(`${GHL_BASE}/conversations/messages`, {
        method: "POST",
        headers: ghlHeaders,
        body: JSON.stringify({
          type: "SMS",
          contactId,
          message,
        }),
      });
      if (!res.ok) return json({ error: `GHL SMS error: ${res.status}` });
      return json(await res.json());
    }

    if (action === "sendEmail") {
      const { contactId, subject, htmlBody } = params;
      if (!contactId || !subject) return json({ error: "contactId and subject required" }, 400);
      const res = await fetch(`${GHL_BASE}/conversations/messages`, {
        method: "POST",
        headers: ghlHeaders,
        body: JSON.stringify({
          type: "Email",
          contactId,
          subject,
          html: htmlBody || "",
        }),
      });
      if (!res.ok) return json({ error: `GHL email error: ${res.status}` });
      return json(await res.json());
    }

    if (action === "getConversations") {
      const { contactId } = params;
      if (!contactId) return json({ error: "contactId required" }, 400);
      const res = await fetch(
        `${GHL_BASE}/conversations/search?locationId=${locationId}&contactId=${contactId}`,
        { headers: ghlHeaders }
      );
      if (!res.ok) return json({ error: `GHL conversations error: ${res.status}` });
      return json(await res.json());
    }

    return json({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    console.error("ghl-proxy error:", err);
    return json({ error: String(err) }, 500);
  }
});
