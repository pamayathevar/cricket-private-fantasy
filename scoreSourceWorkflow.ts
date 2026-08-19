const BROWSER_CAPTURE_HOSTS = ["espncricinfo.com", "cricinfo.com", "cricbuzz.com"];

export const scoreSourceRequiresBrowserCapture = (value: string) => {
  try {
    const hostname = new URL(value.trim()).hostname.toLowerCase();
    return BROWSER_CAPTURE_HOSTS.some(root => hostname === root || hostname.endsWith(`.${root}`));
  } catch {
    return false;
  }
};

export const browserCaptureStatus = (providerName = "This score provider") => (
  `${providerName} blocks server-side scorecard access. Continue below in Scorecard capture: open the scorecard, copy the four rendered tables, and generate the review here. No terminal command is required.`
);
