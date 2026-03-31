import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `You are an expert coaching insights analyst for IEB Coaching.
You review longitudinal coaching data across multiple sessions to identify patterns, progress, and coaching effectiveness.

Analyze all the call logs, AI reviews, and confidence check-ins to return a JSON object with EXACTLY this structure:
{
  "journey_summary": "2-3 sentence narrative overview of the client's coaching journey",
  "progress_trajectory": "improving|steady|declining|mixed",
  "key_themes": ["theme1", "theme2", "theme3"],
  "growth_areas": [
    {
      "area": "string (e.g., 'Sales Skills', 'Team Management')",
      "first_mention_date": "YYYY-MM-DD",
      "current_status": "string describing where they are now",
      "evidence": "string with specific evidence from the calls"
    }
  ],
  "confidence_trend": {
    "direction": "improving|steady|declining",
    "services_trend": "improving|steady|declining",
    "operations_trend": "improving|steady|declining",
    "growth_trend": "improving|steady|declining"
  },
  "milestones_achieved": [
    {
      "milestone": "string description",
      "date": "YYYY-MM-DD",
      "significance": "string explaining why this matters"
    }
  ],
  "areas_needing_attention": [
    {
      "area": "string",
      "concern": "string describing the concern",
      "impact": "high|medium|low",
      "suggested_approach": "string with suggested coaching approach"
    }
  ],
  "recommended_focus": "2-3 sentences about what to focus on in the next session",
  "coach_effectiveness": "2-3 sentence assessment of coaching approach effectiveness and how it has evolved",
  "overall_insights": "2-3 sentence overall summary of the coaching relationship and client potential"
}

Be specific and reference actual content from the call logs and reviews. Focus on longitudinal patterns and progress over time.
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

    const { client_id } = await req.json();
    if (!client_id) {
      return new Response(JSON.stringify({ error: "client_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Fetch all call logs for this client
    const { data: callLogs, error: callLogsError } = await supabaseAdmin
      .from("call_logs")
      .select("*")
      .eq("client_id", client_id)
      .order("call_date", { ascending: true });

    if (callLogsError) {
      return new Response(JSON.stringify({ error: "Failed to fetch call logs" }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Fetch all AI reviews for these calls
    const { data: aiReviews, error: reviewsError } = await supabaseAdmin
      .from("ai_call_reviews")
      .select("*")
      .eq("client_id", client_id)
      .order("created_at", { ascending: true });

    if (reviewsError) {
      return new Response(JSON.stringify({ error: "Failed to fetch AI reviews" }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Fetch confidence check-ins for this client
    const { data: checkins, error: checkinsError } = await supabaseAdmin
      .from("confidence_checkins")
      .select("*")
      .eq("client_id", client_id)
      .order("submitted_at", { ascending: true });

    if (checkinsError) {
      return new Response(JSON.stringify({ error: "Failed to fetch check-ins" }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // If no call logs, return helpful response
    if (!callLogs || callLogs.length === 0) {
      return new Response(JSON.stringify({
        journey_summary: "No coaching calls recorded yet. Once you log your first call, coaching insights will appear here.",
        progress_trajectory: "steady",
        key_themes: [],
        growth_areas: [],
        confidence_trend: {
          direction: "steady",
          services_trend: "steady",
          operations_trend: "steady",
          growth_trend: "steady",
        },
        milestones_achieved: [],
        areas_needing_attention: [],
        recommended_focus: "Log your first coaching call to get started with insights.",
        coach_effectiveness: "Coaching relationship is just beginning. Focus on establishing trust and understanding the client's primary goals.",
        overall_insights: "Ready to begin the coaching journey. Focus on creating a strong foundation in the first session.",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Build comprehensive data summary for Gemini
    const callSummaries = callLogs.map((call, idx) => {
      const review = aiReviews.find(r => r.call_log_id === call.id);
      return `
CALL #${idx + 1}: ${new Date(call.call_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
Type: ${call.call_type || 'coaching'}
Duration: ${call.duration_minutes || 'N/A'} minutes
${call.summary ? `Notes: ${call.summary}` : ''}
${review ? `AI Analysis Summary: ${review.summary}` : ''}
${review ? `Progress Score: ${review.progress_score}/10` : ''}
${review ? `Key Moments: ${review.key_moments?.map(k => k.description).join('; ') || 'N/A'}` : ''}
${review ? `Recommendations: ${review.recommendations_for_coach}` : ''}
`;
    }).join('\n---\n');

    const checkinSummary = checkins && checkins.length > 0 ? `
CONFIDENCE CHECK-INS OVER TIME:
${checkins.map((c, idx) => `Check-in ${idx + 1} (${new Date(c.submitted_at).toLocaleDateString()}): Services ${c.services_score}/10, Operations ${c.operations_score}/10, Growth ${c.growth_score}/10`).join('\n')}
` : '';

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
                text: `${SYSTEM_PROMPT}\n\n--- COACHING DATA FOR ANALYSIS ---\n\n${callSummaries}\n\n${checkinSummary}\n\n--- END COACHING DATA ---`,
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
    let insights;
    try {
      insights = JSON.parse(rawText);
    } catch {
      console.error("Failed to parse Gemini response:", rawText);
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    return new Response(JSON.stringify({ success: true, insights }), {
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
