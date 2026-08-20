import { isScorecardSeriesCapture, type ScorecardSeriesCapture } from "./scorecardSeriesDiscovery";

const CHANNEL = "cricket-rivalries-scorecard-capture-v1";
export const SCORECARD_EXTENSION_MIN_VERSION = "0.3.1";

export type ScorecardBrowserCapture = {
  schemaVersion: 1;
  captureMethod: string;
  sourceUrl: string;
  capturedAt: string;
  page?: { title?: string; heading?: string };
  match: {
    matchNumber?: number | null;
    homeTeam?: string;
    awayTeam?: string;
    firstInningsTeamName?: string;
    winnerTeam?: string;
    resultSummary?: string;
    playerOfMatchName?: string;
  };
  tables: {
    firstInningsBatting: string;
    firstInningsBowling: string;
    secondInningsBatting: string;
    secondInningsBowling: string;
  };
};

export type CricbuzzDismissalCapture = {
  schemaVersion: 1;
  captureMethod: "cricket-rivalries-cricbuzz-fielder-validation";
  sourceUrl: string;
  capturedAt: string;
  page?: { title?: string; heading?: string };
  match: {
    matchNumber?: number | null;
    homeTeam?: string;
    awayTeam?: string;
  };
  innings: Array<{
    innings: 1 | 2;
    teamCode?: string;
    batters: Array<{
      batterName: string;
      dismissalText: string;
      runs?: number | null;
    }>;
  }>;
};

export type CricbuzzFielderCorrection = {
  innings: 1 | 2;
  batterName: string;
  originalDismissal: string;
  validatedDismissal: string;
};

type ExtensionResponse = {
  channel?: string;
  direction?: string;
  type?: string;
  requestId?: string;
  message?: string;
  ok?: boolean;
  capture?: unknown;
  error?: string;
  version?: string;
};

export type ScorecardExtensionStatus = {
  available: boolean;
  current: boolean;
  version: string;
};

const versionAtLeast = (value: string, minimum: string) => {
  const parts = value.split(".").map(part => Number(part));
  const required = minimum.split(".").map(part => Number(part));
  if (parts.some(part => !Number.isFinite(part)) || parts.length < 3) return false;
  for (let index = 0; index < Math.max(parts.length, required.length); index += 1) {
    const actual = parts[index] ?? 0;
    const expected = required[index] ?? 0;
    if (actual !== expected) return actual > expected;
  }
  return true;
};

const requestId = () => globalThis.crypto?.randomUUID?.()
  ?? `scorecard-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const isScorecardBrowserCapture = (value: unknown): value is ScorecardBrowserCapture => {
  const capture = value as ScorecardBrowserCapture | null;
  return Boolean(
    capture
    && capture.schemaVersion === 1
    && typeof capture.sourceUrl === "string"
    && capture.match
    && capture.tables
    && typeof capture.tables.firstInningsBatting === "string"
    && typeof capture.tables.firstInningsBowling === "string"
    && typeof capture.tables.secondInningsBatting === "string"
    && typeof capture.tables.secondInningsBowling === "string",
  );
};

export const isCricbuzzDismissalCapture = (value: unknown): value is CricbuzzDismissalCapture => {
  const capture = value as CricbuzzDismissalCapture | null;
  return Boolean(
    capture
    && capture.schemaVersion === 1
    && capture.captureMethod === "cricket-rivalries-cricbuzz-fielder-validation"
    && typeof capture.sourceUrl === "string"
    && capture.match
    && Array.isArray(capture.innings)
    && capture.innings.length === 2
    && capture.innings.every(item => (item.innings === 1 || item.innings === 2)
      && Array.isArray(item.batters)
      && item.batters.every(row => typeof row.batterName === "string" && typeof row.dismissalText === "string")),
  );
};

const nameKey = (value: string) => value
  .normalize("NFKD")
  .replace(/[†*‡]/g, "")
  .replace(/\((?=[^)]*\b(?:c|capt|wk|wicketkeeper)\b)[^)]*\)/gi, "")
  .replace(/^\s*(?:\(sub\)|sub)\s+/i, "")
  .replace(/[^a-zA-Z0-9]+/g, " ")
  .trim()
  .toLocaleLowerCase();

const dismissalType = (value: string) => {
  const text = value.trim().toLocaleLowerCase();
  if (/^(?:c|caught)\s*&\s*b\b/.test(text)) return "caught-and-bowled";
  if (/^(?:c|caught)\s+.+?\s+b\s+/.test(text)) return "caught";
  if (/^(?:st|stumped)\s+.+?\s+b\s+/.test(text)) return "stumped";
  if (/run\s*out\b/.test(text)) return "run-out";
  if (/\bb\s+/.test(text)) return "bowled";
  if (/\blbw\b/.test(text)) return "lbw";
  if (/not\s+out/.test(text)) return "not-out";
  return "other";
};

const validatedFielderDismissal = (primary: string, validation: string) => {
  const kind = dismissalType(primary);
  if (kind !== dismissalType(validation)) {
    throw new Error(`Cricbuzz dismissal “${validation}” does not match Cricinfo dismissal “${primary}”.`);
  }
  if (kind === "caught") {
    const primaryMatch = primary.match(/^(?:c|caught)\s+.+?\s+b\s+(.+)$/i);
    const validationMatch = validation.match(/^(?:c|caught)\s+(.+?)\s+b\s+.+$/i);
    if (primaryMatch && validationMatch) return `c ${validationMatch[1].trim()} b ${primaryMatch[1].trim()}`;
  }
  if (kind === "stumped") {
    const primaryMatch = primary.match(/^(?:st|stumped)\s+.+?\s+b\s+(.+)$/i);
    const validationMatch = validation.match(/^(?:st|stumped)\s+(.+?)\s+b\s+.+$/i);
    if (primaryMatch && validationMatch) return `st ${validationMatch[1].trim()} b ${primaryMatch[1].trim()}`;
  }
  if (kind === "run-out") {
    const validationMatch = validation.match(/run\s*out\s*\(([^)]+)\)/i);
    if (validationMatch) return `run out (${validationMatch[1].trim()})`;
  }
  return primary;
};

const correctBattingTable = (
  table: string,
  innings: 1 | 2,
  capturedBatters: CricbuzzDismissalCapture["innings"][number]["batters"],
) => {
  const lines = table.replace(/\r/g, "").split("\n");
  const headerCells = (lines[0] ?? "").split("\t").map(value => value.trim());
  const runsIndex = headerCells.findIndex(value => /^(?:R|RUNS)$/i.test(value));
  if (runsIndex < 2) throw new Error(`Cricinfo innings ${innings} batting table has no dismissal column.`);
  const byBatter = new Map(capturedBatters.map(row => [nameKey(row.batterName), row]));
  const corrections: CricbuzzFielderCorrection[] = [];
  const corrected = lines.map((line, index) => {
    if (index === 0 || !line.includes("\t")) return line;
    const cells = line.split("\t");
    const captured = byBatter.get(nameKey(cells[0] ?? ""));
    if (!captured || !cells[runsIndex]) return line;
    const primaryDismissal = cells.slice(1, runsIndex).filter(Boolean).join(" ").trim() || "not out";
    if (!["caught", "stumped", "run-out"].includes(dismissalType(primaryDismissal))) return line;
    if (captured.runs != null && Number(String(cells[runsIndex]).replace(/,/g, "")) !== Number(captured.runs)) {
      throw new Error(`Cricbuzz runs do not match Cricinfo for ${cells[0]} in innings ${innings}.`);
    }
    const validatedDismissal = validatedFielderDismissal(primaryDismissal, captured.dismissalText);
    if (validatedDismissal === primaryDismissal) return line;
    corrections.push({ innings, batterName: cells[0].trim(), originalDismissal: primaryDismissal, validatedDismissal });
    return [...cells.slice(0, 1), validatedDismissal, ...cells.slice(runsIndex)].join("\t");
  });
  return { table: corrected.join("\n"), corrections };
};

export const applyCricbuzzFielderValidation = (
  firstInningsBatting: string,
  secondInningsBatting: string,
  capture: CricbuzzDismissalCapture,
) => {
  const first = capture.innings.find(item => item.innings === 1);
  const second = capture.innings.find(item => item.innings === 2);
  if (!first || !second) throw new Error("Cricbuzz validation must contain both innings.");
  const correctedFirst = correctBattingTable(firstInningsBatting, 1, first.batters);
  const correctedSecond = correctBattingTable(secondInningsBatting, 2, second.batters);
  return {
    firstInningsBatting: correctedFirst.table,
    secondInningsBatting: correctedSecond.table,
    corrections: [...correctedFirst.corrections, ...correctedSecond.corrections],
  };
};

const sendRequest = <T>(
  type: "ping" | "capture",
  payload: Record<string, unknown>,
  timeoutMs: number,
  resolveResponse: (response: ExtensionResponse) => T | undefined,
  onProgress?: (message: string) => void,
) => new Promise<T>((resolve, reject) => {
  if (typeof window === "undefined") {
    reject(new Error("Browser scorecard capture is available only in the web admin app."));
    return;
  }
  const id = requestId();
  const timer = window.setTimeout(() => {
    window.removeEventListener("message", receive);
    reject(new Error(type === "ping" ? "Browser capture extension was not detected." : "Browser scorecard capture timed out."));
  }, timeoutMs);
  function receive(event: MessageEvent<ExtensionResponse>) {
    const response = event.data;
    if (event.source !== window || event.origin !== window.location.origin) return;
    if (response?.channel !== CHANNEL || response.direction !== "extension-to-app" || response.requestId !== id) return;
    if (response.type === "progress") {
      if (response.message) onProgress?.(response.message);
      return;
    }
    let result: T | undefined;
    try {
      result = resolveResponse(response);
    } catch (error) {
      window.clearTimeout(timer);
      window.removeEventListener("message", receive);
      reject(error);
      return;
    }
    if (result === undefined) return;
    window.clearTimeout(timer);
    window.removeEventListener("message", receive);
    resolve(result);
  }
  window.addEventListener("message", receive);
  window.postMessage({ channel: CHANNEL, direction: "app-to-extension", type, requestId: id, ...payload }, window.location.origin);
});

export const detectScorecardBrowserExtensionStatus = async (): Promise<ScorecardExtensionStatus> => {
  try {
    const version = await sendRequest("ping", {}, 900, response => response.type === "ready" ? String(response.version ?? "") : undefined);
    return { available: true, current: versionAtLeast(version, SCORECARD_EXTENSION_MIN_VERSION), version };
  } catch {
    return { available: false, current: false, version: "" };
  }
};

export const detectScorecardBrowserExtension = async () => (await detectScorecardBrowserExtensionStatus()).current;

export const captureScorecardWithBrowserExtension = async (
  sourceUrl: string,
  onProgress?: (message: string) => void,
) => sendRequest("capture", { sourceUrl }, 130_000, response => {
  if (response.type !== "result") return undefined;
  if (!response.ok) throw new Error(response.error || "The browser extension could not capture the scorecard.");
  if (!isScorecardBrowserCapture(response.capture)) throw new Error("The browser extension returned an incomplete scorecard capture.");
  return response.capture;
}, onProgress);

export const captureCricbuzzDismissalsWithBrowserExtension = async (
  sourceUrl: string,
  onProgress?: (message: string) => void,
) => sendRequest("capture", { sourceUrl }, 130_000, response => {
  if (response.type !== "result") return undefined;
  if (!response.ok) throw new Error(response.error || "The browser extension could not validate Cricbuzz dismissals.");
  if (!isCricbuzzDismissalCapture(response.capture)) throw new Error("The browser extension returned incomplete Cricbuzz dismissal data.");
  return response.capture;
}, onProgress);

export const discoverScorecardSeriesWithBrowserExtension = async (
  sourceUrl: string,
  onProgress?: (message: string) => void,
): Promise<ScorecardSeriesCapture> => sendRequest("capture", { sourceUrl }, 130_000, response => {
  if (response.type !== "result") return undefined;
  if (!response.ok) throw new Error(response.error || "The browser extension could not discover series scorecards.");
  if (!isScorecardSeriesCapture(response.capture)) throw new Error("The browser extension returned incomplete series scorecard links.");
  return response.capture;
}, onProgress);
