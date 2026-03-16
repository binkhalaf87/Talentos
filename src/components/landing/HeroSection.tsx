import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, BarChart3, FileText, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";

const HeroSection = () => {
  const { language } = useLanguage();
  const ar = language === "ar";

  const floatingCards = [
    { icon: BarChart3, label: ar ? "تحليل ATS" : "ATS Score", value: "92%", color: "text-emerald-500" },
    { icon: Sparkles, label: ar ? "تحسين ذكي" : "AI Enhanced", value: "+47%", color: "text-primary" },
    { icon: Send, label: ar ? "تقديم تلقائي" : "Auto Apply", value: "150+", color: "text-amber-500" },
  ];

  return (
    <section className="relative min-h-[92vh] flex items-center overflow-hidden" dir={ar ? "rtl" : "ltr"}>
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.12),transparent)]" />
        <div className="absolute top-1/4 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-primary/3 rounded-full blur-[120px]" />
        {/* Dot grid */}
        <div className="absolute inset-0 bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] bg-[size:32px_32px] opacity-40" />
      </div>

      <div className="container relative pt-24 pb-16">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Text Column */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Badge */}
            <motion.div
              className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-primary/8 border border-primary/15 text-primary text-sm font-display font-semibold mb-8"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
              </span>
              {ar ? "منصة الذكاء الاصطناعي المهنية" : "AI Career Operating System"}
            </motion.div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] xl:text-6xl font-display font-extrabold text-foreground leading-[1.08] tracking-tight mb-6">
              {ar ? (
                <>
                  <span className="block">سيرتك الذاتية</span>
                  <span className="block text-primary">تستحق فرصة أفضل</span>
                </>
              ) : (
                <>
                  <span className="block">Your Resume</span>
                  <span className="block text-primary">Deserves Better</span>
                </>
              )}
            </h1>

            {/* Subheadline */}
            <p className="text-lg md:text-xl text-muted-foreground font-body leading-relaxed max-w-[520px] mb-10">
              {ar
                ? "حلّل سيرتك الذاتية بعين مسؤول التوظيف، حسّنها بالذكاء الاصطناعي، وتقدّم لعشرات الوظائف بنقرة واحدة."
                : "Analyze your resume through a recruiter's eyes, enhance it with AI, and apply to dozens of jobs with a single click."}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-12">
              <Button size="lg" className="text-base px-8 h-13 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all" asChild>
                <Link to="/signup">
                  {ar ? "حلّل سيرتي الذاتية مجاناً" : "Analyze My Resume Free"}
                  <ArrowRight className={`${ar ? "mr-2 rotate-180" : "ml-2"}`} size={18} />
                </Link>
              </Button>
            </div>

            {/* Social proof line */}
            <motion.div
              className="flex items-center gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              <div className="flex -space-x-2 rtl:space-x-reverse">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-background bg-gradient-to-br from-primary/20 to-primary/40" />
                ))}
              </div>
              <p className="text-sm text-muted-foreground font-body">
                {ar ? "انضمّ لأكثر من ١٠,٠٠٠ محترف يثقون بنا" : "Trusted by 10,000+ professionals"}
              </p>
            </motion.div>
          </motion.div>

          {/* Visual Column - Interactive Dashboard Preview */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Main card */}
            <div className="relative rounded-2xl bg-card border border-border shadow-prominent overflow-hidden">
              {/* Top bar */}
              <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/30">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-destructive/40" />
                  <div className="w-3 h-3 rounded-full bg-amber-400/40" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400/40" />
                </div>
                <div className="flex-1 mx-8">
                  <div className="h-5 rounded-full bg-muted max-w-[200px] mx-auto" />
                </div>
              </div>

              {/* Dashboard mockup */}
              <div className="p-5 space-y-4">
                {/* Score section */}
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
                      <motion.circle
                        cx="40" cy="40" r="34" fill="none"
                        stroke="hsl(var(--primary))" strokeWidth="6" strokeLinecap="round"
                        strokeDasharray={`${0.85 * 213.6} 213.6`}
                        initial={{ strokeDasharray: "0 213.6" }}
                        animate={{ strokeDasharray: `${0.85 * 213.6} 213.6` }}
                        transition={{ duration: 2, delay: 1, ease: "easeOut" }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-display font-bold text-foreground">85</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-display font-semibold text-foreground mb-2">{ar ? "درجة ATS" : "ATS Score"}</div>
                    <div className="space-y-1.5">
                      {[
                        { w: "85%", label: ar ? "الكلمات المفتاحية" : "Keywords" },
                        { w: "92%", label: ar ? "التنسيق" : "Formatting" },
                        { w: "78%", label: ar ? "الخبرات" : "Experience" },
                      ].map((bar) => (
                        <div key={bar.label} className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground w-14 shrink-0">{bar.label}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <motion.div
                              className="h-full rounded-full bg-primary"
                              initial={{ width: 0 }}
                              animate={{ width: bar.w }}
                              transition={{ duration: 1.5, delay: 1.2, ease: "easeOut" }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Improvement suggestions */}
                <div className="space-y-2">
                  {[
                    { color: "bg-emerald-500", text: ar ? "✓ ملخص مهني قوي" : "✓ Strong professional summary" },
                    { color: "bg-amber-500", text: ar ? "⚡ أضف أرقام للإنجازات" : "⚡ Add metrics to achievements" },
                    { color: "bg-primary", text: ar ? "↑ حسّن الكلمات المفتاحية" : "↑ Optimize keywords" },
                  ].map((item) => (
                    <div key={item.text} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/40">
                      <div className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
                      <span className="text-xs font-body text-muted-foreground">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating metric cards */}
            {floatingCards.map((card, i) => (
              <motion.div
                key={card.label}
                className={`absolute px-3.5 py-2.5 rounded-xl bg-card/95 backdrop-blur-sm border border-border shadow-elevated ${
                  i === 0 ? "-top-4 -left-4 lg:-left-8" :
                  i === 1 ? "-bottom-4 -left-2 lg:-left-6" :
                  "-right-4 lg:-right-8 top-1/3"
                }`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.2 + i * 0.15, duration: 0.5 }}
                whileHover={{ scale: 1.05 }}
              >
                <div className="flex items-center gap-2.5">
                  <card.icon size={16} className={card.color} />
                  <div>
                    <div className={`text-sm font-display font-bold ${card.color}`}>{card.value}</div>
                    <div className="text-[10px] text-muted-foreground font-body">{card.label}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
