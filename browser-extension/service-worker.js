const ADMIN_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "cricketrivalriesleague.com",
  "www.cricketrivalriesleague.com",
  "cricketrivalriesleague.netlify.app",
]);
const SCORECARD_HOSTS = ["espncricinfo.com", "cricinfo.com", "cricbuzz.com"];
const CAPTURE_TIMEOUT_MS = 120_000;

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

const allowedAdminUrl = value => {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && ADMIN_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
};

const approvedScorecardUrl = value => {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || !SCORECARD_HOSTS.some(root => hostname === root || hostname.endsWith(`.${root}`))) {
    throw new Error("Only HTTPS ESPNcricinfo or Cricbuzz scorecard URLs are supported.");
  }
  url.hash = "";
  return url.toString();
};

const captureTab = async tabId => {
  const deadline = Date.now() + CAPTURE_TIMEOUT_MS;
  let lastMessage = "Waiting for the rendered scorecard data…";
  while (Date.now() < deadline) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      files: ["capture-scorecard.js"],
    });
    const result = results?.[0]?.result;
    if (result?.ok && result.capture) return result.capture;
    lastMessage = result?.message || lastMessage;
    if (result?.errorCode && result.errorCode !== "scorecard-not-ready") throw new Error(lastMessage);
    await delay(1_000);
  }
  throw new Error(`${lastMessage} Complete any normal score-provider prompt, open the full scorecard, then try again.`);
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.type !== "capture-scorecard") return false;
  if (!sender.tab?.id || !allowedAdminUrl(sender.tab.url || sender.url || "")) {
    sendResponse({ ok: false, error: "The capture request did not come from an approved Cricket Rivalries admin page." });
    return false;
  }

  (async () => {
    const sourceUrl = approvedScorecardUrl(request.sourceUrl);
    const adminTabId = sender.tab.id;
    const adminWindowId = sender.tab.windowId;
    const scorecardTab = await chrome.tabs.create({ url: sourceUrl, active: true, windowId: adminWindowId });
    if (!scorecardTab.id) throw new Error("Chrome could not open the scorecard tab.");
    const capture = await captureTab(scorecardTab.id);
    await chrome.tabs.update(adminTabId, { active: true });
    sendResponse({ ok: true, capture });
  })().catch(async error => {
    if (sender.tab?.id) await chrome.tabs.update(sender.tab.id, { active: true }).catch(() => undefined);
    sendResponse({ ok: false, error: error instanceof Error ? error.message : "Scorecard capture failed." });
  });
  return true;
});
