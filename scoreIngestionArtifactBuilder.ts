import { compileScoreImport, type NormalizedScoreImport } from "./scoreImportRules";
import {
  calculatePlayerPoints,
  calculatePointDetails,
  type ScoringRulesDocument,
} from "./scoringRules";

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map(key => [key, canonicalize((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
};

const fingerprintDocument = (document: NormalizedScoreImport) => ({
  ...document,
  source: {
    provider: document.source.provider,
    externalMatchId: document.source.externalMatchId,
    sourceUrl: document.source.sourceUrl,
  },
});

const sha256 = async (value: unknown) => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Secure browser hashing is unavailable. Open the admin tool in a current desktop browser.");
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalize(value)));
  const digest = await subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
};

export const buildScoreIngestionArtifact = async (
  document: NormalizedScoreImport,
  rules: ScoringRulesDocument,
) => {
  const compiled = compileScoreImport(document, {
    rules,
    calculatePoints: calculatePlayerPoints,
    calculateDetails: calculatePointDetails,
  });
  const errors = compiled.issues.filter(issue => issue.severity === "error");
  if (errors.length) {
    throw new Error(errors.map(issue => `${issue.path}: ${issue.message}`).join("\n"));
  }
  return {
    schemaVersion: 1,
    status: "ready-for-admin-review",
    generatedAt: new Date().toISOString(),
    sourceFingerprint: await sha256({ document: fingerprintDocument(document), rules }),
    leagueId: document.leagueId,
    fixtureId: document.fixtureId,
    matchNumber: document.matchNumber,
    ruleSetId: document.ruleSetId,
    source: document.source,
    issues: compiled.issues,
    reconciliation: compiled.reconciliation,
    stagingPayload: compiled.stagingPayload,
  };
};
