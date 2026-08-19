#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { chromium } from "playwright-core";

const APPROVED_HOSTS = ["espncricinfo.com", "cricinfo.com"];
const DEFAULT_APP_URL = "http://localhost:8081";
const DEFAULT_TIMEOUT_MS = 120_000;

const usage = () => `
Open a visible Chrome window and capture a rendered ESPNcricinfo scorecard.

Usage:
  npm run score:fetch
  npm run score:fetch -- --url <match-or-full-scorecard-url> [--match 21]
  npm run score:fetch -- --url <url> --match 21 --app-url http://localhost:8081
  npm run score:fetch -- --capture <saved-capture.json> --app-url http://localhost:8081

Options:
  --url <url>          ESPNcricinfo match URL (prompted when omitted)
  --capture <file>     Reuse a saved capture and only prefill the admin app
  --match <number>     Fixture number; inferred from the page when possible
  --output <file>      Capture JSON destination
  --app-url <url>      Open and prefill the authenticated admin review form
  --profile <folder>   Persistent Chrome profile folder
  --chrome <file>      Chrome/Chromium executable
  --timeout <ms>       Navigation/extraction timeout (default: ${DEFAULT_TIMEOUT_MS})
  --headless           Test-only: run without a visible browser
  --help               Show this help

Safety:
  The tool uses a normal visible browser. It does not bypass access controls,
  stage data, or publish scores. The administrator reviews the generated draft.
`;

function parseArguments(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") result.help = true;
    else if (argument === "--headless") result.headless = true;
    else if (argument.startsWith("--")) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
      result[argument.slice(2)] = value;
      index += 1;
    } else throw new Error(`Unexpected argument: ${argument}`);
  }
  return result;
}

function approvedScoreUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("The score source must use HTTPS.");
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!APPROVED_HOSTS.some(host => hostname === host || hostname.endsWith(`.${host}`))) {
    throw new Error(`Unsupported score source host: ${url.hostname}`);
  }
  return url.toString();
}

function defaultChromeExecutable() {
  const candidates = process.platform === "darwin"
    ? [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
      ]
    : process.platform === "win32"
      ? [
          path.join(process.env.PROGRAMFILES ?? "", "Google/Chrome/Application/chrome.exe"),
          path.join(process.env["PROGRAMFILES(X86)"] ?? "", "Google/Chrome/Application/chrome.exe"),
          path.join(process.env.LOCALAPPDATA ?? "", "Google/Chrome/Application/chrome.exe"),
        ]
      : ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  return candidates.find(candidate => candidate && fs.existsSync(candidate));
}

const safeSlug = value => String(value || "scorecard")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 80) || "scorecard";

function loadCapture(filePath) {
  const capturePath = path.resolve(filePath);
  if (!fs.existsSync(capturePath)) throw new Error(`Saved capture was not found: ${capturePath}`);
  let capture;
  try {
    capture = JSON.parse(fs.readFileSync(capturePath, "utf8"));
  } catch (error) {
    throw new Error(`Saved capture is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const requiredTables = [
    "firstInningsBatting",
    "firstInningsBowling",
    "secondInningsBatting",
    "secondInningsBowling",
  ];
  if (
    capture?.schemaVersion !== 1
    || typeof capture?.sourceUrl !== "string"
    || !capture?.match
    || !capture?.tables
    || requiredTables.some(key => typeof capture.tables[key] !== "string" || !capture.tables[key].trim())
  ) {
    throw new Error("Saved capture does not contain a supported complete scorecard.");
  }
  return { capture, capturePath };
}

async function promptValue(terminal, question, fallback = "") {
  if (!process.stdin.isTTY) return fallback;
  const answer = (await terminal.question(question)).trim();
  return answer || fallback;
}

async function acceptCookies(page) {
  for (const label of [/accept all/i, /accept cookies/i, /^i accept$/i]) {
    const button = page.getByRole("button", { name: label }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click().catch(() => undefined);
      break;
    }
  }
}

async function scorecardTableCount(page) {
  return page.locator("table").evaluateAll(tables => tables.filter(table => {
    const headings = Array.from(table.querySelectorAll("thead th"), cell => (cell.textContent || "").trim().toUpperCase());
    return (headings.includes("BATTING") && headings.includes("R") && headings.includes("B"))
      || (headings.includes("BOWLING") && headings.includes("O") && headings.includes("W"));
  }).length);
}

async function navigateToFullScorecard(page) {
  if (await scorecardTableCount(page) >= 4) return;
  const link = page.getByRole("link", { name: /full scorecard/i }).first();
  if (await link.isVisible().catch(() => false)) {
    console.log("Navigating to Full Scorecard…");
    await link.click().catch(() => undefined);
    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    return;
  }
  const current = new URL(page.url());
  const cleanPath = current.pathname.replace(/\/+$/, "");
  if (!/\/full-scorecard$/i.test(cleanPath) && /-\d+$/.test(cleanPath)) {
    current.pathname = `${cleanPath}/full-scorecard`;
    console.log("Opening the canonical Full Scorecard view…");
    await page.goto(current.toString(), { waitUntil: "domcontentloaded" });
  }
}

async function waitForScorecard(page, terminal, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let attemptedScorecardNavigation = false;
  while (Date.now() < deadline) {
    await acceptCookies(page);
    if (await scorecardTableCount(page) >= 4) return;
    if (!attemptedScorecardNavigation) {
      attemptedScorecardNavigation = true;
      await navigateToFullScorecard(page);
    }
    await page.waitForTimeout(1_000);
  }
  if (process.stdin.isTTY) {
    await promptValue(
      terminal,
      "The four scorecard tables are not visible yet. Complete any normal browser prompt, open Full Scorecard, then press Enter: ",
    );
    if (await scorecardTableCount(page) >= 4) return;
  }
  throw new Error("Four rendered batting/bowling scorecard tables were not found.");
}

async function extractScorecard(page) {
  return page.evaluate(() => {
    const compact = value => String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    const cells = row => Array.from(row.querySelectorAll("th,td"), cell => compact(cell.textContent));
    const headings = table => Array.from(table.querySelectorAll("thead th"), cell => compact(cell.textContent).toUpperCase());
    const tableKind = table => {
      const header = headings(table);
      if (header.includes("BATTING") && header.includes("R") && header.includes("B")) return "batting";
      if (header.includes("BOWLING") && header.includes("O") && header.includes("W")) return "bowling";
      return "";
    };
    const semanticTables = Array.from(document.querySelectorAll("table"))
      .map(table => ({ table, kind: tableKind(table) }))
      .filter(item => item.kind);
    if (semanticTables.length < 4) throw new Error(`Expected four scorecard tables; found ${semanticTables.length}.`);
    const selected = semanticTables.slice(0, 4);
    if (selected.map(item => item.kind).join(",") !== "batting,bowling,batting,bowling") {
      throw new Error("The rendered tables are not in the expected innings order.");
    }

    const inningsContainer = table => {
      let element = table.parentElement;
      for (let depth = 0; element && depth < 8; depth += 1, element = element.parentElement) {
        const text = element.innerText || "";
        const semanticCount = Array.from(element.querySelectorAll("table")).filter(candidate => tableKind(candidate)).length;
        if (semanticCount >= 2 && /FALL OF WICKETS/i.test(text) && /BOWLING/i.test(text)) return element;
      }
      return table.parentElement;
    };
    const didNotBat = table => {
      const text = inningsContainer(table)?.innerText || "";
      const match = text.match(/DID NOT BAT\s+([\s\S]*?)(?:FALL OF WICKETS|BOWLING)/i);
      return match ? compact(match[1]).replace(/\s+,/g, ",") : "";
    };
    const teamName = table => {
      let element = table.parentElement;
      for (let depth = 0; element && depth < 10; depth += 1, element = element.parentElement) {
        const lines = (element.innerText || "").split("\n").map(compact).filter(Boolean);
        if (lines.length > 1 && /^BATTING\b/i.test(lines[1]) && /\([^)]*(?:\bovs?\b|\bT:)/i.test(lines[0])) {
          return compact(lines[0].replace(/\s*\([^)]*\)\s*$/, ""));
        }
      }
      return "";
    };
    const toTsv = (item, includeDidNotBat) => {
      const header = headings(item.table);
      const bodyRows = Array.from(item.table.querySelectorAll("tbody tr")).map(cells);
      const rows = bodyRows.filter(row => item.kind === "batting"
        ? row.length >= 6 && /^-?\d[\d,]*$/.test(row[2] || "")
        : row.length >= 6 && /^\d+(?:\.[0-5])?$/.test(row[1] || ""));
      const lines = [header.join("\t"), ...rows.map(row => row.join("\t"))];
      if (item.kind === "batting") {
        const absent = includeDidNotBat ? didNotBat(item.table) : "";
        if (absent) lines.push(`Did not bat\t${absent}`);
        const summaryRows = bodyRows.filter(row => /^(?:extras|total)\b/i.test(row[0] || ""));
        lines.push(...summaryRows.map(row => row.join("\t")));
      }
      return lines.join("\n");
    };

    const h1 = compact(document.querySelector("h1")?.textContent);
    const title = compact(document.title);
    const codeMatch = h1.match(/^([A-Z0-9]+)\s+vs\s+([A-Z0-9]+)/i)
      || title.match(/^([A-Z0-9]+)\s+vs\s+([A-Z0-9]+)/i);
    const homeTeam = (codeMatch?.[1] || "").toUpperCase();
    const awayTeam = (codeMatch?.[2] || "").toUpperCase();
    const matchNumberMatch = h1.match(/\b(\d+)(?:st|nd|rd|th)\s+Match\b/i)
      || title.match(/\b(\d+)(?:st|nd|rd|th)\s+Match\b/i);
    const bodyLines = (document.body.innerText || "").split("\n").map(compact).filter(Boolean);
    const teamPattern = [homeTeam, awayTeam].filter(Boolean).map(value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const resultPattern = teamPattern
      ? new RegExp(`^(?:${teamPattern})\\s+(?:won by|tied|won the Super Over)`, "i")
      : /\bwon by\b/i;
    const resultSummary = bodyLines.find(line => resultPattern.test(line)) || "";
    const playerOfMatchIndex = bodyLines.findIndex(line => line.toUpperCase() === "PLAYER OF THE MATCH");
    const playerOfMatchName = playerOfMatchIndex >= 0 ? bodyLines[playerOfMatchIndex + 1] || "" : "";
    const winnerTeam = [homeTeam, awayTeam].find(code => resultSummary.toUpperCase().startsWith(`${code} `)) || "";

    return {
      schemaVersion: 1,
      captureMethod: "visible-browser-navigation",
      sourceUrl: location.href,
      capturedAt: new Date().toISOString(),
      page: { title, heading: h1 },
      match: {
        matchNumber: matchNumberMatch ? Number(matchNumberMatch[1]) : null,
        homeTeam,
        awayTeam,
        firstInningsTeamName: teamName(selected[0].table),
        firstInningsTeam: homeTeam,
        winnerTeam,
        resultSummary,
        playerOfMatchName,
      },
      tables: {
        firstInningsBatting: toTsv(selected[0], true),
        firstInningsBowling: toTsv(selected[1], false),
        secondInningsBatting: toTsv(selected[2], true),
        secondInningsBowling: toTsv(selected[3], false),
      },
    };
  });
}

async function inferFirstInningsCode(capture) {
  const normalizedName = capture.match.firstInningsTeamName.toLowerCase();
  const codes = [capture.match.homeTeam, capture.match.awayTeam].filter(Boolean);
  const knownNames = {
    CSK: "chennai super kings", DC: "delhi capitals", GT: "gujarat titans", KKR: "kolkata knight riders",
    LSG: "lucknow super giants", MI: "mumbai indians", PBKS: "punjab kings", RCB: "royal challengers bengaluru",
    RR: "rajasthan royals", SRH: "sunrisers hyderabad",
  };
  return codes.find(code => normalizedName.includes(knownNames[code] || "__no_match__")) || codes[0] || "";
}

async function prefillAdminReview(context, appUrl, matchNumber, capture, terminal, timeoutMs) {
  const page = await context.newPage();
  console.log(`Opening admin app: ${appUrl}`);
  await page.goto(appUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  let rules = page.getByText("Rules", { exact: true }).last();
  if (!(await rules.isVisible().catch(() => false))) {
    console.log("Sign in to the app in the Chrome window. The tool never reads your login code.");
    await promptValue(terminal, "After the league dashboard is visible, press Enter here: ");
    rules = page.getByText("Rules", { exact: true }).last();
  }
  await rules.waitFor({ state: "visible", timeout: timeoutMs });
  await rules.click();
  await page.getByText("League Rules", { exact: true }).waitFor({ state: "visible", timeout: timeoutMs });
  await page.getByText("Match Scoring", { exact: true }).click();
  const importAction = page.getByLabel(`Import score source for Match ${matchNumber}`, { exact: true });
  await importAction.waitFor({ state: "visible", timeout: timeoutMs });
  await importAction.click();
  await page.getByRole("tab", { name: "Scorecard capture" }).click();
  await page.getByLabel("Cricinfo full scorecard URL").fill(capture.sourceUrl);

  const firstInningsCode = await inferFirstInningsCode(capture);
  const firstTeamRadios = page.locator('[role="radio"]').filter({ hasText: firstInningsCode });
  await firstTeamRadios.nth(0).click();
  if (capture.match.winnerTeam) {
    const winnerRadios = page.locator('[role="radio"]').filter({ hasText: capture.match.winnerTeam });
    await winnerRadios.nth(1).click();
  }
  await page.getByLabel("Official match result summary").fill(capture.match.resultSummary);
  await page.getByLabel("Player of the match name").fill(capture.match.playerOfMatchName);
  await page.getByLabel("First innings batting table").fill(capture.tables.firstInningsBatting);
  await page.getByLabel("First innings bowling table").fill(capture.tables.firstInningsBowling);
  await page.getByLabel("Second innings batting table").fill(capture.tables.secondInningsBatting);
  await page.getByLabel("Second innings bowling table").fill(capture.tables.secondInningsBowling);
  console.log("Admin review form prefilled. Generating the local review JSON…");
  await page.getByLabel("Generate review from copied scorecard").click();
  await Promise.race([
    page.getByText("Artifact checks passed", { exact: true }).waitFor({ state: "visible", timeout: timeoutMs }),
    page.locator('[role="alert"]:not(#score-ingestion-dialog)').last().waitFor({ state: "visible", timeout: timeoutMs }).then(async () => {
      const message = await page.locator('[role="alert"]:not(#score-ingestion-dialog)').last().innerText();
      throw new Error(`The local app rejected the captured scorecard: ${message}`);
    }),
  ]);
  console.log("Local review JSON generated and validated. Nothing was staged or published.");
  console.log("Check the match identity, winner, Player of the Match, dismissals, dot balls and totals before staging.");
  await page.bringToFront();
  return page;
}

let args;
try {
  args = parseArguments(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  console.error(usage());
  process.exit(2);
}
if (args.help) {
  console.log(usage());
  process.exit(0);
}

const terminal = readline.createInterface({ input, output });
let context;
let capturePath = "";
let capture;
let phase = "capture";
try {
  if (args.capture && args.url) throw new Error("Pass either --capture or --url, not both.");
  const chromeExecutable = args.chrome || defaultChromeExecutable();
  if (!chromeExecutable || !fs.existsSync(chromeExecutable)) {
    throw new Error("Google Chrome, Microsoft Edge or Chromium was not found. Pass its path with --chrome.");
  }
  const profilePath = path.resolve(args.profile || ".local/score-browser-profile");
  const timeoutMs = Number(args.timeout || DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 10_000) throw new Error("--timeout must be at least 10000 ms.");
  fs.mkdirSync(profilePath, { recursive: true });

  console.log("Opening a visible Chrome session…");
  context = await chromium.launchPersistentContext(profilePath, {
    executablePath: chromeExecutable,
    headless: Boolean(args.headless),
    viewport: args.headless ? { width: 1440, height: 1000 } : null,
    args: args.headless ? [] : ["--start-maximized"],
  });
  const page = context.pages()[0] || await context.newPage();
  if (args.capture) {
    ({ capture, capturePath } = loadCapture(args.capture));
    if (args.match) capture.match.matchNumber = Number(args.match);
    if (!capture.match.matchNumber) throw new Error("Saved capture has no match number. Pass it with --match.");
    capture.match.firstInningsTeam ||= await inferFirstInningsCode(capture);
    console.log(`Reusing saved Match ${capture.match.matchNumber} capture: ${capturePath}`);
  } else {
    const requestedUrl = args.url || await promptValue(terminal, "ESPNcricinfo match URL: ");
    if (!requestedUrl) throw new Error("An ESPNcricinfo match URL is required.");
    const sourceUrl = approvedScoreUrl(requestedUrl);
    await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await waitForScorecard(page, terminal, timeoutMs);
    capture = await extractScorecard(page);
    if (args.match) capture.match.matchNumber = Number(args.match);
    if (!capture.match.matchNumber) throw new Error("Match number could not be inferred. Pass it with --match.");
    capture.match.firstInningsTeam = await inferFirstInningsCode(capture);

    const defaultOutput = path.resolve(".local", "score-imports", `match-${capture.match.matchNumber}-${safeSlug(capture.match.homeTeam)}-vs-${safeSlug(capture.match.awayTeam)}.capture.json`);
    capturePath = path.resolve(args.output || defaultOutput);
    fs.mkdirSync(path.dirname(capturePath), { recursive: true });
    fs.writeFileSync(capturePath, `${JSON.stringify(capture, null, 2)}\n`, "utf8");
    const screenshotPath = capturePath.replace(/\.json$/i, ".png");
    await page.screenshot({ path: screenshotPath, fullPage: true });

    console.log(`Captured Match ${capture.match.matchNumber}: ${capture.match.homeTeam} vs ${capture.match.awayTeam}`);
    console.log(`Result: ${capture.match.resultSummary || "not detected — review manually"}`);
    console.log(`Player of the Match: ${capture.match.playerOfMatchName || "not detected — review manually"}`);
    console.log(`Capture JSON: ${capturePath}`);
    console.log(`Audit screenshot: ${screenshotPath}`);
  }

  if (args["app-url"]) {
    phase = "prefill";
    await prefillAdminReview(context, args["app-url"] || DEFAULT_APP_URL, capture.match.matchNumber, capture, terminal, timeoutMs);
  }
  if (!args.headless && process.stdin.isTTY) {
    await promptValue(terminal, "Press Enter when you are ready to close the automation browser: ");
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (phase === "prefill" && capturePath) {
    const appUrl = args["app-url"] || DEFAULT_APP_URL;
    const navigationFailed = /(?:page\.goto|ERR_CONNECTION|net::ERR_|Navigation timeout)/i.test(message);
    console.error(navigationFailed
      ? `Scorecard capture succeeded, but the admin app could not be opened at ${appUrl}.`
      : "Scorecard capture succeeded and the admin app opened, but review generation was rejected.");
    console.error(message);
    if (navigationFailed) console.error("Start the web app in another terminal and wait until it reports its local URL.");
    console.error(`Then retry without fetching the scorecard again:\n  npm run score:fetch -- --capture "${capturePath}" --app-url ${appUrl}`);
  } else {
    console.error(`Scorecard capture failed: ${message}`);
  }
  process.exitCode = 1;
} finally {
  await context?.close().catch(() => undefined);
  terminal.close();
}
