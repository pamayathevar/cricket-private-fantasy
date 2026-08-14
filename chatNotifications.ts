import { useEffect, useRef } from "react";
import { Linking, Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { supabase } from "./supabase";

export type ChatNotificationStatus = "unsupported" | "undetermined" | "granted" | "denied" | "error";
export type AppNotificationRoute =
  | { type: "chat"; leagueId: string; messageId: string }
  | { type: "match"; leagueId: string; fixtureId: string };

let notificationsPromise: Promise<typeof import("expo-notifications")> | null = null;
let notificationHandlerConfigured = false;
const loadNotifications = () => {
  if (!notificationsPromise) notificationsPromise = import("expo-notifications");
  return notificationsPromise;
};

const projectId = () => Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? "";

export async function initializeNativeChatNotifications() {
  if (Platform.OS === "web") return;
  const Notifications = await loadNotifications();
  if (!notificationHandlerConfigured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    notificationHandlerConfigured = true;
  }
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("mentions", {
      name: "Chatroom mentions",
      description: "Alerts when another league member mentions you",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 200, 250],
      lightColor: "#CFFF4D",
      sound: "default",
    });
    await Notifications.setNotificationChannelAsync("match-reminders", {
      name: "Match reminders",
      description: "Alerts 24 hours and 30 minutes before selected league matches",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 200, 250],
      lightColor: "#CFFF4D",
      sound: "default",
    });
  }
}

export async function getChatNotificationStatus(): Promise<ChatNotificationStatus> {
  if (Platform.OS === "web" || !Device.isDevice) return "unsupported";
  try {
    await initializeNativeChatNotifications();
    const Notifications = await loadNotifications();
    const permission = await Notifications.getPermissionsAsync();
    if (permission.status === "granted") return "granted";
    if (permission.status === "denied") return "denied";
    return "undetermined";
  } catch {
    return "error";
  }
}

async function registerCurrentDevice() {
  if (Platform.OS === "web" || !Device.isDevice) throw new Error("Push alerts require an installed app on a physical phone.");
  const easProjectId = projectId();
  if (!easProjectId) throw new Error("The EAS project ID is missing from the app configuration.");
  const Notifications = await loadNotifications();
  const token = await Notifications.getExpoPushTokenAsync({ projectId: easProjectId });
  const { error } = await supabase.rpc("register_app_push_device", {
    p_expo_push_token: token.data,
    p_platform: Platform.OS,
    p_device_name: Device.deviceName ?? Device.modelName ?? null,
  });
  if (error) throw error;
  return token.data;
}

export async function requestAndRegisterPushDevice(): Promise<ChatNotificationStatus> {
  if (Platform.OS === "web" || !Device.isDevice) return "unsupported";
  try {
    await initializeNativeChatNotifications();
    const Notifications = await loadNotifications();
    let permission = await Notifications.getPermissionsAsync();
    if (permission.status !== "granted") {
      permission = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
    }
    if (permission.status !== "granted") return "denied";
    await registerCurrentDevice();
    return "granted";
  } catch {
    return "error";
  }
}

export async function enableChatPushNotifications(leagueId: string): Promise<ChatNotificationStatus> {
  const status = await requestAndRegisterPushDevice();
  if (status !== "granted") return status;
  try {
    const { error } = await supabase.rpc("set_league_chat_push_enabled", { p_league_id: leagueId, p_enabled: true });
    if (error) throw error;
    return "granted";
  } catch {
    return "error";
  }
}

export async function disableChatPushNotifications(leagueId: string) {
  const { error } = await supabase.rpc("set_league_chat_push_enabled", { p_league_id: leagueId, p_enabled: false });
  if (error) throw error;
}

export async function setApplicationMentionBadge(count: number) {
  if (Platform.OS === "web") return;
  try {
    const Notifications = await loadNotifications();
    await Notifications.setBadgeCountAsync(Math.max(0, count));
  } catch {
    // A denied badge permission should not interrupt the app.
  }
}

export async function openNotificationSettings() {
  await Linking.openSettings();
}

export function useChatPushTokenMaintenance(enabled: boolean) {
  useEffect(() => {
    if (!enabled || Platform.OS === "web" || !Device.isDevice) return;
    let active = true;
    let subscription: { remove: () => void } | undefined;
    void initializeNativeChatNotifications().then(async () => {
      if (!active) return;
      const Notifications = await loadNotifications();
      subscription = Notifications.addPushTokenListener(() => { void registerCurrentDevice(); });
    });
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [enabled]);
}

const routeFromResponse = (response: import("expo-notifications").NotificationResponse): AppNotificationRoute | null => {
  const data = response.notification.request.content.data;
  if (data?.type === "league_chat_mention" && typeof data.leagueId === "string" && typeof data.messageId === "string") {
    return { type: "chat", leagueId: data.leagueId, messageId: data.messageId };
  }
  if (data?.type === "league_match_reminder" && typeof data.leagueId === "string" && typeof data.fixtureId === "string") {
    return { type: "match", leagueId: data.leagueId, fixtureId: data.fixtureId };
  }
  return null;
};

export function useChatNotificationRouter(onOpen: (route: AppNotificationRoute) => void) {
  const onOpenRef = useRef(onOpen);
  const handledResponseRef = useRef("");
  onOpenRef.current = onOpen;
  useEffect(() => {
    if (Platform.OS === "web") return;
    let active = true;
    let subscription: { remove: () => void } | undefined;
    const handle = (response: import("expo-notifications").NotificationResponse | null) => {
      if (!response || !active || handledResponseRef.current === response.notification.request.identifier) return;
      const route = routeFromResponse(response);
      if (!route) return;
      handledResponseRef.current = response.notification.request.identifier;
      onOpenRef.current(route);
    };
    void initializeNativeChatNotifications().then(async () => {
      if (!active) return;
      const Notifications = await loadNotifications();
      subscription = Notifications.addNotificationResponseReceivedListener(handle);
      handle(await Notifications.getLastNotificationResponseAsync());
    });
    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);
}
