import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  Sparkles,
  Mail,
  Send,
  Loader2,
  CheckCircle,
  XCircle,
  Paperclip,
  LogOut,
  Wand2,
  Building2,
  Coins,
  Search,
  Clock,
  Users,
  TrendingUp,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ResumeOption {
  id: string;
  file_name: string;
  type: "uploaded" | "generated";
}

interface CompanyItem {
  id: string;
  name: string;
  email: string | null;
  industry: string | null;
}

interface SentRecord {
  id: string;
  company_name: string;
  recipient_email: string;
  subject: string;
  created_at: string;
  gmail_status: string;
}

const COMPANY_COUNT_OPTIONS = [10, 25, 50, 100];
const POINTS_PER_100 = 15;
const calcCost = (count: number) => Math.ceil((count / 100) * POINTS_PER_100);

const DEFAULT_SUBJECT = "Application for Joining Your Team – {jobTitle}";
const DEFAULT_BODY = `Dear Hiring Team at {company},

I hope this message finds you well. I am writing to express my strong interest in joining {company} and contributing to your team's success.

With a background in {industry}, I bring a combination of technical expertise and a results-driven mindset that aligns with the values and goals of forward-thinking organizations like yours.

I would welcome the opportunity to discuss how my skills and experience can add value to your team. I have attached my resume for your review and would be happy to connect at your convenience.

Thank you for considering my application. I look forward to hearing from you.

Best regards,`;

const Marketing = () => {
  const { user } = useAuth();
  const { t, language: uiLang } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const ar = uiLang === "ar";

  const DEFAULT_SUBJECT_AR = "طلب انضمام إلى فريقكم – {jobTitle}";
  const DEFAULT_BODY_AR = `السادة في شركة {company}،

تحية طيبة،

أتقدم إليكم بهذه الرسالة للتعبير عن اهتمامي الكبير بالانضمام إلى {company} والمساهمة في نجاح فريقكم.

بخلفيتي في مجال {industry}، أمتلك مزيجًا من الكفاءة التقنية والتوجه نحو النتائج الذي يتوافق مع قيم وأهداف المؤسسات الرائدة مثل مؤسستكم.

يسعدني مناقشة كيف يمكن لمهاراتي وخبرتي إضافة قيمة لفريقكم. أرفق سيرتي الذاتية للمراجعة وأنا سعيد بالتواصل في أي وقت يناسبكم.

شكرًا لكم على النظر في طلبي، وأتطلع إلى الاستماع منكم.

مع خالص التقدير،`;

  // Gmail state
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [gmailLoading, setGmailLoading] = useState(true);

  // Email compose state
  const [emailSubject, setEmailSubject] = useState(ar ? DEFAULT_SUBJECT_AR : DEFAULT_SUBJECT);
  const [emailBody, setEmailBody] = useState(ar ? DEFAULT_BODY_AR : DEFAULT_BODY);

  // Resume attachment
  const [resumes, setResumes] = useState<ResumeOption[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(
    searchParams.get("resume_id") || searchParams.get("id") || null,
  );
  const [selectedResumeType, setSelectedResumeType] = useState<"uploaded" | "generated">("uploaded");

  // Companies
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [companyCount, setCompanyCount] = useState(10);
  const [companySearch, setCompanySearch] = useState("");
  const [userPoints, setUserPoints] = useState(0);

  // Settings
  const [jobTitle, setJobTitle] = useState("");
  const [industry, setIndustry] = useState("");
  const [emailLang, setEmailLang] = useState<string>(uiLang);
  const [tone, setTone] = useState("formal");
  const [showSettings, setShowSettings] = useState(false);

  // Action state
  const [generating, setGenerating] = useState(false);
  const [improvingSubject, setImprovingSubject] = useState(false);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [sendProgress, setSendProgress] = useState({ sent: 0, total: 0 });

  // Tracker
  const [sentRecords, setSentRecords] = useState<SentRecord[]>([]);
  const [trackerSearch, setTrackerSearch] = useState("");

  const selectedResume = useMemo(
    () => resumes.find((r) => r.id === selectedResumeId) || null,
    [resumes, selectedResumeId],
  );

  const filteredCompanies = useMemo(() => {
    let list = companies.filter((c) => c.email);
    if (companySearch.trim()) {
      const q = companySearch.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || (c.industry || "").toLowerCase().includes(q));
    }
    return list;
  }, [companies, companySearch]);

  const selectedCompanies = useMemo(() => filteredCompanies.slice(0, companyCount), [filteredCompanies, companyCount]);

  const estimatedCost = calcCost(selectedCompanies.length);
  const canAfford = userPoints >= estimatedCost;

  const filteredSentRecords = useMemo(() => {
    if (!trackerSearch.trim()) return sentRecords;
    const q = trackerSearch.toLowerCase();
    return sentRecords.filter(
      (r) => r.company_name.toLowerCase().includes(q) || r.recipient_email.toLowerCase().includes(q),
    );
  }, [sentRecords, trackerSearch]);

  // ── Data loading ──────────────────────────────────────────────

  const checkGmailStatus = useCallback(async () => {
    if (!user) {
      setGmailConnected(false);
      setGmailEmail(null);
      setGmailLoading(false);
      return;
    }
    setGmailLoading(true);
    try {
      const { data, error } = await supabase
        .from("gmail_tokens")
        .select("gmail_email")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data && !error) {
        setGmailConnected(true);
        setGmailEmail(data.gmail_email);
      } else {
        setGmailConnected(false);
        setGmailEmail(null);
      }
    } catch {
      setGmailConnected(false);
      setGmailEmail(null);
    } finally {
      setGmailLoading(false);
    }
  }, [user]);

  const loadResumes = useCallback(async () => {
    if (!user) return;
    const [{ data: uploaded }, { data: generated }] = await Promise.all([
      supabase.from("resumes").select("id, file_name").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase
        .from("generated_resumes")
        .select("id, title")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);
    const list: ResumeOption[] = [
      ...(uploaded || []).map((r) => ({ id: r.id, file_name: r.file_name, type: "uploaded" as const })),
      ...(generated || []).map((r) => ({ id: r.id, file_name: r.title, type: "generated" as const })),
    ];
    setResumes(list);
    if (!selectedResumeId && list.length > 0) {
      setSelectedResumeId(list[0].id);
      setSelectedResumeType(list[0].type);
    }
  }, [user, selectedResumeId]);

  const loadCompanies = useCallback(async () => {
    const { data } = await supabase.from("companies").select("id, name, email, industry").order("name");
    if (data) setCompanies(data);
  }, []);

  const loadUserPoints = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("point_transactions").select("amount").eq("user_id", user.id);
    if (data) setUserPoints(data.reduce((sum, tx) => sum + tx.amount, 0));
  }, [user]);

  const loadSentRecords = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("marketing_emails")
      .select("id, company_name, recipient_email, subject, created_at, gmail_status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setSentRecords(data as SentRecord[]);
  }, [user]);

  useEffect(() => {
    checkGmailStatus();
  }, [checkGmailStatus]);
  useEffect(() => {
    loadResumes();
  }, [loadResumes]);
  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);
  useEffect(() => {
    loadUserPoints();
  }, [loadUserPoints]);
  useEffect(() => {
    loadSentRecords();
  }, [loadSentRecords]);

  useEffect(() => {
    const gmailParam = searchParams.get("gmail");
    if (gmailParam === "connected") {
      toast.success(t.marketing.gmailConnected);
      checkGmailStatus();
      const next = new URLSearchParams(searchParams);
      next.delete("gmail");
      setSearchParams(next, { replace: true });
    } else if (gmailParam === "error") {
      toast.error(searchParams.get("msg") || t.marketing.gmailError);
      const next = new URLSearchParams(searchParams);
      next.delete("gmail");
      next.delete("msg");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, t, checkGmailStatus]);

  // ── Gmail connect / disconnect ────────────────────────────────

  const handleConnectGmail = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("gmail-auth", {
        body: { redirectUri: window.location.href.split("?")[0] },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err?.message || t.marketing.gmailError);
    }
  };

  const handleDisconnectGmail = async () => {
    if (!user) return;
    try {
      await supabase.from("gmail_tokens").delete().eq("user_id", user.id);
      setGmailConnected(false);
      setGmailEmail(null);
      toast.success(ar ? "تم قطع اتصال Gmail" : "Gmail disconnected");
    } catch {
      toast.error(t.marketing.gmailError);
    }
  };

  // ── Resume context helpers ────────────────────────────────────

  const loadResumeContext = async () => {
    if (!selectedResumeId) return "";
    if (selectedResumeType === "uploaded") {
      const { data } = await supabase.from("resumes").select("extracted_text").eq("id", selectedResumeId).single();
      return data?.extracted_text ? `\n\nCandidate's resume:\n${data.extracted_text.substring(0, 2000)}` : "";
    }
    const { data } = await supabase.from("generated_resumes").select("content").eq("id", selectedResumeId).single();
    return data?.content ? `\n\nCandidate's resume data:\n${JSON.stringify(data.content).substring(0, 2000)}` : "";
  };

  const loadProfileContext = async () => {
    if (!user) return "";
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, email, phone")
      .eq("user_id", user.id)
      .single();
    if (!profile) return "";
    return `\nCandidate name: ${profile.display_name || "N/A"}\nCandidate email: ${profile.email || "N/A"}${profile.phone ? `\nPhone: ${profile.phone}` : ""}`;
  };

  // ── AI Generate full email ────────────────────────────────────

  const handleGenerateEmail = async () => {
    if (!selectedResumeId) {
      toast.error(t.marketing.selectResumeFirst);
      return;
    }
    if (!user) return;
    setGenerating(true);
    try {
      const [resumeContext, profileContext] = await Promise.all([loadResumeContext(), loadProfileContext()]);
      const { data, error } = await supabase.functions.invoke("generate-email", {
        body: {
          jobTitle: jobTitle || "General Application",
          industry: industry || "General",
          language: emailLang,
          tone,
          resumeContext,
          profileContext,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setEmailSubject(data.subject || "");
      setEmailBody(data.body + (data.signature ? `\n\n${data.signature}` : ""));
      toast.success(ar ? "تم إنشاء الرسالة بنجاح" : "Email generated successfully");
    } catch (err: any) {
      toast.error(err?.message || t.common.error);
    } finally {
      setGenerating(false);
    }
  };

  const handleImproveSubject = async () => {
    if (!emailSubject.trim()) return;
    setImprovingSubject(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-email", {
        body: {
          jobTitle: jobTitle || "General Application",
          industry: industry || "General",
          language: emailLang,
          tone,
          resumeContext: `Current subject to improve: ${emailSubject}`,
          profileContext: "",
        },
      });
      if (error) throw error;
      if (data?.subject) setEmailSubject(data.subject);
    } catch (err: any) {
      toast.error(err?.message || t.common.error);
    } finally {
      setImprovingSubject(false);
    }
  };

  // ── Bulk Send ─────────────────────────────────────────────────

  const handleBulkSend = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast.error(ar ? "العنوان والرسالة مطلوبان" : "Subject and body are required");
      return;
    }
    if (!user) return;
    if (selectedCompanies.length === 0) {
      toast.error(ar ? "لا توجد شركات مؤهلة للإرسال" : "No eligible companies to send to");
      return;
    }
    if (!canAfford) {
      toast.error(ar ? "رصيد النقاط غير كافٍ" : "Insufficient points balance");
      return;
    }

    setSendingBulk(true);
    setSendProgress({ sent: 0, total: selectedCompanies.length });
    let successCount = 0;

    for (let i = 0; i < selectedCompanies.length; i++) {
      const company = selectedCompanies[i];
      if (!company.email || !company.email.trim()) {
        console.warn(`Skipping ${company.name}: no email address`);
        continue;
      }
      try {
        const personalizedBody = emailBody
          .replace(/\{company\}/gi, company.name)
          .replace(/\{industry\}/gi, company.industry || "")
          .replace(/\{jobTitle\}/gi, jobTitle || "");

        const personalizedSubject = emailSubject
          .replace(/\{company\}/gi, company.name)
          .replace(/\{jobTitle\}/gi, jobTitle || "");

        await supabase.from("marketing_emails").insert([
          {
            user_id: user.id,
            job_title: jobTitle || "General",
            industry: industry || "General",
            language: emailLang,
            tone,
            subject: personalizedSubject,
            body: personalizedBody,
            recipient_email: company.email,
            company_name: company.name,
            selected_resume_id: selectedResumeId,
            action_type: "sent",
            gmail_status: gmailConnected ? "sending" : "generated",
          },
        ]);

        if (gmailConnected) {
          await supabase.functions.invoke("gmail-send", {
            body: {
              action: "send",
              to: company.email,
              subject: personalizedSubject,
              body: personalizedBody,
              resumeId: selectedResumeId,
              resumeType: selectedResumeType,
            },
          });
        }
        successCount++;
      } catch (err) {
        console.error(`Failed to send to ${company.name}:`, err);
      }
      setSendProgress({ sent: i + 1, total: selectedCompanies.length });
    }

    if (successCount > 0) {
      const cost = calcCost(successCount);
      await supabase.from("point_transactions").insert({
        user_id: user.id,
        amount: -cost,
        type: "marketing_send",
        description: ar ? `إرسال إلى ${successCount} شركة` : `Sent to ${successCount} companies`,
      } as any);
      setUserPoints((prev) => prev - cost);
    }

    toast.success(
      ar
        ? `تم الإرسال بنجاح إلى ${successCount} من ${selectedCompanies.length} شركة`
        : `Successfully sent to ${successCount} of ${selectedCompanies.length} companies`,
    );
    setSendingBulk(false);
    await loadSentRecords();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(ar ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background" dir={ar ? "rtl" : "ltr"}>
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur">
        <div className="container flex items-center gap-4 h-16">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard">
              <ArrowLeft size={18} className={ar ? "rotate-180" : ""} />
            </Link>
          </Button>
          <Link to="/dashboard" className="font-display text-lg font-bold text-foreground">
            TALEN<span className="text-primary">TRY</span>
          </Link>
          <span className="text-border/60 hidden sm:inline">/</span>
          <div className="hidden sm:flex items-center gap-2">
            <Mail size={16} className="text-primary" />
            <span className="font-display font-semibold text-foreground text-sm">
              {ar ? "الإرسال الجماعي" : "Bulk Email"}
            </span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-sm">
            <Coins size={14} className="text-primary" />
            <span className="font-display font-bold text-foreground">{userPoints}</span>
            <span className="text-muted-foreground text-xs">{ar ? "نقطة" : "pts"}</span>
          </div>
        </div>
      </header>

      <main className="container py-8 max-w-3xl space-y-5">
        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              icon: <Users size={15} />,
              label: ar ? "إجمالي المُرسَل" : "Total Sent",
              value: sentRecords.length,
            },
            {
              icon: <TrendingUp size={15} />,
              label: ar ? "الشركات المتاحة" : "Available Companies",
              value: companies.filter((c) => c.email).length,
            },
            {
              icon: <Coins size={15} />,
              label: ar ? "رصيد النقاط" : "Points Balance",
              value: userPoints,
            },
          ].map((stat, i) => (
            <div key={i} className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3">
              <div className="text-primary">{stat.icon}</div>
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-lg font-display font-bold text-foreground leading-tight">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Gmail Connection */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                  gmailConnected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                <Mail size={16} />
              </div>
              <div>
                <p className="text-sm font-display font-semibold text-foreground">Gmail</p>
                {gmailLoading ? (
                  <p className="text-xs text-muted-foreground">{t.marketing.gmailConnecting}</p>
                ) : gmailConnected ? (
                  <p className="text-xs text-primary flex items-center gap-1">
                    <CheckCircle size={11} />
                    {gmailEmail || t.marketing.gmailConnected}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">{t.marketing.gmailNotConnected}</p>
                )}
              </div>
            </div>
            {gmailConnected ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnectGmail}
                className="text-muted-foreground hover:text-destructive text-xs"
              >
                <LogOut size={13} className={ar ? "ml-1" : "mr-1"} />
                {t.marketing.disconnectGmail}
              </Button>
            ) : (
              <Button size="sm" onClick={handleConnectGmail} disabled={gmailLoading}>
                <Mail size={13} className={ar ? "ml-1.5" : "mr-1.5"} />
                {t.marketing.connectGmail}
              </Button>
            )}
          </div>
        </div>

        {/* Email Compose */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Subject */}
          <div className="border-b border-border px-5 py-3 flex items-center gap-3">
            <label className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wide shrink-0 w-14">
              {ar ? "العنوان" : "Subject"}
            </label>
            <Input
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder={ar ? "عنوان البريد الإلكتروني" : "Email subject line"}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 flex-1 text-sm"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleImproveSubject}
              disabled={improvingSubject || !emailSubject.trim()}
              className="shrink-0 text-xs text-primary hover:text-primary/80 px-2"
            >
              {improvingSubject ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Wand2 size={13} className={ar ? "ml-1" : "mr-1"} />
              )}
              {ar ? "تحسين" : "Improve"}
            </Button>
          </div>

          {/* Body */}
          <div className="relative">
            <Textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              placeholder={
                ar
                  ? "نص الرسالة... استخدم {company} لاسم الشركة و{jobTitle} للمسمى الوظيفي"
                  : "Email body... Use {company} for company name and {jobTitle} for job title"
              }
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-5 py-4 min-h-[280px] resize-none text-sm leading-relaxed"
              dir={emailLang === "ar" ? "rtl" : "ltr"}
            />
            {/* Variable hints */}
            <div className="absolute bottom-3 right-3 flex gap-1">
              {["{company}", "{jobTitle}", "{industry}"].map((v) => (
                <span
                  key={v}
                  onClick={() => setEmailBody((prev) => prev + v)}
                  className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-mono cursor-pointer hover:bg-primary/20 transition-colors"
                >
                  {v}
                </span>
              ))}
            </div>
          </div>

          {/* Attachment + AI row */}
          <div className="border-t border-border px-5 py-3 flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-2">
              <Paperclip size={13} className="text-muted-foreground" />
              {selectedResume ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-foreground font-body truncate max-w-[140px]">
                    {selectedResume.file_name}
                  </span>
                  <Select
                    value={selectedResumeId || ""}
                    onValueChange={(val) => {
                      const r = resumes.find((x) => x.id === val);
                      if (r) {
                        setSelectedResumeId(r.id);
                        setSelectedResumeType(r.type);
                      }
                    }}
                  >
                    <SelectTrigger className="h-6 w-auto text-xs border-0 bg-transparent shadow-none px-1">
                      <span className="text-primary text-xs">{t.marketing.changeResume}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {resumes.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.file_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">{t.marketing.noResumes}</span>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleGenerateEmail}
              disabled={generating || !selectedResumeId}
              className="text-xs text-primary hover:text-primary/80 gap-1.5"
            >
              {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {generating
                ? ar
                  ? "جارٍ الإنشاء..."
                  : "Generating..."
                : ar
                  ? "إنشاء بالذكاء الاصطناعي"
                  : "Generate with AI"}
            </Button>
          </div>
        </div>

        {/* Settings (collapsible) */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 text-sm font-display font-medium text-foreground w-full px-5 py-3.5 hover:bg-muted/30 transition-colors"
          >
            <Sparkles size={14} className="text-primary" />
            {ar ? "إعدادات الإنشاء بالذكاء الاصطناعي" : "AI Generation Settings"}
            <ChevronDown
              size={14}
              className={`ml-auto transition-transform duration-200 ${showSettings ? "rotate-180" : ""}`}
            />
          </button>

          {showSettings && (
            <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border pt-4">
              <div>
                <label className="text-xs font-display font-medium text-muted-foreground mb-1 block">
                  {t.marketing.jobTitle}
                </label>
                <Input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder={t.marketing.jobTitlePlaceholder}
                  className="bg-background text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-display font-medium text-muted-foreground mb-1 block">
                  {t.marketing.industry}
                </label>
                <Input
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder={t.marketing.industryPlaceholder}
                  className="bg-background text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-display font-medium text-muted-foreground mb-1 block">
                  {t.marketing.language}
                </label>
                <Select value={emailLang} onValueChange={setEmailLang}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">{t.common.english}</SelectItem>
                    <SelectItem value="ar">{t.common.arabic}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-display font-medium text-muted-foreground mb-1 block">
                  {t.marketing.tone}
                </label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="formal">{t.marketing.tones.formal}</SelectItem>
                    <SelectItem value="confident">{t.marketing.tones.confident}</SelectItem>
                    <SelectItem value="concise">{t.marketing.tones.concise}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* Company Selection */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Building2 size={15} className="text-primary" />
            <h2 className="text-sm font-display font-semibold text-foreground">
              {ar ? "اختيار الشركات المستهدفة" : "Target Companies"}
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {COMPANY_COUNT_OPTIONS.map((count) => (
              <Button
                key={count}
                variant={companyCount === count ? "default" : "outline"}
                size="sm"
                onClick={() => setCompanyCount(count)}
                className="text-xs"
              >
                {count} {ar ? "شركة" : "co."}
              </Button>
            ))}
          </div>

          <div className="relative">
            <Search
              size={13}
              className={`absolute ${ar ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 text-muted-foreground`}
            />
            <Input
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              placeholder={ar ? "فلترة بالاسم أو القطاع..." : "Filter by name or industry..."}
              className={`${ar ? "pr-9" : "pl-9"} h-9 text-sm bg-background`}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
            <div className="text-sm">
              <span className="text-muted-foreground">{ar ? "سيتم الإرسال إلى " : "Sending to "}</span>
              <span className="font-bold text-foreground">{selectedCompanies.length}</span>
              <span className="text-muted-foreground"> {ar ? "شركة" : "companies"}</span>
              {filteredCompanies.length < companyCount && (
                <span className="text-xs text-muted-foreground block mt-0.5">
                  ({ar ? `${filteredCompanies.length} متاح فقط` : `${filteredCompanies.length} available`})
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Coins size={13} className={canAfford ? "text-primary" : "text-destructive"} />
              <span className={`font-display font-bold text-sm ${canAfford ? "text-primary" : "text-destructive"}`}>
                {estimatedCost} {ar ? "نقطة" : "pts"}
              </span>
            </div>
          </div>

          {!canAfford && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <XCircle size={11} />
              {ar
                ? "رصيد النقاط غير كافٍ. اشترِ نقاط إضافية من لوحة التحكم."
                : "Insufficient points. Buy more from the dashboard."}
            </p>
          )}
        </div>

        {/* Send Button */}
        <Button
          size="lg"
          className="w-full h-12 text-base font-display font-semibold"
          onClick={handleBulkSend}
          disabled={
            !gmailConnected ||
            sendingBulk ||
            selectedCompanies.length === 0 ||
            !canAfford ||
            !emailSubject.trim() ||
            !emailBody.trim()
          }
        >
          {sendingBulk ? (
            <div className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              <span>
                {sendProgress.sent}/{sendProgress.total} {ar ? "جارٍ الإرسال..." : "sending..."}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Send size={16} />
              {ar ? `إرسال إلى ${selectedCompanies.length} شركة` : `Send to ${selectedCompanies.length} companies`}
            </div>
          )}
        </Button>

        {!gmailConnected && (
          <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
            <XCircle size={11} />
            {t.marketing.gmailNotConnected}
          </p>
        )}

        {/* ── Sent Tracker ── */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-primary" />
              <h2 className="text-sm font-display font-semibold text-foreground">
                {ar ? "سجل الإرسال" : "Sent Tracker"}
              </h2>
              {sentRecords.length > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-display font-bold">
                  {sentRecords.length}
                </span>
              )}
            </div>
            {sentRecords.length > 0 && (
              <div className="relative">
                <Search
                  size={12}
                  className={`absolute ${ar ? "right-2.5" : "left-2.5"} top-1/2 -translate-y-1/2 text-muted-foreground`}
                />
                <Input
                  value={trackerSearch}
                  onChange={(e) => setTrackerSearch(e.target.value)}
                  placeholder={ar ? "بحث..." : "Search..."}
                  className={`${ar ? "pr-7" : "pl-7"} h-7 w-44 text-xs bg-background`}
                />
              </div>
            )}
          </div>

          {sentRecords.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted mx-auto mb-3">
                <Send size={16} className="text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground font-body">
                {ar ? "لم يتم إرسال أي رسائل بعد" : "No emails sent yet"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {ar ? "ستظهر الرسائل هنا بعد الإرسال" : "Sent emails will appear here"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredSentRecords.map((record) => (
                <div
                  key={record.id}
                  className="px-5 py-3.5 flex items-start justify-between gap-3 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 size={13} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-display font-semibold text-foreground truncate">
                        {record.company_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{record.recipient_email}</p>
                      <p className="text-xs text-muted-foreground/70 truncate mt-0.5 font-body italic">
                        {record.subject}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div
                      className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-display font-semibold ${
                        record.gmail_status === "sent" || record.gmail_status === "sending"
                          ? "bg-green-500/10 text-green-600"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <CheckCircle size={9} />
                      {record.gmail_status === "sending"
                        ? ar
                          ? "مُرسَل"
                          : "Sent"
                        : record.gmail_status === "generated"
                          ? ar
                            ? "محفوظ"
                            : "Saved"
                          : ar
                            ? "مُرسَل"
                            : "Sent"}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-0.5 justify-end">
                      <Clock size={9} />
                      {formatDate(record.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredSentRecords.length === 0 && sentRecords.length > 0 && (
            <div className="px-5 py-6 text-center">
              <p className="text-sm text-muted-foreground">{ar ? "لا توجد نتائج للبحث" : "No results found"}</p>
            </div>
          )}
        </div>

        {/* Back */}
        <div className="text-center pb-4">
          <Button variant="ghost" asChild className="text-sm text-muted-foreground">
            <Link to="/dashboard">
              <ArrowLeft size={13} className={ar ? "ml-1.5 rotate-180" : "mr-1.5"} />
              {t.marketing.returnToDashboard}
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Marketing;
