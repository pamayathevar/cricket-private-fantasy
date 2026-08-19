(() => {
  const CHANNEL = "cricket-rivalries-scorecard-capture-v1";

  const reply = payload => window.postMessage({
    channel: CHANNEL,
    direction: "extension-to-app",
    ...payload,
  }, window.location.origin);

  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const request = event.data;
    if (!request || request.channel !== CHANNEL || request.direction !== "app-to-extension") return;
    if (typeof request.requestId !== "string" || !request.requestId) return;

    if (request.type === "ping") {
      reply({ type: "ready", requestId: request.requestId });
      return;
    }
    if (request.type !== "capture" || typeof request.sourceUrl !== "string") return;

    reply({ type: "progress", requestId: request.requestId, message: "Opening the scorecard in Chrome…" });
    chrome.runtime.sendMessage({
      type: "capture-scorecard",
      requestId: request.requestId,
      sourceUrl: request.sourceUrl,
    }, response => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reply({ type: "result", requestId: request.requestId, ok: false, error: "The scorecard extension stopped before capture completed. Try again." });
        return;
      }
      reply({
        type: "result",
        requestId: request.requestId,
        ok: Boolean(response?.ok),
        capture: response?.capture,
        error: response?.error,
      });
    });
  });
})();
