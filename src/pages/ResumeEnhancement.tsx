import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { deductPoints, getPointsBalance, SERVICE_COSTS } from "@/lib/points";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { getStoredResumeData } from "@/hooks/useUserResume";
import ResumeRichEditor from "@/components/enhance/ResumeRichEditor";
import MissingSectionsPanel from "@/components/enhance/MissingSectionsPanel";
import MetricSuggestions from "@/components/enhance/MetricSuggestions";
import EditableResumeHeader from "@/components/enhance/EditableResumeHeader";
import ResumeConfirmationStep from "@/components/enhance/ResumeConfirmationStep";
import {
  Sparkles,
  Loader2,
  FileDown,
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Lightbulb,
  Zap,
  FileText,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from "docx";
import { saveAs } from "file-saver";

import {
  StructuredResume,
  EMPTY_STRUCTURED,
  Rating,
  SECTION_LABELS,
  PROTECTED_FIELDS,
  IMPROVABLE_FIELDS,
  cleanArtifacts,
  splitLines,
  detectResumeLanguage,
  enrichStructuredResume,
  mapExtractedToEditor,
  parseResumeTextFallback,
  computeMetrics,
  buildSuggestions,
  sanitizeOptimizedSections,
} from "@/lib/resume-utils";

type ExtractionStage = "downloading" | "extracting" | "normalizing" | "done";

const EDITABLE_SECTIONS: (keyof StructuredResume)[] = [
  "summary",
  "experience",
  "skills",
  "education",
  "certifications",
  "projects",
  "languages",
];

function RatingBadge({ rating }: { rating: Rating }) {
  if (rating === "good") {
    return (
      <Badge className="bg-green-600/20 text-green-400 border-green-600/30">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Good
      </Badge>
    );
  }

  if (rating === "improve") {
    return (
      <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30">
        <AlertTriangle className="w-3 h-3 mr-1" />
        Improve
      </Badge>
    );
  }

  return (
    <Badge className="bg-red-600/20 text-red-400 border-red-600/30">
      <XCircle className="w-3 h-3 mr-1" />
      Missing
    </Badge>
  );
}

async function exportToDocx(s: StructuredResume, lang: string) {
  const data = enrichStructuredResume(s);
  const isAr = lang === "ar";
  const lk = isAr ? "ar" : "en";
  const sections: Paragraph[] = [];

  if (data.name.trim()) {
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: data.name,
            bold: true,
            size: 32,
            font: "Segoe UI",
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
      }),
    );
  }

  if (data.job_title.trim()) {
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: data.job_title,
            size: 24,
            font: "Segoe UI",
            color: "555555",
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
      }),
    );
  }

  if (data.contact.trim()) {
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: data.contact,
            size: 20,
            font: "Segoe UI",
            color: "666666",
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
      }),
    );
  }

  sections.push(
    new Paragraph({
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 1,
          color: "CCCCCC",
        },
      },
      spacing: { after: 200 },
    }),
  );

  const addSection = (title: string, content: string) => {
    if (!content.trim()) return;

    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: title,
            bold: true,
            size: 24,
            font: "Segoe UI",
            color: "2B4C7E",
          }),
        ],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 260, after: 100 },
      }),
    );

    for (const line of splitLines(content)) {
      const isBullet = /^[•▪*\-]/.test(line);
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line.replace(/^[•▪*\-]\s*/, ""),
              size: 22,
              font: "Segoe UI",
            }),
          ],
          bullet: isBullet ? { level: 0 } : undefined,
          spacing: { after: 50 },
        }),
      );
    }
  };

  addSection(SECTION_LABELS.summary[lk], data.summary);
  addSection(SECTION_LABELS.experience[lk], data.experience);
  addSection(SECTION_LABELS.skills[lk], data.skills);
  addSection(SECTION_LABELS.education[lk], data.education);
  addSection(SECTION_LABELS.certifications[lk], data.certifications);
  addSection(SECTION_LABELS.projects[lk], data.projects);
  addSection(SECTION_LABELS.languages[lk], data.languages);

  const doc = new Document({ sections: [{ children: sections }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${data.name || "resume"}_optimized.docx`);
}

const ResumeEnhancement = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { language } = useLanguage();

  const isRTL = language === "ar";
  const t = useCallback((en: string, ar: string) => (language === "ar" ? ar : en), [language]);

  const resumeId = searchParams.get("resume_id");

  const [loading, setLoading] = useState(true);
  const [extractionStage, setExtractionStage] = useState<ExtractionStage | null>(null);
  const [structured, setStructured] = useState<StructuredResume>(EMPTY_STRUCTURED);
  const [originalStructured, setOriginalStructured] = useState<StructuredResume>(EMPTY_STRUCTURED);

  // Confirmation step state
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingStructured, setPendingStructured] = useState<StructuredResume | null>(null);

  const [sectionDrafts, setSectionDrafts] = useState<Record<keyof StructuredResume, string>>({
    ...EMPTY_STRUCTURED,
  });

  const [optimizing, setOptimizing] = useState(false);
  const [optimizingProgress, setOptimizingProgress] = useState(0);
  const [optimizingSection, setOptimizingSection] = useState<keyof StructuredResume | null>(null);
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState("");
  const [userResumes, setUserResumes] = useState<{ id: string; file_name: string; created_at: string }[]>([]);
  const [loadingResumes, setLoadingResumes] = useState(false);
  const [analysisScore, setAnalysisScore] = useState<number | null>(null);

  const atsMetrics = useMemo(() => {
    const local = computeMetrics(structured);
    if (analysisScore !== null) return { ...local, overall: analysisScore };
    return local;
  }, [structured, analysisScore]);

  const suggestions = useMemo(() => buildSuggestions(structured), [structured]);

  const stageLabels: Record<ExtractionStage, { en: string; ar: string; progress: number }> = {
    downloading: {
      en: "Downloading resume file...",
      ar: "جارٍ تحميل ملف السيرة...",
      progress: 20,
    },
    extracting: {
      en: "Extracting text from document...",
      ar: "جارٍ استخراج النص من الملف...",
      progress: 50,
    },
    normalizing: {
      en: "Structuring and formatting resume...",
      ar: "جارٍ تنظيم وتنسيق السيرة...",
      progress: 80,
    },
    done: { en: "Ready!", ar: "جاهز!", progress: 100 },
  };

  const initializeEditor = useCallback((data: StructuredResume) => {
    const normalized = enrichStructuredResume(data);
    setStructured(normalized);
    setOriginalStructured(normalized);
    setSectionDrafts({
      ...EMPTY_STRUCTURED,
      ...normalized,
    });
  }, []);

  // Show confirmation step before opening editor (for fresh extractions)
  const initializeWithConfirmation = useCallback((data: StructuredResume) => {
    const normalized = enrichStructuredResume(data);
    setPendingStructured(normalized);
    setShowConfirmation(true);
    setLoading(false);
  }, []);

  const handleConfirmAndOpenEditor = useCallback((confirmed: StructuredResume) => {
    setShowConfirmation(false);
    setPendingStructured(null);
    initializeEditor(confirmed);
  }, [initializeEditor]);

  const handleSectionChange = useCallback((key: keyof StructuredResume, value: string) => {
    setSectionDrafts((prev) => ({
      ...prev,
      [key]: value,
    }));

    setStructured((prev) =>
      enrichStructuredResume({
        ...prev,
        [key]: value,
      } as StructuredResume),
    );
  }, []);

  const missingSections = useMemo(() => {
    const lk = language === "ar" ? "ar" : "en";
    return (["certifications", "projects", "languages"] as (keyof StructuredResume)[])
      .filter((k) => !structured[k]?.trim())
      .map((k) => ({ key: k, label: SECTION_LABELS[k][lk] }));
  }, [structured, language]);

  const handleAddSection = useCallback((key: string, content: string) => {
    const sectionKey = key as keyof StructuredResume;

    setSectionDrafts((prev) => ({
      ...prev,
      [sectionKey]: content,
    }));

    setStructured((prev) =>
      enrichStructuredResume({
        ...prev,
        [sectionKey]: content,
      } as StructuredResume),
    );
  }, []);

  const handleAddMetric = useCallback(
    (metricText: string) => {
      const current = sectionDrafts.experience || "";
      const newExp = current + (current ? "\n" : "") + `• ${metricText}`;

      setSectionDrafts((prev) => ({
        ...prev,
        experience: newExp,
      }));

      setStructured((prev) =>
        enrichStructuredResume({
          ...prev,
          experience: newExp,
        } as StructuredResume),
      );

      toast({
        title: t("✅ Metric added to experience!", "✅ تمت إضافة الإنجاز للخبرة!"),
      });
    },
    [sectionDrafts.experience, t],
  );

  useEffect(() => {
    if (resumeId || !user) return;

    const loadResumes = async () => {
      setLoadingResumes(true);
      const { data } = await supabase
        .from("resumes")
        .select("id, file_name, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (data) setUserResumes(data);
      setLoadingResumes(false);
    };

    loadResumes();
  }, [resumeId, user]);

  useEffect(() => {
    if (!resumeId || !user) return;

    const load = async () => {
      try {
        setLoading(true);

        const { data: analysisData } = await supabase
          .from("analyses")
          .select("overall_score")
          .eq("resume_id", resumeId)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (analysisData) setAnalysisScore(analysisData.overall_score);

        const { data: session } = await supabase
          .from("enhancement_sessions")
          .select("*")
          .eq("user_id", user.id)
          .eq("id", resumeId)
          .maybeSingle();

        if (session?.structured_data) {
          const mapped = mapExtractedToEditor(session.structured_data as Record<string, unknown>);
          initializeEditor(mapped);
          setFileName(session.file_name || "");
          setLoading(false);
          return;
        }

        const { data: resume } = await supabase
          .from("resumes")
          .select("*")
          .eq("id", resumeId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!resume) {
          toast({
            title: t("Resume not found", "السيرة الذاتية غير موجودة"),
            variant: "destructive",
          });
          navigate("/dashboard");
          return;
        }

        setFileName(resume.file_name);

        const storedResume = await getStoredResumeData(user.id, resumeId);
        if (
          storedResume?.structured_resume_json &&
          Object.values(storedResume.structured_resume_json).some((v) => v && String(v).trim())
        ) {
          const mapped = mapExtractedToEditor(storedResume.structured_resume_json as Record<string, unknown>);
          // Show confirmation for stored data too (first time)
          initializeWithConfirmation(mapped);
          return;
        }

        if (resume.extracted_text && resume.extracted_text.length > 20) {
          const parsed = parseResumeTextFallback(resume.extracted_text);
          initializeWithConfirmation(parsed);
          return;
        }

        setExtractionStage("downloading");
        const { data: fileData } = await supabase.storage.from("resumes").download(resume.file_path);

        if (!fileData) {
          throw new Error("Failed to download file");
        }

        setExtractionStage("extracting");
        const formData = new FormData();
        formData.append(
          "file",
          new File([fileData], resume.file_name, {
            type: resume.file_type || "application/pdf",
          }),
        );

        const { data: extractData, error: extractError } = await supabase.functions.invoke("extract-text", {
          body: formData,
        });

        if (extractError) throw extractError;

        setExtractionStage("normalizing");

        if (extractData?.structured) {
          const mapped = mapExtractedToEditor(extractData.structured);

          if (extractData.text) {
            await supabase
              .from("resumes")
              .update({
                extracted_text: extractData.text,
                language: extractData.language || "en",
              })
              .eq("id", resumeId);
          }

          setExtractionStage("done");
          await new Promise((r) => setTimeout(r, 400));
          initializeWithConfirmation(mapped);
        } else if (extractData?.text) {
          const parsed = parseResumeTextFallback(extractData.text);

          await supabase
            .from("resumes")
            .update({
              extracted_text: extractData.text,
              language: extractData.language || "en",
            })
            .eq("id", resumeId);

          setExtractionStage("done");
          await new Promise((r) => setTimeout(r, 400));
          initializeWithConfirmation(parsed);
        } else {
          throw new Error("No text extracted");
        }
      } catch (err) {
        console.error("Error loading resume:", err);
        toast({
          title: t("Error loading resume", "خطأ في تحميل السيرة"),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
        setExtractionStage(null);
      }
    };

    load();
  }, [resumeId, user, navigate, initializeEditor, initializeWithConfirmation, t]);

  const handleRephraseSelection = useCallback(
    async (selectedText: string): Promise<string | null> => {
      if (!selectedText.trim()) return null;

      const arabicRatio = (selectedText.match(/[\u0600-\u06FF]/g) || []).length / Math.max(selectedText.length, 1);
      const contentLang = arabicRatio > 0.3 ? "ar" : "en";

      try {
        const { data, error } = await supabase.functions.invoke("rephrase-selection", {
          body: {
            text: selectedText,
            language: contentLang,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        if (data?.rephrased) {
          toast({
            title: t("✅ Text rephrased!", "✅ تمت إعادة الصياغة!"),
          });
          return data.rephrased;
        }

        return null;
      } catch (err) {
        console.error("Rephrase error:", err);
        toast({
          title: t("Rephrase failed", "فشل إعادة الصياغة"),
          variant: "destructive",
        });
        return null;
      }
    },
    [t],
  );

  const handleOptimizeSection = useCallback(
    async (sectionKey: keyof StructuredResume) => {
      if (!user) return;

      const currentValue = cleanArtifacts(sectionDrafts[sectionKey] || "");
      if (!currentValue.trim()) {
        toast({
          title: t("This section is empty", "هذا القسم فارغ"),
          variant: "destructive",
        });
        return;
      }

      setOptimizingSection(sectionKey);

      try {
        const balance = await getPointsBalance(user.id);
        if (balance < SERVICE_COSTS.enhancement) {
          toast({
            title: t("Insufficient points", "رصيدك لا يكفي"),
            variant: "destructive",
          });
          return;
        }

        const contentLang = detectResumeLanguage(currentValue);

        const { data, error } = await supabase.functions.invoke("improve-section", {
          body: {
            language: contentLang,
            batchSections: {
              [sectionKey]: currentValue,
            },
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const improvedValue = data?.improved_sections?.[sectionKey];
        if (!improvedValue || typeof improvedValue !== "string") {
          throw new Error("No improved content returned");
        }

        const pointResult = await deductPoints(user.id, "enhancement", `Improve ${String(sectionKey)}`);

        if (!pointResult.success) {
          toast({
            title: t("Insufficient points", "رصيدك لا يكفي"),
            variant: "destructive",
          });
          return;
        }

        setSectionDrafts((prev) => ({
          ...prev,
          [sectionKey]: improvedValue,
        }));

        setStructured((prev) =>
          enrichStructuredResume({
            ...prev,
            [sectionKey]: improvedValue,
          } as StructuredResume),
        );

        toast({
          title: t("✅ Section improved", "✅ تم تحسين القسم"),
        });
      } catch (err) {
        console.error("Section optimization error:", err);
        toast({
          title: t("Optimization failed", "فشل التحسين"),
          variant: "destructive",
        });
      } finally {
        setOptimizingSection(null);
      }
    },
    [user, sectionDrafts, t],
  );

  const handleResetSection = useCallback(
    (sectionKey: keyof StructuredResume) => {
      const originalValue = originalStructured[sectionKey] || "";

      setSectionDrafts((prev) => ({
        ...prev,
        [sectionKey]: originalValue,
      }));

      setStructured((prev) =>
        enrichStructuredResume({
          ...prev,
          [sectionKey]: originalValue,
        } as StructuredResume),
      );

      toast({
        title: t("Section reset", "تمت إعادة القسم"),
      });
    },
    [originalStructured, t],
  );

  const handleOptimize = useCallback(async () => {
    if (!user) return;

    setOptimizing(true);
    setOptimizingProgress(0);

    try {
      const balance = await getPointsBalance(user.id);
      if (balance < SERVICE_COSTS.enhancement) {
        toast({
          title: t("Insufficient points", "رصيدك لا يكفي"),
          variant: "destructive",
        });
        setOptimizing(false);
        return;
      }

      const originalSnapshot: StructuredResume = { ...structured };
      const sectionsToImprove: Record<string, string> = {};

      for (const field of IMPROVABLE_FIELDS) {
        const value = cleanArtifacts(sectionDrafts[field] || originalSnapshot[field]);
        if (value) sectionsToImprove[field] = value;
      }

      if (Object.keys(sectionsToImprove).length === 0) {
        toast({
          title: t("Nothing to optimize", "لا يوجد محتوى كافٍ للتحسين"),
          variant: "destructive",
        });
        setOptimizing(false);
        return;
      }

      const contentLang = detectResumeLanguage(Object.values(sectionsToImprove).join("\n"));

      const { data, error } = await supabase.functions.invoke("improve-section", {
        body: {
          language: contentLang,
          batchSections: sectionsToImprove,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const improvedSections = data?.improved_sections;
      if (!improvedSections || typeof improvedSections !== "object") {
        throw new Error("No improved sections returned");
      }

      const pointResult = await deductPoints(user.id, "enhancement", "Resume Enhancement");

      if (!pointResult.success) {
        toast({
          title: t("Insufficient points", "رصيدك لا يكفي"),
          variant: "destructive",
        });
        setOptimizing(false);
        return;
      }

      const mergedSource = {
        ...originalSnapshot,
        ...sectionDrafts,
      } as StructuredResume;

      const sanitized = sanitizeOptimizedSections(mergedSource, improvedSections);

      for (const f of PROTECTED_FIELDS) {
        sanitized[f] = mergedSource[f];
      }

      const normalized = enrichStructuredResume(sanitized);
      setStructured(normalized);
      setSectionDrafts({
        ...EMPTY_STRUCTURED,
        ...normalized,
      });

      const failedSections = data?.errors ? Object.keys(data.errors) : [];
      const successCount = Object.keys(sectionsToImprove).length - failedSections.length;

      toast({
        title: t(`✅ ${successCount} section(s) optimized!`, `✅ تم تحسين ${successCount} قسم(أقسام)!`),
        description: failedSections.length
          ? t(
              `${failedSections.length} section(s) kept original due to errors.`,
              `${failedSections.length} قسم(أقسام) بقيت كما هي بسبب أخطاء.`,
            )
          : t("Facts and header details preserved.", "تم الحفاظ على الحقائق وبيانات العنوان."),
      });
    } catch (err) {
      console.error("Optimization error:", err);
      toast({
        title: t("Optimization failed", "فشل التحسين"),
        variant: "destructive",
      });
    } finally {
      setOptimizing(false);
      setOptimizingProgress(0);
    }
  }, [structured, sectionDrafts, user, t]);

  const handleSave = useCallback(async () => {
    if (!user) return;

    setSaving(true);

    try {
      const normalized = enrichStructuredResume({
        ...structured,
        ...sectionDrafts,
      } as StructuredResume);

      const score = computeMetrics(normalized).overall;

      await supabase.from("generated_resumes").insert([
        {
          user_id: user.id,
          title: normalized.name || fileName || "ATS Optimized Resume",
          content: JSON.parse(JSON.stringify(normalized)),
          language: language === "ar" ? "ar" : "en",
          source_resume_id: resumeId || null,
          ats_score: score,
        } as any,
      ]);

      setStructured(normalized);
      setSectionDrafts({
        ...EMPTY_STRUCTURED,
        ...normalized,
      });

      toast({
        title: t("✅ Resume saved!", "✅ تم حفظ السيرة!"),
      });
    } catch (err) {
      console.error("Save error:", err);
      toast({
        title: t("Save failed", "فشل الحفظ"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [user, structured, sectionDrafts, fileName, language, resumeId, t]);

  const handleExport = useCallback(async () => {
    try {
      const normalized = enrichStructuredResume({
        ...structured,
        ...sectionDrafts,
      } as StructuredResume);

      await exportToDocx(normalized, language);

      toast({
        title: t("✅ DOCX exported!", "✅ تم تصدير الملف!"),
      });
    } catch (err) {
      console.error("Export error:", err);
      toast({
        title: t("Export failed", "فشل التصدير"),
        variant: "destructive",
      });
    }
  }, [structured, sectionDrafts, language, t]);

  // ── Resume selection (no resume_id) ───────────────────────────
  if (!resumeId) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-card">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {t("Resume ATS Optimizer", "محسّن السيرة الذاتية")}
            </h1>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-12 text-center space-y-6">
          <FileText size={48} className="mx-auto text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground">
            {t("Choose a resume to enhance", "اختر سيرة ذاتية لتحسينها")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t(
              "Select a previously uploaded resume to optimize with AI.",
              "اختر سيرة ذاتية محمّلة مسبقاً لتحسينها بالذكاء الاصطناعي.",
            )}
          </p>

          {loadingResumes && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}

          {!loadingResumes && userResumes.length === 0 && (
            <div className="py-8 space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("No resumes uploaded yet.", "لم يتم رفع أي سيرة ذاتية بعد.")}
              </p>
              <Button onClick={() => navigate("/dashboard")}>{t("Go to Dashboard", "اذهب للوحة التحكم")}</Button>
            </div>
          )}

          {!loadingResumes && userResumes.length > 0 && (
            <div className="space-y-2 max-w-md mx-auto">
              {userResumes.map((r) => (
                <button
                  key={r.id}
                  onClick={() => navigate(`/enhance?resume_id=${r.id}`)}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{r.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const handleCancelExtraction = () => {
    setLoading(false);
    setExtractionStage(null);
    navigate("/dashboard");
  };

  const extractionDialogOpen = loading || !!extractionStage;
  const extractionCurrentStage = extractionStage || "downloading";
  const extractionStageInfo = stageLabels[extractionCurrentStage];

  // ── Confirmation step ─────────────────────────────────────────
  if (showConfirmation && pendingStructured) {
    return (
      <div className={`min-h-screen bg-background ${isRTL ? "rtl" : "ltr"}`}>
        <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Link to="/dashboard" className="font-display text-lg font-bold text-foreground">
              TALEN<span className="text-primary">TRY</span>
            </Link>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <ResumeConfirmationStep
            structured={pendingStructured}
            onConfirm={handleConfirmAndOpenEditor}
            onBack={() => navigate("/dashboard")}
            isRTL={isRTL}
            t={t}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <Dialog
        open={extractionDialogOpen}
        onOpenChange={(open) => {
          if (!open) handleCancelExtraction();
        }}
      >
        <DialogContent className="sm:max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
          <div className="space-y-6 text-center py-4">
            <Sparkles className="w-12 h-12 text-primary animate-pulse mx-auto" />
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">{t("Analyzing Resume", "جارٍ تحليل السيرة")}</h2>
              <p className="text-sm text-muted-foreground">
                {language === "ar" ? extractionStageInfo.ar : extractionStageInfo.en}
              </p>
            </div>
            <Progress value={extractionStageInfo.progress} className="h-2" />
            <Button variant="outline" onClick={handleCancelExtraction}>
              {t("Cancel", "إلغاء")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className={`min-h-screen bg-background ${isRTL ? "rtl" : "ltr"}`}>
        <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>

              <Link to="/dashboard" className="font-display text-lg font-bold text-foreground">
                TALEN<span className="text-primary">TRY</span>
              </Link>

              <span className="text-border/60 hidden sm:inline">/</span>

              <div className="hidden sm:flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="font-display font-semibold text-foreground text-sm">
                  {t("Resume ATS Optimizer", "محسّن السيرة الذاتية")}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <FileDown className="w-4 h-4 mr-1" />
                {t("Export DOCX", "تصدير Word")}
              </Button>

              <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                {t("Save", "حفظ")}
              </Button>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* ATS Score Card */}
          <Card className="mb-6 border-primary/20">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="hsl(var(--muted))"
                        strokeWidth="3"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="3"
                        strokeDasharray={`${atsMetrics.overall}, 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-foreground">
                      {atsMetrics.overall}
                    </span>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">{t("ATS Score", "نقاط ATS")}</p>
                    <p className="text-2xl font-bold text-foreground">{atsMetrics.overall} / 100</p>
                  </div>
                </div>

                <Separator orientation="vertical" className="hidden md:block h-16" />

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 flex-1">
                  {(["structure", "keywords", "readability", "impact", "completeness"] as const).map((cat) => (
                    <div key={cat} className="text-center">
                      <p className="text-xs text-muted-foreground capitalize mb-1">{cat}</p>
                      <RatingBadge rating={atsMetrics[cat]} />
                    </div>
                  ))}
                </div>

                <Button onClick={handleOptimize} disabled={optimizing} className="shrink-0">
                  {optimizing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                  {optimizing ? t("Optimizing sections...", "جارٍ تحسين الأقسام...") : t("Optimize All", "تحسين الكل")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Editable Header: Name, Job Title, Contact */}
          <EditableResumeHeader
            name={sectionDrafts.name || structured.name}
            jobTitle={sectionDrafts.job_title || structured.job_title}
            contact={sectionDrafts.contact || structured.contact}
            onNameChange={(v) => handleSectionChange("name", v)}
            onJobTitleChange={(v) => handleSectionChange("job_title", v)}
            onContactChange={(v) => handleSectionChange("contact", v)}
            isRTL={isRTL}
            t={t}
          />

          <div className="mb-4 p-3 rounded-lg border border-primary/20 bg-primary/5 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-foreground/80">
              {t(
                "Each section has its own editor and AI improvement — edit independently for the best results.",
                "كل قسم له محرر مستقل وتحسين مستقل بالذكاء الاصطناعي — عدّل كل قسم على حدة لأفضل النتائج.",
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {EDITABLE_SECTIONS.map((sectionKey) => {
                const lk = language === "ar" ? "ar" : "en";
                const title = SECTION_LABELS[sectionKey][lk];
                const value = sectionDrafts[sectionKey] || "";
                const isBusy = optimizingSection === sectionKey;
                const sectionMetrics = computeMetrics(
                  enrichStructuredResume({
                    ...structured,
                    [sectionKey]: value,
                  } as StructuredResume),
                );

                return (
                  <Card key={sectionKey} data-section-key={sectionKey} className="border-border/60">
                    <CardHeader className="pb-3">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <CardTitle className="text-base font-semibold">{title}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">
                            {t("Edit and improve this section independently.", "عدّل وحسّن هذا القسم بشكل مستقل.")}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {t("ATS view", "تقييم ATS")} {sectionMetrics.overall}/100
                          </Badge>

                          <Button size="sm" variant="outline" onClick={() => handleResetSection(sectionKey)}>
                            <RotateCcw className="w-4 h-4 mr-1" />
                            {t("Reset", "استعادة")}
                          </Button>

                          <Button size="sm" onClick={() => handleOptimizeSection(sectionKey)} disabled={isBusy}>
                            {isBusy ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <Zap className="w-4 h-4 mr-2" />
                            )}
                            {t("Improve this section", "تحسين هذا القسم")}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <ResumeRichEditor
                        content={value}
                        onChange={(html) => handleSectionChange(sectionKey, html)}
                        onRephraseSelection={handleRephraseSelection}
                        isRTL={isRTL}
                        placeholder={t(`Write your ${title} here...`, `اكتب ${title} هنا...`)}
                      />
                    </CardContent>
                  </Card>
                );
              })}

              <MissingSectionsPanel
                missingSections={missingSections}
                onAddSection={handleAddSection}
                language={language}
                isRTL={isRTL}
                t={t}
              />

              <MetricSuggestions
                experience={sectionDrafts.experience || structured.experience}
                onAddMetric={handleAddMetric}
                isRTL={isRTL}
                t={t}
              />
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-primary" />
                    {t("Smart Suggestions", "اقتراحات ذكية")}
                  </CardTitle>
                </CardHeader>

                <CardContent className="px-4 pb-4 pt-0 space-y-3">
                  {suggestions.length === 0 ? (
                    <div className="text-center py-6">
                      <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">{t("Looking great!", "ممتاز!")}</p>
                    </div>
                  ) : (
                    suggestions.map((s) => (
                      <div key={s.id} className="p-3 rounded-lg border border-border bg-muted/30">
                        <p className="text-sm font-medium text-foreground flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-yellow-500" />
                          {language === "ar" ? s.titleAr : s.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {language === "ar" ? s.descriptionAr : s.description}
                        </p>
                        {s.actionLabel && (
                          <Button
                            variant="link"
                            size="sm"
                            className="mt-1 h-auto p-0 text-xs text-primary"
                            onClick={() => {
                              // Scroll to the relevant section
                              const sectionEl = document.querySelector(`[data-section-key="${s.field}"]`);
                              if (sectionEl) {
                                sectionEl.scrollIntoView({ behavior: "smooth", block: "center" });
                              }
                            }}
                          >
                            {language === "ar" ? s.actionLabelAr : s.actionLabel} →
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
            <Button variant="ghost" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              {t("Back", "العودة")}
            </Button>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExport}>
                <FileDown className="w-4 h-4 mr-1" />
                {t("Export DOCX", "تصدير Word")}
              </Button>

              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                {t("Save Changes", "حفظ التغييرات")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ResumeEnhancement;
