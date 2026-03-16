import { motion } from "framer-motion";
import { BarChart3, Sparkles, FileText, Mic, Mail, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";

const FeaturesSection = () => {
  const { language } = useLanguage();
  const ar = language === "ar";

  const features = [
    {
      icon: BarChart3,
      title: ar ? "تحليل السيرة الذاتية" : "Resume Analysis",
      description: ar
        ? "اكتشف بالضبط كيف تراك أنظمة ATS ومسؤولو التوظيف. تحصل على تقرير مفصّل بـ ١٠ محاور مع درجة دقيقة وخطة تحسين عملية."
        : "Discover exactly how ATS systems and recruiters see you. Get a detailed 10-axis report with a precise score and actionable improvement plan.",
      link: "/analysis",
      gradient: "from-blue-500/10 to-indigo-500/10",
      iconBg: "bg-blue-500/10 text-blue-600",
    },
    {
      icon: FileText,
      title: ar ? "بناء السيرة الذاتية" : "Resume Builder",
      description: ar
        ? "ابنِ سيرة ذاتية احترافية من الصفر بمساعدة الذكاء الاصطناعي. كل قسم يُكتب بأسلوب يجتاز أنظمة الفلترة ويلفت انتباه المسؤولين."
        : "Build a professional resume from scratch with AI. Every section is written to pass filtering systems and catch recruiters' attention.",
      link: "/builder",
      gradient: "from-emerald-500/10 to-teal-500/10",
      iconBg: "bg-emerald-500/10 text-emerald-600",
    },
    {
      icon: Sparkles,
      title: ar ? "تحسين السيرة الذاتية" : "Resume Enhancement",
      description: ar
        ? "حوّل سيرتك الحالية إلى نسخة أقوى. الذكاء الاصطناعي يعيد صياغة كل قسم بكلمات مفتاحية دقيقة وأسلوب يبرز إنجازاتك الحقيقية."
        : "Transform your current resume into a stronger version. AI rewrites each section with precise keywords and a style that highlights your real achievements.",
      link: "/enhance",
      gradient: "from-violet-500/10 to-purple-500/10",
      iconBg: "bg-violet-500/10 text-violet-600",
    },
    {
      icon: Mic,
      title: ar ? "التحضير للمقابلات" : "Interview Preparation",
      description: ar
        ? "تدرّب على المقابلات مع مُحاور ذكي يحاكي بيئة المقابلة الحقيقية. يقيّم إجاباتك ويعطيك ملاحظات فورية لتحسين أدائك."
        : "Practice interviews with an AI interviewer that simulates a real interview environment. It evaluates your answers and gives instant feedback.",
      link: "/dashboard/interview-avatar",
      gradient: "from-amber-500/10 to-orange-500/10",
      iconBg: "bg-amber-500/10 text-amber-600",
    },
    {
      icon: Mail,
      title: ar ? "التقديم الذكي للوظائف" : "Smart Job Applications",
      description: ar
        ? "أنشئ رسائل تقديم احترافية مخصصة لكل شركة، وأرسل سيرتك الذاتية مباشرة لعشرات المسؤولين بضغطة زر — موفّراً ساعات من العمل اليدوي."
        : "Create professional application emails tailored to each company, and send your resume directly to dozens of recruiters with one click — saving hours of manual work.",
      link: "/marketing",
      gradient: "from-rose-500/10 to-pink-500/10",
      iconBg: "bg-rose-500/10 text-rose-600",
    },
  ];

  return (
    <section id="features" className="py-24 md:py-32 bg-card/50 relative" dir={ar ? "rtl" : "ltr"}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.03),transparent_70%)]" />

      <div className="container relative">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground mb-5 tracking-tight">
            {ar ? (
              <>منظومة متكاملة <span className="text-primary">لمسيرتك المهنية</span></>
            ) : (
              <>A Complete System <span className="text-primary">for Your Career</span></>
            )}
          </h2>
          <p className="text-muted-foreground font-body max-w-lg mx-auto text-lg">
            {ar ? "خمس أدوات قوية تعمل معاً لتحويل بحثك عن عمل إلى قصة نجاح" : "Five powerful tools working together to turn your job search into a success story"}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              className={`group relative p-7 rounded-2xl bg-background border border-border hover:border-primary/20 transition-all duration-500 hover:shadow-elevated ${
                i >= 3 ? "lg:col-span-1" : ""
              } ${i === 4 ? "md:col-span-2 lg:col-span-1" : ""}`}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
            >
              {/* Gradient hover effect */}
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

              <div className="relative">
                <div className="flex items-start justify-between mb-5">
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${feature.iconBg}`}>
                    <feature.icon size={22} />
                  </div>
                  <Link to={feature.link} className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <ArrowUpRight size={18} className="text-primary" />
                  </Link>
                </div>
                <h3 className="font-display font-bold text-foreground mb-3 text-lg">{feature.title}</h3>
                <p className="text-sm text-muted-foreground font-body leading-relaxed">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
