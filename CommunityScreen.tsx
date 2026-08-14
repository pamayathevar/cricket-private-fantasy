import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { supabase } from "./supabase";
import { userActionError } from "./errorMessages";
import { CARD_SHADOW, UI_TOKENS, normalizeUiStyles } from "./uiTokens";
import { ChatNotificationStatus, disableChatPushNotifications, enableChatPushNotifications, getChatNotificationStatus, openNotificationSettings, setApplicationMentionBadge, useChatPushTokenMaintenance } from "./chatNotifications";

type CommunityMember = {
  id: string;
  display_name: string;
  role: "league_admin" | "owner" | "viewer";
  status: string;
};

type MemberPresence = { member_id: string; last_seen_at: string };
type ChatUnreadSummary = { unreadMessages: number; unreadMentions: number; pushMentionsEnabled: boolean };
type ChatMessage = {
  id: string;
  member_id: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
};
const MEMBER_COLORS = ["#1769AA", "#6A38B1", "#C13B78", "#C95F18", "#2C8B55", "#087F8C", "#8B5A2B", "#B53644"];
const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const UI = UI_TOKENS.colors;

const memberColor = (memberId: string) => MEMBER_COLORS[[...memberId].reduce((sum, character) => sum + character.charCodeAt(0), 0) % MEMBER_COLORS.length];
const memberInitials = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "?";
const formatClockTime = (value: string) => new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const TrashIcon = ({ light = false }: { light?: boolean }) => <View style={styles.trashIcon}>
  <View style={[styles.trashHandle, light && styles.trashPartLight]} />
  <View style={[styles.trashLid, light && styles.trashPartLight]} />
  <View style={[styles.trashCan, light && styles.trashCanLight]}><View style={[styles.trashLine, light && styles.trashPartLight]} /><View style={[styles.trashLine, light && styles.trashPartLight]} /></View>
</View>;
const ChatroomGroupIcon = () => <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.chatroomGroupIcon}>
  <View style={[styles.chatroomGroupBodySide, styles.chatroomGroupBodyLeft]} />
  <View style={[styles.chatroomGroupBodySide, styles.chatroomGroupBodyRight]} />
  <View style={styles.chatroomGroupBodyCenter} />
  <View style={[styles.chatroomGroupHeadSide, styles.chatroomGroupHeadLeft]} />
  <View style={[styles.chatroomGroupHeadSide, styles.chatroomGroupHeadRight]} />
  <View style={styles.chatroomGroupHeadCenter} />
</View>;
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const everyoneIsMentioned = (body: string) => /(^|\s)@everyone(?=\s|$|[.,!?;:])/i.test(body);
const memberIsMentioned = (body: string, member: CommunityMember) => new RegExp(`(^|\\s)@${escapeRegExp(member.display_name)}(?=\\s|$|[.,!?;:])`, "i").test(body);
const renderMessageText = (body: string, members: CommunityMember[], currentMemberId: string, mine: boolean) => {
  const namedMembers = members.filter(member => body.toLocaleLowerCase().includes(`@${member.display_name.toLocaleLowerCase()}`)).sort((left, right) => right.display_name.length - left.display_name.length);
  const mentionsEveryone = everyoneIsMentioned(body);
  if (!namedMembers.length && !mentionsEveryone) return body;
  const memberByTag = new Map(namedMembers.map(member => [`@${member.display_name}`.toLocaleLowerCase(), member]));
  const tagAlternatives = [...(mentionsEveryone ? ["everyone"] : []), ...namedMembers.map(member => escapeRegExp(member.display_name))];
  const expression = new RegExp(`(@(?:${tagAlternatives.join("|")}))(?=\\s|$|[.,!?;:])`, "gi");
  return body.split(expression).map((part, index) => {
    const taggedMember = memberByTag.get(part.toLocaleLowerCase());
    const everyoneTag = part.toLocaleLowerCase() === "@everyone";
    if (!taggedMember && !everyoneTag) return part;
    return <Text key={`${part}:${index}`} style={[styles.inlineMention, mine && styles.inlineMentionMine, everyoneTag && styles.inlineMentionEveryone, taggedMember?.id === currentMemberId && styles.inlineMentionCurrent]}>{part}</Text>;
  });
};
const presenceLabel = (lastSeenAt: string | undefined, now: number) => {
  if (!lastSeenAt) return "Not online yet";
  const age = Math.max(0, now - new Date(lastSeenAt).getTime());
  if (age <= ONLINE_WINDOW_MS) return "Online now";
  const minutes = Math.floor(age / 60_000);
  if (minutes < 60) return `Active ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Active ${hours}h ago`;
  return `Active ${new Date(lastSeenAt).toLocaleDateString([], { month: "short", day: "numeric" })}`;
};

export function useLeagueHeartbeat(leagueId: string, memberId: string) {
  useEffect(() => {
    if (!leagueId || !memberId) return;
    let stopped = false;
    const touch = async () => {
      if (stopped || AppState.currentState !== "active") return;
      await supabase.rpc("touch_league_presence", { p_league_id: leagueId });
    };
    void touch();
    const timer = setInterval(touch, 45_000);
    const appStateSubscription = AppState.addEventListener("change", state => { if (state === "active") void touch(); });
    return () => {
      stopped = true;
      clearInterval(timer);
      appStateSubscription.remove();
    };
  }, [leagueId, memberId]);
}

export function useLeagueChatUnread(leagueId: string, memberId: string) {
  const [summary, setSummary] = useState<ChatUnreadSummary>({ unreadMessages: 0, unreadMentions: 0, pushMentionsEnabled: false });
  const refresh = useCallback(async () => {
    if (!leagueId || !memberId) {
      setSummary({ unreadMessages: 0, unreadMentions: 0, pushMentionsEnabled: false });
      return;
    }
    const { data, error } = await supabase.rpc("get_league_chat_unread", { p_league_id: leagueId });
    if (error || !data || typeof data !== "object") return;
    const value = data as Record<string, unknown>;
    setSummary({
      unreadMessages: Number(value.unread_messages ?? 0),
      unreadMentions: Number(value.unread_mentions ?? 0),
      pushMentionsEnabled: value.push_mentions_enabled === true,
    });
  }, [leagueId, memberId]);
  useEffect(() => {
    void refresh();
    if (!leagueId || !memberId) return;
    const channel = supabase.channel(`league-chat-unread:${leagueId}:${memberId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "league_chat_mentions", filter: `member_id=eq.${memberId}` }, () => { void refresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "league_chat_messages", filter: `league_id=eq.${leagueId}` }, () => { void refresh(); })
      .subscribe();
    const timer = setInterval(refresh, 45_000);
    return () => {
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [leagueId, memberId, refresh]);
  useEffect(() => { void setApplicationMentionBadge(summary.unreadMentions); }, [summary.unreadMentions]);
  return { ...summary, refresh };
}

export function CommunityScreen({
  leagueId,
  currentMemberId,
  currentMemberName,
  canModerate,
  unreadMessages,
  unreadMentions,
  pushMentionsEnabled,
  onUnreadRefresh,
}: {
  leagueId: string;
  currentMemberId: string;
  currentMemberName: string;
  canModerate: boolean;
  unreadMessages: number;
  unreadMentions: number;
  pushMentionsEnabled: boolean;
  onUnreadRefresh: () => Promise<void>;
}) {
  const { width } = useWindowDimensions();
  const compact = width < 700;
  const messageScrollRef = useRef<ScrollView>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [presence, setPresence] = useState<MemberPresence[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<ChatNotificationStatus>("undetermined");
  const [removeCandidate, setRemoveCandidate] = useState<ChatMessage | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [clock, setClock] = useState(Date.now());
  useChatPushTokenMaintenance(pushMentionsEnabled && notificationStatus === "granted");

  useEffect(() => { void getChatNotificationStatus().then(setNotificationStatus); }, []);

  const loadMembers = useCallback(async () => {
    const [memberResult, presenceResult] = await Promise.all([
      supabase.from("league_members").select("id,display_name,role,status").eq("league_id", leagueId).order("display_name"),
      supabase.from("league_member_presence").select("member_id,last_seen_at").eq("league_id", leagueId),
    ]);
    if (memberResult.error || presenceResult.error) {
      setMessage(userActionError(memberResult.error ?? presenceResult.error, "Member board refresh"));
      return;
    }
    setMembers((memberResult.data ?? []) as CommunityMember[]);
    setPresence((presenceResult.data ?? []) as MemberPresence[]);
    setClock(Date.now());
  }, [leagueId]);

  const loadMessages = useCallback(async () => {
    const { data, error } = await supabase.from("league_chat_messages")
      .select("id,member_id,body,created_at,deleted_at")
      .eq("league_id", leagueId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      setMessage(userActionError(error, "League chat refresh"));
      return;
    }
    setMessages(((data ?? []) as ChatMessage[]).reverse());
  }, [leagueId]);

  const markChatRead = useCallback(async () => {
    const { error } = await supabase.rpc("mark_league_chat_read", { p_league_id: leagueId });
    if (!error) await onUnreadRefresh();
  }, [leagueId, onUnreadRefresh]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMessage("");
    Promise.all([loadMembers(), loadMessages()]).finally(() => { if (active) setLoading(false); });
    const channel = supabase.channel(`league-community:${leagueId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "league_member_presence", filter: `league_id=eq.${leagueId}` }, () => { void loadMembers(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "league_chat_messages", filter: `league_id=eq.${leagueId}` }, () => { void loadMessages(); })
      .subscribe();
    const memberTimer = setInterval(loadMembers, 30_000);
    const clockTimer = setInterval(() => setClock(Date.now()), 30_000);
    return () => {
      active = false;
      clearInterval(memberTimer);
      clearInterval(clockTimer);
      void supabase.removeChannel(channel);
    };
  }, [leagueId, loadMembers, loadMessages]);

  const presenceByMember = useMemo(() => new Map(presence.map(row => [row.member_id, row.last_seen_at])), [presence]);
  const activeMembers = useMemo(() => members.filter(member => member.status === "active"), [members]);
  const onlineMembers = useMemo(() => activeMembers.filter(member => {
    const lastSeenAt = presenceByMember.get(member.id);
    return !!lastSeenAt && clock - new Date(lastSeenAt).getTime() <= ONLINE_WINDOW_MS;
  }), [activeMembers, clock, presenceByMember]);
  const memberById = useMemo(() => new Map(members.map(member => [member.id, member])), [members]);

  useEffect(() => {
    if (!loading) void markChatRead();
  }, [loading, markChatRead, messages.length]);

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return [];
    const query = mentionQuery.trim().toLocaleLowerCase();
    const includesEveryone = "everyone".includes(query);
    return activeMembers
      .filter(member => member.id !== currentMemberId)
      .filter(member => !query || member.display_name.toLocaleLowerCase().includes(query))
      .slice(0, includesEveryone ? 3 : 4);
  }, [activeMembers, currentMemberId, mentionQuery]);
  const showEveryoneCandidate = mentionQuery !== null && "everyone".includes(mentionQuery.trim().toLocaleLowerCase());

  const updateDraft = (value: string) => {
    setDraft(value);
    const mentionMatch = value.match(/(?:^|\s)@([^@\n]{0,60})$/);
    setMentionQuery(mentionMatch ? mentionMatch[1] : null);
  };

  const insertMention = (member: CommunityMember) => {
    const mentionStart = draft.lastIndexOf("@");
    if (mentionStart < 0) return;
    setDraft(`${draft.slice(0, mentionStart)}@${member.display_name} `);
    setMentionQuery(null);
  };

  const insertEveryoneMention = () => {
    const mentionStart = draft.lastIndexOf("@");
    if (mentionStart < 0) return;
    setDraft(`${draft.slice(0, mentionStart)}@everyone `);
    setMentionQuery(null);
  };

  const everyoneMentioned = everyoneIsMentioned(draft);
  const mentionedMembers = useMemo(() => everyoneMentioned ? [] : activeMembers.filter(member => member.id !== currentMemberId && memberIsMentioned(draft, member)).slice(0, 8), [activeMembers, currentMemberId, draft, everyoneMentioned]);

  const sendMessage = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setMessage("");
    const { data: messageId, error } = await supabase.rpc("post_league_chat_message", {
      p_league_id: leagueId,
      p_body: body,
      p_mentioned_member_ids: mentionedMembers.map(member => member.id),
    });
    if (error) setMessage(userActionError(error, "Message send"));
    else {
      setDraft("");
      setMentionQuery(null);
      await loadMessages();
      if (messageId && (everyoneMentioned || mentionedMembers.length)) {
        void supabase.functions.invoke("send-chat-mention", { body: { messageId } });
      }
      requestAnimationFrame(() => messageScrollRef.current?.scrollToEnd({ animated: true }));
    }
    setSending(false);
  };

  const removeMessage = async () => {
    if (!removeCandidate || removeBusy) return;
    setRemoveBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("remove_league_chat_message", { p_message_id: removeCandidate.id });
    if (error) setMessage(userActionError(error, "Message removal"));
    else await loadMessages();
    setRemoveBusy(false);
    setRemoveCandidate(null);
  };

  const enableNotifications = async () => {
    if (notificationBusy) return;
    setNotificationBusy(true);
    setMessage("");
    const status = await enableChatPushNotifications(leagueId);
    setNotificationStatus(status);
    if (status === "granted") await onUnreadRefresh();
    else if (status === "error") setMessage("Mention alerts could not be configured. Check your connection and try again.");
    setNotificationBusy(false);
  };

  const disableNotifications = () => {
    Alert.alert("Turn off mention alerts?", "You will still see mentions and unread badges inside the app.", [
      { text: "Keep alerts", style: "cancel" },
      { text: "Turn off", style: "destructive", onPress: async () => {
        setNotificationBusy(true);
        try {
          await disableChatPushNotifications(leagueId);
          await onUnreadRefresh();
        } catch (error) {
          setMessage(userActionError(error instanceof Error ? error : String(error), "Notification preference"));
        }
        setNotificationBusy(false);
      } },
    ]);
  };

  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={compact ? 92 : 0}>
    <ScrollView contentContainerStyle={[styles.page, compact && styles.pageCompact]} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <View pointerEvents="none" style={styles.heroGlow} />
        <View style={styles.heroHeading}><View style={styles.heroIcon}><ChatroomGroupIcon /></View><View style={styles.grow}><Text style={styles.heroEyebrow}>PRIVATE LEAGUE SPACE</Text><Text accessibilityRole="header" style={styles.heroTitle}>Chatroom</Text><Text style={styles.heroSubtitle}>See who is around and talk cricket with your league.</Text></View></View>
        <View style={styles.heroStats}><View style={styles.heroStat}><Text style={styles.heroStatValue}>{activeMembers.length}</Text><Text style={styles.heroStatLabel}>MEMBERS</Text></View><View style={styles.heroDivider} /><View style={styles.heroStat}><Text style={[styles.heroStatValue, styles.onlineValue]}>{onlineMembers.length}</Text><Text style={styles.heroStatLabel}>ONLINE NOW</Text></View><View style={styles.heroDivider} /><View style={styles.heroStat}><Text style={styles.heroStatValue}>{unreadMessages}</Text><Text style={styles.heroStatLabel}>UNREAD</Text></View></View>
      </View>

      {message ? <View accessibilityLiveRegion="polite" style={styles.errorBanner}><Text style={styles.errorText}>{message}</Text><TouchableOpacity accessibilityRole="button" style={styles.retryButton} onPress={() => { setMessage(""); void Promise.all([loadMembers(), loadMessages()]); }}><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View> : null}

      <View style={[styles.workspace, compact && styles.workspaceCompact]}>
        <View style={[styles.sidebarColumn, compact && styles.sidebarColumnCompact]}>
          <View style={[styles.card, styles.memberBoardCard]}>
            <View style={styles.sectionHeading}><View style={styles.grow}><Text style={styles.sectionEyebrow}>MEMBER BOARD</Text><Text style={styles.sectionTitle}>League members</Text></View><View style={styles.onlinePill}><View style={styles.onlineDot} /><Text style={styles.onlinePillText}>{onlineMembers.length} online</Text></View></View>
            {loading ? <View style={styles.loading}><ActivityIndicator color={UI.primary} /><Text style={styles.loadingText}>Opening the clubhouse…</Text></View> : <ScrollView horizontal={compact} nestedScrollEnabled style={compact ? undefined : styles.memberList} showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={!compact} contentContainerStyle={compact ? styles.memberStrip : styles.memberListContent}>{activeMembers.map(member => {
              const lastSeenAt = presenceByMember.get(member.id);
              const online = !!lastSeenAt && clock - new Date(lastSeenAt).getTime() <= ONLINE_WINDOW_MS;
              const current = member.id === currentMemberId;
              return <View key={member.id} style={[styles.memberCard, !compact && styles.memberCardDesktop, current && styles.memberCardCurrent]}><View style={[styles.avatar, { backgroundColor: `${memberColor(member.id)}1F`, borderColor: memberColor(member.id) }]}><Text style={[styles.avatarText, { color: memberColor(member.id) }]}>{memberInitials(member.display_name)}</Text>{online ? <View style={styles.avatarOnline} /> : null}</View><View style={styles.memberDetails}><View style={styles.memberNameRow}><Text numberOfLines={1} style={styles.memberName}>{member.display_name}</Text>{current ? <View style={styles.youPill}><Text style={styles.youPillText}>YOU</Text></View> : null}</View><Text style={styles.memberRole}>{member.role === "league_admin" ? "League admin" : member.role === "viewer" ? "Viewer" : "Owner"}</Text><Text numberOfLines={1} style={[styles.memberPresence, online && styles.memberPresenceOnline]}>{presenceLabel(lastSeenAt, clock)}</Text></View></View>;
            })}</ScrollView>}
            <Text style={styles.presenceNote}>Online status is approximate and refreshes while the app is active.</Text>
          </View>

          <View style={[styles.notificationCard, !compact && styles.notificationCardSidebar]}>
            <View style={styles.notificationIcon}><Text style={styles.notificationIconText}>@</Text>{unreadMentions ? <View style={styles.notificationBadge}><Text style={styles.notificationBadgeText}>{Math.min(unreadMentions, 99)}</Text></View> : null}</View>
            <View style={styles.grow}><Text style={styles.notificationTitle}>Mention alerts</Text><Text style={styles.notificationText}>{Platform.OS === "web" ? "Push alerts are available in the installed iOS and Android app." : pushMentionsEnabled && notificationStatus === "granted" ? "On · You will be notified when a member tags you." : notificationStatus === "denied" ? "Blocked by your phone settings. In-app badges will still work." : "Get a private alert only when another member tags you."}</Text></View>
            {Platform.OS === "web" ? <View style={styles.notificationStatePill}><Text style={styles.notificationStateText}>APP ONLY</Text></View> : notificationStatus === "denied" ? <TouchableOpacity accessibilityRole="button" style={styles.notificationSecondaryButton} onPress={() => void openNotificationSettings()}><Text style={styles.notificationSecondaryText}>Settings</Text></TouchableOpacity> : pushMentionsEnabled && notificationStatus === "granted" ? <TouchableOpacity accessibilityRole="switch" accessibilityState={{ checked: true, disabled: notificationBusy }} disabled={notificationBusy} style={styles.notificationOnButton} onPress={disableNotifications}><View style={styles.notificationSwitchKnob} /><Text style={styles.notificationOnText}>On</Text></TouchableOpacity> : <TouchableOpacity accessibilityRole="button" accessibilityLabel="Enable mention notifications" accessibilityState={{ busy: notificationBusy }} disabled={notificationBusy} style={styles.notificationEnableButton} onPress={() => void enableNotifications()}>{notificationBusy ? <ActivityIndicator size="small" color={UI.primaryDeep} /> : <Text style={styles.notificationEnableText}>Enable</Text>}</TouchableOpacity>}
          </View>

        </View>

        <View style={[styles.card, styles.chatCard]}>
        <View style={styles.sectionHeading}><View style={styles.grow}><Text style={styles.sectionEyebrow}>LEAGUE CHATROOM</Text><Text style={styles.sectionTitle}>Match-day conversation</Text><Text style={styles.sectionText}>Visible only to active members of this league.</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh league chat" style={styles.refreshButton} onPress={() => void loadMessages()}><Text style={styles.refreshButtonText}>↻</Text></TouchableOpacity></View>
        <ScrollView ref={messageScrollRef} style={[styles.messageList, compact && styles.messageListCompact]} contentContainerStyle={styles.messageListContent} keyboardShouldPersistTaps="handled" onContentSizeChange={() => messageScrollRef.current?.scrollToEnd({ animated: false })}>
          {!loading && !messages.length ? <View style={styles.emptyChat}><Text style={styles.emptyChatIcon}>✦</Text><Text style={styles.emptyChatTitle}>Start the conversation</Text><Text style={styles.emptyChatText}>Share a lineup thought, celebrate a result, or begin the match-day banter.</Text></View> : null}
          {messages.map(chatMessage => {
            const author = memberById.get(chatMessage.member_id);
            const mine = chatMessage.member_id === currentMemberId;
            const mentionedMe = !mine && !chatMessage.deleted_at && (everyoneIsMentioned(chatMessage.body) || (!!memberById.get(currentMemberId) && memberIsMentioned(chatMessage.body, memberById.get(currentMemberId)!)));
            const removable = !chatMessage.deleted_at && (mine || canModerate);
            return <View key={chatMessage.id} style={[styles.messageRow, mine && styles.messageRowMine]}>{!mine ? <View style={[styles.messageAvatar, { backgroundColor: memberColor(chatMessage.member_id) }]}><Text style={styles.messageAvatarText}>{memberInitials(author?.display_name ?? "Former member")}</Text></View> : null}<View style={[styles.messageBubble, mine && styles.messageBubbleMine, mentionedMe && styles.messageBubbleMentioned, chatMessage.deleted_at && styles.messageBubbleDeleted]}>{mentionedMe ? <View style={styles.mentionedYouPill}><Text style={styles.mentionedYouText}>MENTIONED YOU</Text></View> : null}<View style={styles.messageMeta}><Text numberOfLines={1} style={[styles.messageAuthor, mine && styles.messageAuthorMine]}>{mine ? currentMemberName : author?.display_name ?? "Former member"}</Text><View style={styles.messageMetaActions}><Text style={[styles.messageTime, mine && styles.messageTimeMine]}>{formatClockTime(chatMessage.created_at)}</Text>{removable ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove message by ${mine ? "you" : author?.display_name ?? "former member"}`} accessibilityHint="Opens a confirmation before removing this message" hitSlop={8} style={[styles.removeButton, mine && styles.removeButtonMine]} onPress={() => setRemoveCandidate(chatMessage)}><TrashIcon light={mine} /></TouchableOpacity> : null}</View></View><Text style={[styles.messageBody, mine && styles.messageBodyMine, chatMessage.deleted_at && styles.messageBodyDeleted]}>{renderMessageText(chatMessage.body, activeMembers, currentMemberId, mine)}</Text></View></View>;
          })}
        </ScrollView>
        {showEveryoneCandidate || mentionCandidates.length ? <View accessibilityLabel="Mention suggestions" style={styles.mentionMenu}><Text style={styles.mentionMenuTitle}>TAG A MEMBER OR EVERYONE</Text>{showEveryoneCandidate ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Mention everyone, ${Math.max(0, activeMembers.length - 1)} members`} style={[styles.mentionSuggestion, styles.everyoneSuggestion]} onPress={insertEveryoneMention}><View style={styles.everyoneAvatar}><Text style={styles.everyoneAvatarText}>@</Text></View><View style={styles.grow}><Text style={styles.mentionName}>Everyone</Text><Text style={styles.mentionRole}>Notify all {Math.max(0, activeMembers.length - 1)} other members</Text></View><Text style={styles.mentionAction}>ALL</Text></TouchableOpacity> : null}{mentionCandidates.map(member => <TouchableOpacity key={member.id} accessibilityRole="button" accessibilityLabel={`Mention ${member.display_name}`} style={styles.mentionSuggestion} onPress={() => insertMention(member)}><View style={[styles.mentionAvatar, { backgroundColor: memberColor(member.id) }]}><Text style={styles.mentionAvatarText}>{memberInitials(member.display_name)}</Text></View><View style={styles.grow}><Text style={styles.mentionName}>{member.display_name}</Text><Text style={styles.mentionRole}>{member.role === "league_admin" ? "League admin" : "Member"}</Text></View><Text style={styles.mentionAction}>@</Text></TouchableOpacity>)}</View> : null}
        {everyoneMentioned || mentionedMembers.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectedMentions}>{everyoneMentioned ? <View style={[styles.selectedMentionPill, styles.selectedEveryonePill]}><Text style={[styles.selectedMentionText, styles.selectedEveryoneText]}>@everyone · {Math.max(0, activeMembers.length - 1)} members</Text></View> : mentionedMembers.map(member => <View key={member.id} style={styles.selectedMentionPill}><Text style={styles.selectedMentionText}>@{member.display_name}</Text></View>)}</ScrollView> : null}
        <View style={styles.composer}><View style={styles.composerAt}><Text style={styles.composerAtText}>@</Text></View><TextInput accessibilityLabel="League chat message" accessibilityHint="Type at to tag a member. Maximum 500 characters." value={draft} onChangeText={updateDraft} editable={!sending} multiline maxLength={500} placeholder="Message your league…" placeholderTextColor="#87958F" style={styles.composerInput} returnKeyType="send" blurOnSubmit onSubmitEditing={() => void sendMessage()} /><TouchableOpacity accessibilityRole="button" accessibilityLabel="Send league message" accessibilityState={{ disabled: !draft.trim() || sending, busy: sending }} disabled={!draft.trim() || sending} style={[styles.sendButton, (!draft.trim() || sending) && styles.sendButtonDisabled]} onPress={() => void sendMessage()}>{sending ? <ActivityIndicator size="small" color={UI.primaryDeep} /> : <Text style={styles.sendButtonText}>↑</Text>}</TouchableOpacity></View>
        <View style={styles.composerHelp}><Text style={styles.composerHint}>Type @ to notify a member</Text><Text style={styles.characterCount}>{draft.length}/500</Text></View>
        </View>
      </View>
    </ScrollView>
    <Modal animationType="fade" transparent visible={removeCandidate !== null} onRequestClose={() => { if (!removeBusy) setRemoveCandidate(null); }}>
      <View accessibilityViewIsModal style={styles.removeModalBackdrop}>
        <View style={styles.removeModalCard}>
          <View style={styles.removeModalIcon}><TrashIcon /></View>
          <Text accessibilityRole="header" style={styles.removeModalTitle}>Remove this message?</Text>
          <Text style={styles.removeModalText}>The message content will be replaced with “Message removed” for everyone in this league.</Text>
          <View style={styles.removeModalActions}>
            <TouchableOpacity accessibilityRole="button" disabled={removeBusy} style={styles.removeModalCancel} onPress={() => setRemoveCandidate(null)}><Text style={styles.removeModalCancelText}>Keep message</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Confirm remove message" accessibilityState={{ busy: removeBusy }} disabled={removeBusy} style={styles.removeModalConfirm} onPress={() => void removeMessage()}>{removeBusy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <><TrashIcon light /><Text style={styles.removeModalConfirmText}>Remove</Text></>}</TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create(normalizeUiStyles({
  screen: { flex: 1, minHeight: 0 },
  page: { width: "100%", maxWidth: 1440, alignSelf: "center", paddingHorizontal: 22, paddingTop: 22, paddingBottom: 110, gap: 18 },
  pageCompact: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 105, gap: 14 },
  grow: { flex: 1, minWidth: 0 },
  hero: { position: "relative", overflow: "hidden", borderRadius: 24, backgroundColor: "#071D3C", padding: 22, ...CARD_SHADOW },
  heroGlow: { position: "absolute", right: -80, top: -115, width: 270, height: 270, borderRadius: 135, backgroundColor: "#174D3D" },
  heroHeading: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: UI.accent, alignItems: "center", justifyContent: "center" },
  chatroomGroupIcon: { width: 35, height: 29, position: "relative" },
  chatroomGroupHeadCenter: { position: "absolute", top: 0, left: 12, width: 11, height: 11, borderRadius: 6, borderWidth: 2.5, borderColor: "#071D3C" },
  chatroomGroupHeadSide: { position: "absolute", top: 6, width: 8, height: 8, borderRadius: 4, borderWidth: 2, borderColor: "#071D3C" },
  chatroomGroupHeadLeft: { left: 0 },
  chatroomGroupHeadRight: { right: 0 },
  chatroomGroupBodyCenter: { position: "absolute", left: 7, bottom: 0, width: 21, height: 13, borderWidth: 2.5, borderBottomWidth: 0, borderColor: "#071D3C", borderTopLeftRadius: 11, borderTopRightRadius: 11 },
  chatroomGroupBodySide: { position: "absolute", bottom: 1, width: 11, height: 10, borderWidth: 2, borderBottomWidth: 0, borderColor: "#071D3C", borderTopLeftRadius: 7, borderTopRightRadius: 7 },
  chatroomGroupBodyLeft: { left: 0 },
  chatroomGroupBodyRight: { right: 0 },
  heroEyebrow: { color: "#AFC5D8", fontSize: 8, letterSpacing: 1.2, fontWeight: "900" },
  heroTitle: { color: "#FFFFFF", fontSize: 25, lineHeight: 30, fontWeight: "900", marginTop: 3 },
  heroSubtitle: { color: "#DCE6EF", fontSize: 11, lineHeight: 16, marginTop: 4 },
  heroStats: { flexDirection: "row", alignItems: "stretch", borderWidth: 1, borderColor: "#355070", borderRadius: 16, backgroundColor: "#10294B", marginTop: 18, overflow: "hidden" },
  heroStat: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", paddingVertical: 12, paddingHorizontal: 6 },
  heroStatValue: { color: "#FFFFFF", fontSize: 18, fontWeight: "900", fontVariant: ["tabular-nums"] },
  onlineValue: { color: UI.accent },
  heroStatLabel: { color: "#AFC5D8", fontSize: 6, fontWeight: "900", letterSpacing: 0.65, marginTop: 2, textAlign: "center" },
  heroDivider: { width: 1, backgroundColor: "#355070" },
  errorBanner: { borderWidth: 1, borderColor: "#E59A8B", borderRadius: 14, backgroundColor: "#FFF0EC", paddingHorizontal: 14, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 10 },
  errorText: { flex: 1, color: "#7A4036", fontSize: 10, lineHeight: 14, fontWeight: "700" },
  retryButton: { minHeight: 38, justifyContent: "center", paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#7A4036" },
  retryText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
  card: { borderWidth: 1, borderColor: UI.border, borderRadius: 20, backgroundColor: UI.card, padding: 18, ...CARD_SHADOW },
  workspace: { flexDirection: "row", alignItems: "stretch", gap: 18 },
  workspaceCompact: { flexDirection: "column", gap: 14 },
  sidebarColumn: { width: 330, gap: 14 },
  sidebarColumnCompact: { width: "100%" },
  memberBoardCard: { minWidth: 0 },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 12 },
  sectionEyebrow: { color: UI.primary, fontSize: 7, fontWeight: "900", letterSpacing: 1 },
  sectionTitle: { color: UI.ink, fontSize: 17, lineHeight: 22, fontWeight: "900", marginTop: 2 },
  sectionText: { color: UI.muted, fontSize: 9, lineHeight: 13, marginTop: 3 },
  onlinePill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, backgroundColor: UI.primarySoft, paddingHorizontal: 10, paddingVertical: 7 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#2BB673" },
  onlinePillText: { color: UI.primary, fontSize: 8, fontWeight: "900" },
  loading: { minHeight: 120, alignItems: "center", justifyContent: "center", gap: 8 },
  loadingText: { color: UI.muted, fontSize: 9, fontWeight: "700" },
  memberStrip: { paddingTop: 15, paddingBottom: 4, gap: 10 },
  memberList: { height: 430, marginTop: 12 },
  memberListContent: { gap: 8, paddingRight: 4, paddingBottom: 3 },
  memberCard: { width: 188, minHeight: 82, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: UI.border, borderRadius: 15, backgroundColor: UI.surface, padding: 11 },
  memberCardDesktop: { width: "100%", minHeight: 72 },
  memberCardCurrent: { borderColor: UI.primary, backgroundColor: UI.primarySoft },
  memberDetails: { flex: 1, minWidth: 0 },
  memberNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  avatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 12, fontWeight: "900" },
  avatarOnline: { position: "absolute", right: -2, bottom: -1, width: 11, height: 11, borderRadius: 6, backgroundColor: "#2BB673", borderWidth: 2, borderColor: UI.card },
  youPill: { borderRadius: 999, backgroundColor: UI.primary, paddingHorizontal: 7, paddingVertical: 4 },
  youPillText: { color: UI.accent, fontSize: 6, fontWeight: "900", letterSpacing: 0.5 },
  memberName: { flexShrink: 1, color: UI.ink, fontSize: 11, fontWeight: "900" },
  memberRole: { color: UI.muted, fontSize: 7, fontWeight: "700", marginTop: 2 },
  memberPresence: { color: UI.subtle, fontSize: 7, marginTop: 4 },
  memberPresenceOnline: { color: "#16804C", fontWeight: "900" },
  presenceNote: { color: UI.subtle, fontSize: 7, lineHeight: 11, marginTop: 10 },
  notificationCard: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#CDB9E8", borderRadius: 18, backgroundColor: "#F7F0FF", padding: 14, ...CARD_SHADOW },
  notificationIcon: { position: "relative", width: 46, height: 46, borderRadius: 15, backgroundColor: "#6A38B1", alignItems: "center", justifyContent: "center" },
  notificationIconText: { color: "#FFFFFF", fontSize: 19, fontWeight: "900" },
  notificationBadge: { position: "absolute", right: -7, top: -7, minWidth: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#F7F0FF", backgroundColor: "#C13B78", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  notificationBadgeText: { color: "#FFFFFF", fontSize: 6, fontWeight: "900" },
  notificationTitle: { color: UI.ink, fontSize: 11, fontWeight: "900" },
  notificationText: { color: UI.muted, fontSize: 8, lineHeight: 12, marginTop: 3 },
  notificationStatePill: { borderRadius: 999, backgroundColor: "#E9DDF7", paddingHorizontal: 9, paddingVertical: 7 },
  notificationStateText: { color: "#6A38B1", fontSize: 6, fontWeight: "900", letterSpacing: 0.5 },
  notificationEnableButton: { minWidth: 72, minHeight: 42, borderRadius: 12, backgroundColor: UI.accent, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  notificationEnableText: { color: UI.primaryDeep, fontSize: 8, fontWeight: "900" },
  notificationSecondaryButton: { minWidth: 72, minHeight: 42, borderWidth: 1, borderColor: "#6A38B1", borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  notificationSecondaryText: { color: "#6A38B1", fontSize: 8, fontWeight: "900" },
  notificationOnButton: { minWidth: 72, minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 999, backgroundColor: "#DFF3E8", paddingHorizontal: 10 },
  notificationSwitchKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#16804C" },
  notificationOnText: { color: "#16804C", fontSize: 8, fontWeight: "900" },
  notificationCardSidebar: { minHeight: 84 },
  chatCard: { flex: 1, minWidth: 0, paddingBottom: 13 },
  refreshButton: { width: 42, height: 42, borderRadius: 12, backgroundColor: UI.primarySoft, alignItems: "center", justifyContent: "center" },
  refreshButtonText: { color: UI.primary, fontSize: 20, fontWeight: "900" },
  messageList: { height: 470, marginTop: 15, borderWidth: 1, borderColor: UI.border, borderRadius: 16, backgroundColor: "#F4F7F5" },
  messageListCompact: { height: 390 },
  messageListContent: { flexGrow: 1, padding: 12, gap: 9, justifyContent: "flex-end" },
  emptyChat: { flex: 1, minHeight: 260, alignItems: "center", justifyContent: "center", padding: 25 },
  emptyChatIcon: { color: UI.primary, fontSize: 25 },
  emptyChatTitle: { color: UI.ink, fontSize: 14, fontWeight: "900", marginTop: 8 },
  emptyChatText: { maxWidth: 330, color: UI.muted, fontSize: 9, lineHeight: 14, textAlign: "center", marginTop: 5 },
  messageRow: { maxWidth: "86%", flexDirection: "row", alignItems: "flex-end", gap: 7, alignSelf: "flex-start" },
  messageRowMine: { alignSelf: "flex-end" },
  messageAvatar: { width: 27, height: 27, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  messageAvatarText: { color: "#FFFFFF", fontSize: 7, fontWeight: "900" },
  messageBubble: { minWidth: 108, borderWidth: 1, borderColor: UI.border, borderRadius: 14, borderBottomLeftRadius: 4, backgroundColor: UI.card, paddingHorizontal: 11, paddingVertical: 8 },
  messageBubbleMine: { borderColor: UI.primary, borderBottomLeftRadius: 14, borderBottomRightRadius: 4, backgroundColor: UI.primary },
  messageBubbleMentioned: { borderWidth: 2, borderColor: "#7B42B7", backgroundColor: "#FAF5FF" },
  messageBubbleDeleted: { borderStyle: "dashed", opacity: 0.72 },
  mentionedYouPill: { alignSelf: "flex-start", borderRadius: 999, backgroundColor: "#E9DDF7", paddingHorizontal: 7, paddingVertical: 3, marginBottom: 5 },
  mentionedYouText: { color: "#6A38B1", fontSize: 5, fontWeight: "900", letterSpacing: 0.55 },
  messageMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  messageMetaActions: { flexDirection: "row", alignItems: "center", gap: 5 },
  messageAuthor: { flexShrink: 1, color: UI.primary, fontSize: 7, fontWeight: "900" },
  messageAuthorMine: { color: UI.accent },
  messageTime: { color: UI.subtle, fontSize: 6 },
  messageTimeMine: { color: "#B9CEC7" },
  messageBody: { color: UI.ink, fontSize: 10, lineHeight: 15, marginTop: 4 },
  messageBodyMine: { color: "#FFFFFF" },
  messageBodyDeleted: { fontStyle: "italic" },
  inlineMention: { color: "#6A38B1", fontWeight: "900", backgroundColor: "#EFE4FA" },
  inlineMentionMine: { color: UI.accent, backgroundColor: "#264F45" },
  inlineMentionEveryone: { textDecorationLine: "underline" },
  inlineMentionCurrent: { textDecorationLine: "underline" },
  removeButton: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF0EC" },
  removeButtonMine: { backgroundColor: "#2A574B" },
  trashIcon: { width: 14, height: 16, alignItems: "center", justifyContent: "flex-start" },
  trashHandle: { width: 5, height: 2, borderRadius: 1, backgroundColor: "#A04435" },
  trashLid: { width: 13, height: 2, borderRadius: 1, backgroundColor: "#A04435", marginTop: 1 },
  trashCan: { width: 10, height: 10, flexDirection: "row", justifyContent: "center", gap: 2, borderWidth: 1.5, borderTopWidth: 0, borderColor: "#A04435", borderBottomLeftRadius: 2, borderBottomRightRadius: 2, paddingTop: 2 },
  trashCanLight: { borderColor: "#FFFFFF" },
  trashLine: { width: 1.5, height: 5, borderRadius: 1, backgroundColor: "#A04435" },
  trashPartLight: { backgroundColor: "#FFFFFF" },
  removeModalBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(2, 18, 14, 0.62)", padding: 20 },
  removeModalCard: { width: "100%", maxWidth: 420, borderRadius: 22, backgroundColor: UI.card, padding: 22, alignItems: "center", ...CARD_SHADOW },
  removeModalIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: "#FFF0EC", alignItems: "center", justifyContent: "center" },
  removeModalTitle: { color: UI.ink, fontSize: 18, lineHeight: 23, fontWeight: "900", textAlign: "center", marginTop: 14 },
  removeModalText: { color: UI.muted, fontSize: 10, lineHeight: 15, textAlign: "center", marginTop: 7 },
  removeModalActions: { width: "100%", flexDirection: "row", gap: 10, marginTop: 20 },
  removeModalCancel: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: UI.borderStrong, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: UI.card },
  removeModalCancelText: { color: UI.ink, fontSize: 9, fontWeight: "900" },
  removeModalConfirm: { flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 14, backgroundColor: "#A04435" },
  removeModalConfirmText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
  mentionMenu: { borderWidth: 1, borderColor: "#CDB9E8", borderRadius: 15, backgroundColor: UI.card, marginTop: 10, overflow: "hidden", ...CARD_SHADOW },
  mentionMenuTitle: { color: "#6A38B1", fontSize: 6, fontWeight: "900", letterSpacing: 0.75, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 5 },
  mentionSuggestion: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: UI.border, paddingHorizontal: 12, paddingVertical: 7 },
  everyoneSuggestion: { backgroundColor: "#FAF6FF" },
  everyoneAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#6A38B1" },
  everyoneAvatarText: { color: UI.accent, fontSize: 13, fontWeight: "900" },
  mentionAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  mentionAvatarText: { color: "#FFFFFF", fontSize: 7, fontWeight: "900" },
  mentionName: { color: UI.ink, fontSize: 9, fontWeight: "900" },
  mentionRole: { color: UI.muted, fontSize: 6, marginTop: 1 },
  mentionAction: { color: "#6A38B1", fontSize: 16, fontWeight: "900" },
  selectedMentions: { gap: 6, paddingTop: 9 },
  selectedMentionPill: { borderRadius: 999, backgroundColor: "#EFE4FA", paddingHorizontal: 9, paddingVertical: 5 },
  selectedMentionText: { color: "#6A38B1", fontSize: 7, fontWeight: "900" },
  selectedEveryonePill: { backgroundColor: "#6A38B1" },
  selectedEveryoneText: { color: "#FFFFFF" },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 10 },
  composerAt: { width: 42, height: 46, borderRadius: 14, backgroundColor: "#EFE4FA", alignItems: "center", justifyContent: "center" },
  composerAtText: { color: "#6A38B1", fontSize: 18, fontWeight: "900" },
  composerInput: { flex: 1, minHeight: 46, maxHeight: 100, borderWidth: 1, borderColor: UI.borderStrong, borderRadius: 14, backgroundColor: UI.card, color: UI.ink, fontSize: 11, lineHeight: 16, paddingHorizontal: 13, paddingVertical: 11 },
  sendButton: { width: 46, minHeight: 46, borderRadius: 23, backgroundColor: UI.accent, alignItems: "center", justifyContent: "center" },
  sendButtonDisabled: { backgroundColor: UI.borderStrong },
  sendButtonText: { color: UI.primaryDeep, fontSize: 17, fontWeight: "900" },
  composerHelp: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 3, marginTop: 6 },
  composerHint: { color: UI.muted, fontSize: 6, fontWeight: "700" },
  characterCount: { color: UI.subtle, fontSize: 6, lineHeight: 10 },
}));
