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

type ExpoTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
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

  let messageId = "";
  try {
    const payload = await request.json();
    messageId = typeof payload?.messageId === "string" ? payload.messageId : "";
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) return json({ error: "A valid messageId is required" }, 400);

  const { data: message, error: messageError } = await serviceClient
    .from("league_chat_messages")
    .select("id,league_id,member_id,body,deleted_at")
    .eq("id", messageId)
    .maybeSingle();
  if (messageError || !message || message.deleted_at) return json({ error: "Message was not found" }, 404);

  const [{ data: author }, { data: league }] = await Promise.all([
    serviceClient.from("league_members").select("id,user_id,display_name,status").eq("id", message.member_id).eq("league_id", message.league_id).maybeSingle(),
    serviceClient.from("leagues").select("name").eq("id", message.league_id).maybeSingle(),
  ]);
  if (!author || author.status !== "active" || author.user_id !== authData.user.id) {
    return json({ error: "Only the message author can dispatch its notifications" }, 403);
  }

  const { data: mentions, error: mentionsError } = await serviceClient
    .from("league_chat_mentions")
    .select("member_id")
    .eq("message_id", messageId);
  if (mentionsError) return json({ error: "Could not load mentions" }, 500);
  const mentionedMemberIds = [...new Set((mentions ?? []).map(row => row.member_id))];
  if (!mentionedMemberIds.length) return json({ sent: 0, skipped: 0 });

  const [{ data: targets }, { data: preferences }] = await Promise.all([
    serviceClient.from("league_members").select("id,user_id,status").eq("league_id", message.league_id).in("id", mentionedMemberIds),
    serviceClient.from("league_chat_member_state").select("member_id,push_mentions_enabled").eq("league_id", message.league_id).in("member_id", mentionedMemberIds),
  ]);
  const optedIn = new Set((preferences ?? []).filter(row => row.push_mentions_enabled).map(row => row.member_id));
  const targetByUserId = new Map((targets ?? [])
    .filter(row => row.status === "active" && row.user_id && optedIn.has(row.id))
    .map(row => [row.user_id as string, row.id as string]));
  const targetUserIds = [...targetByUserId.keys()];
  if (!targetUserIds.length) return json({ sent: 0, skipped: mentionedMemberIds.length });

  const { data: devices, error: devicesError } = await serviceClient
    .from("app_push_devices")
    .select("user_id,expo_push_token")
    .eq("enabled", true)
    .in("user_id", targetUserIds);
  if (devicesError) return json({ error: "Could not load notification devices" }, 500);

  const claimed: Array<{ memberId: string; token: string }> = [];
  for (const device of devices ?? []) {
    const memberId = targetByUserId.get(device.user_id);
    if (!memberId) continue;
    const { error } = await serviceClient.from("league_chat_push_deliveries").insert({
      message_id: messageId,
      member_id: memberId,
      expo_push_token: device.expo_push_token,
      status: "sending",
    });
    if (!error) claimed.push({ memberId, token: device.expo_push_token });
    else if (error.code !== "23505") console.error("delivery claim failed", error.message);
  }
  if (!claimed.length) return json({ sent: 0, skipped: (devices ?? []).length });

  const expoPayload = claimed.map(item => ({
    to: item.token,
    sound: "default",
    title: `${author.display_name} mentioned you`,
    body: String(message.body).slice(0, 180),
    data: {
      type: "league_chat_mention",
      leagueId: message.league_id,
      messageId,
      leagueName: league?.name ?? "League chat",
    },
    channelId: "mentions",
    priority: "high",
  }));

  const pushHeaders: Record<string, string> = {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/json",
  };
  const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
  if (expoAccessToken) pushHeaders.Authorization = `Bearer ${expoAccessToken}`;

  let tickets: ExpoTicket[] = [];
  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: pushHeaders,
      body: JSON.stringify(expoPayload),
    });
    if (!response.ok) throw new Error(`Expo Push Service returned ${response.status}`);
    const responseBody = await response.json() as { data?: ExpoTicket[] };
    tickets = Array.isArray(responseBody?.data) ? responseBody.data : [];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Push request failed";
    await serviceClient.from("league_chat_push_deliveries").update({
      status: "failed",
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    }).eq("message_id", messageId).eq("status", "sending");
    return json({ error: errorMessage }, 502);
  }

  let sent = 0;
  await Promise.all(claimed.map(async (delivery, index) => {
    const ticket = tickets[index];
    const successful = ticket?.status === "ok";
    if (successful) sent += 1;
    await serviceClient.from("league_chat_push_deliveries").update({
      status: successful ? "sent" : "failed",
      expo_ticket_id: ticket?.id ?? null,
      error_message: successful ? null : ticket?.message ?? "Expo rejected the notification",
      completed_at: new Date().toISOString(),
    }).eq("message_id", messageId).eq("member_id", delivery.memberId).eq("expo_push_token", delivery.token);
    if (ticket?.details?.error === "DeviceNotRegistered") {
      await serviceClient.from("app_push_devices").update({ enabled: false, updated_at: new Date().toISOString() }).eq("expo_push_token", delivery.token);
    }
  }));

  return json({ sent, failed: claimed.length - sent, skipped: (devices ?? []).length - claimed.length });
});
