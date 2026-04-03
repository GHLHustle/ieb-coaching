/**
 * invite-client Edge Function
 *
 * Actions:
 *   invite   — Creates a Supabase auth user, links to clients table,
 *              generates a magic link, sends it via GHL (or Supabase email fallback)
 *   reset    — Generates a password recovery link for an existing client,
 *              sends it via GHL
 *
 * Called from the coach portal (ClientProfile / ClientList).
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
    // Auth the coach
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: coach }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !coach) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { action, client_id, send_via } = await req.json();

    // Fetch the client
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("*")
      .eq("id", client_id)
      .eq("coach_id", coach.id)
      .single();

    if (clientErr || !client) return json({ error: "Client not found" }, 404);
    if (!client.email) return json({ error: "Client has no email address. Add one first." }, 400);

    // Fetch coach's GHL settings (for sending via GHL)
    const { data: settings } = await supabase
      .from("coach_settings")
      .select("ghl_api_key, ghl_location_id")
      .eq("coach_id", coach.id)
      .single();

    const hasGHL = settings?.ghl_api_key && settings?.ghl_location_id;

    // Get the app URL for redirect
    const appUrl = SUPABASE_URL.includes("cpobusfadlpnmwdiehof")
      ? "https://ieb-coaching.vercel.app"
      : SUPABASE_URL.replace(".supabase.co", ".vercel.app");

    // ─── INVITE ──────────────────────────────────────────────────────

    if (action === "invite") {
      // Check if client already has a linked auth user
      if (client.user_id) {
        return json({ error: "This client already has an account. Use 'Reset Password' instead." }, 400);
      }

      // Check if an auth user with this email already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(
        (u: { email?: string }) => u.email?.toLowerCase() === client.email.toLowerCase()
      );

      let userId: string;

      if (existingUser) {
        userId = existingUser.id;
      } else {
        // Create the auth user
        const tempPassword = crypto.randomUUID().replace(/-/g, "").slice(0, 16) + "Aa1!";
        const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
          email: client.email,
          password: tempPassword,
          email_confirm: true, // skip email verification
          user_metadata: { full_name: `${client.first_name} ${client.last_name}` },
        });

        if (createErr) return json({ error: `Failed to create account: ${createErr.message}` }, 500);
        userId = newUser.user.id;
      }

      // Ensure profile row exists with role=client
      await supabase.from("profiles").upsert({
        id: userId,
        role: "client",
        full_name: `${client.first_name} ${client.last_name}`,
        email: client.email,
      }, { onConflict: "id" });

      // Link client record to the auth user
      await supabase.from("clients").update({ user_id: userId }).eq("id", client_id);

      // Generate a magic link for the invite
      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: client.email,
        options: { redirectTo: `${appUrl}/client` },
      });

      if (linkErr) return json({ error: `Failed to generate link: ${linkErr.message}` }, 500);

      const magicLink = linkData.properties?.action_link || "";

      // Build the invite message
      const message = `Hi ${client.first_name}! You've been invited to your IEB 1:1 Launch Coaching portal. Click this link to sign in and access your coaching dashboard, check-ins, action steps, and call notes:\n\n${magicLink}\n\nThis link expires in 24 hours. After your first login, you can set a permanent password from your profile.`;

      // Send via GHL if available, otherwise return the link for manual sharing
      let sentVia = "link_only";

      if (hasGHL && client.ghl_contact_id && (send_via === "sms" || send_via === "email" || send_via === "both")) {
        const ghlHeaders = {
          Authorization: `Bearer ${settings!.ghl_api_key}`,
          "Content-Type": "application/json",
          Version: "2021-07-28",
        };

        if (send_via === "sms" || send_via === "both") {
          await fetch(`${GHL_BASE}/conversations/messages`, {
            method: "POST",
            headers: ghlHeaders,
            body: JSON.stringify({
              type: "SMS",
              contactId: client.ghl_contact_id,
              message,
            }),
          });
          sentVia = "sms";
        }

        if (send_via === "email" || send_via === "both") {
          await fetch(`${GHL_BASE}/conversations/messages`, {
            method: "POST",
            headers: ghlHeaders,
            body: JSON.stringify({
              type: "Email",
              contactId: client.ghl_contact_id,
              subject: "Welcome to IEB 1:1 Launch Coaching",
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
                <h2 style="color:#1e3a5f;">Welcome to IEB Coaching, ${client.first_name}!</h2>
                <p>You've been invited to your personal coaching portal where you can access your coaching dashboard, check-ins, action steps, and call notes.</p>
                <p style="text-align:center;margin:30px 0;">
                  <a href="${magicLink}" style="background:#1e3a5f;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Sign In to Your Portal</a>
                </p>
                <p style="color:#666;font-size:14px;">This link expires in 24 hours. After your first login, you can set a permanent password.</p>
                <hr style="border:none;border-top:1px solid #eee;margin:30px 0;">
                <p style="color:#999;font-size:12px;">IEB 1:1 Launch Coaching</p>
              </div>`,
            }),
          });
          sentVia = send_via === "both" ? "both" : "email";
        }
      }

      return json({
        success: true,
        user_id: userId,
        sent_via: sentVia,
        magic_link: magicLink,
        message: sentVia === "link_only"
          ? "Account created! Copy the magic link to send to your client manually."
          : `Invite sent to ${client.first_name} via ${sentVia}!`,
      });
    }

    // ─── RESET PASSWORD ───────────────────────────────────────────────

    if (action === "reset") {
      if (!client.user_id) {
        return json({ error: "This client doesn't have an account yet. Send an Invite first." }, 400);
      }

      // Generate a recovery link
      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: "recovery",
        email: client.email,
        options: { redirectTo: `${appUrl}/client` },
      });

      if (linkErr) return json({ error: `Failed to generate reset link: ${linkErr.message}` }, 500);

      const resetLink = linkData.properties?.action_link || "";

      const message = `Hi ${client.first_name}, here's your password reset link for your IEB Coaching portal:\n\n${resetLink}\n\nThis link expires in 24 hours.`;

      let sentVia = "link_only";

      if (hasGHL && client.ghl_contact_id && (send_via === "sms" || send_via === "email" || send_via === "both")) {
        const ghlHeaders = {
          Authorization: `Bearer ${settings!.ghl_api_key}`,
          "Content-Type": "application/json",
          Version: "2021-07-28",
        };

        if (send_via === "sms" || send_via === "both") {
          await fetch(`${GHL_BASE}/conversations/messages`, {
            method: "POST",
            headers: ghlHeaders,
            body: JSON.stringify({
              type: "SMS",
              contactId: client.ghl_contact_id,
              message,
            }),
          });
          sentVia = "sms";
        }

        if (send_via === "email" || send_via === "both") {
          await fetch(`${GHL_BASE}/conversations/messages`, {
            method: "POST",
            headers: ghlHeaders,
            body: JSON.stringify({
              type: "Email",
              contactId: client.ghl_contact_id,
              subject: "Reset Your IEB Coaching Password",
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
                <h2 style="color:#1e3a5f;">Password Reset</h2>
                <p>Hi ${client.first_name}, click below to reset your IEB Coaching portal password:</p>
                <p style="text-align:center;margin:30px 0;">
                  <a href="${resetLink}" style="background:#1e3a5f;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Reset Password</a>
                </p>
                <p style="color:#666;font-size:14px;">This link expires in 24 hours.</p>
                <hr style="border:none;border-top:1px solid #eee;margin:30px 0;">
                <p style="color:#999;font-size:12px;">IEB 1:1 Launch Coaching</p>
              </div>`,
            }),
          });
          sentVia = send_via === "both" ? "both" : "email";
        }
      }

      return json({
        success: true,
        sent_via: sentVia,
        reset_link: resetLink,
        message: sentVia === "link_only"
          ? "Reset link generated! Copy it to send manually."
          : `Password reset sent to ${client.first_name} via ${sentVia}!`,
      });
    }

    return json({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    console.error("invite-client error:", err);
    return json({ error: String(err) }, 500);
  }
});
