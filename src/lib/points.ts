import { supabase } from "@/integrations/supabase/client";

export const SERVICE_COSTS = {
  analysis: 3,
  enhancement: 5,
  interview: 5,
  builder: 3,
  marketing_per_100: 10,
} as const;

export type ServiceType = keyof typeof SERVICE_COSTS;

export async function getPointsBalance(userId: string): Promise<number> {
  const { data } = await supabase
    .from("point_transactions")
    .select("amount")
    .eq("user_id", userId);
  if (!data) return 0;
  return data.reduce((sum, tx) => sum + tx.amount, 0);
}

export async function hasFreeAnalysis(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("free_analysis_used")
    .eq("user_id", userId)
    .maybeSingle();
  return data ? !data.free_analysis_used : true;
}

export async function markFreeAnalysisUsed(userId: string): Promise<void> {
  await supabase
    .from("profiles")
    .update({ free_analysis_used: true } as unknown as Record<string, unknown>)
    .eq("user_id", userId);
}

/**
 * Deducts points via a secure server-side Edge Function.
 * This prevents client-side manipulation of the points balance.
 */
export async function deductPoints(
  _userId: string,
  service: ServiceType,
  description?: string
): Promise<{ success: boolean; balance: number; error?: string }> {
  const { data, error } = await supabase.functions.invoke("deduct-points", {
    body: { service, description },
  });

  if (error) {
    return { success: false, balance: 0, error: error.message };
  }

  return data as { success: boolean; balance: number; error?: string };
}
