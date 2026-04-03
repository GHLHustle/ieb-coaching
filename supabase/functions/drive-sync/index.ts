/**
 * drive-sync Edge Function
 *
 * Polls each client's PUBLIC Google Drive folder for new Google Docs,
 * reads them, runs Gemini AI analysis, creates call_logs,
 * ai_call_reviews, and action_items automatically.
 *
 * Requirements:
 *   - Client's Drive folder must be set to "Anyone with the link can view"
 *   - A Google Cloud API key with Drive API enabled (no OAuth, no service account)
 *
 * Required Supabase Secrets:
 *   GOOGLE_DRIVE_API_KEY        - simple API key from Google Cloud Console
 *   GEMINI_API_KEY              - Gemini API key
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const DRIVE_API_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY")!;

const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent?key=${GEMINI_API_KEY}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Google Drive: List Google Docs in a public folder ──────────────────────

async function listDriveFiles(
  folderId: string,
  sinceDate?: string
): Promise<Array<{ id: string; name: string; modifiedTime: string }>> {
  // Works for folders shared "Anyone with the link can view"
  let q = `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.document' and trashed = false`;
  if (sinceDate) {
    q += ` and modifiedTime > '${sinceDate}'`;
  }

  const params = new URLSearchParams({
    q,
    fields: "files(id,name,modifiedTime)",
    orderBy: "modifiedTime asc",
    pageSize: "50",
    key: DRIVE_API_KEY,
  });

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params}`
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive API error: ${err}`);
  }

  const data = await res.json();
  return data.files || [];
}

// ─── Google Docs: Export public doc as plain text ───────────────────────────

async function exportDocAsText(fileId: string): Promise<string> {
  // Public Google Docs can be exported without any auth key
  const res = await fetch(
    `https://docs.google.com/document/d/${fileId}/export?format=txt`
  );

  if (!res.ok) {
    // Fallback: try via Drive API with key
    const res2 = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain&key=${DRIVE_API_KEY}`
    );
    if (!res2.ok) throw new Error(`Could not export doc ${fileId}: ${await res2.text()}`);
    return await res2.text();
  }

  return await res.text();
}

// ─── Parse call date from filename ──────────────────────────────────────────

function parseDateFromFilename(name: string): string {
  // "2024-01-15 - Call Notes", "Jan 15 2024", "01-15-2024", "January 15, 2024"
  const isoMatch = name.match(/(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/);
  if (isoMatch) return isoMatch[1].replace(/\//g, "-");

  const usMatch = name.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/);
  if (usMatch) {
    const [m, d, y] = usMatch[1].split(/[-\/]/);
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const months = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  const short  = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const lower  = name.toLowerCase();
  for (let i = 0; i < months.length; i++) {
    const re = new RegExp(`(${months[i]}|${short[i]})\\s+(\\d{1,2}),?\\s+(\\d{4})`, "i");
    const m = lower.match(re);
    if (m) return `${m[3]}-${String(i + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }

  return new Date().toISOString().split("T")[0]; // default today
}

// ─── Gemini AI Analysis ──────────────────────────────────────────────────────

const AI_PROMPT = `You are an expert coaching session analyst for IEB Coaching.
Analyze these coaching call notes and return a JSON object with EXACTLY this structure:
{
  "summary": "2-3 sentence summary of the session",
  "call_type": "coaching|check_in|strategy|other",
  "goals_mentioned": [{"goal": "string", "status": "on_track|behind|achieved|new", "notes": "string"}],
  "commitments_tracked": [{"commitment": "string", "followed_through": true/false, "notes": "string"}],
  "progress_score": 1-10,
  "progress_notes": "Brief assessment of client progress",
  "question_types": [{"type": "open-ended|closed|reflective|challenging|clarifying", "example": "quote", "effectiveness": "high|medium|low"}],
  "rapport_indicators": [{"indicator": "string", "observation": "string"}],
  "techniques_used": [{"technique": "string", "context": "string", "effectiveness": "high|medium|low"}],
  "coaching_quality_score": 1-10,
  "coaching_quality_notes": "Brief assessment",
  "extracted_action_items": [{"title": "string", "description": "string", "suggested_due_date": "YYYY-MM-DD or null", "priority": "high|medium|low", "division": "services|operations|growth or null"}],
  "client_sentiment": "very_positive|positive|neutral|negative|very_negative",
  "engagement_score": 1-10,
  "engagement_notes": "Brief assessment",
  "key_moments": [{"description": "string", "significance": "breakthrough|insight|concern|action"}],
  "overall_assessment": "2-3 sentence overall assessment",
  "recommendations_for_coach": "2-3 specific recommendations"
}
Return ONLY valid JSON, no markdown fences.`;

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

  if (!res.ok) throw new Error(`Gemini error: ${await res.text()}`);
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

  if (!DRIVE_API_KEY) {
    return new Response(
      JSON.stringify({ error: "GOOGLE_DRIVE_API_KEY secret not set. Add it in Supabase → Settings → Edge Functions → Secrets." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const results: Array<Record<string, unknown>> = [];
  let totalProcessed = 0;
  let totalErrors = 0;

  try {
    // Optional: sync a single client (for the "Sync Now" button in the UI)
    let targetClientId: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        targetClientId = body.client_id || null;
      } catch { /* no body */ }
    }

    // Fetch clients with Drive folders configured
    let query = supabase
      .from("clients")
      .select("id, full_name, coach_id, google_drive_folder_id, drive_last_synced_at")
      .not("google_drive_folder_id", "is", null);

    if (targetClientId) query = query.eq("id", targetClientId);

    const { data: clients, error: clientsError } = await query;
    if (clientsError) throw clientsError;

    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({ message: "No clients with Drive folders linked yet.", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    for (const client of clients) {
      const clientResult: Record<string, unknown> = {
        client_id: client.id,
        client_name: client.full_name,
        files_processed: 0,
        errors: [],
      };

      try {
        // Only look at docs modified since the last sync (or last 30 days on first run)
        const sinceDate = client.drive_last_synced_at
          ? new Date(client.drive_last_synced_at).toISOString()
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const files = await listDriveFiles(client.google_drive_folder_id, sinceDate);

        // Which files have already been processed?
        const { data: processedFiles } = await supabase
          .from("processed_drive_files")
          .select("drive_file_id")
          .eq("client_id", client.id);

        const processedIds = new Set((processedFiles || []).map((f: { drive_file_id: string }) => f.drive_file_id));
        const newFiles = files.filter((f: { id: string }) => !processedIds.has(f.id));

        for (const file of newFiles) {
          try {
            const content = await exportDocAsText(file.id);

            if (!content.trim() || content.trim().length < 50) {
              await supabase.from("processed_drive_files").insert({
                client_id: client.id,
                drive_file_id: file.id,
                drive_file_name: file.name,
                status: "skipped",
                error_message: "Document too short or empty",
              });
              continue;
            }

            const callDate = parseDateFromFilename(file.name);
            const analysis = await analyzeWithGemini(content, client.full_name, callDate);

            // Create call_log
            const { data: callLog, error: callLogError } = await supabase
              .from("call_logs")
              .insert({
                client_id: client.id,
                coach_id: client.coach_id,
                call_date: callDate,
                call_type: (analysis.call_type as string) || "coaching",
                notes: content.substring(0, 5000),
                transcript: content,
                google_doc_url: `https://docs.google.com/document/d/${file.id}`,
                source: "google_drive",
              })
              .select()
              .single();

            if (callLogError) throw callLogError;

            // Create AI review
            await supabase.from("ai_call_reviews").upsert({
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

            // Auto-create action items
            const validDivisions = ["services", "operations", "growth"];
            const actionItems = (analysis.extracted_action_items as Array<{
              title: string; description: string;
              suggested_due_date: string | null; priority: string; division: string | null;
            }>) || [];

            for (const item of actionItems) {
              await supabase.from("action_items").insert({
                client_id: client.id,
                coach_id: client.coach_id,
                call_log_id: callLog.id,
                title: item.title,
                description: item.description || "",
                due_date: item.suggested_due_date || null,
                priority: ["high","medium","low"].includes(item.priority) ? item.priority : "medium",
                division: validDivisions.includes(item.division ?? "") ? item.division : null,
                status: "pending",
                is_visible_to_client: true,
                source: "ai_extracted",
              });
            }

            // Mark as processed
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
            await supabase.from("processed_drive_files").insert({
              client_id: client.id,
              drive_file_id: file.id,
              drive_file_name: file.name,
              status: "error",
              error_message: msg,
            }).catch(() => {});
          }
        }

        // Update last synced timestamp
        await supabase.from("clients")
          .update({ drive_last_synced_at: new Date().toISOString() })
          .eq("id", client.id);

      } catch (clientErr) {
        clientResult.client_error = clientErr instanceof Error ? clientErr.message : String(clientErr);
        totalErrors++;
      }

      results.push(clientResult);
    }

    return new Response(
      JSON.stringify({ success: true, total_clients: clients.length, total_processed: totalProcessed, total_errors: totalErrors, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
