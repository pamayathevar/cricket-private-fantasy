import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Switch, Text, useWindowDimensions, View } from "react-native";
import { requestAndRegisterPushDevice, useChatPushTokenMaintenance } from "./chatNotifications";
import { userActionError } from "./errorMessages";
import { supabase } from "./supabase";
import { CARD_SHADOW, UI_TOKENS, normalizeUiStyles } from "./uiTokens";

type MatchReminderPreferences = {
  push24h: boolean;
  push30m: boolean;
  email24h: boolean;
  email30m: boolean;
  emailAvailable: boolean;
  email: string;
};

type MatchReminderKey = "push24h" | "push30m" | "email24h" | "email30m";

const EMPTY_PREFERENCES: MatchReminderPreferences = {
  push24h: false,
  push30m: false,
  email24h: false,
  email30m: false,
  emailAvailable: false,
  email: "",
};

const UI = UI_TOKENS.colors;

export function MatchReminderSettings({ leagueId }: { leagueId: string }) {
  const { width } = useWindowDimensions();
  const compact = width < 620;
  const [preferences, setPreferences] = useState<MatchReminderPreferences>(EMPTY_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<MatchReminderKey | null>(null);
  const [message, setMessage] = useState("");

  useChatPushTokenMaintenance(preferences.push24h || preferences.push30m);

  const loadPreferences = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_league_match_reminder_preferences", { p_league_id: leagueId });
    if (error || !data || typeof data !== "object") {
      setMessage(userActionError(error ?? "Reminder preferences were not returned", "Match reminder refresh"));
      setLoading(false);
      return;
    }
    const value = data as Record<string, unknown>;
    setPreferences({
      push24h: value.push_24h_enabled === true,
      push30m: value.push_30m_enabled === true,
      email24h: value.email_24h_enabled === true,
      email30m: value.email_30m_enabled === true,
      emailAvailable: value.email_available === true,
      email: typeof value.email === "string" ? value.email : "",
    });
    setMessage("");
    setLoading(false);
  }, [leagueId]);

  useEffect(() => {
    setLoading(true);
    setPreferences(EMPTY_PREFERENCES);
    void loadPreferences();
  }, [loadPreferences]);

  const updatePreference = async (key: MatchReminderKey, enabled: boolean) => {
    if (busy || loading) return;
    if (key.startsWith("email") && !preferences.emailAvailable) return;
    setBusy(key);
    setMessage("");

    if (key.startsWith("push") && enabled) {
      const status = await requestAndRegisterPushDevice();
      if (status !== "granted") {
        setMessage(status === "denied"
          ? "Match reminders are blocked by your phone notification settings."
          : status === "unsupported"
            ? "Push reminders require the installed iOS or Android app on a physical phone."
            : "Push reminders could not be configured. Check your connection and try again.");
        setBusy(null);
        return;
      }
    }

    const next = { ...preferences, [key]: enabled };
    const { data, error } = await supabase.rpc("set_league_match_reminder_preferences", {
      p_league_id: leagueId,
      p_push_24h_enabled: next.push24h,
      p_push_30m_enabled: next.push30m,
      p_email_24h_enabled: next.email24h,
      p_email_30m_enabled: next.email30m,
    });
    if (error || !data || typeof data !== "object") {
      setMessage(userActionError(error ?? "Reminder preferences were not returned", "Match reminder update"));
    } else {
      const value = data as Record<string, unknown>;
      setPreferences({
        push24h: value.push_24h_enabled === true,
        push30m: value.push_30m_enabled === true,
        email24h: value.email_24h_enabled === true,
        email30m: value.email_30m_enabled === true,
        emailAvailable: value.email_available === true,
        email: typeof value.email === "string" ? value.email : preferences.email,
      });
    }
    setBusy(null);
  };

  return <View style={[styles.card, compact && styles.cardCompact]}>
    <View style={[styles.heading, compact && styles.headingCompact]}>
      <View style={styles.icon}><Text style={styles.iconText}>◷</Text></View>
      <View style={styles.grow}>
        <Text style={styles.eyebrow}>YOUR ALERTS</Text>
        <Text accessibilityRole="header" style={styles.title}>Match reminders</Text>
        <Text style={styles.subtitle}>Plan your XI with alerts tied to the official fixture start.</Text>
      </View>
      {!compact ? <View style={styles.contextPill}><Text style={styles.contextPillText}>FIXTURE SETTINGS</Text></View> : null}
    </View>

    {message ? <View accessibilityLiveRegion="polite" style={styles.message}><Text style={styles.messageText}>{message}</Text></View> : null}
    {loading ? <View style={styles.loading}><ActivityIndicator size="small" color={UI.primary} /><Text style={styles.loadingText}>Loading reminder settings…</Text></View> : <>
      <View style={styles.columns}><Text style={styles.timeColumn}>BEFORE START</Text><Text style={styles.controlColumn}>PUSH</Text><Text style={styles.controlColumn}>EMAIL</Text></View>
      <ReminderRow label="24 hours" hint="Plan your XI" last={false} pushValue={preferences.push24h} emailValue={preferences.email24h} emailAvailable={preferences.emailAvailable} busy={busy !== null} onPush={(enabled) => void updatePreference("push24h", enabled)} onEmail={(enabled) => void updatePreference("email24h", enabled)} />
      <ReminderRow label="30 minutes" hint="Final lineup check" last pushValue={preferences.push30m} emailValue={preferences.email30m} emailAvailable={preferences.emailAvailable} busy={busy !== null} onPush={(enabled) => void updatePreference("push30m", enabled)} onEmail={(enabled) => void updatePreference("email30m", enabled)} />
      <View style={styles.foot}><Text style={styles.footIcon}>{preferences.emailAvailable ? "✓" : "i"}</Text><Text style={styles.footText}>{Platform.OS === "web" ? "Push settings are managed in the installed app. " : "Push uses this phone. "}{preferences.emailAvailable ? `Email goes to ${preferences.email}.` : "Email is optional and will appear after a verified sender is configured."}</Text></View>
      <Text style={styles.safety}>Started, cancelled and abandoned fixtures are skipped automatically.</Text>
    </>}
  </View>;
}

function ReminderRow({ label, hint, last, pushValue, emailValue, emailAvailable, busy, onPush, onEmail }: { label: string; hint: string; last: boolean; pushValue: boolean; emailValue: boolean; emailAvailable: boolean; busy: boolean; onPush: (enabled: boolean) => void; onEmail: (enabled: boolean) => void }) {
  return <View style={[styles.row, last && styles.rowLast]}>
    <View style={styles.time}><Text style={styles.timeValue}>{label}</Text><Text style={styles.timeHint}>{hint}</Text></View>
    <View style={styles.control}><Switch accessibilityLabel={`Push reminder ${label} before match`} value={pushValue} disabled={Platform.OS === "web" || busy} onValueChange={onPush} trackColor={{ false: "#D9E1DD", true: "#80BDA7" }} thumbColor={pushValue ? UI.primary : "#FFFFFF"} /></View>
    <View style={styles.control}><Switch accessibilityLabel={`Email reminder ${label} before match`} value={emailValue} disabled={!emailAvailable || busy} onValueChange={onEmail} trackColor={{ false: "#D9E1DD", true: "#BBA3DD" }} thumbColor={emailValue ? "#6A38B1" : "#FFFFFF"} /></View>
  </View>;
}

const styles = StyleSheet.create(normalizeUiStyles({
  card: { borderWidth: 1, borderColor: UI.border, borderRadius: 20, backgroundColor: UI.card, padding: 18, ...CARD_SHADOW },
  cardCompact: { borderRadius: 18, padding: 15 },
  heading: { flexDirection: "row", alignItems: "center", gap: 12 },
  headingCompact: { alignItems: "flex-start" },
  icon: { width: 46, height: 46, borderRadius: 15, backgroundColor: UI.primarySoft, alignItems: "center", justifyContent: "center" },
  iconText: { color: UI.primary, fontSize: 22, fontWeight: "900" },
  grow: { flex: 1, minWidth: 0 },
  eyebrow: { color: UI.primary, fontSize: 7, fontWeight: "900", letterSpacing: 1 },
  title: { color: UI.ink, fontSize: 17, lineHeight: 22, fontWeight: "900", marginTop: 2 },
  subtitle: { color: UI.muted, fontSize: 9, lineHeight: 13, marginTop: 3 },
  contextPill: { borderRadius: 999, backgroundColor: UI.primarySoft, paddingHorizontal: 11, paddingVertical: 8 },
  contextPillText: { color: UI.primary, fontSize: 6, fontWeight: "900", letterSpacing: 0.6 },
  message: { borderWidth: 1, borderColor: "#E59A8B", borderRadius: 12, backgroundColor: "#FFF0EC", paddingHorizontal: 12, paddingVertical: 9, marginTop: 12 },
  messageText: { color: "#7A4036", fontSize: 8, lineHeight: 12, fontWeight: "700" },
  loading: { minHeight: 100, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  loadingText: { color: UI.muted, fontSize: 9, fontWeight: "700" },
  columns: { minHeight: 30, flexDirection: "row", alignItems: "flex-end", borderBottomWidth: 1, borderBottomColor: UI.border, marginTop: 14, paddingBottom: 7 },
  timeColumn: { flex: 1, color: UI.subtle, fontSize: 6, fontWeight: "900", letterSpacing: 0.65 },
  controlColumn: { width: 70, color: UI.subtle, fontSize: 6, fontWeight: "900", letterSpacing: 0.65, textAlign: "center" },
  row: { minHeight: 66, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: UI.border },
  rowLast: { borderBottomWidth: 0 },
  time: { flex: 1, minWidth: 0, paddingRight: 8 },
  timeValue: { color: UI.ink, fontSize: 10, fontWeight: "900" },
  timeHint: { color: UI.muted, fontSize: 7, marginTop: 2 },
  control: { width: 70, alignItems: "center", justifyContent: "center" },
  foot: { flexDirection: "row", alignItems: "flex-start", gap: 7, borderRadius: 11, backgroundColor: "#F2F6F4", paddingHorizontal: 10, paddingVertical: 9, marginTop: 9 },
  footIcon: { width: 16, color: UI.primary, fontSize: 9, fontWeight: "900", textAlign: "center" },
  footText: { flex: 1, color: UI.muted, fontSize: 7, lineHeight: 11 },
  safety: { color: UI.subtle, fontSize: 6, lineHeight: 10, marginTop: 8 },
}));
