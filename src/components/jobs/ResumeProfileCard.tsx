import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserResumeData } from "@/hooks/useUserResume";
import { FileText, Upload, Briefcase, Star, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  resumeData: UserResumeData | null;
  loading: boolean;
  ar: boolean;
}

export function ResumeProfileCard({ resumeData, loading, ar }: Props) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-5 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-60" />
          <Skeleton className="h-4 w-48" />
        </CardContent>
      </Card>
    );
  }

  if (!resumeData) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardContent className="p-5 flex flex-col items-center gap-3 text-center">
          <Upload className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            {ar ? "لم يتم رفع سيرة ذاتية بعد. قم برفع سيرتك الذاتية أولاً لتحسين نتائج البحث." : "No resume uploaded yet. Upload your resume first to improve search results."}
          </p>
          <Button size="sm" variant="outline" onClick={() => navigate("/dashboard")}>
            <Upload size={14} className="mr-1.5" />
            {ar ? "رفع السيرة الذاتية" : "Upload Resume"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const structured = resumeData.structured_resume_json as Record<string, any> | null;
  const name = structured?.name || structured?.full_name || "";
  const skills = resumeData.detected_skills?.split(/[,;|]/).map(s => s.trim()).filter(Boolean).slice(0, 6) || [];

  return (
    <Card className="bg-card border-primary/20">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              {name && <p className="font-medium text-sm truncate">{name}</p>}
              {resumeData.detected_job_title && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Briefcase size={11} />
                  {resumeData.detected_job_title}
                </p>
              )}
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px] shrink-0 bg-primary/10 text-primary border-0">
            <Star size={10} className="mr-1" />
            {ar ? "السيرة الذاتية متصلة" : "Resume Connected"}
          </Badge>
        </div>

        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {skills.map((skill, i) => (
              <Badge key={i} variant="outline" className="text-[10px] font-normal">
                {skill}
              </Badge>
            ))}
          </div>
        )}

        {resumeData.detected_experience_level && (
          <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
            <Globe size={10} />
            {resumeData.detected_experience_level}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
