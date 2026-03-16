import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";

const Footer = () => {
  const { language } = useLanguage();
  const ar = language === "ar";

  return (
    <footer className="border-t border-border bg-card py-14" dir={ar ? "rtl" : "ltr"}>
      <div className="container">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-10 mb-10">
          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-1">
            <Link to="/" className="font-display font-bold text-xl text-foreground tracking-wide inline-block mb-3">
              TALEN<span className="text-primary">TRY</span>
            </Link>
            <p className="text-sm text-muted-foreground font-body leading-relaxed max-w-xs">
              {ar
                ? "منصة ذكية تساعد في مسارك المهني بذكاء"
                : "A smart platform that empowers your career journey intelligently."}
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-display font-semibold text-foreground mb-4 text-sm">
              {ar ? "المنتج" : "Product"}
            </h4>
            <ul className="space-y-2.5">
              {[
                { label: ar ? "تحليل السيرة" : "Resume Analysis", href: "#features" },
                { label: ar ? "تحسين السيرة" : "Resume Enhancement", href: "#features" },
                { label: ar ? "بناء السيرة" : "Resume Builder", href: "#features" },
                { label: ar ? "التقديم الذكي" : "Smart Applications", href: "#features" },
              ].map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-muted-foreground hover:text-foreground font-body transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-display font-semibold text-foreground mb-4 text-sm">
              {ar ? "روابط مهمة" : "Resources"}
            </h4>
            <ul className="space-y-2.5">
              {[
                { label: ar ? "الأسعار" : "Pricing", href: "#pricing" },
                { label: ar ? "كيف يعمل" : "How It Works", href: "#how-it-works" },
                { label: ar ? "الأسئلة الشائعة" : "FAQ", href: "#faq" },
              ].map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-muted-foreground hover:text-foreground font-body transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-display font-semibold text-foreground mb-4 text-sm">
              {ar ? "الشركة" : "Company"}
            </h4>
            <ul className="space-y-2.5">
              {[
                { label: ar ? "من نحن" : "About", href: "#" },
                { label: ar ? "تواصل معنا" : "Contact", href: "#" },
                { label: ar ? "سياسة الخصوصية" : "Privacy Policy", href: "#" },
              ].map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-muted-foreground hover:text-foreground font-body transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-border pt-7 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground font-body">
            © {new Date().getFullYear()} TALENTRY. {ar ? "جميع الحقوق محفوظة." : "All rights reserved."}
          </p>
          <p className="text-xs text-muted-foreground font-body">
            {ar ? "منصة ذكاء اصطناعي مهنية" : "AI Career Operating System"}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
