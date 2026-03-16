import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, User, Camera, Mail, Phone, Globe } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Profile = () => {
  const { user } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resumeCount, setResumeCount] = useState(0);
  const [analysisCount, setAnalysisCount] = useState(0);
  const [generatedCount, setGeneratedCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [profileRes, resumesRes, analysesRes, generatedRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).single(),
        supabase.from("resumes").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("analyses").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("generated_resumes").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      if (profileRes.data) {
        setName(profileRes.data.display_name || "");
        setEmail(profileRes.data.email || "");
        setPhone(profileRes.data.phone || "");
        setAvatarUrl(profileRes.data.avatar_url);
      }
      setResumeCount(resumesRes.count || 0);
      setAnalysisCount(analysesRes.count || 0);
      setGeneratedCount(generatedRes.count || 0);
    };
    load();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name, phone, language })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t.profile.saved);
    }
  };

  const stats = [
    { label: t.dashboard.myResumes, value: resumeCount },
    { label: t.dashboard.myAnalyses, value: analysisCount },
    { label: t.dashboard.myGenerated, value: generatedCount },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur">
        <div className="container flex items-center gap-4 h-16">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard"><ArrowLeft size={18} /></Link>
          </Button>
          <Link to="/dashboard" className="font-display text-lg font-bold text-foreground">
            TALEN<span className="text-primary">TRY</span>
          </Link>
          <span className="text-border/60 hidden sm:inline">/</span>
          <h1 className="font-display font-semibold text-foreground text-sm hidden sm:block">{t.profile.title}</h1>
        </div>
      </header>

      <main className="container py-8 md:py-12 max-w-lg">
        {/* Avatar & Name */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="w-24 h-24 rounded-full object-cover border-2 border-primary/20" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                <User size={36} className="text-primary" />
              </div>
            )}
          </div>
          <h2 className="font-display font-semibold text-lg text-foreground">{name || t.profile.yourProfile}</h2>
          <p className="text-sm text-muted-foreground font-body">{email}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center p-3 bg-card rounded-xl border border-border">
              <p className="text-2xl font-display font-bold text-primary">{s.value}</p>
              <p className="text-xs text-muted-foreground font-body mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Edit Form */}
        <div className="space-y-4 p-6 bg-card rounded-xl border border-border">
          <div>
            <label className="text-sm font-display font-medium text-foreground mb-1.5 flex items-center gap-2">
              <User size={14} className="text-muted-foreground" />
              {t.profile.name}
            </label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-background" />
          </div>
          <div>
            <label className="text-sm font-display font-medium text-foreground mb-1.5 flex items-center gap-2">
              <Mail size={14} className="text-muted-foreground" />
              {t.profile.email}
            </label>
            <Input value={email} disabled className="bg-background opacity-60" />
          </div>
          <div>
            <label className="text-sm font-display font-medium text-foreground mb-1.5 flex items-center gap-2">
              <Phone size={14} className="text-muted-foreground" />
              {t.profile.phone}
            </label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+966 5XX XXX XXXX" className="bg-background" />
          </div>
          <div>
            <label className="text-sm font-display font-medium text-foreground mb-1.5 flex items-center gap-2">
              <Globe size={14} className="text-muted-foreground" />
              {t.profile.language}
            </label>
            <div className="flex gap-2">
              <Button variant={language === "en" ? "default" : "outline"} size="sm" onClick={() => setLanguage("en")}>English</Button>
              <Button variant={language === "ar" ? "default" : "outline"} size="sm" onClick={() => setLanguage("ar")}>العربية</Button>
            </div>
          </div>
          <Button className="w-full mt-4" onClick={handleSave} disabled={saving}>
            {saving ? t.common.loading : t.profile.save}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Profile;
