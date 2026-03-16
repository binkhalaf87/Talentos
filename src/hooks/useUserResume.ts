import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UserResumeData {
  id: string;
  user_id: string;
  original_file_url: string;
  raw_resume_text: string | null;
  structured_resume_json: Record<string, string> | null;
  detected_job_title: string | null;
  detected_skills: string | null;
  detected_experience_level: string | null;
  resume_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Hook to load the user's parsed resume data from `user_resumes`.
 * All services should use this instead of re-extracting text.
 */
export function useUserResume(resumeId?: string | null) {
  const { user, loading: authLoading, initialized } = useAuth();
  const [data, setData] = useState<UserResumeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResume = useCallback(async () => {
    if (!initialized || authLoading) {
      setLoading(true);
      return;
    }

    if (!user?.id) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("user_resumes" as any)
        .select("*")
        .eq("user_id", user.id);

      if (resumeId) {
        query = query.eq("resume_id", resumeId);
      }

      const { data: rows, error: fetchError } = await query
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        throw fetchError;
      }

      setData(rows as unknown as UserResumeData | null);
    } catch (err: unknown) {
      console.error("[useUserResume] error:", err);
      setError(err instanceof Error ? err.message : "Failed to load resume data");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [initialized, authLoading, user?.id, resumeId]);

  useEffect(() => {
    void fetchResume();
  }, [fetchResume]);

  return { data, loading, error, refetch: fetchResume };
}

/**
 * Upload a resume file, extract text deterministically, and store structured data.
 * Returns the new resume row ID and user_resume row.
 */
export async function uploadAndParseResume(
  userId: string,
  file: File,
): Promise<{ resumeId: string; userResumeId: string; structured: Record<string, string> }> {
  // 1. Upload file to storage
  const filePath = `${userId}/${Date.now()}_${file.name}`;
  const { error: uploadError } = await supabase.storage.from("resumes").upload(filePath, file);
  if (uploadError) throw new Error(uploadError.message);

  // 2. Insert into resumes table
  const { data: resumeRow, error: insertError } = await supabase
    .from("resumes")
    .insert({
      user_id: userId,
      file_name: file.name,
      file_path: filePath,
      file_type: file.type,
    })
    .select("id")
    .single();

  if (insertError || !resumeRow) throw new Error(insertError?.message || "Failed to create resume record");

  // 3. Call extract-text edge function (deterministic, no AI)
  const formData = new FormData();
  formData.append("file", file);

  const { data: extractData, error: extractError } = await supabase.functions.invoke("extract-text", {
    body: formData,
  });

  if (extractError) throw new Error(extractError.message || "Extraction failed");

  const rawText = extractData?.text || "";
  const structured = extractData?.structured || {};
  const detectedJobTitle = extractData?.detected_job_title || structured?.job_title || null;
  const detectedSkills = extractData?.detected_skills || null;
  const detectedExperienceLevel = extractData?.detected_experience_level || null;
  const detectedLanguage = extractData?.language || "en";

  // 4. Update resumes table with extracted text
  await supabase
    .from("resumes")
    .update({ extracted_text: rawText, language: detectedLanguage })
    .eq("id", resumeRow.id);

  // 5. Insert into user_resumes table
  const { data: userResumeRow, error: urError } = await supabase
    .from("user_resumes" as any)
    .insert({
      user_id: userId,
      original_file_url: filePath,
      raw_resume_text: rawText,
      structured_resume_json: structured,
      detected_job_title: detectedJobTitle,
      detected_skills: detectedSkills,
      detected_experience_level: detectedExperienceLevel,
      resume_id: resumeRow.id,
    } as any)
    .select("id")
    .single();

  if (urError) {
    console.error("[uploadAndParseResume] user_resumes insert error:", urError);
  }

  return {
    resumeId: resumeRow.id,
    userResumeId: (userResumeRow as any)?.id || "",
    structured,
  };
}

/**
 * Get the stored structured resume for a given resume_id. 
 * Returns null if not found.
 */
export async function getStoredResumeData(
  userId: string,
  resumeId: string,
): Promise<UserResumeData | null> {
  const { data, error } = await supabase
    .from("user_resumes" as any)
    .select("*")
    .eq("user_id", userId)
    .eq("resume_id", resumeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as unknown as UserResumeData;
}
