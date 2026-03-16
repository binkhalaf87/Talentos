import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";

const FinalCTASection = () => {
  const { language } = useLanguage();
  const ar = language === "ar";

  return (
    <section className="py-24 md:py-32 relative overflow-hidden" dir={ar ? "rtl" : "ltr"}>
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/3 to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.08),transparent_60%)]" />

      <div className="container relative max-w-3xl">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary font-display font-semibold text-sm mb-8"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <Sparkles size={14} />
            {ar ? "ابدأ رحلتك المهنية الآن" : "Start Your Career Journey Now"}
          </motion.div>

          <h2 className="text-3xl md:text-5xl lg:text-6xl font-display font-extrabold text-foreground mb-7 leading-tight tracking-tight">
            {ar ? (
              <>
                <span className="block">سيرتك الذاتية</span>
                <span className="block text-primary">بوابتك للفرصة القادمة</span>
              </>
            ) : (
              <>
                <span className="block">Your Resume is</span>
                <span className="block text-primary">Your Gateway to Opportunity</span>
              </>
            )}
          </h2>

          <p className="text-lg md:text-xl text-muted-foreground font-body max-w-xl mx-auto mb-10 leading-relaxed">
            {ar
              ? "ارفع سيرتك الذاتية الآن واحصل على تحليل مجاني يكشف لك بالضبط ما يحتاج تحسين — في أقل من دقيقتين."
              : "Upload your resume now and get a free analysis that shows you exactly what needs improvement — in under 2 minutes."}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="text-base px-10 h-14 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all font-semibold" asChild>
              <Link to="/signup">
                {ar ? "ابدأ مجاناً الآن" : "Start Free Now"}
                <ArrowRight className={`${ar ? "mr-2 rotate-180" : "ml-2"}`} size={18} />
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground font-body">
              {ar ? "✓ بدون بطاقة ائتمان • ✓ ١٠ نقاط مجانية" : "✓ No credit card • ✓ 10 free points"}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FinalCTASection;
