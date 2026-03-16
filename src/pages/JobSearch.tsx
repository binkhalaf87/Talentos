import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { useUserResume } from "@/hooks/useUserResume";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ResumeProfileCard } from "@/components/jobs/ResumeProfileCard";
import { JobCard, JobItem } from "@/components/jobs/JobCard";
import { JobFilters, JobFiltersState, DEFAULT_FILTERS } from "@/components/jobs/JobFilters";
import {
  Search, MapPin, Briefcase, Sparkles, BookmarkCheck, Clock, AlertCircle, Mail,
} from "lucide-react";

/* ── match score (client-side, no AI) ── */
function computeMatchScore(job: JobItem, resumeData: any): number {
  if (!resumeData) return 0;
  let score = 15; // base

  const jobTitle = (resumeData.detected_job_title || "").toLowerCase();
  const jt = job.job_title.toLowerCase();
  if (jobTitle) {
    const words = jobTitle.split(/\s+/).filter(w => w.length > 2);
    const hits = words.filter(w => jt.includes(w));
    score += Math.round((hits.length / Math.max(words.length, 1)) * 40);
  }

  const skills = (resumeData.detected_skills || "").toLowerCase().split(/[,;|]/).map((s: string) => s.trim()).filter(Boolean);
  const jobSkills = (job.job_required_skills || []).map(s => s.toLowerCase());
  if (skills.length && jobSkills.length) {
    const hits = skills.filter((s: string) => jobSkills.some(js => js.includes(s) || s.includes(js)));
    score += Math.round(Math.min((hits.length / Math.max(skills.length, 1)) * 35, 35));
  }

  // description keyword overlap
  const desc = job.job_description?.toLowerCase() || "";
  if (skills.length && desc) {
    const hits = skills.filter((s: string) => s.length > 3 && desc.includes(s));
    score += Math.round(Math.min((hits.length / Math.max(skills.length, 1)) * 10, 10));
  }

  return Math.min(Math.round(score), 99);
}

export default function JobSearch() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const ar = language === "ar";
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: resumeData, loading: resumeLoading } = useUserResume();

  const [jobTitle, setJobTitle] = useState("");
  const [city, setCity] = useState("");
  const [keywords, setKeywords] = useState("");
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [tab, setTab] = useState("search");
  const [filters, setFilters] = useState<JobFiltersState>(DEFAULT_FILTERS);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [savedJobs, setSavedJobs] = useState<any[]>([]);
  const [recentSearches, setRecentSearches] = useState<{ query: string; city: string }[]>([]);
  const [gmailConnected, setGmailConnected] = useState(false);

  // Pre-fill from resume
  useEffect(() => {
    if (resumeData && !jobTitle) {
      if (resumeData.detected_job_title) setJobTitle(resumeData.detected_job_title);
    }
  }, [resumeData]);

  // Load saved jobs + gmail status + recent searches
  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("saved_jobs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("gmail_tokens").select("id").eq("user_id", user.id).limit(1),
      supabase.from("job_search_history").select("query, city").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
    ]).then(([savedRes, gmailRes, historyRes]) => {
      if (savedRes.data) {
        setSavedJobs(savedRes.data);
        setSavedJobIds(new Set(savedRes.data.map((j: any) => j.job_id)));
      }
      setGmailConnected(!!gmailRes.data?.length);
      if (historyRes.data) setRecentSearches(historyRes.data as any);
    });
  }, [user]);

  const handleSearch = useCallback(async () => {
    if (!jobTitle.trim() && !keywords.trim()) {
      toast({ title: ar ? "أدخل عنوان الوظيفة" : "Enter a job title", variant: "destructive" });
      return;
    }
    setLoading(true);
    setSearched(true);
    setTab("search");

    try {
      const query = [jobTitle.trim(), keywords.trim()].filter(Boolean).join(" ");
      const { data, error } = await supabase.functions.invoke("search-jobs", {
        body: {
          query,
          city: city.trim(),
          date_posted: filters.datePosted,
          employment_types: filters.employmentType,
          remote_only: filters.remoteOnly,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const results = (data?.jobs || []).map((j: JobItem) => ({
        ...j,
        match_score: computeMatchScore(j, resumeData),
      }));

      // Sort
      if (filters.sortBy === "date") {
        results.sort((a: JobItem, b: JobItem) => new Date(b.job_posted_at).getTime() - new Date(a.job_posted_at).getTime());
      } else {
        results.sort((a: JobItem, b: JobItem) => (b.match_score ?? 0) - (a.match_score ?? 0));
      }

      setJobs(results);

      // Save search history
      if (user) {
        supabase.from("job_search_history").insert({
          user_id: user.id,
          query: jobTitle.trim(),
          city: city.trim() || null,
          results_count: results.length,
        } as any).then(() => {
          setRecentSearches(prev => [{ query: jobTitle.trim(), city: city.trim() }, ...prev].slice(0, 5));
        });
      }
    } catch (err: any) {
      console.error("Search error:", err);
      toast({ title: ar ? "خطأ في البحث" : "Search Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [jobTitle, city, keywords, filters, resumeData, user, ar, toast]);

  const handleSaveJob = async (job: JobItem) => {
    if (!user) return;
    const { error } = await supabase.from("saved_jobs").insert({
      user_id: user.id,
      job_id: job.job_id,
      job_title: job.job_title,
      company_name: job.employer_name,
      location: [job.job_city, job.job_country].filter(Boolean).join(", "),
      job_type: job.job_employment_type,
      apply_url: job.job_apply_link,
      employer_logo: job.employer_logo,
      match_score: job.match_score ?? null,
      description: job.job_description?.slice(0, 300),
      job_data: job as any,
    } as any);
    if (!error) {
      setSavedJobIds(prev => new Set(prev).add(job.job_id));
      setSavedJobs(prev => [{ ...job, job_id: job.job_id, job_data: job } as any, ...prev]);
      toast({ title: ar ? "تم الحفظ" : "Job saved" });
    }
  };

  const handleUnsaveJob = async (jobId: string) => {
    if (!user) return;
    await supabase.from("saved_jobs").delete().eq("user_id", user.id).eq("job_id", jobId);
    setSavedJobIds(prev => { const n = new Set(prev); n.delete(jobId); return n; });
    setSavedJobs(prev => prev.filter(j => j.job_id !== jobId));
    toast({ title: ar ? "تمت الإزالة" : "Removed" });
  };

  const handleAutoApply = (job: JobItem) => {
    if (!gmailConnected) {
      toast({
        title: ar ? "قم بربط Gmail أولاً" : "Connect Gmail First",
        description: ar ? "اذهب لصفحة التسويق لربط بريدك" : "Go to Marketing page to connect your email",
        variant: "destructive",
      });
      return;
    }
    navigate(`/marketing?jobTitle=${encodeURIComponent(job.job_title)}&company=${encodeURIComponent(job.employer_name)}`);
  };

  const handleRecentSearch = (s: { query: string; city: string }) => {
    setJobTitle(s.query);
    setCity(s.city || "");
  };

  return (
    <div className={`max-w-5xl mx-auto space-y-6 pb-12 ${ar ? "text-right" : ""}`} dir={ar ? "rtl" : "ltr"}>
      {/* Hero Search */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Briefcase className="h-6 w-6 text-primary" />
          <h1 className="text-xl sm:text-2xl font-display font-bold">
            {ar ? "البحث عن الوظائف" : "Job Search"}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-xl">
          {ar
            ? "ابحث عن وظائف تناسب مهاراتك وخبراتك. نستخدم بيانات سيرتك الذاتية المحفوظة لتحسين المطابقة تلقائياً."
            : "Find jobs that match your skills and experience. We use your saved resume data to improve matching automatically."}
        </p>
      </div>

      {/* Search Form */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3">
            <div className="relative">
              <Briefcase size={15} className="absolute top-1/2 -translate-y-1/2 left-3 text-muted-foreground" />
              <Input
                placeholder={ar ? "المسمى الوظيفي" : "Job Title"}
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="pl-9"
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div className="relative">
              <MapPin size={15} className="absolute top-1/2 -translate-y-1/2 left-3 text-muted-foreground" />
              <Input
                placeholder={ar ? "المدينة" : "City"}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="pl-9"
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} disabled={loading} className="sm:px-8">
              <Search size={16} className={ar ? "ml-2" : "mr-2"} />
              {ar ? "بحث" : "Search"}
            </Button>
          </div>

          {/* Keywords (optional) */}
          <div className="mt-3">
            <Input
              placeholder={ar ? "كلمات مفتاحية إضافية (اختياري)" : "Additional keywords (optional)"}
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="text-sm"
            />
          </div>

          {/* Helper note */}
          <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
            <Sparkles size={11} className="text-primary shrink-0" />
            {ar
              ? "نستخدم بيانات سيرتك المحفوظة لتحسين المطابقة بدون إعادة معالجة سيرتك الذاتية."
              : "We use your saved resume data to improve matching without reprocessing your CV."}
          </p>

          {/* Recent searches */}
          {recentSearches.length > 0 && !searched && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <Clock size={12} className="text-muted-foreground" />
              {recentSearches.map((s, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="h-6 text-[11px] px-2"
                  onClick={() => handleRecentSearch(s)}
                >
                  {s.query}{s.city ? ` · ${s.city}` : ""}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resume Profile Card */}
      <ResumeProfileCard resumeData={resumeData} loading={resumeLoading} ar={ar} />

      {/* Tabs: Search Results / Saved */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="search" className="gap-1.5 text-xs">
            <Search size={13} />
            {ar ? "نتائج البحث" : "Results"}
            {searched && !loading && <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">{jobs.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="saved" className="gap-1.5 text-xs">
            <BookmarkCheck size={13} />
            {ar ? "المحفوظة" : "Saved"}
            {savedJobs.length > 0 && <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">{savedJobs.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* Search Results */}
        <TabsContent value="search" className="mt-4 space-y-3">
          {searched && <JobFilters filters={filters} onChange={setFilters} ar={ar} />}

          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardContent className="p-5 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!loading && searched && jobs.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <AlertCircle className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  {ar ? "لم يتم العثور على وظائف. حاول تغيير المدينة أو المسمى الوظيفي." : "No jobs found. Try changing city or job title."}
                </p>
              </CardContent>
            </Card>
          )}

          {!loading && jobs.length > 0 && (
            <>
              {resumeData && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Sparkles size={11} className="text-primary" />
                  {ar
                    ? "المطابقة بناءً على المسمى الوظيفي والمهارات والخبرة من سيرتك المحفوظة."
                    : "Matched based on title, skills, and experience from your saved resume."}
                </p>
              )}
              <div className="space-y-3">
                {jobs.map((job) => (
                  <JobCard
                    key={job.job_id}
                    job={job}
                    isSaved={savedJobIds.has(job.job_id)}
                    ar={ar}
                    onSave={handleSaveJob}
                    onUnsave={handleUnsaveJob}
                    onAutoApply={handleAutoApply}
                    gmailConnected={gmailConnected}
                  />
                ))}
              </div>
            </>
          )}

          {!searched && !loading && (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  {ar ? "ابدأ بالبحث عن وظائف باستخدام المسمى الوظيفي أو المدينة" : "Start searching for jobs using a job title or city"}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Saved Jobs */}
        <TabsContent value="saved" className="mt-4 space-y-3">
          {savedJobs.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <BookmarkCheck className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  {ar ? "لم تقم بحفظ أي وظائف بعد." : "No saved jobs yet."}
                </p>
              </CardContent>
            </Card>
          ) : (
            savedJobs.map((sj: any) => {
              const job: JobItem = sj.job_data || {
                job_id: sj.job_id,
                job_title: sj.job_title,
                employer_name: sj.company_name || "",
                employer_logo: sj.employer_logo || null,
                job_city: sj.location || "",
                job_state: "", job_country: "",
                job_employment_type: sj.job_type || "",
                job_apply_link: sj.apply_url || "",
                job_description: sj.description || "",
                job_posted_at: sj.created_at || "",
                job_is_remote: false,
                job_min_salary: null, job_max_salary: null,
                job_salary_currency: null, job_salary_period: null,
                job_required_skills: [],
                job_required_experience_months: null,
                job_highlights: { qualifications: [], responsibilities: [] },
                match_score: sj.match_score,
              };
              return (
                <JobCard
                  key={sj.job_id}
                  job={job}
                  isSaved={true}
                  ar={ar}
                  onSave={handleSaveJob}
                  onUnsave={handleUnsaveJob}
                  onAutoApply={handleAutoApply}
                  gmailConnected={gmailConnected}
                />
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* Gmail status footer hint */}
      {!gmailConnected && (
        <Card className="border-dashed border-primary/20 bg-muted/30">
          <CardContent className="p-3 flex items-center gap-2">
            <Mail size={14} className="text-primary shrink-0" />
            <p className="text-xs text-muted-foreground">
              {ar
                ? "قم بربط Gmail في صفحة التسويق لاستخدام التقديم التلقائي."
                : "Connect Gmail in the Marketing page to use Auto Apply."}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] shrink-0 ml-auto"
              onClick={() => navigate("/marketing")}
            >
              {ar ? "ربط" : "Connect"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
