import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const toolSchema = {
  type: "function",
  function: {
    name: "submit_analysis",
    description: "Submit the complete ATS career intelligence analysis report.",
    parameters: {
      type: "object",
      properties: {
        target_role: { type: "string", description: "The target role chosen or inferred for the candidate" },
        candidate_name: { type: "string" },
        ats_score: { type: "number" },
        section_scores: {
          type: "object",
          properties: {
            resume_formatting: { type: "number" },
            keyword_optimization: { type: "number" },
            experience_quality: { type: "number" },
            career_progression: { type: "number" },
            skills_relevance: { type: "number" },
            education_strength: { type: "number" },
            contact_information_quality: { type: "number" },
          },
          required: ["resume_formatting", "keyword_optimization", "experience_quality", "career_progression", "skills_relevance", "education_strength", "contact_information_quality"],
        },
        executive_summary: {
          type: "object",
          properties: {
            candidate_level: { type: "string", enum: ["junior", "mid", "senior", "executive"] },
            summary_paragraphs: { type: "string", description: "1-3 paragraphs of executive assessment" },
            best_fit_roles: { type: "array", items: { type: "string" } },
            top_strengths: { type: "array", items: { type: "string" } },
            main_risks: { type: "array", items: { type: "string" } },
          },
          required: ["candidate_level", "summary_paragraphs", "best_fit_roles", "top_strengths", "main_risks"],
        },
        ats_breakdown: {
          type: "object",
          properties: {
            formatting: { type: "object", properties: { score: { type: "number" }, current_state: { type: "string" }, problem: { type: "string" }, recommended_improvement: { type: "string" } }, required: ["score", "current_state", "problem", "recommended_improvement"] },
            sections: { type: "object", properties: { score: { type: "number" }, current_state: { type: "string" }, problem: { type: "string" }, recommended_improvement: { type: "string" } }, required: ["score", "current_state", "problem", "recommended_improvement"] },
            keywords: { type: "object", properties: { score: { type: "number" }, current_state: { type: "string" }, problem: { type: "string" }, recommended_improvement: { type: "string" } }, required: ["score", "current_state", "problem", "recommended_improvement"] },
            experience: { type: "object", properties: { score: { type: "number" }, current_state: { type: "string" }, problem: { type: "string" }, recommended_improvement: { type: "string" } }, required: ["score", "current_state", "problem", "recommended_improvement"] },
            education: { type: "object", properties: { score: { type: "number" }, current_state: { type: "string" }, problem: { type: "string" }, recommended_improvement: { type: "string" } }, required: ["score", "current_state", "problem", "recommended_improvement"] },
            skills: { type: "object", properties: { score: { type: "number" }, current_state: { type: "string" }, problem: { type: "string" }, recommended_improvement: { type: "string" } }, required: ["score", "current_state", "problem", "recommended_improvement"] },
            contact_info: { type: "object", properties: { score: { type: "number" }, current_state: { type: "string" }, problem: { type: "string" }, recommended_improvement: { type: "string" } }, required: ["score", "current_state", "problem", "recommended_improvement"] },
          },
          required: ["formatting", "sections", "keywords", "experience", "education", "skills", "contact_info"],
        },
        recruiter_analysis: {
          type: "object",
          properties: {
            first_impression: { type: "object", properties: { score: { type: "number" }, comment: { type: "string" } }, required: ["score", "comment"] },
            career_clarity: { type: "object", properties: { score: { type: "number" }, comment: { type: "string" } }, required: ["score", "comment"] },
            achievement_strength: { type: "object", properties: { score: { type: "number" }, comment: { type: "string" } }, required: ["score", "comment"] },
            role_alignment: { type: "object", properties: { score: { type: "number" }, comment: { type: "string" } }, required: ["score", "comment"] },
            professional_presentation: { type: "object", properties: { score: { type: "number" }, comment: { type: "string" } }, required: ["score", "comment"] },
          },
          required: ["first_impression", "career_clarity", "achievement_strength", "role_alignment", "professional_presentation"],
        },
        career_recommendations: {
          type: "object",
          properties: {
            top_roles: { type: "array", items: { type: "object", properties: { role: { type: "string" }, why_it_fits: { type: "string" } }, required: ["role", "why_it_fits"] } },
            skills_to_improve: { type: "array", items: { type: "string" } },
            thirty_sixty_ninety_day_plan: { type: "object", properties: { thirty_days: { type: "string" }, sixty_days: { type: "string" }, ninety_days: { type: "string" } }, required: ["thirty_days", "sixty_days", "ninety_days"] },
            certifications_recommended: { type: "array", items: { type: "string" } },
            linkedin_improvements: { type: "string", description: "LinkedIn/Portfolio improvement suggestions if applicable" },
          },
          required: ["top_roles", "skills_to_improve", "thirty_sixty_ninety_day_plan", "certifications_recommended"],
        },
        salary_estimation: {
          type: "object",
          properties: {
            salary_table: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  role: { type: "string" },
                  monthly_range_low: { type: "number" },
                  monthly_range_high: { type: "number" },
                  when_upper_range: { type: "string" },
                  notes: { type: "string" },
                },
                required: ["role", "monthly_range_low", "monthly_range_high", "when_upper_range", "notes"],
              },
            },
            offer_range_low: { type: "number" },
            offer_range_high: { type: "number" },
            negotiation_target: { type: "number" },
            anchor: { type: "number" },
            walk_away: { type: "number" },
          },
          required: ["salary_table", "offer_range_low", "offer_range_high", "negotiation_target", "anchor", "walk_away"],
        },
        resume_rewrite: {
          type: "object",
          properties: {
            full_resume: { type: "string", description: "Complete ATS-friendly rewritten resume in English with proper formatting using markdown" },
          },
          required: ["full_resume"],
        },
        quick_improvements: {
          type: "array",
          items: {
            type: "object",
            properties: {
              priority: { type: "string", enum: ["high", "medium", "low"] },
              description: { type: "string" },
              action_step: { type: "string" },
            },
            required: ["priority", "description", "action_step"],
          },
        },
        interview_questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              suggested_answer_direction: { type: "string", description: "3-5 line answer idea" },
            },
            required: ["question", "suggested_answer_direction"],
          },
        },
      },
      required: ["target_role", "candidate_name", "ats_score", "section_scores", "executive_summary", "ats_breakdown", "recruiter_analysis", "career_recommendations", "salary_estimation", "resume_rewrite", "quick_improvements", "interview_questions"],
      additionalProperties: false,
    },
  },
};

function buildPrompt(resumeText: string, language: string) {
  const langInstruction = language === "ar"
    ? "أجب باللغة العربية فقط لكل الأقسام ما عدا قسم إعادة كتابة السيرة الذاتية (resume_rewrite) فيجب أن يكون بالإنجليزية فقط."
    : "Respond in English for all sections. The resume_rewrite must always be in English.";

  const today = new Date().toISOString().split("T")[0];

  const systemPrompt = `You are an elite Recruitment Manager and ATS specialist with 15+ years of experience in the global job market. ${langInstruction}

TODAY'S DATE: ${today}. Use this as reference for all date calculations (experience duration, career gaps, graduation recency, etc.).

CRITICAL RULES:
- Never invent candidate information. If something is missing, write "[Required]" or "[Please confirm]".
- If you find date conflicts or career gaps, mention them as a brief note + suggest professional wording (without inventing reasons).
- All scores must be 0-100.
- All salary figures in SAR (monthly).
- Be specific and actionable — avoid generalities.
- Never mention "keyword map" or any equivalent.
- Never add a section about "recommended sectors/companies" or any similar heading.
- The resume_rewrite.full_resume must ALWAYS be in English only, using action verbs, STAR format, quantified achievements, and ATS-friendly keywords.
- For interview_questions, provide 8-12 questions with 3-5 line answer directions each.
- For quick_improvements, provide 10-15 items in imperative form ("Do X").
- When calculating years of experience, use today's date (${today}) as the end date.`;

  const userPrompt = `Perform a comprehensive ATS career intelligence analysis on this resume for the global job market.

If no target job description is provided, choose a suitable target role based on the candidate's level and specialization in the global job market, and include it as target_role.

Resume Text:
${resumeText}

Analyze ALL of the following and return via the tool call:

1. TARGET ROLE: Infer the best target role for the global job market.

2. EXECUTIVE SUMMARY (1-3 paragraphs): Quick assessment of candidate level, best-fit roles, top 3 strengths, top 3 hiring risks/gaps.

3. ATS SCORE (0-100) with section scores for: resume_formatting, keyword_optimization, experience_quality, career_progression, skills_relevance, education_strength, contact_information_quality.

4. ATS BREAKDOWN for each section (formatting, sections, keywords, experience, education, skills, contact_info): score (0-100), current_state, problem, recommended_improvement.

5. RECRUITER ANALYSIS (score 0-100 for each): first_impression, career_clarity, achievement_strength, role_alignment, professional_presentation — each with score + practical comment.

6. CAREER RECOMMENDATIONS for the global job market: top 3-5 roles with why_it_fits, skills_to_improve, 30/60/90 day plan (concise & practical), certifications recommended, LinkedIn/portfolio improvements if needed. Do NOT include recommended sectors/companies.

7. SALARY ESTIMATION (SAR monthly):
   - salary_table: For the target role + 2-3 related roles, provide: role, monthly_range_low, monthly_range_high, when_upper_range (when does candidate get the high end), notes (city/sector/allowances).
   - Candidate-specific: offer_range_low, offer_range_high, negotiation_target, anchor (opening number), walk_away (minimum acceptance).
   - Note these are general market estimates.

8. RESUME REWRITE (English only): Complete ATS-friendly resume rewrite in markdown format. Sections: Header, Professional Summary, Key Skills, Experience (STAR format with numbers), Education, Certifications, Projects (if any), Languages. Never invent info.

9. QUICK IMPROVEMENTS: 10-15 items ordered by priority (high/medium/low), imperative form, specific and actionable.

10. INTERVIEW QUESTIONS: 8-12 questions related to the target role, each with a 3-5 line suggested answer direction.`;

  return { systemPrompt, userPrompt };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { resumeText, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { systemPrompt, userPrompt } = buildPrompt(resumeText, language || "en");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [toolSchema],
        tool_choice: { type: "function", function: { name: "submit_analysis" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;
    const toolCall = message?.tool_calls?.[0];
    
    let analysis;
    if (toolCall) {
      analysis = JSON.parse(toolCall.function.arguments);
    } else if (message?.content) {
      // Fallback: try to parse JSON from content
      console.log("No tool call, attempting to parse content as JSON");
      const content = message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No tool call and no parseable JSON in response");
      }
    } else {
      throw new Error("No tool call or content in response");
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-resume error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
