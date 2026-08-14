import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.0";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

type ReminderDelivery = {
  delivery_id: string;
  fixture_id: string;
  league_id: string;
  member_id: string;
  recipient_user_id: string;
  recipient_email: string;
  recipient_name: string;
  league_name: string;
  league_timezone: string;
  match_number: number;
  home_team: string;
  away_team: string;
  scheduled_start: string;
  reminder_offset_minutes: 1440 | 30;
  channel: "push" | "email";
  attempt_count: number;
};

type ExpoTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const reminderLabel = (offset: number) => offset === 1440 ? "24 hours" : "30 minutes";

const fixtureTime = (delivery: ReminderDelivery) => {
  try {
    return new Intl.DateTimeFormat("en", {
      timeZone: delivery.league_timezone || "UTC",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(delivery.scheduled_start));
  } catch {
    return new Date(delivery.scheduled_start).toISOString();
  }
};

Deno.serve(async request => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret = Deno.env.get("MATCH_REMINDER_CRON_SECRET");
  if (!supabaseUrl || !serviceRoleKey || !cronSecret) return json({ error: "Function environment is incomplete" }, 500);
  if (request.headers.get("x-cron-secret") !== cronSecret) return json({ error: "Invalid scheduler credential" }, 401);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data, error } = await serviceClient.rpc("claim_due_match_reminders", { p_batch_size: 100 });
  if (error) return json({ error: "Could not claim due reminders", detail: error.message }, 500);

  const deliveries = (data ?? []) as ReminderDelivery[];
  if (!deliveries.length) return json({ claimed: 0, sent: 0, partial: 0, failed: 0, skipped: 0 });

  const complete = async (delivery: ReminderDelivery, status: "sent" | "partial" | "failed" | "skipped", providerId?: string, message?: string) => {
    const { error: completionError } = await serviceClient.rpc("complete_match_reminder_delivery", {
      p_delivery_id: delivery.delivery_id,
      p_status: status,
      p_provider_message_id: providerId ?? null,
      p_error_message: message ?? null,
    });
    if (completionError) console.error("Reminder completion failed", delivery.delivery_id, completionError.message);
    return status;
  };

  const sendPush = async (delivery: ReminderDelivery) => {
    const { data: devices, error: devicesError } = await serviceClient
      .from("app_push_devices")
      .select("expo_push_token")
      .eq("user_id", delivery.recipient_user_id)
      .eq("enabled", true);
    if (devicesError) return complete(delivery, "failed", undefined, devicesError.message);
    if (!devices?.length) return complete(delivery, "skipped", undefined, "No active app device");

    const payloads = devices.map(device => ({
      to: device.expo_push_token,
      sound: "default",
      title: `${delivery.home_team} vs ${delivery.away_team} starts in ${reminderLabel(delivery.reminder_offset_minutes)}`,
      body: `Match ${delivery.match_number} · ${fixtureTime(delivery)} · Review and submit your XI.`,
      data: {
        type: "league_match_reminder",
        leagueId: delivery.league_id,
        fixtureId: delivery.fixture_id,
        matchNumber: delivery.match_number,
      },
      channelId: "match-reminders",
      priority: "high",
    }));

    const headers: Record<string, string> = {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    };
    const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
    if (expoAccessToken) headers.Authorization = `Bearer ${expoAccessToken}`;

    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers,
        body: JSON.stringify(payloads),
      });
      if (!response.ok) throw new Error(`Expo Push Service returned ${response.status}`);
      const responseBody = await response.json() as { data?: ExpoTicket[] };
      const tickets = Array.isArray(responseBody.data) ? responseBody.data : [];
      const successful = tickets.filter(ticket => ticket.status === "ok");
      await Promise.all(tickets.map(async (ticket, index) => {
        if (ticket.details?.error === "DeviceNotRegistered" && devices[index]?.expo_push_token) {
          await serviceClient.from("app_push_devices").update({ enabled: false, updated_at: new Date().toISOString() }).eq("expo_push_token", devices[index].expo_push_token);
        }
      }));
      const providerIds = successful.map(ticket => ticket.id).filter(Boolean).join(",");
      if (successful.length === devices.length) return complete(delivery, "sent", providerIds);
      if (successful.length) return complete(delivery, "partial", providerIds, `${devices.length - successful.length} device delivery failures`);
      return complete(delivery, "failed", undefined, tickets.map(ticket => ticket.message).filter(Boolean).join("; ") || "Expo rejected the notification");
    } catch (pushError) {
      return complete(delivery, "failed", undefined, pushError instanceof Error ? pushError.message : "Push request failed");
    }
  };

  const sendEmail = async (delivery: ReminderDelivery) => {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("REMINDER_FROM_EMAIL");
    if (!resendApiKey || !fromEmail) return complete(delivery, "failed", undefined, "Email provider is not configured");
    const teams = `${delivery.home_team} vs ${delivery.away_team}`;
    const label = reminderLabel(delivery.reminder_offset_minutes);
    const time = fixtureTime(delivery);
    const subject = `${teams} starts in ${label}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#10231d">
        <div style="background:#071d3c;color:white;border-radius:18px 18px 0 0;padding:24px">
          <div style="font-size:12px;letter-spacing:1px;color:#cfff4d;font-weight:700">MATCH REMINDER</div>
          <h1 style="margin:8px 0 0;font-size:28px">${escapeHtml(teams)}</h1>
        </div>
        <div style="border:1px solid #dce5e0;border-top:0;border-radius:0 0 18px 18px;padding:24px">
          <p>Hi ${escapeHtml(delivery.recipient_name)},</p>
          <p><strong>Match ${delivery.match_number}</strong> starts in ${escapeHtml(label)}.</p>
          <p style="font-size:18px"><strong>${escapeHtml(time)}</strong></p>
          <p>Open ${escapeHtml(delivery.league_name)} to review and submit your XI before it locks.</p>
          <p style="color:#66756f;font-size:12px">You opted in to this reminder for this private league.</p>
        </div>
      </div>`;

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": delivery.delivery_id,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [delivery.recipient_email],
          subject,
          html,
        }),
      });
      const responseBody = await response.json() as { id?: string; message?: string };
      if (!response.ok) throw new Error(responseBody.message || `Email provider returned ${response.status}`);
      return complete(delivery, "sent", responseBody.id);
    } catch (emailError) {
      return complete(delivery, "failed", undefined, emailError instanceof Error ? emailError.message : "Email request failed");
    }
  };

  const statuses = await Promise.all(deliveries.map(delivery => delivery.channel === "push" ? sendPush(delivery) : sendEmail(delivery)));
  return json({
    claimed: deliveries.length,
    sent: statuses.filter(status => status === "sent").length,
    partial: statuses.filter(status => status === "partial").length,
    failed: statuses.filter(status => status === "failed").length,
    skipped: statuses.filter(status => status === "skipped").length,
  });
});
