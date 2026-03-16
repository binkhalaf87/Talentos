import { motion } from "framer-motion";
import { Upload, Search, Sparkles, Send, ArrowRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const HowItWorksSection = () => {
  const { language } = useLanguage();
  const ar = language === "ar";

  const steps = [
    {
      icon: Upload,
      number: "01",
      title: ar ? "ارفع سيرتك الذاتية" : "Upload Your Resume",
      description: ar
        ? "أسقط ملفك بصيغة PDF أو Word ودع الذكاء الاصطناعي يقرأ كل سطر ويفهم خبراتك ومهاراتك."
        : "Drop your PDF or Word file and let AI read every line, understanding your experience and skills.",
      highlight: ar ? "يدعم العربية والإنجليزية" : "Supports Arabic & English",
    },
    {
      icon: Search,
      number: "02",
      title: ar ? "تحليل شامل بعين الخبير" : "Expert-Level Analysis",
      description: ar
        ? "نقيّم سيرتك عبر ١٠ معايير تشمل توافق ATS، الكلمات المفتاحية، الإنجازات، والتنسيق — كما يفعل مدير توظيف محترف."
        : "We evaluate your resume across 10 criteria including ATS compatibility, keywords, achievements, and formatting — just like a hiring manager.",
      highlight: ar ? "١٠ محاور تقييم" : "10 evaluation criteria",
    },
    {
      icon: Sparkles,
      number: "03",
      title: ar ? "تحسين ذكي فوري" : "Instant AI Enhancement",
      description: ar
        ? "بنقرة واحدة، يعيد الذكاء الاصطناعي صياغة كل قسم بأسلوب احترافي يبرز إنجازاتك ويضيف الكلمات المفتاحية المناسبة."
        : "With one click, AI rewrites each section professionally, highlighting achievements and adding the right keywords.",
      highlight: ar ? "إعادة صياغة احترافية" : "Professional rewriting",
    },
    {
      icon: Send,
      number: "04",
      title: ar ? "تقدّم للوظائف بذكاء" : "Apply Smarter",
      description: ar
        ? "أنشئ رسائل تقديم مخصصة وأرسل سيرتك مباشرة لعشرات الشركات عبر البريد الإلكتروني — كل شيء من مكان واحد."
        : "Create tailored application emails and send your resume directly to dozens of companies via email — all from one place.",
      highlight: ar ? "إرسال جماعي بنقرة" : "Bulk send in one click",
    },
  ];

  return (
    <section id="how-it-works" className="py-24 md:py-32 relative" dir={ar ? "rtl" : "ltr"}>
      <div className="container">
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground mb-5 tracking-tight">
            {ar ? (
              <>من الرفع إلى <span className="text-primary">التوظيف</span> في ٤ خطوات</>
            ) : (
              <>From Upload to <span className="text-primary">Hired</span> in 4 Steps</>
            )}
          </h2>
          <p className="text-muted-foreground font-body max-w-lg mx-auto text-lg">
            {ar ? "رحلة واضحة بدون تعقيد — كل خطوة مدعومة بالذكاء الاصطناعي" : "A clear journey without complexity — every step powered by AI"}
          </p>
        </motion.div>

        <div className="max-w-5xl mx-auto">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              className={`relative flex flex-col md:flex-row items-start gap-6 md:gap-10 ${i < steps.length - 1 ? "mb-8 md:mb-0 pb-8 md:pb-16" : ""}`}
              initial={{ opacity: 0, x: ar ? 30 : -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
            >
              {/* Number + Line */}
              <div className="flex flex-col items-center shrink-0">
                <div className="relative w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                  <step.icon size={24} className="text-primary" />
                  <div className={`absolute -top-2 ${ar ? "-left-2" : "-right-2"} w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xs font-display font-bold shadow-md`}>
                    {i + 1}
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div className="hidden md:block w-px h-full bg-gradient-to-b from-primary/20 to-transparent mt-3" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pb-2">
                <h3 className="text-xl font-display font-bold text-foreground mb-2">{step.title}</h3>
                <p className="text-muted-foreground font-body leading-relaxed mb-3 max-w-md">{step.description}</p>
                <span className="inline-flex items-center gap-1.5 text-xs font-display font-semibold text-primary bg-primary/8 px-3 py-1 rounded-full">
                  {step.highlight}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
