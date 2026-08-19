import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SOURCE_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 15_000;
const SENSITIVE_QUERY_KEY = /^(?:access[_-]?token|api[_-]?key|apikey|auth(?:orization)?|credential|secret|signature|x-amz-.+)$/i;
const DEFAULT_SCORE_SOURCE_HOSTS = [
  "espncricinfo.com",
  "*.espncricinfo.com",
  "cricinfo.com",
  "*.cricinfo.com",
  "cricbuzz.com",
  "*.cricbuzz.com",
];
const PROVIDER_PAGE_HOSTS = ["espncricinfo.com", "cricinfo.com", "cricbuzz.com"];

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const configuredHosts = () => Array.from(new Set([
  ...DEFAULT_SCORE_SOURCE_HOSTS,
  ...(Deno.env.get("SCORE_SOURCE_ALLOWED_HOSTS") ?? "")
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean),
]));

const hostIsAllowed = (hostname: string, allowedHosts: string[]) => allowedHosts.some(entry => {
  if (entry.startsWith("*.")) {
    const suffix = entry.slice(1);
    return hostname.endsWith(suffix) && hostname.length > suffix.length;
  }
  return hostname === entry;
});

const isProviderPageHost = (hostname: string) => PROVIDER_PAGE_HOSTS.some(root => (
  hostname === root || hostname.endsWith(`.${root}`)
));

const validateSourceUrl = (rawUrl: unknown) => {
  if (typeof rawUrl !== "string" || rawUrl.length > 2048) {
    throw new Error("A score source URL is required");
  }
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("The score source URL is invalid");
  }
  if (url.protocol !== "https:") throw new Error("Score sources must use HTTPS");
  if (url.username || url.password) throw new Error("Score source credentials are not allowed in the URL");
  if (url.port && url.port !== "443") throw new Error("Non-standard score source ports are not allowed");
  for (const key of url.searchParams.keys()) {
    if (SENSITIVE_QUERY_KEY.test(key)) {
      throw new Error("Do not include access tokens, API keys, or signed credentials in the score source URL");
    }
  }
  const hostname = url.hostname.toLowerCase();
  if (!hostname || hostname === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":")) {
    throw new Error("Local and IP-address score sources are not allowed");
  }
  const allowedHosts = configuredHosts();
  if (!hostIsAllowed(hostname, allowedHosts)) {
    throw new Error(`The score source host ${hostname} is not approved`);
  }
  url.hash = "";
  return url;
};

const readLimitedJson = async (response: Response) => {
  const length = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > MAX_SOURCE_BYTES) {
    throw new Error("The score source response is too large");
  }
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_SOURCE_BYTES) {
    throw new Error("The score source response is too large");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("The score source did not return valid JSON");
  }
};

const fetchWithTimeout = async (url: string, init: RequestInit = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, redirect: "error", signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const validateReviewArtifact = (
  candidate: unknown,
  fixture: { id: string; league_id: string; match_number: number },
) => {
  const artifact = isObject(candidate) && isObject(candidate.reviewArtifact)
    ? candidate.reviewArtifact
    : candidate;
  if (!isObject(artifact)) throw new Error("The provider did not return a review artifact");
  if (artifact.schemaVersion !== 1 || artifact.status !== "ready-for-admin-review") {
    throw new Error("The provider returned an unsupported review artifact");
  }
  if (artifact.fixtureId !== fixture.id || artifact.leagueId !== fixture.league_id || artifact.matchNumber !== fixture.match_number) {
    throw new Error("The review artifact does not match the selected fixture");
  }
  if (!Array.isArray(artifact.stagingPayload) || !artifact.stagingPayload.length) {
    throw new Error("The review artifact contains no player score rows");
  }
  if (!Array.isArray(artifact.issues)) throw new Error("The review artifact issue list is missing");
  if (artifact.issues.some(issue => isObject(issue) && String(issue.severity).toLowerCase() === "error")) {
    throw new Error("The provider review artifact contains validation errors");
  }
  return artifact;
};

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Function environment is incomplete" }, 500);
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Authentication is required" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Invalid session" }, 401);

  let fixtureId = "";
  let sourceUrl: URL;
  let providerKey = "auto";
  try {
    const payload = await request.json();
    fixtureId = typeof payload?.fixtureId === "string" ? payload.fixtureId : "";
    providerKey = typeof payload?.providerKey === "string" ? payload.providerKey.trim().toLowerCase() : "auto";
    if (!UUID_PATTERN.test(fixtureId)) throw new Error("A valid fixtureId is required");
    if (!/^[a-z0-9_-]{1,64}$/.test(providerKey)) throw new Error("The provider key is invalid");
    sourceUrl = validateSourceUrl(payload?.sourceUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body";
    console.warn("score_ingestion_validation_failed", {
      error: message,
      fixtureIdPresent: Boolean(fixtureId),
      fixtureIdValid: UUID_PATTERN.test(fixtureId),
      providerKey,
    });
    return json({ error: message, errorCode: "invalid_request" }, 400);
  }

  const { data: requestedJob, error: requestError } = await userClient.rpc("request_score_ingestion_job", {
    p_fixture_id: fixtureId,
    p_source_url: sourceUrl.toString(),
    p_provider_key: providerKey,
  });
  if (requestError || !requestedJob?.job_id) {
    return json({ error: requestError?.message ?? "Could not create the score import job" }, 403);
  }
  const jobId = String(requestedJob.job_id);

  const finish = async (
    status: "needs_configuration" | "ready_for_review" | "failed",
    statusMessage: string,
    leagueId: string,
    extra: Record<string, unknown> = {},
  ) => {
    const finishedAt = new Date().toISOString();
    const { error } = await serviceClient.from("score_ingestion_jobs").update({
      status,
      status_message: statusMessage,
      finished_at: finishedAt,
      ...extra,
    }).eq("id", jobId);
    if (error) throw new Error(`Could not save score import status: ${error.message}`);
    await serviceClient.from("audit_events").insert({
      league_id: leagueId,
      actor_user_id: authData.user.id,
      action: `score_ingestion_job_${status}`,
      entity_type: "score_ingestion_job",
      entity_id: jobId,
      after_data: {
        fixture_id: fixtureId,
        provider_key: providerKey,
        status,
      },
    });
  };

  const { data: fixtureRecord, error: fixtureError } = await serviceClient
    .from("fixtures")
    .select("id,league_id,match_number,status,scheduled_start,home_team_id,away_team_id")
    .eq("id", fixtureId)
    .single();
  if (fixtureError || !fixtureRecord) {
    const { error: jobUpdateError } = await serviceClient.from("score_ingestion_jobs").update({
      status: "failed",
      error_code: "fixture_load_failed",
      status_message: "Fixture metadata could not be loaded",
      finished_at: new Date().toISOString(),
    }).eq("id", jobId);
    console.error("score_ingestion_fixture_load_failed", {
      fixtureId,
      jobId,
      fixtureError: fixtureError?.message ?? null,
      jobUpdateError: jobUpdateError?.message ?? null,
    });
    return json({ error: "Fixture metadata could not be loaded", jobId }, 500);
  }

  const { data: fixtureTeams, error: fixtureTeamsError } = await serviceClient
    .from("cricket_teams")
    .select("id,code,name")
    .in("id", [fixtureRecord.home_team_id, fixtureRecord.away_team_id]);
  if (fixtureTeamsError || !fixtureTeams || fixtureTeams.length < 2) {
    const { error: jobUpdateError } = await serviceClient.from("score_ingestion_jobs").update({
      status: "failed",
      error_code: "fixture_teams_load_failed",
      status_message: "Fixture team metadata could not be loaded",
      finished_at: new Date().toISOString(),
    }).eq("id", jobId);
    console.error("score_ingestion_fixture_teams_load_failed", {
      fixtureId,
      jobId,
      fixtureTeamsError: fixtureTeamsError?.message ?? null,
      jobUpdateError: jobUpdateError?.message ?? null,
    });
    return json({ error: "Fixture team metadata could not be loaded", jobId }, 500);
  }

  const home = fixtureTeams.find(team => team.id === fixtureRecord.home_team_id);
  const away = fixtureTeams.find(team => team.id === fixtureRecord.away_team_id);
  if (!home || !away) {
    await finish("failed", "Fixture team metadata is incomplete", fixtureRecord.league_id, {
      error_code: "fixture_teams_incomplete",
    });
    return json({ error: "Fixture team metadata is incomplete", jobId }, 500);
  }
  const fixture = { ...fixtureRecord, home, away };

  await serviceClient.from("score_ingestion_jobs").update({
    status: "processing",
    source_host: sourceUrl.hostname,
    started_at: new Date().toISOString(),
    attempt_count: 1,
  }).eq("id", jobId);

  try {
    let candidate: unknown;
    const adapterUrl = Deno.env.get("SCORE_INGESTION_ADAPTER_URL");
    const adapterToken = Deno.env.get("SCORE_INGESTION_ADAPTER_TOKEN");

    if (adapterUrl && adapterToken) {
      let adapterEndpoint: URL;
      try {
        adapterEndpoint = new URL(adapterUrl);
      } catch {
        throw new Error("The configured score adapter URL is invalid");
      }
      if (adapterEndpoint.protocol !== "https:") {
        throw new Error("The configured score adapter must use HTTPS");
      }
      const response = await fetchWithTimeout(adapterEndpoint.toString(), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adapterToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobId,
          sourceUrl: sourceUrl.toString(),
          providerKey,
          fixture,
        }),
      });
      if (!response.ok) throw new Error(`The configured score adapter returned ${response.status}`);
      candidate = await readLimitedJson(response);
    } else if (isProviderPageHost(sourceUrl.hostname.toLowerCase())) {
      await finish(
        "needs_configuration",
        "This official score page was accepted, but an authorized score-provider adapter must be connected before it can be parsed.",
        fixture.league_id,
        { error_code: "adapter_required" },
      );
      return json({
        jobId,
        status: "needs_configuration",
        message: "Score source accepted. Connect the authorized score-provider adapter to prepare its review draft.",
      }, 202);
    } else {
      const response = await fetchWithTimeout(sourceUrl.toString(), {
        headers: { Accept: "application/json" },
      });
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (!response.ok) throw new Error(`The score source returned ${response.status}`);
      if (!contentType.includes("json")) {
        await finish(
          "needs_configuration",
          "This source requires an authorized score-provider adapter before it can be parsed.",
          fixture.league_id,
          { error_code: "adapter_required" },
        );
        return json({
          jobId,
          status: "needs_configuration",
          message: "This source requires an authorized score-provider adapter before it can be parsed.",
        }, 202);
      }
      candidate = await readLimitedJson(response);
    }

    const artifact = validateReviewArtifact(candidate, fixture);
    const warnings = (artifact.issues as unknown[]).filter(issue => (
      isObject(issue) && String(issue.severity).toLowerCase() === "warning"
    ));
    await finish(
      "ready_for_review",
      "Review artifact prepared. Verify every player and total before staging.",
      fixture.league_id,
      {
        review_artifact: artifact,
        warnings,
        error_code: null,
        source_metadata: {
          hostname: sourceUrl.hostname,
          providerKey,
        },
      },
    );
    return json({
      jobId,
      status: "ready_for_review",
      message: "Review artifact prepared. Verify every player and total before staging.",
      reviewArtifact: artifact,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Score import failed";
    try {
      await finish("failed", message, fixture.league_id, {
        error_code: "source_processing_failed",
      });
    } catch {
      // Preserve the original, non-sensitive provider error for the caller.
    }
    return json({ error: message, jobId, status: "failed" }, 422);
  }
});
