import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import {
  FileText,
  BarChart3,
  Send,
  RefreshCw,
  Loader2,
  Upload,
  Plus,
  Trash2,
  ChevronRight,
  Coins,
  Wand2,
  MessageSquare,
  FileType,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { uploadAndParseResume } from "@/hooks/useUserResume";
import { SERVICE_COSTS } from "@/lib/points";

// ─── Safe query helper — awaits Supabase builder directly ──
async function safeQuery<T>(fn: () => PromiseLike<T>, label: string): Promise<T | null> {
  try {
    const result = await fn();
    return result;
  } catch (err) {
    console.error(`[Dashboard] query THREW for ${label}:`, err);
    return null;
  }
}

// ─── Section Wrapper ─────────────────────────────────────────────────────────
const Section = ({
  icon: Icon,
  title,
  subtitle,
  children,
  action,
}: {
  icon: React.ComponentType<any>;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) => (
  <section className="space-y-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon size={18} />
        </div>
        <div>
          <h2 className="font-display text-base font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground font-body">{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
    {children}
  </section>
);


// ─── Main Dashboard ───────────────────────────────────────────────────────────
const Dashboard = () => {
  const { user, loading: authLoading, initialized } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ar = language === "ar";

  // ── Critical data ──
  const [resumes, setResumes] = useState<Tables<"resumes">[]>([]);
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [criticalReady, setCriticalReady] = useState(false);
  const [criticalError, setCriticalError] = useState<string | null>(null);
  const [resumesLoading, setResumesLoading] = useState(true);

  // ── Secondary data ──
  const [analyses, setAnalyses] = useState<Tables<"analyses">[]>([]);
  const [generatedResumes, setGeneratedResumes] = useState<
    { id: string; source_resume_id: string | null; ats_score: number | null; title: string; created_at: string }[]
  >([]);
  const [enhancementSessions, setEnhancementSessions] = useState<
    { id: string; file_name: string; status: string; created_at: string; file_path?: string }[]
  >([]);
  const [marketingEmails, setMarketingEmails] = useState<Tables<"marketing_emails">[]>([]);
  const [interviewSessions, setInterviewSessions] = useState<
    { id: string; resume_id: string | null; overall_score: number | null; session_title: string; created_at: string; job_title: string | null }[]
  >([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [secondaryReady, setSecondaryReady] = useState(false);

  // ── UI state ──
  const [uploading, setUploading] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Tables<"resumes"> | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [buyingPackage, setBuyingPackage] = useState<string | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // CRITICAL DATA LOADER
  // ═══════════════════════════════════════════════════════════════════════════
  const loadCriticalData = useCallback(async (userId: string) => {
    setCriticalReady(false);
    setCriticalError(null);
    setResumesLoading(true);

    const [resumesRes, profileRes, txRes] = await Promise.all([
      safeQuery(() => supabase.from("resumes").select("*").eq("user_id", userId).order("created_at", { ascending: false }), "resumes"),
      safeQuery(() => supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(), "profile"),
      safeQuery(() => supabase.from("point_transactions").select("amount").eq("user_id", userId), "points"),
    ]);

    if (resumesRes?.error) console.error("[Dashboard] resumes error:", resumesRes.error.message);
    if (profileRes?.error) console.error("[Dashboard] profile error:", profileRes.error.message);
    if (txRes?.error) console.error("[Dashboard] points error:", txRes.error.message);

    setResumes(resumesRes?.data ?? []);
    setProfile(profileRes?.data ?? null);
    setPointsBalance(txRes?.data ? txRes.data.reduce((sum: number, tx: { amount: number }) => sum + tx.amount, 0) : 0);
    setResumesLoading(false);

    const resumesFailed = !resumesRes || !!resumesRes.error;
    if (resumesFailed) {
      setCriticalError(resumesRes?.error?.message || "Failed to load resumes");
    }

    setCriticalReady(true);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECONDARY DATA LOADER
  // ═══════════════════════════════════════════════════════════════════════════
  const loadSecondaryData = useCallback(async (userId: string) => {
    setSecondaryReady(false);

    const [analysesRes, enhanceRes, roleRes, emailsRes, genRes, interviewRes] = await Promise.all([
      safeQuery(() => supabase.from("analyses").select("*").eq("user_id", userId).order("created_at", { ascending: false }), "analyses"),
      safeQuery(() => supabase.from("enhancement_sessions").select("*").eq("user_id", userId).order("created_at", { ascending: false }), "enhancement_sessions"),
      safeQuery(() => supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin"), "roles"),
      safeQuery(() => supabase.from("marketing_emails").select("*").eq("user_id", userId), "marketing_emails"),
      safeQuery(() => supabase.from("generated_resumes").select("id, source_resume_id, ats_score, title, created_at").eq("user_id", userId), "generated_resumes") as Promise<any>,
      safeQuery(() => supabase.from("interview_sessions").select("id, resume_id, overall_score, session_title, created_at, job_title").eq("user_id", userId).order("created_at", { ascending: false }), "interview_sessions"),
    ]);

    setAnalyses(analysesRes?.data ?? []);
    setEnhancementSessions((enhanceRes?.data as typeof enhancementSessions) ?? []);
    setIsAdmin(!!roleRes?.data && roleRes.data.length > 0);
    setMarketingEmails(emailsRes?.data ?? []);
    setGeneratedResumes((genRes?.data as typeof generatedResumes) ?? []);
    setInterviewSessions((interviewRes?.data as typeof interviewSessions) ?? []);

    setSecondaryReady(true);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // ORCHESTRATOR
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!initialized || authLoading) return;

    if (!user?.id) {
      setCriticalReady(true);
      setSecondaryReady(true);
      setResumesLoading(false);
      return;
    }

    const uid = user.id;
    void Promise.allSettled([loadCriticalData(uid), loadSecondaryData(uid)]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, authLoading, user?.id]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════
  const canAfford = (cost: number) => pointsBalance >= cost;

  const getScoreForResume = (resumeId: string): number | null => {
    const analysis = analyses.find((a) => a.resume_id === resumeId);
    return analysis ? analysis.overall_score : null;
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const allowedTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowedTypes.includes(file.type)) {
      toast.error(ar ? "يرجى رفع ملف PDF أو DOCX" : "Please upload a PDF or DOCX file");
      return;
    }
    setUploading(true);
    try {
      const { resumeId, structured } = await uploadAndParseResume(user.id, file);
      const jobTitle = structured?.job_title || "";
      toast.success(
        ar
          ? `تم رفع وتحليل السيرة الذاتية بنجاح${jobTitle ? ` — ${jobTitle}` : ""}`
          : `Resume uploaded & parsed successfully${jobTitle ? ` — ${jobTitle}` : ""}`,
      );
      const { data } = await supabase
        .from("resumes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) setResumes(data);
    } catch (err: unknown) {
      console.error("[Dashboard] upload error:", err);
      toast.error(ar ? "فشل رفع السيرة الذاتية" : "Failed to upload resume");
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || !user) return;
    setDeleting(true);
    await supabase.storage.from("resumes").remove([deleteTarget.file_path]);
    const { error } = await supabase.from("resumes").delete().eq("id", deleteTarget.id);
    if (error) {
      toast.error(ar ? "فشل حذف السيرة الذاتية" : "Failed to delete resume");
    } else {
      toast.success(ar ? "تم حذف السيرة الذاتية" : "Resume deleted");
      setResumes((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const handleAction = (action: "analyze" | "enhance" | "publish", resumeId: string) => {
    const costMap = { analyze: SERVICE_COSTS.analysis, enhance: SERVICE_COSTS.enhancement, publish: SERVICE_COSTS.marketing_per_100 };
    if (!canAfford(costMap[action])) {
      setUpgradeOpen(true);
      return;
    }
    const routes = {
      analyze: `/analysis?id=${resumeId}`,
      enhance: `/enhance?resume_id=${resumeId}`,
      publish: `/marketing?resume_id=${resumeId}`,
    };
    navigate(routes[action]);
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString(ar ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const getFileType = (fileType: string | null) => {
    if (fileType?.includes("pdf")) return "PDF";
    if (fileType?.includes("word") || fileType?.includes("docx")) return "DOCX";
    return "—";
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-primary";
    return "text-destructive";
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER GATES
  // ═══════════════════════════════════════════════════════════════════════════

  // Gate 1: Auth not ready — spinner (AuthContext hard-timeout = 5s max)
  if (!initialized || authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground font-body">
          <Loader2 size={16} className="animate-spin" />
          {t.common.loading}
        </div>
      </div>
    );
  }

  // Gate 2: No user after auth resolved → redirect (never show blank screen)
  if (!user?.id) {
    return <Navigate to="/login" replace />;
  }

  // Gate 3: Critical data not ready yet — show shell with skeletons for resume section only
  // But always render the dashboard shell (welcome header, points, upload button)

  return (
    <TooltipProvider delayDuration={200}>
      <div className="bg-background">
        <div className="container py-6 md:py-8 space-y-8 max-w-5xl">
          {/* Welcome + Points */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground md:text-2xl font-display">
                {t.dashboard.welcome}
                {profile?.display_name ? ` ${profile.display_name}` : ""}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground font-body">
                {ar ? "ماذا تريد أن تفعل اليوم؟" : "What would you like to do today?"}
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Coins size={16} />
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground font-body leading-none">
                  {ar ? "رصيدك" : "Balance"}
                </p>
                <p className="text-lg font-bold font-display text-foreground leading-tight">
                  {criticalReady ? pointsBalance : "—"}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setUpgradeOpen(true)} className="gap-1.5 ms-2">
                <Plus size={14} />
                {ar ? "شراء" : "Buy"}
              </Button>
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* ═══════════════════════════════════════════════════════════════════
              SECTION: Resumes
             ═══════════════════════════════════════════════════════════════════ */}
          <Section
            icon={FileText}
            title={ar ? "سيرك الذاتية" : "Your Resumes"}
            subtitle={ar ? "جميع ملفات السيرة الذاتية المرفوعة" : "All your uploaded resume files"}
            action={
              <Button size="sm" onClick={handleUploadClick} disabled={uploading} className="gap-1.5">
                {uploading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading ? (ar ? "جارٍ الرفع..." : "Uploading...") : (ar ? "رفع سيرة" : "Upload")}
              </Button>
            }
          >
            {criticalError ? (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-foreground font-body">
                    {ar ? "تعذر تحميل بيانات لوحة التحكم. حاول مرة أخرى." : "Dashboard data failed to load. Please retry."}
                  </p>
                  <Button size="sm" variant="outline" onClick={() => { if (user?.id) void Promise.allSettled([loadCriticalData(user.id), loadSecondaryData(user.id)]); }} className="gap-2">
                    <RefreshCw size={14} />
                    {ar ? "إعادة المحاولة" : "Retry"}
                  </Button>
                </CardContent>
              </Card>
            ) : resumesLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="border-border">
                    <CardContent className="p-4 space-y-3">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-1/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : resumes.length === 0 ? (
              <div
                onClick={handleUploadClick}
                className="cursor-pointer rounded-xl border-2 border-dashed border-border hover:border-primary/30 bg-muted/30 p-10 text-center transition-colors"
              >
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Upload size={20} className="text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground font-display">
                  {ar ? "لا توجد سير ذاتية بعد" : "No resumes yet"}
                </p>
                <p className="text-xs text-muted-foreground font-body mt-1">
                  {ar ? "اضغط هنا لرفع سيرتك الذاتية الأولى" : "Click here to upload your first resume"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {resumes.map((resume) => {
                  const score = getScoreForResume(resume.id);
                  const enhanced = generatedResumes.find((g) => g.source_resume_id === resume.id);
                  const enhancedScore = enhanced?.ats_score ?? null;
                  const hasAnalysis = score !== null;
                  const hasEnhancement = !!enhanced;
                  const resumeInterviews = interviewSessions.filter((s) => s.resume_id === resume.id);
                  const hasInterview = resumeInterviews.length > 0;
                  const bestInterviewScore = hasInterview
                    ? Math.max(...resumeInterviews.map((s) => s.overall_score ?? 0))
                    : null;
                  const resumeEmails = marketingEmails.filter((e) => e.selected_resume_id === resume.id);
                  const sentEmails = resumeEmails.filter((e) => e.action_type === "sent" || e.gmail_status === "sent");
                  const hasMarketing = resumeEmails.length > 0;

                  return (
                    <Card
                      key={resume.id}
                      className="group border-border hover:border-primary/20 transition-all duration-200 relative overflow-hidden"
                    >
                      <CardContent className="p-0">
                        {/* Header: file info + delete */}
                        <div className="flex items-start justify-between gap-2 p-4 pb-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 mt-0.5">
                              <FileText size={18} className="text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground font-display truncate max-w-[200px]">
                                {resume.file_name}
                              </p>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground font-body">
                                <span className="flex items-center gap-1">
                                  <FileType size={11} />
                                  {getFileType(resume.file_type)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar size={11} />
                                  {formatDate(resume.created_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                                onClick={() => setDeleteTarget(resume)}
                              >
                                <Trash2 size={13} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">{ar ? "حذف" : "Delete"}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>

                        {/* Status rows — render immediately, show loading indicator if secondary not ready */}
                        <div className="border-t border-border/40 bg-muted/20 divide-y divide-border/30">
                          {/* Analysis row */}
                          <div
                            className={`flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors ${!hasAnalysis ? "opacity-70" : ""}`}
                            onClick={() => hasAnalysis ? navigate(`/analysis?id=${resume.id}`) : handleAction("analyze", resume.id)}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${hasAnalysis ? "bg-primary/10" : "bg-muted"}`}>
                                <BarChart3 size={13} className={hasAnalysis ? "text-primary" : "text-muted-foreground"} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-foreground font-display">
                                  {ar ? "التحليل" : "Analysis"}
                                </p>
                                {!secondaryReady ? (
                                  <Skeleton className="h-3 w-16 mt-0.5" />
                                ) : hasAnalysis ? (
                                  <p className="text-[10px] text-muted-foreground font-body">
                                    {ar ? "اضغط لعرض التقرير" : "Tap to view report"}
                                  </p>
                                ) : (
                                  <p className="text-[10px] text-muted-foreground font-body">
                                    {ar ? "لم يتم التحليل بعد" : "Not analyzed yet"}
                                  </p>
                                )}
                              </div>
                            </div>
                            {!secondaryReady ? (
                              <Skeleton className="h-5 w-10" />
                            ) : hasAnalysis ? (
                              <div className="flex items-center gap-2">
                                <div className={`text-base font-bold font-display ${scoreColor(score!)}`}>
                                  {score}
                                </div>
                                <div className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${score! >= 80 ? "bg-success" : score! >= 60 ? "bg-primary" : "bg-destructive"}`}
                                    style={{ width: `${score}%` }}
                                  />
                                </div>
                                <ChevronRight size={12} className="text-muted-foreground/50" />
                              </div>
                            ) : (
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-primary px-2">
                                <BarChart3 size={10} />
                                {ar ? "حلّل" : "Analyze"}
                              </Button>
                            )}
                          </div>

                          {/* Enhancement row */}
                          <div
                            className={`flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors ${!hasEnhancement ? "opacity-70" : ""}`}
                            onClick={() => {
                              if (hasEnhancement) {
                                navigate(`/enhance?resume_id=${resume.id}`);
                              } else {
                                handleAction("enhance", resume.id);
                              }
                            }}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${hasEnhancement ? "bg-success/10" : "bg-muted"}`}>
                                <Wand2 size={13} className={hasEnhancement ? "text-success" : "text-muted-foreground"} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-foreground font-display">
                                  {ar ? "التحسين" : "Enhancement"}
                                </p>
                                {!secondaryReady ? (
                                  <Skeleton className="h-3 w-16 mt-0.5" />
                                ) : hasEnhancement ? (
                                  <p className="text-[10px] text-muted-foreground font-body">
                                    {ar ? "تم التحسين" : "Enhanced"}
                                    {enhancedScore !== null && ` • ATS: ${enhancedScore}`}
                                  </p>
                                ) : (
                                  <p className="text-[10px] text-muted-foreground font-body">
                                    {ar ? "لم يتم التحسين بعد" : "Not enhanced yet"}
                                  </p>
                                )}
                              </div>
                            </div>
                            {!secondaryReady ? (
                              <Skeleton className="h-5 w-10" />
                            ) : hasEnhancement ? (
                              <div className="flex items-center gap-2">
                                {enhancedScore !== null && (
                                  <>
                                    <div className={`text-base font-bold font-display ${scoreColor(enhancedScore)}`}>
                                      {enhancedScore}
                                    </div>
                                    <div className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all ${enhancedScore >= 80 ? "bg-success" : enhancedScore >= 60 ? "bg-primary" : "bg-destructive"}`}
                                        style={{ width: `${enhancedScore}%` }}
                                      />
                                    </div>
                                  </>
                                )}
                                {!enhancedScore && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-success/10 text-success border-0">
                                    ✓ {ar ? "مكتمل" : "Done"}
                                  </Badge>
                                )}
                                <ChevronRight size={12} className="text-muted-foreground/50" />
                              </div>
                            ) : (
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-primary px-2">
                                <Wand2 size={10} />
                                {ar ? "حسّن" : "Enhance"}
                              </Button>
                            )}
                          </div>

                          {/* Interview row */}
                          <div
                            className={`flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors ${!hasInterview ? "opacity-70" : ""}`}
                            onClick={() => hasInterview ? navigate("/dashboard/interview-history") : navigate("/dashboard/interview-avatar")}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${hasInterview ? "bg-accent" : "bg-muted"}`}>
                                <MessageSquare size={13} className={hasInterview ? "text-accent-foreground" : "text-muted-foreground"} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-foreground font-display">
                                  {ar ? "المقابلات" : "Interviews"}
                                </p>
                                {!secondaryReady ? (
                                  <Skeleton className="h-3 w-16 mt-0.5" />
                                ) : hasInterview ? (
                                  <p className="text-[10px] text-muted-foreground font-body">
                                    {resumeInterviews.length} {ar ? "جلسة" : resumeInterviews.length === 1 ? "session" : "sessions"}
                                  </p>
                                ) : (
                                  <p className="text-[10px] text-muted-foreground font-body">
                                    {ar ? "لا توجد مقابلات بعد" : "No interviews yet"}
                                  </p>
                                )}
                              </div>
                            </div>
                            {!secondaryReady ? (
                              <Skeleton className="h-5 w-10" />
                            ) : hasInterview ? (
                              <div className="flex items-center gap-2">
                                {bestInterviewScore !== null && bestInterviewScore > 0 && (
                                  <>
                                    <div className={`text-base font-bold font-display ${scoreColor(bestInterviewScore)}`}>
                                      {bestInterviewScore}
                                    </div>
                                    <div className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all ${bestInterviewScore >= 80 ? "bg-success" : bestInterviewScore >= 60 ? "bg-primary" : "bg-destructive"}`}
                                        style={{ width: `${bestInterviewScore}%` }}
                                      />
                                    </div>
                                  </>
                                )}
                                {(!bestInterviewScore || bestInterviewScore === 0) && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    {resumeInterviews.length} {ar ? "جلسة" : "sessions"}
                                  </Badge>
                                )}
                                <ChevronRight size={12} className="text-muted-foreground/50" />
                              </div>
                            ) : (
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-primary px-2">
                                <MessageSquare size={10} />
                                {ar ? "تدرّب" : "Practice"}
                              </Button>
                            )}
                          </div>

                          {/* Marketing row */}
                          <div
                            className={`flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors ${!hasMarketing ? "opacity-70" : ""}`}
                            onClick={() => navigate(`/marketing${hasMarketing ? `?resume_id=${resume.id}` : ""}`)}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${hasMarketing ? "bg-primary/10" : "bg-muted"}`}>
                                <Send size={13} className={hasMarketing ? "text-primary" : "text-muted-foreground"} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-foreground font-display">
                                  {ar ? "التسويق" : "Marketing"}
                                </p>
                                {!secondaryReady ? (
                                  <Skeleton className="h-3 w-16 mt-0.5" />
                                ) : hasMarketing ? (
                                  <p className="text-[10px] text-muted-foreground font-body">
                                    {sentEmails.length > 0
                                      ? `${sentEmails.length} ${ar ? "تم إرساله" : "sent"}`
                                      : `${resumeEmails.length} ${ar ? "مسودة" : resumeEmails.length === 1 ? "draft" : "drafts"}`}
                                  </p>
                                ) : (
                                  <p className="text-[10px] text-muted-foreground font-body">
                                    {ar ? "لم يتم الإرسال بعد" : "Not marketed yet"}
                                  </p>
                                )}
                              </div>
                            </div>
                            {!secondaryReady ? (
                              <Skeleton className="h-5 w-10" />
                            ) : hasMarketing ? (
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-0">
                                  {sentEmails.length > 0
                                    ? `${sentEmails.length} ${ar ? "مُرسل" : "sent"}`
                                    : `${resumeEmails.length} ${ar ? "بريد" : "emails"}`}
                                </Badge>
                                <ChevronRight size={12} className="text-muted-foreground/50" />
                              </div>
                            ) : (
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-primary px-2">
                                <Send size={10} />
                                {ar ? "أرسل" : "Send"}
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Add resume card */}
                <div
                  onClick={handleUploadClick}
                  className="cursor-pointer rounded-xl border-2 border-dashed border-border hover:border-primary/30 flex flex-col items-center justify-center p-6 text-center transition-colors min-h-[140px]"
                >
                  <Plus size={20} className="text-muted-foreground/50 mb-1" />
                  <p className="text-xs text-muted-foreground font-body">
                    {ar ? "رفع سيرة جديدة" : "Upload new resume"}
                  </p>
                </div>
              </div>
            )}
          </Section>

        </div>

        {/* ── Delete Confirmation Dialog ── */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display text-destructive">
                <Trash2 size={18} />
                {ar ? "حذف السيرة الذاتية" : "Delete Resume"}
              </DialogTitle>
              <DialogDescription className="font-body">
                {ar
                  ? `هل أنت متأكد من حذف "${deleteTarget?.file_name}"؟ لا يمكن التراجع.`
                  : `Are you sure you want to delete "${deleteTarget?.file_name}"? This cannot be undone.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                {ar ? "إلغاء" : "Cancel"}
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleting} className="gap-2">
                {deleting && <RefreshCw size={14} className="animate-spin" />}
                {ar ? "نعم، احذف" : "Yes, Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Buy Points Modal ── */}
        <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display">
                <Coins size={20} className="text-primary" />
                {ar ? "احصل على المزيد من النقاط" : "Get More Points"}
              </DialogTitle>
              <DialogDescription className="font-body">
                {ar ? "اشترِ نقاط لاستخدام خدمات المنصة." : "Buy points to use platform services."}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-3">
              {[
                { packageId: "starter", name: ar ? "المبتدئ" : "Starter", points: 30, price: "29", period: ar ? "/شهرياً" : "/mo", features: ar ? ["10 تحليل", "6 تحسينات", "6 مقابلات"] : ["10 analyses", "6 enhancements", "6 interviews"] },
                { packageId: "pro", name: ar ? "المحترف" : "Pro", points: 100, price: "79", period: ar ? "/شهرياً" : "/mo", features: ar ? ["33 تحليل", "20 تحسين", "20 مقابلة"] : ["33 analyses", "20 enhancements", "20 interviews"], popular: true },
                { packageId: "business", name: ar ? "الأعمال" : "Business", points: 300, price: "149", period: ar ? "/شهرياً" : "/mo", features: ar ? ["100 تحليل", "60 تحسين", "60 مقابلة"] : ["100 analyses", "60 enhancements", "60 interviews"] },
              ].map((pack) => (
                <div
                  key={pack.points}
                  className={`rounded-xl border p-4 transition-colors ${
                    pack.popular ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-semibold text-foreground">{pack.name}</span>
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Coins size={10} /> {pack.points}
                      </Badge>
                    </div>
                    <span className="text-sm font-bold text-foreground">
                      {pack.price} {ar ? "ر.س" : "SAR"}{pack.period}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground font-body mb-3">
                    {pack.features.map((f) => (
                      <span key={f} className="bg-muted px-2 py-0.5 rounded-full">{f}</span>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    variant={pack.popular ? "default" : "outline"}
                    disabled={buyingPackage === pack.packageId}
                    onClick={async () => {
                      setBuyingPackage(pack.packageId);
                      try {
                        const { data, error } = await supabase.functions.invoke("paymob-checkout", {
                          body: { packageId: pack.packageId },
                        });
                        if (error) throw error;
                        if (data?.checkout_url) {
                          window.location.href = data.checkout_url;
                        } else {
                          throw new Error("No checkout URL");
                        }
                      } catch (err: unknown) {
                        console.error("Checkout error:", err);
                        toast.error(ar ? "فشل إنشاء جلسة الدفع" : "Failed to create checkout session");
                      } finally {
                        setBuyingPackage(null);
                      }
                    }}
                  >
                    {buyingPackage === pack.packageId ? (
                      <><Loader2 size={14} className="animate-spin mr-2" />{ar ? "جاري التحويل..." : "Redirecting..."}</>
                    ) : (
                      ar ? "شراء الآن" : "Buy Now"
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default Dashboard;
