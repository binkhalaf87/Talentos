import {
  FileText,
  BarChart3,
  Wand2,
  PenSquare,
  MessageSquare,
  History,
  Send,
  
  LayoutDashboard,
  Settings,
  User,
  Shield,
  Search,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { language } = useLanguage();
  const { user } = useAuth();
  const ar = language === "ar";
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .then(({ data }) => setIsAdmin(!!data && data.length > 0));
  }, [user]);

  const mainItems = [
    {
      title: ar ? "لوحة التحكم" : "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
    },
  ];

  const resumeItems = [
    {
      title: ar ? "كتابة السيرة" : "Resume Builder",
      url: "/builder",
      icon: PenSquare,
    },
    {
      title: ar ? "تحليل ATS" : "ATS Analysis",
      url: "/analysis",
      icon: BarChart3,
    },
    {
      title: ar ? "تحسين بالذكاء" : "AI Enhancement",
      url: "/enhance",
      icon: Wand2,
    },
  ];

  const interviewItems = [
    {
      title: ar ? "المقابلة الذكية" : "AI Interview",
      url: "/dashboard/interview-avatar",
      icon: MessageSquare,
    },
    {
      title: ar ? "سجل المقابلات" : "Interview History",
      url: "/dashboard/interview-history",
      icon: History,
    },
  ];

  const marketingItems = [
    {
      title: ar ? "تسويق السيرة" : "Resume Marketing",
      url: "/marketing",
      icon: Send,
    },
  ];

  const jobItems = [
    {
      title: ar ? "البحث عن الوظائف" : "Job Search",
      url: "/job-search",
      icon: Search,
    },
  ];

  const accountItems = [
    {
      title: ar ? "الملف الشخصي" : "Profile",
      url: "/profile",
      icon: User,
    },
    {
      title: ar ? "الإعدادات" : "Settings",
      url: "/settings",
      icon: Settings,
    },
    ...(isAdmin
      ? [
          {
            title: ar ? "لوحة الأدمن" : "Admin",
            url: "/admin",
            icon: Shield,
          },
        ]
      : []),
  ];

  const isActive = (path: string) => location.pathname === path;

  const renderItem = (item: { title: string; url: string; icon: any }) => (
    <SidebarMenuItem key={item.url}>
      <SidebarMenuButton asChild>
        <NavLink
          to={item.url}
          end
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-body text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          activeClassName="bg-sidebar-primary/10 text-sidebar-primary font-medium"
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <span className="flex-1 truncate">{item.title}</span>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon" side={ar ? "right" : "left"}>
      <SidebarHeader className="p-4 pb-2">
        <NavLink to="/dashboard" className="flex items-center gap-2">
          {!collapsed ? (
            <span className="font-display text-xl font-bold text-sidebar-foreground">
              TALEN<span className="text-sidebar-primary">TRY</span>
            </span>
          ) : (
            <span className="font-display text-lg font-bold text-sidebar-primary">T</span>
          )}
        </NavLink>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* Main */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>{mainItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Resume Services */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-display px-3">
              {ar ? "خدمات السيرة" : "Resume"}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>{resumeItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Interview */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-display px-3">
              {ar ? "المقابلات" : "Interview"}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>{interviewItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Marketing */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-display px-3">
              {ar ? "التسويق" : "Marketing"}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>{marketingItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Jobs */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-display px-3">
              {ar ? "الوظائف" : "Jobs"}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>{jobItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Account */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-display px-3">
              {ar ? "الحساب" : "Account"}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>{accountItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
