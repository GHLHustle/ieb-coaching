import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `You are an expert coaching session analyst for IEB Coaching.
You review coaching call transcripts and provide structured, actionable insights.

Analyze the transcript and return a JSON object with EXACTLY this structure:
{
  "summary": "2-3 sentence summary of the session",
  "goals_mentioned": [{"goal": "string", "status": "on_track|behind|achieved|new", "notes": "string"}],
  "commitments_tracked": [{"commitment": "string", "followed_through": true/false, "notes": "string"}],
  "progress_score": 1-10,
  "progress_notes": "Brief assessment of client progress",
  "question_types": [{"type": "open-ended|closed|reflective|challenging|clarifying", "example": "quote from transcript", "effectiveness": "high|medium|low"}],
  "rapport_indicators": [{"indicator": "string", "observation": "string"}],
  "techniques_used": [{"technique": "string", "context": "string", "effectiveness": "high|medium|low"}],
  "coaching_quality_score": 1-10,
  "coaching_quality_notes": "Brief assessment of coaching quality",
  "extracted_action_items": [{"title": "string", "description": "string", "suggested_due_date": "YYYY-MM-DD or null", "priority": "high|medium|low"}],
  "client_sentiment": "very_positive|positive|neutral|negative|very_negative",
  "engagement_score": 1-10,
  "engagement_notes": "Brief assessment of client engagement",
  "key_moments": [{"description": "string", "significance": "breakthrough|insight|concern|action"}],
  "overall_assessment": "2-3 sentence overall assessment",
  "recommendations_for_coach": "2-3 specific recommendations for the coach"
}

Be specific and reference actual content from the transcript. Be constructive in coaching quality feedback.
Return ONLY valid JSON, no markdown fences or extra text.`;

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Create Supabase clients
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const { call_log_id } = await req.json();
    if (!call_log_id) {
      return new Response(JSON.stringify({ error: "call_log_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Fetch the call log with transcript/summary
    const { data: callLog, error: callError } = await supabaseAdmin
      .from("call_logs")
      .select("*, clients(id, user_id, full_name)")
      .eq("id", call_log_id)
      .single();

    if (callError || !callLog) {
      return new Response(JSON.stringify({ error: "Call log not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Build the transcript content to analyze
    const transcriptContent = callLog.transcript || callLog.summary || callLog.notes || "";
    if (!transcriptContent.trim()) {
      return new Response(JSON.stringify({ error: "No transcript or notes available for this call" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Call Gemini 3 Flash
    const geminiResponse = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${SYSTEM_PROMPT}\n\n--- COACHING CALL TRANSCRIPT ---\nClient: ${callLog.clients?.full_name || "Unknown"}\nCall Type: ${callLog.call_type || "coaching"}\nDate: ${callLog.call_date || "Unknown"}\nDuration: ${callLog.duration_minutes || "Unknown"} minutes\n\n${transcriptContent}\n--- END TRANSCRIPT ---`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini API error:", errText);
      return new Response(JSON.stringify({ error: "AI analysis failed", details: errText }), {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const geminiData = await geminiResponse.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    const tokensUsed = geminiData.usageMetadata?.totalTokenCount || null;

    if (!rawText) {
      return new Response(JSON.stringify({ error: "No response from AI" }), {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Parse the JSON response
    let analysis;
    try {
      analysis = JSON.parse(rawText);
    } catch {
      console.error("Failed to parse Gemini response:", rawText);
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Upsert into ai_call_reviews (update if already exists for this call)
    const reviewData = {
      call_log_id,
      client_id: callLog.client_id || callLog.clients?.id,
      coach_id: user.id,
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
      tokens_used: tokensUsed,
    };

    const { data: review, error: upsertError } = await supabaseAdmin
      .from("ai_call_reviews")
      .upsert(reviewData, { onConflict: "call_log_id" })
      .select()
      .single();

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return new Response(JSON.stringify({ error: "Failed to save review", details: upsertError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    return new Response(JSON.stringify({ success: true, review }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal error", details: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
