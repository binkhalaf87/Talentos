import { useState, useEffect, useMemo } from "react";
import { deductPoints, getPointsBalance, SERVICE_COSTS, hasFreeAnalysis, markFreeAnalysisUsed } from "@/lib/points";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Upload,
  FileText,
  ArrowLeft,
  Loader2,
  Target,
  Briefcase,
  TrendingUp,
  DollarSign,
  Sparkles,
  ListChecks,
  Eye,
  CheckCircle2,
  Wand2,
  ChevronRight,
  BarChart3,
  PenSquare,
  Download,
  Save,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getStoredResumeData } from "@/hooks/useUserResume";
import {
  ScoreBar,
  BreakdownCard,
  RecruiterItem,
  QuickImprovement,
  InterviewQuestion,
} from "@/components/analysis/AnalysisCards";

interface SalaryTableRow {
  role: string;
  monthly_range_low: number;
  monthly_range_high: number;
  when_upper_range: string;
  notes: string;
}

interface FullAnalysis {
  target_role: string;
  candidate_name: string;
  ats_score: number;
  section_scores: Record<string, number>;
  executive_summary: {
    candidate_level: string;
    summary_paragraphs: string;
    best_fit_roles: string[];
    top_strengths: string[];
    main_risks: string[];
  };
  ats_breakdown: Record<
    string,
    {
      score: number;
      current_state: string;
      problem: string;
      recommended_improvement: string;
    }
  >;
  recruiter_analysis: Record<string, { score: number; comment: string }>;
  career_recommendations: {
    top_roles: { role: string; why_it_fits: string }[];
    skills_to_improve: string[];
    thirty_sixty_ninety_day_plan: {
      thirty_days: string;
      sixty_days: string;
      ninety_days: string;
    };
    certifications_recommended: string[];
    linkedin_improvements?: string;
  };
  salary_estimation: {
    salary_table: SalaryTableRow[];
    offer_range_low: number;
    offer_range_high: number;
    negotiation_target: number;
    anchor: number;
    walk_away: number;
  };
  resume_rewrite: { full_resume: string };
  quick_improvements: { priority: string; description: string; action_step: string }[];
  interview_questions: { question: string; suggested_answer_direction: string }[];
}

type AnalysisStage = "uploading" | "extracting" | "analyzing" | "preparing" | "done";

const stageConfig: Record<AnalysisStage, { en: string; ar: string; progress: number }> = {
  uploading: { en: "Uploading your resume...", ar: "جارٍ رفع السيرة الذاتية...", progress: 10 },
  extracting: { en: "Extracting text from document...", ar: "جارٍ استخراج النص من المستند...", progress: 30 },
  analyzing: {
    en: "Running AI analysis (this may take a minute)...",
    ar: "جارٍ التحليل بالذكاء الاصطناعي (قد يستغرق دقيقة)...",
    progress: 55,
  },
  preparing: { en: "Preparing your report...", ar: "جارٍ إعداد التقرير...", progress: 90 },
  done: { en: "Analysis complete!", ar: "اكتمل التحليل!", progress: 100 },
};

const allStages: AnalysisStage[] = ["uploading", "extracting", "analyzing", "preparing", "done"];

const EMPTY_ANALYSIS: FullAnalysis = {
  target_role: "",
  candidate_name: "",
  ats_score: 0,
  section_scores: {},
  executive_summary: {
    candidate_level: "",
    summary_paragraphs: "",
    best_fit_roles: [],
    top_strengths: [],
    main_risks: [],
  },
  ats_breakdown: {},
  recruiter_analysis: {},
  career_recommendations: {
    top_roles: [],
    skills_to_improve: [],
    thirty_sixty_ninety_day_plan: {
      thirty_days: "",
      sixty_days: "",
      ninety_days: "",
    },
    certifications_recommended: [],
    linkedin_improvements: "",
  },
  salary_estimation: {
    salary_table: [],
    offer_range_low: 0,
    offer_range_high: 0,
    negotiation_target: 0,
    anchor: 0,
    walk_away: 0,
  },
  resume_rewrite: { full_resume: "" },
  quick_improvements: [],
  interview_questions: [],
};

const Analysis = () => {
  const [analyzing, setAnalyzing] = useState(false);
  const [stage, setStage] = useState<AnalysisStage>("uploading");
  const [result, setResult] = useState<FullAnalysis | null>(null);
  const [lastAnalysisId, setLastAnalysisId] = useState<string | null>(null);
  const [reportLanguage, setReportLanguage] = useState<"ar" | "en">("ar");
  const [autoAnalyzeFailed, setAutoAnalyzeFailed] = useState(false);
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const reviewAnalysisId = searchParams.get("review");
  const resumeId = searchParams.get("id");
  const analysisRunKey = `${resumeId ?? ""}:${reviewAnalysisId ?? ""}`;

  const hasText = (value?: string | null) => !!String(value || "").trim();
  const hasArray = (value?: unknown[]) => Array.isArray(value) && value.length > 0;
  const hasObject = (value?: Record<string, any> | null) =>
    !!value && typeof value === "object" && Object.keys(value).length > 0;

  const buildEnhanceUrl = (focus?: string) => {
    const params = new URLSearchParams();

    if (lastAnalysisId) params.set("analysis", lastAnalysisId);
    if (focus) params.set("focus", focus);

    const query = params.toString();
    return query ? `/enhance?${query}` : "/enhance";
  };

  const reconstructStoredResult = (existing: Record<string, unknown>): FullAnalysis => {
    const payload =
      existing?.full_analysis || existing?.analysis_payload || existing?.result_json || existing?.raw_result || null;

    if (payload && typeof payload === "object") {
      return {
        ...EMPTY_ANALYSIS,
        ...payload,
        executive_summary: {
          ...EMPTY_ANALYSIS.executive_summary,
          ...(payload.executive_summary || {}),
        },
        career_recommendations: {
          ...EMPTY_ANALYSIS.career_recommendations,
          ...(payload.career_recommendations || {}),
          thirty_sixty_ninety_day_plan: {
            ...EMPTY_ANALYSIS.career_recommendations.thirty_sixty_ninety_day_plan,
            ...(payload.career_recommendations?.thirty_sixty_ninety_day_plan || {}),
          },
        },
        salary_estimation: {
          ...EMPTY_ANALYSIS.salary_estimation,
          ...(payload.salary_estimation || {}),
        },
        resume_rewrite: {
          ...EMPTY_ANALYSIS.resume_rewrite,
          ...(payload.resume_rewrite || {}),
        },
      };
    }

    return {
      ...EMPTY_ANALYSIS,
      target_role: existing?.target_role || "",
      candidate_name: existing?.candidate_name || "",
      ats_score: existing?.overall_score || 0,
      section_scores: (existing?.section_scores as Record<string, number>) || {},
      executive_summary: {
        ...EMPTY_ANALYSIS.executive_summary,
        top_strengths: existing?.strengths || [],
        main_risks: existing?.weaknesses || [],
      },
      quick_improvements: (existing?.suggestions || []).map((s: string) => ({
        priority: "",
        description: s,
        action_step: "",
      })),
    };
  };

  useEffect(() => {
    setAutoAnalyzeFailed(false);
  }, [analysisRunKey]);

  useEffect(() => {
    if ((!resumeId && !reviewAnalysisId) || !user || analyzing || result || autoAnalyzeFailed) return;

    const autoAnalyze = async () => {
      try {
        if (reviewAnalysisId) {
          const { data: selectedAnalysis, error } = await supabase
            .from("analyses")
            .select("*")
            .eq("id", reviewAnalysisId)
            .eq("user_id", user.id)
            .single();

          if (error || !selectedAnalysis) {
            toast.error(language === "ar" ? "لم يتم العثور على التحليل" : "Analysis not found");
            setAutoAnalyzeFailed(true);
            return;
          }

          setLastAnalysisId(selectedAnalysis.id);
          setResult(reconstructStoredResult(selectedAnalysis));
          toast.success(language === "ar" ? "تم تحميل التحليل" : "Analysis loaded");
          return;
        }

        if (!resumeId) return;

        const { data: existingAnalysis } = await supabase
          .from("analyses")
          .select("*")
          .eq("resume_id", resumeId)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (existingAnalysis && existingAnalysis.length > 0) {
          const existing = existingAnalysis[0];

          // Check if resume was updated after the analysis
          const { data: resumeMeta } = await supabase
            .from("resumes")
            .select("updated_at")
            .eq("id", resumeId)
            .single();

          const resumeUpdated = resumeMeta?.updated_at ? new Date(resumeMeta.updated_at) : null;
          const analysisCreated = new Date(existing.created_at);

          if (!resumeUpdated || resumeUpdated <= analysisCreated) {
            // Resume hasn't changed — load cached analysis
            setLastAnalysisId(existing.id);
            setResult(reconstructStoredResult(existing));
            toast.success(language === "ar" ? "تم تحميل التحليل السابق" : "Previous analysis loaded");
            return;
          }
          // Resume was updated after last analysis — continue to re-analyze
        }

        const { data: resume, error: resumeError } = await supabase
          .from("resumes")
          .select("*")
          .eq("id", resumeId)
          .eq("user_id", user.id)
          .single();

        if (resumeError || !resume) {
          toast.error(language === "ar" ? "لم يتم العثور على السيرة الذاتية" : "Resume not found");
          setAutoAnalyzeFailed(true);
          return;
        }

        let extractedText = resume.extracted_text || "";

        // Try to load from stored user_resumes first (no AI cost)
        if (!extractedText || extractedText.length < 30) {
          const storedResume = await getStoredResumeData(user.id, resumeId);
          if (storedResume?.raw_resume_text && storedResume.raw_resume_text.length >= 30) {
            extractedText = storedResume.raw_resume_text;
          }
        }

        // Fallback: extract from file (deterministic, no AI)
        if (!extractedText || extractedText.length < 30) {
          setAnalyzing(true);
          setStage("extracting");

          const { data: fileData } = await supabase.storage.from("resumes").download(resume.file_path);
          if (!fileData) {
            toast.error(language === "ar" ? "فشل تحميل الملف" : "Failed to download file");
            setAutoAnalyzeFailed(true);
            return;
          }

          const formData = new FormData();
          formData.append(
            "file",
            new File([fileData], resume.file_name, { type: resume.file_type || "application/pdf" }),
          );

          const { data: extractData, error: extractError } = await supabase.functions.invoke("extract-text", {
            body: formData,
          });

          if (extractError) throw extractError;

          extractedText = extractData.text || "";
          const detectedLang = extractData.language || "en";

          await supabase
            .from("resumes")
            .update({ extracted_text: extractedText, language: detectedLang })
            .eq("id", resumeId);
        }

        if (extractedText.length < 30) {
          toast.error(language === "ar" ? "لم يتم استخراج نص كافٍ" : "Not enough text extracted");
          setAutoAnalyzeFailed(true);
          return;
        }

        // Check if user has free analysis available or enough points
        const freeAvailable = await hasFreeAnalysis(user.id);
        if (!freeAvailable) {
          const balance = await getPointsBalance(user.id);
          if (balance < SERVICE_COSTS.analysis) {
            toast.error(language === "ar" ? "رصيدك لا يكفي. يرجى شراء نقاط إضافية." : "Insufficient points. Please buy more points.");
            setAutoAnalyzeFailed(true);
            return;
          }
        }

        setAnalyzing(true);
        setStage("analyzing");

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const session = await supabase.auth.getSession();
        const accessToken = session.data.session?.access_token || supabaseKey;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000);

        const analyzeResponse = await fetch(`${supabaseUrl}/functions/v1/analyze-resume`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: supabaseKey,
          },
          body: JSON.stringify({ resumeText: extractedText, language: reportLanguage }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!analyzeResponse.ok) {
          const errText = await analyzeResponse.text();
          let errMessage = errText || "Analysis failed";

          try {
            const parsed = JSON.parse(errText);
            errMessage = parsed?.error || errMessage;
          } catch {
            // keep raw text
          }

          throw new Error(analyzeResponse.status === 429 ? "Rate limit exceeded" : errMessage);
        }

        const analysisData = await analyzeResponse.json();
        if (analysisData.error) throw new Error(analysisData.error);

        // Deduct points ONLY after successful AI analysis (or mark free analysis used)
        if (freeAvailable) {
          await markFreeAnalysisUsed(user.id);
        } else {
          const pointResult = await deductPoints(user.id, "analysis", "CV Analysis");
          if (!pointResult.success) {
            toast.error(language === "ar" ? "رصيدك لا يكفي. يرجى شراء نقاط إضافية." : "Insufficient points. Please buy more points.");
            setAutoAnalyzeFailed(true);
            return;
          }
        }

        setStage("preparing");

        const insertPayload: Record<string, unknown> = {
          user_id: user.id,
          resume_id: resumeId,
          overall_score: analysisData.ats_score || 0,
          section_scores: analysisData.section_scores || {},
          strengths: analysisData.executive_summary?.top_strengths || [],
          weaknesses: analysisData.executive_summary?.main_risks || [],
          suggestions: analysisData.quick_improvements?.map((q: {description: string}) => q.description) || [],
          language: reportLanguage,
          full_analysis: analysisData,
        };

        const { data: analysisRow } = await supabase.from("analyses").insert(insertPayload).select("id").single();

        if (analysisRow) setLastAnalysisId(analysisRow.id);

        setStage("done");
        await new Promise((r) => setTimeout(r, 600));
        setResult({
          ...EMPTY_ANALYSIS,
          ...analysisData,
          executive_summary: {
            ...EMPTY_ANALYSIS.executive_summary,
            ...(analysisData.executive_summary || {}),
          },
          career_recommendations: {
            ...EMPTY_ANALYSIS.career_recommendations,
            ...(analysisData.career_recommendations || {}),
            thirty_sixty_ninety_day_plan: {
              ...EMPTY_ANALYSIS.career_recommendations.thirty_sixty_ninety_day_plan,
              ...(analysisData.career_recommendations?.thirty_sixty_ninety_day_plan || {}),
            },
          },
          salary_estimation: {
            ...EMPTY_ANALYSIS.salary_estimation,
            ...(analysisData.salary_estimation || {}),
          },
          resume_rewrite: {
            ...EMPTY_ANALYSIS.resume_rewrite,
            ...(analysisData.resume_rewrite || {}),
          },
        });
        toast.success(t.analysis.analysisComplete);
      } catch (err: unknown) {
        console.error("Auto-analysis error:", err);
        if (err.name === "AbortError") {
          toast.error(language === "ar" ? "انتهت المهلة" : "Request timed out");
        } else {
          toast.error(err.message || t.common.error);
        }
        setAutoAnalyzeFailed(true);
      } finally {
        setAnalyzing(false);
      }
    };

    autoAnalyze();
  }, [user, resumeId, reviewAnalysisId, analyzing, result, language, t, reportLanguage, autoAnalyzeFailed]);

  const sectionScoreLabels: Record<string, string> = {
    resume_formatting: t.analysis.formatting,
    keyword_optimization: t.analysis.keywords,
    experience_quality: t.analysis.experience,
    career_progression: t.analysis.careerProgression,
    skills_relevance: t.analysis.skills,
    education_strength: t.analysis.education,
    contact_information_quality: t.analysis.contactInfo,
  };

  const breakdownLabels: Record<string, string> = {
    formatting: t.analysis.formatting,
    sections: t.analysis.sections,
    keywords: t.analysis.keywords,
    experience: t.analysis.experience,
    education: t.analysis.education,
    skills: t.analysis.skills,
    contact_info: t.analysis.contactInfo,
  };

  const recruiterLabels: Record<string, string> = {
    first_impression: t.analysis.firstImpression,
    career_clarity: t.analysis.careerClarity,
    achievement_strength: t.analysis.achievementStrength,
    role_alignment: t.analysis.roleAlignment,
    professional_presentation: t.analysis.professionalPresentation,
  };

  // ── Load user's resumes for picker ──────────────────────────────────────
  const [userResumes, setUserResumes] = useState<{ id: string; file_name: string; created_at: string }[]>([]);
  const [loadingResumes, setLoadingResumes] = useState(false);

  useEffect(() => {
    if (!user || result || analyzing) return;
    if (resumeId || reviewAnalysisId) return; // auto-analyze will handle it

    let isActive = true;

    const loadResumes = async () => {
      setLoadingResumes(true);

      const timeoutId = setTimeout(() => {
        if (isActive) {
          setLoadingResumes(false);
          toast.error(language === "ar" ? "انتهت مهلة تحميل السير الذاتية" : "Resumes loading timed out");
        }
      }, 12000);

      try {
        const { data, error } = await supabase
          .from("resumes")
          .select("id, file_name, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (isActive) setUserResumes(data || []);
      } catch (err) {
        console.error("Load resumes error:", err);
        if (isActive) {
          toast.error(language === "ar" ? "تعذر تحميل السير الذاتية" : "Failed to load resumes");
        }
      } finally {
        clearTimeout(timeoutId);
        if (isActive) setLoadingResumes(false);
      }
    };

    loadResumes();

    return () => {
      isActive = false;
    };
  }, [user, result, analyzing, resumeId, reviewAnalysisId, language]);

  const handleExportPDF = () => {
    window.print();
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-primary";
    if (score >= 40) return "text-amber-600";
    return "text-destructive";
  };

  const barColor = (score: number) => {
    if (score >= 80) return "bg-success";
    if (score >= 60) return "bg-primary";
    if (score >= 40) return "bg-amber-500";
    return "bg-destructive";
  };

  const today = new Date().toLocaleDateString(language === "ar" ? "ar-SA" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const overallStatus = useMemo(() => {
    if (!result) return null;

    if (result.ats_score >= 85) {
      return {
        tone: "success",
        title: language === "ar" ? "سيرة قوية وجاهزة للمنافسة" : "Strong interview-ready resume",
        description:
          language === "ar"
            ? "سيرتك جيدة جداً، وتحتاج فقط تحسينات خفيفة قبل التقديم."
            : "Your resume is strong and only needs light refinement before applying.",
      };
    }

    if (result.ats_score >= 70) {
      return {
        tone: "primary",
        title: language === "ar" ? "أساس جيد لكنه يحتاج تحسينات موجهة" : "Good foundation, needs targeted improvements",
        description:
          language === "ar"
            ? "سيرتك فيها أساس ممتاز، لكن رفع بعض الأقسام سيزيد فرص المقابلة بشكل واضح."
            : "Your resume has a solid base, but improving a few sections should increase interview chances.",
      };
    }

    return {
      tone: "destructive",
      title: language === "ar" ? "تحتاج إعادة صياغة وتحسين قبل التقديم" : "Needs major optimization before applying",
      description:
        language === "ar"
          ? "يفضل معالجة النقاط الضعيفة أولاً قبل إرسال السيرة للوظائف."
          : "It is better to fix the weak areas first before sending this resume to employers.",
    };
  }, [result, language]);

  const sectionFocusMap: Record<string, string> = {
    resume_formatting: "contactInfo",
    keyword_optimization: "skills",
    experience_quality: "workExperience",
    career_progression: "workExperience",
    skills_relevance: "skills",
    education_strength: "education",
    contact_information_quality: "contactInfo",
    formatting: "contactInfo",
    sections: "professionalSummary",
    keywords: "skills",
    experience: "workExperience",
    education: "education",
    skills: "skills",
    contact_info: "contactInfo",
  };

  const lowScoreSections = useMemo(() => {
    if (!result?.section_scores) return [];

    return Object.entries(result.section_scores)
      .sort((a, b) => (a[1] as number) - (b[1] as number))
      .slice(0, 3)
      .map(([key, score]) => ({
        key,
        score: score as number,
        label: sectionScoreLabels[key] || key,
        focus: sectionFocusMap[key] || "professionalSummary",
      }));
  }, [result, sectionScoreLabels]);

  const priorityFixes = useMemo(() => {
    if (!result) return [];

    const fromQuick = (result.quick_improvements || [])
      .filter((item) => hasText(item.description) || hasText(item.action_step))
      .slice(0, 3)
      .map((item, index) => ({
        id: `quick-${index}`,
        title: item.description,
        action: item.action_step,
        focus: index === 0 ? "professionalSummary" : index === 1 ? "workExperience" : "skills",
        priority: item.priority || "medium",
      }));

    if (fromQuick.length > 0) return fromQuick;

    const fromRisks = (result.executive_summary?.main_risks || [])
      .filter((risk) => hasText(risk))
      .slice(0, 3)
      .map((risk, index) => ({
        id: `risk-${index}`,
        title: risk,
        action:
          language === "ar" ? "انتقل للمحرر الذكي لمعالجة هذه النقطة." : "Open the AI editor to address this issue.",
        focus:
          index === 0
            ? "professionalSummary"
            : index === 1
              ? "workExperience"
              : index === 2
                ? "skills"
                : "professionalSummary",
        priority: "high",
      }));

    if (fromRisks.length > 0) return fromRisks;

    return lowScoreSections.map((section, index) => ({
      id: `section-${index}`,
      title: language === "ar" ? `تحسين قسم ${section.label}` : `Improve ${section.label}`,
      action:
        language === "ar"
          ? "ابدأ بهذا القسم لأنه من أقل الأقسام تقييماً."
          : "Start here because this is one of your lowest scoring sections.",
      focus: section.focus,
      priority: "high",
    }));
  }, [result, lowScoreSections, language]);

  const transformationPreview = useMemo(() => {
    const firstQuick = result?.quick_improvements?.find(
      (item) => hasText(item.description) || hasText(item.action_step),
    );

    if (!firstQuick) {
      return {
        before:
          language === "ar"
            ? "وصف عام أو مختصر لا يوضح القيمة الحقيقية للمرشح."
            : "Generic wording that does not clearly show the candidate's value.",
        after:
          language === "ar"
            ? "صياغة أقوى توضح الإنجازات والملاءمة الوظيفية بكلمات احترافية مناسبة لأنظمة ATS."
            : "Stronger wording that highlights achievements and role fit using ATS-friendly language.",
      };
    }

    return {
      before: firstQuick.description,
      after:
        firstQuick.action_step ||
        (language === "ar"
          ? "سيتم تحسين هذا الجزء داخل المحرر الذكي."
          : "This part will be improved inside the smart editor."),
    };
  }, [result, language]);

  const flowSteps = [
    {
      label: language === "ar" ? "رفع السيرة" : "Upload Resume",
      active: true,
      icon: FileText,
    },
    {
      label: language === "ar" ? "تحليل بالذكاء الاصطناعي" : "AI Analysis",
      active: true,
      icon: BarChart3,
    },
    {
      label: language === "ar" ? "تحسين السيرة" : "Fix Resume",
      active: !!result,
      icon: PenSquare,
    },
    {
      label: language === "ar" ? "النسخة النهائية" : "Final Resume",
      active: false,
      icon: Download,
    },
  ];

  const hasBreakdown = hasObject(result?.ats_breakdown || null);
  const hasCareer =
    !!result?.career_recommendations &&
    (hasArray(result.career_recommendations.top_roles) ||
      hasArray(result.career_recommendations.skills_to_improve) ||
      hasArray(result.career_recommendations.certifications_recommended) ||
      hasText(result.career_recommendations.linkedin_improvements) ||
      hasText(result.career_recommendations.thirty_sixty_ninety_day_plan?.thirty_days) ||
      hasText(result.career_recommendations.thirty_sixty_ninety_day_plan?.sixty_days) ||
      hasText(result.career_recommendations.thirty_sixty_ninety_day_plan?.ninety_days));

  const hasSalary =
    !!result?.salary_estimation &&
    (hasArray(result.salary_estimation.salary_table) ||
      result.salary_estimation.offer_range_low > 0 ||
      result.salary_estimation.offer_range_high > 0 ||
      result.salary_estimation.negotiation_target > 0 ||
      result.salary_estimation.anchor > 0 ||
      result.salary_estimation.walk_away > 0);

  const hasRecruiterAnalysis = hasObject(result?.recruiter_analysis || null);
  const hasQuickImprovements = hasArray(
    result?.quick_improvements?.filter((item) => hasText(item.description) || hasText(item.action_step)) || [],
  );
  const hasInterviewQuestions = hasArray(
    result?.interview_questions?.filter((q) => hasText(q.question) || hasText(q.suggested_answer_direction)) || [],
  );

  const handleCancelAnalysis = () => {
    setAnalyzing(false);
    setStage("uploading");
    setAutoAnalyzeFailed(true);
  };

  const analysisDialog = (
    <Dialog open={analyzing} onOpenChange={(open) => { if (!open) handleCancelAnalysis(); }}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        {(() => {
          const currentConfig = stageConfig[stage];
          const currentIdx = allStages.indexOf(stage);
          return (
            <div className="space-y-6 text-center py-4">
              <motion.div
                key={stage}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                {stage === "done" ? (
                  <CheckCircle2 size={48} className="mx-auto text-success" />
                ) : (
                  <Loader2 size={48} className="mx-auto text-primary animate-spin" />
                )}
              </motion.div>

              <AnimatePresence mode="wait">
                <motion.p
                  key={stage}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-lg font-display font-semibold text-foreground"
                >
                  {language === "ar" ? currentConfig.ar : currentConfig.en}
                </motion.p>
              </AnimatePresence>

              <div className="space-y-2">
                <Progress value={currentConfig.progress} className="h-2.5" />
                <p className="text-xs text-muted-foreground font-body">{currentConfig.progress}%</p>
              </div>

              <div className="space-y-2 text-start">
                {allStages.slice(0, -1).map((s, i) => {
                  const isDone = i < currentIdx;
                  const isCurrent = i === currentIdx;
                  const cfg = stageConfig[s];
                  return (
                    <motion.div
                      key={s}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                        isCurrent ? "bg-primary/10 text-primary" : isDone ? "text-success" : "text-muted-foreground/50"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 size={16} className="shrink-0" />
                      ) : isCurrent ? (
                        <Loader2 size={16} className="shrink-0 animate-spin" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-current shrink-0" />
                      )}
                      <span className="text-sm font-body">{language === "ar" ? cfg.ar : cfg.en}</span>
                    </motion.div>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground font-body">{t.analysis.analyzingSubtext}</p>

              <Button variant="outline" onClick={handleCancelAnalysis} className="mt-2">
                {language === "ar" ? "إلغاء" : "Cancel"}
              </Button>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
  );

  if (!result) {
    return (
      <div className="min-h-screen bg-background">
        {analysisDialog}
        <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur">
          <div className="container flex items-center gap-4 h-16">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/dashboard">
                <ArrowLeft size={18} />
              </Link>
            </Button>
            <Link to="/dashboard" className="font-display text-lg font-bold text-foreground">
              TALEN<span className="text-primary">TRY</span>
            </Link>
            <span className="text-border/60 hidden sm:inline">/</span>
            <h1 className="font-display font-semibold text-foreground text-sm hidden sm:block">{t.analysis.title}</h1>
          </div>
        </header>

        <main className="container py-8 md:py-12 max-w-3xl">
          <div className="text-center space-y-6">
            <FileText size={48} className="mx-auto text-muted-foreground" />
            <h2 className="text-xl font-display font-semibold text-foreground">
              {language === "ar" ? "اختر سيرة ذاتية لتحليلها" : "Select a Resume to Analyze"}
            </h2>
            <p className="text-sm text-muted-foreground font-body">
              {language === "ar"
                ? "اختر سيرة ذاتية من الملفات المرفوعة في لوحة التحكم"
                : "Choose a resume from your uploaded files in the Dashboard"}
            </p>

            {loadingResumes ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : userResumes.length === 0 ? (
              <div className="space-y-4 py-8">
                <p className="text-muted-foreground text-sm">
                  {language === "ar" ? "لا توجد سير ذاتية مرفوعة بعد." : "No resumes uploaded yet."}
                </p>
                <Button onClick={() => navigate("/dashboard")}>
                  {language === "ar" ? "ارفع سيرة ذاتية من لوحة التحكم" : "Upload a resume from Dashboard"}
                </Button>
              </div>
            ) : (
              <div className="max-w-lg mx-auto space-y-5">
                {/* Report Language Selector */}
                <div className="flex items-center justify-center gap-3 p-3 rounded-xl border border-border bg-card">
                  <span className="text-sm font-medium text-muted-foreground">
                    {language === "ar" ? "لغة التقرير:" : "Report Language:"}
                  </span>
                  <div className="flex gap-1 bg-secondary rounded-lg p-1">
                    <button
                      onClick={() => setReportLanguage("ar")}
                      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                        reportLanguage === "ar"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      العربية
                    </button>
                    <button
                      onClick={() => setReportLanguage("en")}
                      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                        reportLanguage === "en"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      English
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 text-start">
                  {userResumes.map((resume) => (
                    <button
                      key={resume.id}
                      onClick={() => navigate(`/analysis?id=${resume.id}`)}
                      className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all text-start w-full"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                        <FileText size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{resume.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(resume.created_at).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US", {
                            year: "numeric", month: "short", day: "numeric"
                          })}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {analysisDialog}
      <style>{`
        @media print {
          header,
          button,
          input,
          label {
            display: none !important;
          }

          body {
            background: white !important;
          }

          #analysis-report {
            max-width: 100% !important;
            padding: 0 !important;
          }

          .shadow-sm,
          .hover\\:shadow-md {
            box-shadow: none !important;
          }

          .border {
            border-color: #ddd !important;
          }

          .rounded-2xl,
          .rounded-3xl,
          .rounded-xl {
            border-radius: 12px !important;
          }
        }
      `}</style>

      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur">
        <div className="container flex items-center gap-4 h-16">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard">
              <ArrowLeft size={18} />
            </Link>
          </Button>
          <Link to="/dashboard" className="font-display text-lg font-bold text-foreground">
            TALEN<span className="text-primary">TRY</span>
          </Link>
          <span className="text-border/60 hidden sm:inline">/</span>
          <h1 className="font-display font-semibold text-foreground text-sm hidden sm:block">{t.analysis.title}</h1>
          <div className="flex-1" />

          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <Download size={16} className="mr-2" />
            {language === "ar" ? "تصدير PDF" : "Export PDF"}
          </Button>

          <Button variant="default" size="sm" onClick={handleExportPDF}>
            <Save size={16} className="mr-2" />
            {language === "ar" ? "حفظ" : "Save"}
          </Button>
        </div>
      </header>

      <main id="analysis-report" className="container py-8 max-w-5xl space-y-6">
        <section className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles size={14} />
                <span>
                  {language === "ar" ? "تدفق موجه من التحليل إلى التحسين" : "Guided flow from analysis to enhancement"}
                </span>
              </div>

              <h2 className="font-display font-bold text-lg text-foreground mb-2">
                {language === "ar"
                  ? "تقرير تحليل السيرة الذاتية (ATS) — TALENTRY"
                  : "ATS Resume Analysis Report — TALENTRY"}
              </h2>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground font-body">
                <span>📅 {today}</span>
                {result.candidate_name && <span>👤 {result.candidate_name}</span>}
                {result.target_role && <span>🎯 {result.target_role}</span>}
                <span>🌍 TALENTRY</span>
              </div>
            </div>

            <Button variant="hero" size="lg" asChild>
              <Link to={buildEnhanceUrl(priorityFixes[0]?.focus || "professionalSummary")}>
                <Wand2 size={18} className="mr-2" />
                {language === "ar" ? "ابدأ تحسين السيرة الآن" : "Fix My Resume with AI"}
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {flowSteps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.label}
                  className={`rounded-2xl border px-4 py-3 text-center ${
                    step.active ? "border-primary/20 bg-primary/5" : "border-border bg-background/60"
                  }`}
                >
                  <Icon
                    size={18}
                    className={`mx-auto mb-2 ${step.active ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <p className={`text-xs font-medium ${step.active ? "text-foreground" : "text-muted-foreground"}`}>
                    {step.label}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="text-center lg:text-start">
              <div className={`text-7xl font-display font-bold mb-2 ${scoreColor(result.ats_score)}`}>
                {result.ats_score}
              </div>
              <div className="text-sm text-muted-foreground font-body mb-4">{t.analysis.atsScore}</div>

              <div className="w-full h-3 bg-secondary rounded-full overflow-hidden max-w-sm mx-auto lg:mx-0">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${barColor(result.ats_score)}`}
                  style={{ width: `${result.ats_score}%` }}
                />
              </div>

              {result.executive_summary?.candidate_level && (
                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-display font-medium">
                  <Target size={14} />
                  {result.executive_summary.candidate_level}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div
                className={`rounded-2xl border p-4 ${
                  overallStatus?.tone === "success"
                    ? "border-success/20 bg-success/5"
                    : overallStatus?.tone === "primary"
                      ? "border-primary/20 bg-primary/5"
                      : "border-destructive/20 bg-destructive/5"
                }`}
              >
                <p className="font-display font-semibold text-foreground mb-1">{overallStatus?.title}</p>
                <p className="text-sm text-muted-foreground font-body leading-6">{overallStatus?.description}</p>
              </div>

              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-display font-semibold text-foreground mb-1">
                      {language === "ar" ? "ماذا تفعل الآن؟" : "What should you do next?"}
                    </p>
                    <p className="text-sm text-muted-foreground font-body leading-6">
                      {language === "ar"
                        ? "ابدأ بالأقسام الأقل تقييماً أولاً، ثم انتقل إلى الملخص المهني والخبرة والمهارات داخل محرر التحسين."
                        : "Start with the lowest scoring sections first, then improve your summary, experience, and skills inside the enhancement editor."}
                    </p>
                  </div>
                </div>
              </div>

              <Button className="w-full sm:w-auto" variant="hero" size="lg" asChild>
                <Link to={buildEnhanceUrl(priorityFixes[0]?.focus || "professionalSummary")}>
                  <Sparkles size={18} className="mr-2" />
                  {language === "ar" ? "تحسين وإعادة كتابة السيرة" : "Rewrite Resume Based on This Analysis"}
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {hasArray(priorityFixes) && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold text-foreground">
                  {language === "ar" ? "أهم الإصلاحات المقترحة أولاً" : "Top Priority Fixes"}
                </h3>
                <p className="text-sm text-muted-foreground font-body mt-1">
                  {language === "ar"
                    ? "هذه هي أسرع النقاط التي سترفع جودة السيرة قبل الانتقال للتعديل الكامل."
                    : "These are the fastest improvements that can lift your resume quality before full editing."}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {priorityFixes.map((item) => (
                <div key={item.id} className="rounded-2xl border border-border bg-background/60 p-4">
                  <div className="mb-3 inline-flex items-center rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
                    {language === "ar" ? "أولوية" : "Priority"}
                  </div>

                  <p className="font-display font-semibold text-foreground leading-6 mb-2">{item.title}</p>
                  <p className="text-sm text-muted-foreground font-body leading-6 mb-4">{item.action}</p>

                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link to={buildEnhanceUrl(item.focus)}>
                      {language === "ar" ? "إصلاح داخل المحرر" : "Fix in Editor"}
                      <ChevronRight size={14} className="ml-2" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        {result.executive_summary && (
          <section className="space-y-4">
            {hasText(result.executive_summary.summary_paragraphs) && (
              <div className="p-5 bg-card rounded-xl border border-border shadow-sm">
                <h3 className="font-display font-semibold text-foreground mb-3">
                  {language === "ar" ? "📌 ملخص تنفيذي" : "📌 Executive Summary"}
                </h3>
                <p className="text-sm font-body text-foreground whitespace-pre-wrap leading-relaxed">
                  {result.executive_summary.summary_paragraphs}
                </p>
              </div>
            )}

            {(hasArray(result.executive_summary.best_fit_roles) ||
              hasArray(result.executive_summary.top_strengths) ||
              hasArray(result.executive_summary.main_risks)) && (
              <div className="grid md:grid-cols-3 gap-4">
                {hasArray(result.executive_summary.best_fit_roles) && (
                  <div className="p-5 bg-card rounded-xl border border-border shadow-sm">
                    <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Briefcase size={16} className="text-primary" />
                      {t.analysis.bestFitRoles}
                    </h3>
                    <ul className="space-y-1">
                      {result.executive_summary.best_fit_roles.map((r, i) => (
                        <li key={i} className="text-sm font-body text-foreground">
                          • {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {hasArray(result.executive_summary.top_strengths) && (
                  <div className="p-5 bg-card rounded-xl border border-border shadow-sm">
                    <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
                      <TrendingUp size={16} className="text-success" />
                      {t.analysis.strengths}
                    </h3>
                    <ul className="space-y-1">
                      {result.executive_summary.top_strengths.map((s, i) => (
                        <li key={i} className="text-sm font-body text-foreground flex items-start gap-2">
                          <span className="text-success shrink-0">✅</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {hasArray(result.executive_summary.main_risks) && (
                  <div className="p-5 bg-card rounded-xl border border-border shadow-sm">
                    <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Eye size={16} className="text-destructive" />
                      {t.analysis.risks}
                    </h3>
                    <ul className="space-y-1">
                      {result.executive_summary.main_risks.map((r, i) => (
                        <li key={i} className="text-sm font-body text-foreground flex items-start gap-2">
                          <span className="text-destructive shrink-0">⚠️</span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {hasObject(result.section_scores) && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-5">
              <h3 className="font-display text-lg font-bold text-foreground">
                {language === "ar" ? "الأقسام التي تحتاج تحسين" : "Sections That Need Improvement"}
              </h3>
              <p className="text-sm text-muted-foreground font-body mt-1">
                {language === "ar"
                  ? "اضغط على أي قسم للانتقال مباشرة إلى محرر التحسين مع تركيز على هذا الجزء."
                  : "Jump directly into the enhancement editor with focus on any weak section."}
              </p>
            </div>

            <div className="space-y-3">
              {Object.entries(result.section_scores)
                .sort((a, b) => (a[1] as number) - (b[1] as number))
                .map(([key, score]) => (
                  <ScoreBar
                    key={key}
                    label={sectionScoreLabels[key] || key}
                    score={score as number}
                    subtitle={
                      lowScoreSections.some((s) => s.key === key)
                        ? language === "ar"
                          ? "من أقل الأقسام تقييماً — يفضل البدء به"
                          : "One of your lowest scoring sections — recommended first"
                        : undefined
                    }
                    actionLabel={language === "ar" ? "تحسين هذا القسم" : "Improve This Section"}
                    actionTo={buildEnhanceUrl(sectionFocusMap[key] || "professionalSummary")}
                  />
                ))}
            </div>
          </section>
        )}

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="font-display text-lg font-bold text-foreground mb-4">
              {language === "ar" ? "قبل التحسين" : "Before Improvement"}
            </h3>
            <div className="rounded-2xl border border-border bg-background/60 p-4 text-sm text-muted-foreground font-body leading-7">
              {transformationPreview.before}
            </div>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 shadow-sm">
            <h3 className="font-display text-lg font-bold text-foreground mb-4">
              {language === "ar" ? "بعد التحسين" : "After Improvement"}
            </h3>
            <div className="rounded-2xl border border-primary/15 bg-background/80 p-4 text-sm text-foreground font-body leading-7">
              {transformationPreview.after}
            </div>
          </div>
        </section>

        {hasBreakdown && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                <ListChecks size={20} />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-foreground">{t.analysis.atsBreakdown}</h3>
                <p className="text-sm text-muted-foreground font-body mt-0.5">
                  {language === "ar"
                    ? "تفصيل أداء كل جانب من جوانب سيرتك في أنظمة ATS"
                    : "Detailed performance of each aspect of your resume in ATS systems"}
                </p>
              </div>
            </div>
            <div className="space-y-4">
              {Object.entries(result.ats_breakdown).map(([key, data]) => (
                <BreakdownCard
                  key={key}
                  title={breakdownLabels[key] || key}
                  score={data.score}
                  currentState={data.current_state}
                  problem={data.problem}
                  improvement={data.recommended_improvement}
                  actionLabel={language === "ar" ? "تحسين هذا الجزء" : "Improve This Area"}
                  actionTo={buildEnhanceUrl(sectionFocusMap[key] || "professionalSummary")}
                />
              ))}
            </div>
          </section>
        )}

        {hasCareer && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                <Briefcase size={20} />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-foreground">{t.analysis.career}</h3>
                <p className="text-sm text-muted-foreground font-body mt-0.5">
                  {language === "ar"
                    ? "توصيات مهنية مبنية على تحليل سيرتك الذاتية"
                    : "Career recommendations based on your resume analysis"}
                </p>
              </div>
            </div>
            <div className="space-y-5">
              {hasArray(result.career_recommendations.top_roles) && (
                <div className="p-5 rounded-xl border border-border bg-background/60">
                      <h3 className="font-display font-semibold text-foreground mb-3">{t.analysis.topRoles}</h3>
                      <div className="space-y-3">
                        {result.career_recommendations.top_roles.map((r, i) => (
                          <div key={i} className="p-3 bg-secondary/50 rounded-lg">
                            <p className="font-display font-medium text-foreground text-sm">{r.role}</p>
                            <p className="text-sm text-muted-foreground font-body mt-1">{r.why_it_fits}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

              {(hasArray(result.career_recommendations.skills_to_improve) ||
                hasArray(result.career_recommendations.certifications_recommended)) && (
                <div className="grid md:grid-cols-2 gap-4">
                  {hasArray(result.career_recommendations.skills_to_improve) && (
                    <div className="p-5 rounded-xl border border-border bg-background/60">
                      <h4 className="font-display font-semibold text-foreground mb-3">
                        {t.analysis.skillsToImprove}
                      </h4>
                      <ul className="space-y-1">
                        {result.career_recommendations.skills_to_improve.map((s, i) => (
                          <li key={i} className="text-sm font-body text-foreground">• {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {hasArray(result.career_recommendations.certifications_recommended) && (
                    <div className="p-5 rounded-xl border border-border bg-background/60">
                      <h4 className="font-display font-semibold text-foreground mb-3">
                        {t.analysis.certifications}
                      </h4>
                      <ul className="space-y-1">
                        {result.career_recommendations.certifications_recommended.map((c, i) => (
                          <li key={i} className="text-sm font-body text-foreground">• {c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {(hasText(result.career_recommendations.thirty_sixty_ninety_day_plan?.thirty_days) ||
                hasText(result.career_recommendations.thirty_sixty_ninety_day_plan?.sixty_days) ||
                hasText(result.career_recommendations.thirty_sixty_ninety_day_plan?.ninety_days)) && (
                <div className="p-5 rounded-xl border border-border bg-background/60">
                  <h4 className="font-display font-semibold text-foreground mb-3">{t.analysis.actionPlan}</h4>
                  <div className="grid md:grid-cols-3 gap-4">
                    {(["thirty_days", "sixty_days", "ninety_days"] as const).map((period) => {
                      const value = result.career_recommendations.thirty_sixty_ninety_day_plan?.[period];
                      if (!hasText(value)) return null;
                      return (
                        <div key={period} className="p-3 bg-primary/5 rounded-lg border border-primary/10">
                          <p className="font-display font-semibold text-primary text-sm mb-1">
                            {period === "thirty_days" ? "30" : period === "sixty_days" ? "60" : "90"}{" "}
                            {t.analysis.days}
                          </p>
                          <p className="text-sm font-body text-foreground">{value}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {hasText(result.career_recommendations.linkedin_improvements) && (
                <div className="p-5 rounded-xl border border-border bg-background/60">
                  <h4 className="font-display font-semibold text-foreground mb-3">
                    {language === "ar" ? "تحسينات LinkedIn / Portfolio" : "LinkedIn / Portfolio Improvements"}
                  </h4>
                  <p className="text-sm font-body text-foreground whitespace-pre-wrap">
                    {result.career_recommendations.linkedin_improvements}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {hasSalary && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                <DollarSign size={20} />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-foreground">{t.analysis.salary}</h3>
                <p className="text-sm text-muted-foreground font-body mt-0.5">
                  {language === "ar"
                    ? "تقديرات الرواتب بناءً على مستواك والسوق المستهدف"
                    : "Salary estimates based on your level and target market"}
                </p>
              </div>
            </div>
            <div className="space-y-5">
              {hasArray(result.salary_estimation.salary_table) && (
                <div className="p-5 rounded-xl border border-border bg-background/60 overflow-x-auto">
                  <h4 className="font-display font-semibold text-foreground mb-4">
                    {language === "ar" ? "📊 مقارنة الرواتب في السوق" : "📊 Market Salary Comparison"}
                  </h4>
                  <table className="w-full text-sm font-body">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-start p-2 font-display font-semibold text-foreground">
                          {language === "ar" ? "الدور" : "Role"}
                        </th>
                        <th className="text-start p-2 font-display font-semibold text-foreground">
                          {language === "ar" ? "النطاق الشهري (SAR)" : "Monthly Range (SAR)"}
                        </th>
                        <th className="text-start p-2 font-display font-semibold text-foreground">
                          {language === "ar" ? "متى الحد الأعلى؟" : "When Upper Range?"}
                        </th>
                        <th className="text-start p-2 font-display font-semibold text-foreground">
                          {language === "ar" ? "ملاحظات" : "Notes"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.salary_estimation.salary_table.map((row, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="p-2 text-foreground font-medium">{row.role}</td>
                          <td className="p-2 text-foreground">
                            {row.monthly_range_low?.toLocaleString()} – {row.monthly_range_high?.toLocaleString()}
                          </td>
                          <td className="p-2 text-muted-foreground">{row.when_upper_range}</td>
                          <td className="p-2 text-muted-foreground">{row.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="p-6 rounded-xl border border-border bg-background/60">
                <h4 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
                  <DollarSign size={18} className="text-primary" />
                  {language === "ar" ? "التقدير الخاص بالمرشح" : "Candidate Salary Estimate"}
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    {
                      label: language === "ar" ? "نطاق العرض (أدنى)" : "Offer Low",
                      value: result.salary_estimation.offer_range_low,
                    },
                    {
                      label: language === "ar" ? "نطاق العرض (أعلى)" : "Offer High",
                      value: result.salary_estimation.offer_range_high,
                    },
                    { label: t.analysis.negotiationTarget, value: result.salary_estimation.negotiation_target },
                    {
                      label: language === "ar" ? "رقم فتح التفاوض" : "Anchor",
                      value: result.salary_estimation.anchor,
                    },
                    {
                      label: language === "ar" ? "حد القبول الأدنى" : "Walk-away",
                      value: result.salary_estimation.walk_away,
                    },
                  ].map((item) => (
                    <div key={item.label} className="text-center p-3 bg-secondary/50 rounded-lg">
                      <p className="text-xs text-muted-foreground font-body mb-1">{item.label}</p>
                      <p className="text-lg font-display font-bold text-foreground">
                        {item.value?.toLocaleString()} <span className="text-xs text-muted-foreground">SAR</span>
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground font-body mt-3">
                  {language === "ar"
                    ? "⚠️ هذه تقديرات سوقية عامة وليست مصادر مؤكدة."
                    : "⚠️ These are general market estimates, not confirmed sources."}
                </p>
              </div>
            </div>
          </section>
        )}

        {hasRecruiterAnalysis && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-5">
              <h3 className="font-display text-lg font-bold text-foreground">
                {language === "ar" ? "منظور المجند" : "Recruiter Perspective"}
              </h3>
              <p className="text-sm text-muted-foreground font-body mt-1">
                {language === "ar"
                  ? "كيف تبدو سيرتك الذاتية من زاوية مسؤول التوظيف."
                  : "How your resume appears from a recruiter’s point of view."}
              </p>
            </div>

            <div className="space-y-3">
              {Object.entries(result.recruiter_analysis).map(([key, data]) => (
                <RecruiterItem
                  key={key}
                  label={recruiterLabels[key] || key}
                  score={data.score}
                  comment={data.comment}
                />
              ))}
            </div>
          </section>
        )}

        {hasQuickImprovements && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-5">
              <h3 className="font-display text-lg font-bold text-foreground">
                {language === "ar" ? "تحسينات سريعة مقترحة" : "Quick Improvements"}
              </h3>
              <p className="text-sm text-muted-foreground font-body mt-1">
                {language === "ar"
                  ? "خطوات عملية سريعة لرفع جودة السيرة."
                  : "Practical quick wins to improve resume quality."}
              </p>
            </div>

            <div className="space-y-3">
              {result.quick_improvements
                .filter((item) => hasText(item.description) || hasText(item.action_step))
                .map((item, i) => (
                  <QuickImprovement
                    key={i}
                    priority={item.priority}
                    description={item.description}
                    actionStep={item.action_step}
                    actionLabel={language === "ar" ? "تطبيق داخل المحرر" : "Apply in Editor"}
                    actionTo={buildEnhanceUrl(i === 0 ? "professionalSummary" : i === 1 ? "workExperience" : "skills")}
                  />
                ))}
            </div>
          </section>
        )}

        {hasInterviewQuestions && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-5">
              <h3 className="font-display text-lg font-bold text-foreground">
                {language === "ar" ? "أسئلة المقابلة المتوقعة" : "Interview Questions"}
              </h3>
              <p className="text-sm text-muted-foreground font-body mt-1">
                {language === "ar"
                  ? "أسئلة محتملة بناءً على سيرتك الحالية مع اتجاهات للإجابة."
                  : "Likely interview questions based on your current resume with answer directions."}
              </p>
            </div>

            <div className="space-y-3">
              {result.interview_questions
                .filter((q) => hasText(q.question) || hasText(q.suggested_answer_direction))
                .map((q, i) => (
                  <InterviewQuestion
                    key={i}
                    index={i + 1}
                    question={q.question}
                    direction={q.suggested_answer_direction}
                  />
                ))}
            </div>

            {/* CTA: Practice with AI Avatar */}
            <div className="mt-6 p-4 rounded-xl border border-primary/20 bg-primary/5 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground font-display">
                  {language === "ar" ? "تدرب على هذه الأسئلة مع المحاور الذكي" : "Practice these questions with AI Avatar"}
                </p>
                <p className="text-xs text-muted-foreground font-body">
                  {language === "ar" ? "أجب بصوتك واحصل على تقييم فوري" : "Answer by voice and get instant evaluation"}
                </p>
              </div>
              <Button size="sm" asChild className="gap-1.5 shrink-0">
                <Link to={`/dashboard/interview-avatar?analysis_id=${searchParams.get("id") || ""}&job_title=${encodeURIComponent(result.target_role || "")}&questions=${encodeURIComponent(JSON.stringify(result.interview_questions.filter(q => q.question).slice(0, 10)))}`}>
                  <MessageSquare size={14} />
                  {language === "ar" ? "ابدأ المقابلة الذكية" : "Start Avatar Interview"}
                </Link>
              </Button>
            </div>
          </section>
        )}

        <section className="mt-10 p-6 md:p-8 bg-card rounded-2xl border border-primary/20 shadow-sm text-center">
          <Sparkles size={28} className="mx-auto text-primary mb-3" />
          <h3 className="font-display text-xl font-bold text-foreground mb-2">
            {language === "ar" ? "جاهز لتحسين سيرتك الذاتية؟" : "Ready to enhance your resume?"}
          </h3>
          <p className="text-sm text-muted-foreground font-body max-w-lg mx-auto mb-5">
            {language === "ar"
              ? "انتقل الآن إلى محرر التحسين الذكي، وابدأ من الأقسام الأضعف لرفع جودة السيرة بشكل أسرع."
              : "Open the smart enhancement editor now and start with your weakest sections to improve the resume faster."}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button variant="hero" size="lg" asChild>
              <Link to={buildEnhanceUrl(priorityFixes[0]?.focus || "professionalSummary")}>
                <Sparkles size={18} className="mr-2" />
                {language === "ar" ? "تحسين وإعادة كتابة السيرة الذاتية" : "Improve Resume"}
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/dashboard">
                <ArrowLeft size={18} className={`mr-2 ${language === "ar" ? "rotate-180" : ""}`} />
                {language === "ar" ? "العودة للوحة التحكم" : "Return to Dashboard"}
              </Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Analysis;
