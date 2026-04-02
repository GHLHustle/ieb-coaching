/**
 * drive-sync Edge Function
 *
 * Polls each client's Google Drive folder for new Docs,
 * reads them, runs Gemini AI analysis, creates call_logs,
 * ai_call_reviews, and action_items automatically.
 *
 * Called by pg_cron every hour, or manually via POST.
 *
 * Required Supabase Secrets:
 *   GOOGLE_SERVICE_ACCOUNT_JSON  - full JSON key from Google Cloud
 *   GEMINI_API_KEY               - Gemini API key
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { encode as base64encode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const SERVICE_ACCOUNT_JSON = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")!;

const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent?key=${GEMINI_API_KEY}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Google Service Account JWT Auth ────────────────────────────────────────

async function getGoogleAccessToken(): Promise<string> {
  const sa = JSON.parse(SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/documents.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const claimB64 = btoa(JSON.stringify(claim)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signingInput = `${headerB64}.${claimB64}`;

  // Import the RSA private key from the service account
  const pemKey = sa.private_key;
  const keyData = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");

  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(signingInput)
  );

  const sigB64 = base64encode(new Uint8Array(signature))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const jwt = `${signingInput}.${sigB64}`;

  // Exchange JWT for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`Failed to get Google access token: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

// ─── Google Drive: List files in a folder ───────────────────────────────────

async function listDriveFiles(
  folderId: string,
  accessToken: string,
  sinceDate?: string
): Promise<Array<{ id: string; name: string; modifiedTime: string; mimeType: string }>> {
  let query = `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.document' and trashed = false`;
  if (sinceDate) {
    query += ` and modifiedTime > '${sinceDate}'`;
  }

  const params = new URLSearchParams({
    q: query,
    fields: "files(id,name,modifiedTime,mimeType)",
    orderBy: "modifiedTime asc",
    pageSize: "50",
  });

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive API error listing files: ${err}`);
  }

  const data = await res.json();
  return data.files || [];
}

// ─── Google Docs: Export as plain text ──────────────────────────────────────

async function exportDocAsText(fileId: string, accessToken: string): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive API error exporting doc: ${err}`);
  }

  return await res.text();
}

// ─── Parse call date from filename ──────────────────────────────────────────

function parseDateFromFilename(name: string): string {
  // Try common patterns:
  // "2024-01-15 - Call Notes"
  // "Jan 15 2024 - Session"
  // "01-15-2024 Coaching"
  // "January 15, 2024"

  const isoMatch = name.match(/(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/);
  if (isoMatch) return isoMatch[1].replace(/\//g, "-");

  const usMatch = name.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/);
  if (usMatch) {
    const parts = usMatch[1].split(/[-\/]/);
    return `${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
  }

  const monthNames = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  const shortMonths = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const lower = name.toLowerCase();

  for (let i = 0; i < monthNames.length; i++) {
    const re = new RegExp(`(${monthNames[i]}|${shortMonths[i]})\\s+(\\d{1,2}),?\\s+(\\d{4})`, "i");
    const m = lower.match(re);
    if (m) {
      const month = (i + 1).toString().padStart(2, "0");
      return `${m[3]}-${month}-${m[2].padStart(2, "0")}`;
    }
  }

  // Default to today
  return new Date().toISOString().split("T")[0];
}

// ─── Gemini AI Analysis ──────────────────────────────────────────────────────

const AI_PROMPT = `You are an expert coaching session analyst for IEB Coaching.
Analyze these coaching call notes and return a JSON object with EXACTLY this structure:
{
  "summary": "2-3 sentence summary of the session",
  "call_type": "coaching|check_in|strategy|other",
  "duration_estimate": null,
  "goals_mentioned": [{"goal": "string", "status": "on_track|behind|achieved|new", "notes": "string"}],
  "commitments_tracked": [{"commitment": "string", "followed_through": true/false, "notes": "string"}],
  "progress_score": 1-10,
  "progress_notes": "Brief assessment of client progress",
  "question_types": [{"type": "open-ended|closed|reflective|challenging|clarifying", "example": "quote", "effectiveness": "high|medium|low"}],
  "rapport_indicators": [{"indicator": "string", "observation": "string"}],
  "techniques_used": [{"technique": "string", "context": "string", "effectiveness": "high|medium|low"}],
  "coaching_quality_score": 1-10,
  "coaching_quality_notes": "Brief assessment",
  "extracted_action_items": [{"title": "string", "description": "string", "suggested_due_date": "YYYY-MM-DD or null", "priority": "high|medium|low", "division": "services|operations|growth or null (services=delivery work, operations=systems/team/process, growth=marketing/sales/revenue)"}],
  "client_sentiment": "very_positive|positive|neutral|negative|very_negative",
  "engagement_score": 1-10,
  "engagement_notes": "Brief assessment",
  "key_moments": [{"description": "string", "significance": "breakthrough|insight|concern|action"}],
  "overall_assessment": "2-3 sentence overall assessment",
  "recommendations_for_coach": "2-3 specific recommendations"
}
Return ONLY valid JSON, no markdown.`;

async function analyzeWithGemini(
  content: string,
  clientName: string,
  callDate: string
): Promise<Record<string, unknown>> {
  const res = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [{
          text: `${AI_PROMPT}\n\n--- CALL NOTES ---\nClient: ${clientName}\nDate: ${callDate}\n\n${content}\n--- END NOTES ---`,
        }],
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini API error: ${await res.text()}`);
  }

  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("No response from Gemini");

  return JSON.parse(raw);
}

// ─── Main handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const results: Array<Record<string, unknown>> = [];
  let totalProcessed = 0;
  let totalErrors = 0;

  try {
    // Validate the service account JSON is configured
    if (!SERVICE_ACCOUNT_JSON) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_SERVICE_ACCOUNT_JSON secret not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse optional client_id from request body (for per-client manual sync)
    let targetClientId: string | null = null;
    if (req.method === "POST" && req.headers.get("content-type")?.includes("application/json")) {
      try {
        const body = await req.json();
        targetClientId = body.client_id || null;
      } catch { /* no body is fine */ }
    }

    // Get a fresh Google access token
    const accessToken = await getGoogleAccessToken();

    // Fetch clients that have a Google Drive folder configured
    let query = supabase
      .from("clients")
      .select("id, full_name, coach_id, google_drive_folder_id, drive_last_synced_at")
      .not("google_drive_folder_id", "is", null);

    if (targetClientId) {
      query = query.eq("id", targetClientId);
    }

    const { data: clients, error: clientsError } = await query;

    if (clientsError) throw clientsError;
    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({ message: "No clients with Drive folders configured", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process each client
    for (const client of clients) {
      const clientResult: Record<string, unknown> = {
        client_id: client.id,
        client_name: client.full_name,
        files_processed: 0,
        errors: [],
      };

      try {
        // List files in the client's Drive folder
        // Only look at files modified since the last sync (or 30 days if first run)
        const sinceDate = client.drive_last_synced_at
          ? new Date(client.drive_last_synced_at).toISOString()
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const files = await listDriveFiles(
          client.google_drive_folder_id,
          accessToken,
          sinceDate
        );

        // Get the list of already-processed file IDs for this client
        const { data: processedFiles } = await supabase
          .from("processed_drive_files")
          .select("drive_file_id")
          .eq("client_id", client.id);

        const processedIds = new Set((processedFiles || []).map((f: { drive_file_id: string }) => f.drive_file_id));

        // Filter to only new files
        const newFiles = files.filter((f: { id: string }) => !processedIds.has(f.id));

        for (const file of newFiles) {
          try {
            // Export the Google Doc as plain text
            const content = await exportDocAsText(file.id, accessToken);

            if (!content.trim() || content.trim().length < 50) {
              // Skip empty or nearly-empty docs
              await supabase.from("processed_drive_files").insert({
                client_id: client.id,
                drive_file_id: file.id,
                drive_file_name: file.name,
                status: "skipped",
                error_message: "Document too short or empty",
              });
              continue;
            }

            // Parse the call date from the filename
            const callDate = parseDateFromFilename(file.name);

            // Run Gemini analysis
            const analysis = await analyzeWithGemini(content, client.full_name, callDate);

            // Create the call_log entry
            const { data: callLog, error: callLogError } = await supabase
              .from("call_logs")
              .insert({
                client_id: client.id,
                coach_id: client.coach_id,
                call_date: callDate,
                call_type: (analysis.call_type as string) || "coaching",
                duration_minutes: analysis.duration_estimate || null,
                notes: content.substring(0, 5000), // store first 5k chars of raw notes
                transcript: content,               // full content
                google_doc_url: `https://docs.google.com/document/d/${file.id}`,
                source: "google_drive",
              })
              .select()
              .single();

            if (callLogError) throw callLogError;

            // Create the AI review
            const { error: reviewError } = await supabase
              .from("ai_call_reviews")
              .upsert({
                call_log_id: callLog.id,
                client_id: client.id,
                coach_id: client.coach_id,
                summary: analysis.summary,
                goals_mentioned: analysis.goals_mentioned || [],
                commitments_tracked: analysis.commitments_tracked || [],
                progress_score: analysis.progress_score,
                progress_notes: analysis.progress_notes,
                question_types: analysis.question_types || [],
                rapport_indicators: analysis.rapport_indicators || [],
                techniques_used: analysis.techniques_used || [],
                coaching_quality_score: analysis.coaching_quality_score,
                coaching_quality_notes: analysis.coaching_quality_notes,
                extracted_action_items: analysis.extracted_action_items || [],
                client_sentiment: analysis.client_sentiment,
                engagement_score: analysis.engagement_score,
                engagement_notes: analysis.engagement_notes,
                key_moments: analysis.key_moments || [],
                overall_assessment: analysis.overall_assessment,
                recommendations_for_coach: analysis.recommendations_for_coach,
                model_used: "gemini-3-flash",
              }, { onConflict: "call_log_id" });

            if (reviewError) throw reviewError;

            // Auto-create action items from AI extraction
            const actionItems = (analysis.extracted_action_items as Array<{
              title: string;
              description: string;
              suggested_due_date: string | null;
              priority: string;
              division: string | null;
            }>) || [];

            const validDivisions = ["services", "operations", "growth"];
            for (const item of actionItems) {
              const division = validDivisions.includes(item.division ?? "") ? item.division : null;
              await supabase.from("action_items").insert({
                client_id: client.id,
                coach_id: client.coach_id,
                call_log_id: callLog.id,
                title: item.title,
                description: item.description || "",
                due_date: item.suggested_due_date || null,
                priority: ["high", "medium", "low"].includes(item.priority) ? item.priority : "medium",
                division,
                status: "pending",
                is_visible_to_client: true,
                source: "ai_extracted",
              });
            }

            // Mark the file as processed
            await supabase.from("processed_drive_files").insert({
              client_id: client.id,
              drive_file_id: file.id,
              drive_file_name: file.name,
              call_log_id: callLog.id,
              status: "success",
            });

            clientResult.files_processed = (clientResult.files_processed as number) + 1;
            totalProcessed++;

          } catch (fileErr) {
            const msg = fileErr instanceof Error ? fileErr.message : String(fileErr);
            (clientResult.errors as string[]).push(`${file.name}: ${msg}`);
            totalErrors++;

            // Log the error so we don't retry the same broken file forever
            await supabase.from("processed_drive_files").insert({
              client_id: client.id,
              drive_file_id: file.id,
              drive_file_name: file.name,
              status: "error",
              error_message: msg,
            }).catch(() => {});
          }
        }

        // Update last synced timestamp for this client
        await supabase
          .from("clients")
          .update({ drive_last_synced_at: new Date().toISOString() })
          .eq("id", client.id);

      } catch (clientErr) {
        const msg = clientErr instanceof Error ? clientErr.message : String(clientErr);
        clientResult.client_error = msg;
        totalErrors++;
      }

      results.push(clientResult);
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_clients: clients.length,
        total_processed: totalProcessed,
        total_errors: totalErrors,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("drive-sync fatal error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
