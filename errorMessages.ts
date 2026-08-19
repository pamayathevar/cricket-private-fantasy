type ErrorLike = { message?: string | null; code?: string | null } | Error | string | null | undefined;

const rawMessage = (error: ErrorLike) => typeof error === "string" ? error : error?.message ?? "";

export function userActionError(error: ErrorLike, action = "This action"): string {
  const raw = rawMessage(error);
  const message = raw.toLocaleLowerCase();

  if (__DEV__ && raw) console.warn(`${action} failed:`, raw);
  if (message.includes("failed to fetch") || message.includes("network request failed") || message.includes("timeout")) return "Check your internet connection and try again.";
  if (message.includes("rate limit") || message.includes("too many requests") || message.includes("email rate limit")) return "Too many code requests were made. Wait a few minutes, then try again.";
  if (message.includes("token has expired") || message.includes("otp expired") || message.includes("invalid token") || message.includes("invalid otp")) return "That login code is invalid or has expired. Request a new code and try again.";
  if (message.includes("league admin access required") || message.includes("permission denied") || message.includes("row-level security")) return "Only a league administrator can make this change.";
  if (message.includes("active league membership required")) return "Your league membership is not active. Return to All leagues and check your invitation status.";
  if (message.includes("lineup is locked") || message.includes("fixture is locked")) return "This lineup is locked because the match has started.";
  if (message.includes("source fingerprint already exists with different score facts")) return "This score capture is already staged, but this retry calculated at least one score fact differently. Nothing was overwritten. Review the existing staged batch, or create a correction from an updated scorecard.";
  if (message.includes("already used in this league") || message.includes("duplicate key") || message.includes("already exists")) return "That value is already in use. Choose a different one.";
  if (message.includes("overlap") || message.includes("gap") || message.includes("continuous")) return "Match ranges must be continuous and cannot overlap.";
  if (message.includes("transfer limit")) return "This change exceeds the available transfer balance.";
  if (message.includes("does not exist") || message.includes("undefined function") || message.includes("schema cache") || message.includes("column ") || message.includes("relation ")) return "The app update is not fully installed. Ask a league administrator to complete the database update.";
  if (message.includes("jwt") || message.includes("session") || message.includes("not authenticated")) return "Your login session has expired. Sign in again and retry.";
  return `${action} could not be completed. Please try again.`;
}
