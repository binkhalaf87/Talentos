import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Section-specific AI guidance ────────────────────────────────
const sectionGuidance: Record<string, string> = {
  summary:
    "Refine the existing summary into 3-4 polished sentences. Improve wording and add relevant ATS keywords. Do NOT add new claims, certifications, or experience not already mentioned.",
  professionalSummary:
    "Refine the existing summary into 3-4 polished sentences. Improve wording and add relevant ATS keywords. Do NOT add new claims, certifications, or experience not already mentioned.",
  experience:
    "Rewrite existing bullets using STAR format. Start each with strong action verbs (Led, Developed, Implemented, Achieved). If the original has numbers/metrics, keep them exact. If not, do NOT invent percentages or figures — instead restructure the sentence to highlight impact. Add relevant ATS keywords naturally.",
  skills:
    "Reorganize existing skills into categories (Technical, Soft, Tools). Use industry-standard terminology for the same skills mentioned. You may add closely related ATS keywords ONLY if they are clearly implied by the existing skills. Do NOT add unrelated skills.",
  education:
    "Format consistently with degree, institution, graduation year. Only include what is already provided. Do NOT invent GPA, honors, or coursework.",
  certifications:
    "Format in reverse chronological order. Only include what is already provided. Do NOT invent certifications, dates, or credential IDs.",
  languages:
    "List with proficiency levels. Only include languages already mentioned. Do NOT add languages the candidate did not list.",
  projects:
    "Improve project descriptions with impact and technologies used. Only include what is already provided.",
  bullet:
    "Improve this single resume bullet point. Make it achievement-focused using strong action verbs. Preserve all original facts. Add measurable impact phrasing if the original implies it, but do NOT invent numbers or percentages. Return ONLY the improved bullet text, no bullet character prefix.",
};

// ── Bullet micro-improvement types ──────────────────────────────
const bulletActionPrompts: Record<string, string> = {
  improve: "Improve this bullet point to be more impactful and achievement-focused while preserving all original facts.",
  rewrite: "Completely rewrite this bullet point in a more professional and impactful way while keeping the same meaning.",
  shorten: "Shorten this bullet point to be more concise while keeping the key achievement and impact.",
  achievement: "Rewrite this bullet point to focus on the achievement and result rather than just the task.",
  measurable: "Add measurable impact phrasing to this bullet point ONLY if the original text implies quantifiable results. Do NOT invent numbers.",
  ats: "Rewrite this bullet point with ATS-friendly keywords while preserving the original meaning and facts.",
};

function buildSystemPrompt(language: string): string {
  const langInstruction =
    language === "ar"
      ? "أجب باللغة العربية فقط. اكتب بأسلوب مهني وفقاً لمعايير ATS."
      : "Respond in English only. Write in a professional tone optimized for ATS systems.";

  return `You are an elite resume writer and ATS optimization specialist. ${langInstruction}

ABSOLUTE RULES:
1. NEVER invent, fabricate, or add information not present in the original text.
2. NEVER add fake metrics, percentages, dollar amounts, or team sizes.
3. NEVER add certifications, degrees, companies, or job titles not in the original.
4. ONLY improve wording, sentence structure, and add relevant ATS keywords.
5. If the original text is vague, make it clearer — but do NOT add specifics that weren't there.
6. Preserve all factual details exactly as provided (names, dates, numbers, companies).
7. If content is very short, improve it gently without inventing facts.`;
}

// ── Error response helper ───────────────────────────────────────
function errorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Enhance a single section ────────────────────────────────────
async function enhanceSingleSection(
  text: string,
  sectionType: string,
  language: string,
  apiKey: string,
): Promise<string> {
  const guidance = sectionGuidance[sectionType] || "Improve wording and add ATS keywords. Do NOT invent new information.";

  const userPrompt = `Improve this "${sectionType}" section of a resume.

SECTION-SPECIFIC GUIDANCE:
${guidance}

STRICT RULES:
- ONLY rephrase, restructure, and add ATS-relevant keywords
- NEVER fabricate metrics, achievements, certifications, or experience
- NEVER add information not present or clearly implied in the original
- Keep all original facts unchanged
- Use professional, concise language
- Use action verbs to start bullets where appropriate

ORIGINAL TEXT:
${text}

Return ONLY the improved text. No explanations, headers, or markdown formatting.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: buildSystemPrompt(language) },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 429) throw new Error("RATE_LIMIT");
    if (status === 402) throw new Error("CREDITS_EXHAUSTED");
    const t = await response.text();
    console.error(`AI error for section ${sectionType}:`, status, t);
    throw new Error("AI_ERROR");
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || text;
}

// ── Enhance a single bullet ─────────────────────────────────────
async function enhanceBullet(
  text: string,
  action: string,
  language: string,
  apiKey: string,
): Promise<string> {
  const actionPrompt = bulletActionPrompts[action] || bulletActionPrompts.improve;

  const langInstruction =
    language === "ar"
      ? "أجب باللغة العربية فقط. حافظ على اللغة العربية."
      : "Respond in English only.";

  const userPrompt = `${actionPrompt}

${langInstruction}

STRICT RULES:
- Return ONLY the improved bullet text
- No bullet character prefix (no • or -)
- No explanations, headers, or markdown
- NEVER invent facts not in the original
- Keep the same language as the original

ORIGINAL BULLET:
${text}`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: buildSystemPrompt(language) },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error("RATE_LIMIT");
    if (response.status === 402) throw new Error("CREDITS_EXHAUSTED");
    throw new Error("AI_ERROR");
  }

  const data = await response.json();
  const result = data.choices?.[0]?.message?.content?.trim() || text;
  // Remove leading bullet character if AI added one
  return result.replace(/^[•▪*\-]\s*/, "").trim();
}

// ── Main handler ────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { text, sectionType, language, batchSections, bulletText, bulletAction } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // ── BULLET MODE: enhance a single bullet point ──────────────
    if (bulletText && typeof bulletText === "string") {
      console.log(`Bullet enhancement requested: action=${bulletAction || "improve"}`);
      const improved = await enhanceBullet(
        bulletText,
        bulletAction || "improve",
        language || "en",
        LOVABLE_API_KEY,
      );
      return new Response(JSON.stringify({ improved_bullet: improved }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── BATCH MODE: enhance multiple sections independently ─────
    if (batchSections && typeof batchSections === "object") {
      console.log("Batch section enhancement requested:", Object.keys(batchSections));

      const results: Record<string, string> = {};
      const errors: Record<string, string> = {};

      for (const [section, content] of Object.entries(batchSections as Record<string, string>)) {
        if (!content || !String(content).trim()) {
          results[section] = "";
          continue;
        }

        try {
          console.log(`Enhancing section: ${section} (${String(content).length} chars)`);
          const improved = await enhanceSingleSection(
            String(content),
            section,
            language || "en",
            LOVABLE_API_KEY,
          );
          results[section] = improved;
          console.log(`Section ${section} enhanced successfully`);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Unknown error";
          console.error(`Section ${section} enhancement failed:`, errMsg);

          if (errMsg === "RATE_LIMIT") {
            return errorResponse(429, "Rate limit exceeded, please try again later.");
          }
          if (errMsg === "CREDITS_EXHAUSTED") {
            return errorResponse(402, "AI credits exhausted. Please add credits.");
          }

          errors[section] = errMsg;
          results[section] = String(content);
        }
      }

      return new Response(
        JSON.stringify({ improved_sections: results, errors: Object.keys(errors).length ? errors : undefined }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── SINGLE SECTION MODE ─────────────────────────────────────
    if (!text?.trim()) {
      return errorResponse(400, "No text provided");
    }

    const improved = await enhanceSingleSection(
      text,
      sectionType || "general",
      language || "en",
      LOVABLE_API_KEY,
    );

    return new Response(JSON.stringify({ improved_text: improved }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("improve-section error:", e);

    if (e instanceof Error) {
      if (e.message === "RATE_LIMIT") return errorResponse(429, "Rate limit exceeded, please try again later.");
      if (e.message === "CREDITS_EXHAUSTED") return errorResponse(402, "AI credits exhausted. Please add credits.");
    }

    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
