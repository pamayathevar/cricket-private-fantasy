(() => {
  try {
    const compact = value => String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    const playoffMatchNumber = value => {
      const normalized = compact(value).toLowerCase().replace(/[\s_]+/g, "-");
      if (/(?:^|[-/])qualifier-1(?:[-/]|$)/.test(normalized)) return 71;
      if (/(?:^|[-/])eliminator(?:[-/]|$)/.test(normalized)) return 72;
      if (/(?:^|[-/])qualifier-2(?:[-/]|$)/.test(normalized)) return 73;
      if (/(?:^|[-/])final(?:[-/]|$)/.test(normalized)) return 74;
      return null;
    };
    const matchNumberForValue = value => {
      const regularMatch = compact(value).match(/(?:^|[-/\s])(\d+)(?:st|nd|rd|th)[-/\s]+match(?:[-/\s]|$)/i);
      return regularMatch ? Number(regularMatch[1]) : playoffMatchNumber(value);
    };
    const providerMatchLabel = "(?:\\d+(?:st|nd|rd|th)-match|qualifier-1|eliminator|qualifier-2|final)";
    const hostname = location.hostname.toLowerCase();
    const isCricbuzz = hostname === "cricbuzz.com" || hostname.endsWith(".cricbuzz.com");
    const isSeriesPage = isCricbuzz
      ? /\/cricket-series\/\d+(?:\/|$)/i.test(location.pathname)
      : !/\/full-scorecard\/?$/i.test(location.pathname);
    if (isSeriesPage) {
      const provider = isCricbuzz ? "cricbuzz" : "espncricinfo";
      const scorecardForLink = link => {
        try {
          const url = new URL(link.href, location.href);
          if (provider === "cricbuzz") {
            const pathMatch = url.pathname.match(/\/(?:live-cricket-scores|live-cricket-scorecard)\/(\d+)\/([^/?#]+)/i);
            if (!pathMatch || !new RegExp(`(?:^|-)${providerMatchLabel}(?:-|$)`, "i").test(pathMatch[2])) return null;
            return new URL(`/live-cricket-scorecard/${pathMatch[1]}/${pathMatch[2]}`, url.origin).toString();
          }
          const pathMatch = url.pathname.match(new RegExp(`^(.*\\/[^/]*-vs-[^/]*-${providerMatchLabel}-\\d+)(?:\\/[^/]+)?\\/?$`, "i"));
          if (!pathMatch) return null;
          return new URL(`${pathMatch[1]}/full-scorecard`, url.origin).toString();
        } catch {
          return null;
        }
      };
      const detailsForUrl = scorecardUrl => {
        const path = new URL(scorecardUrl).pathname;
        const matchNumber = matchNumberForValue(path);
        const teams = provider === "cricbuzz"
          ? path.match(new RegExp(`\\/([a-z0-9-]+)-vs-([a-z0-9-]+)-${providerMatchLabel}(?:-|$)`, "i"))?.slice(1, 3)
          : path.match(new RegExp(`\\/([^/]+?)-vs-([^/]+?)-${providerMatchLabel}-\\d+`, "i"))?.slice(1, 3);
        return Number.isInteger(matchNumber) && matchNumber > 0 && teams?.length === 2
          ? { matchNumber, teamTokens: teams }
          : null;
      };
      const discovered = new Map();
      for (const link of Array.from(document.querySelectorAll("a[href]"))) {
        const scorecardUrl = scorecardForLink(link);
        if (!scorecardUrl) continue;
        const details = detailsForUrl(scorecardUrl);
        if (!details) continue;
        const contextElement = link.closest("article, li, [class*='match'], [class*='fixture']") || link.parentElement;
        const machineDate = contextElement?.querySelector?.("time[datetime], [datetime]")?.getAttribute("datetime");
        const context = compact(contextElement?.textContent || link.textContent);
        discovered.set(scorecardUrl, { ...details, scorecardUrl, scheduledText: machineDate || context });
      }
      if (!discovered.size) {
        return { ok: false, errorCode: "scorecard-not-ready", message: `Waiting for ${provider === "cricbuzz" ? "Cricbuzz" : "ESPNcricinfo"} series match links…` };
      }
      return {
        ok: true,
        capture: {
          schemaVersion: 1,
          captureMethod: "cricket-rivalries-series-scorecard-discovery",
          provider,
          sourceUrl: location.href,
          capturedAt: new Date().toISOString(),
          matches: Array.from(discovered.values()).sort((left, right) => left.matchNumber - right.matchNumber),
        },
      };
    }
    if (isCricbuzz) {
      const inningsControls = Array.from(document.querySelectorAll("div"))
        .map(element => ({ element, label: compact(element.textContent) }))
        .filter(item => /^[A-Z0-9]+\s+\((?:1st|2nd) Inn\)$/i.test(item.label));
      if (inningsControls.length < 2) {
        return { ok: false, errorCode: "scorecard-not-ready", message: "Waiting for the Cricbuzz innings scorecard…" };
      }
      const teamCodeForInnings = innings => {
        const control = inningsControls.find(item => item.label.includes(innings === 1 ? "(1st Inn)" : "(2nd Inn)"));
        return String(control?.label.match(/^([A-Z0-9]+)\s+/)?.[1] || "").toUpperCase();
      };
      const captureInnings = innings => {
        const section = Array.from(document.querySelectorAll('[id^="scard-team-"][id*="-innings-"]'))
          .find(element => new RegExp(`-innings-${innings}$`).test(element.id));
        if (!section) return null;
        const batters = Array.from(section.querySelectorAll('[class*="scorecard-bat-grid"]')).flatMap(row => {
          const block = row.children?.[0];
          if (!block || row.children.length < 5) return [];
          const profileLink = block.querySelector('a[title*="View Profile Of"], a[href*="/profiles/"]');
          const titledName = compact(profileLink?.getAttribute("title")).replace(/^View Profile Of\s+/i, "");
          const name = compact(titledName || block.children?.[0]?.textContent || profileLink?.textContent)
            .replace(/\s*\((?=[^)]*\b(?:c|capt|wk|wicketkeeper)\b)[^)]*\)\s*/gi, " ").trim();
          const dismissalText = compact(block.children?.[1]?.textContent || "");
          const runsText = compact(row.children?.[1]?.textContent);
          if (!name || !dismissalText || !/^\d+$/.test(runsText)) return [];
          return [{ batterName: name, dismissalText, runs: Number(runsText) }];
        });
        return batters.length ? { innings, teamCode: teamCodeForInnings(innings), batters } : null;
      };
      const innings = [captureInnings(1), captureInnings(2)];
      if (!innings[0] || !innings[1]) {
        return { ok: false, errorCode: "scorecard-not-ready", message: "Waiting for both Cricbuzz innings batting tables…" };
      }

      const title = compact(document.title);
      const heading = compact(document.querySelector("h1")?.textContent);
      const matchNumber = matchNumberForValue(`${location.pathname} ${title} ${heading}`);
      const slugTeams = location.pathname.match(new RegExp(`\\/([a-z0-9]+)-vs-([a-z0-9]+)-${providerMatchLabel}(?:-|$)`, "i"));
      return {
        ok: true,
        capture: {
          schemaVersion: 1,
          captureMethod: "cricket-rivalries-cricbuzz-fielder-validation",
          sourceUrl: location.href,
          capturedAt: new Date().toISOString(),
          page: { title, heading },
          match: {
            matchNumber,
            homeTeam: String(slugTeams?.[1] || "").toUpperCase(),
            awayTeam: String(slugTeams?.[2] || "").toUpperCase(),
          },
          innings,
        },
      };
    }
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
    if (semanticTables.length < 4) {
      return { ok: false, errorCode: "scorecard-not-ready", message: `Waiting for four scorecard tables; ${semanticTables.length} are visible.` };
    }
    const selected = semanticTables.slice(0, 4);
    if (selected.map(item => item.kind).join(",") !== "batting,bowling,batting,bowling") {
      return { ok: false, errorCode: "unexpected-table-order", message: "The scorecard tables are not in the expected innings order." };
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
    const teamNames = {
      CSK: "chennai super kings", DC: "delhi capitals", GT: "gujarat titans", KKR: "kolkata knight riders",
      LSG: "lucknow super giants", MI: "mumbai indians", PBKS: "punjab kings", RCB: "royal challengers bengaluru",
      RR: "rajasthan royals", SRH: "sunrisers hyderabad"
    };
    const teamCode = value => {
      const normalized = compact(value).toLowerCase();
      return Object.entries(teamNames).find(([code, name]) => normalized.includes(name) || new RegExp(`(?:^|\\W)${code}(?:$|\\W)`, "i").test(value))?.[0] || "";
    };
    const headingTeams = (h1.match(/^(.+?)\s+vs\s+(.+?)(?:,|\s+-\s+|$)/i)
      || title.match(/^(.+?)\s+vs\s+(.+?)(?:,|\s+-\s+|$)/i))?.slice(1, 3) || [];
    const homeTeam = teamCode(headingTeams[0] || "");
    const awayTeam = teamCode(headingTeams[1] || "");
    const matchNumber = matchNumberForValue(`${location.pathname} ${h1} ${title}`);
    const bodyLines = (document.body.innerText || "").split("\n").map(compact).filter(Boolean);
    const resultSummary = bodyLines.find(line => /\b(?:won by|won the Super Over|match tied)\b/i.test(line) && Boolean(teamCode(line))) || "";
    const playerOfMatchIndex = bodyLines.findIndex(line => line.toUpperCase() === "PLAYER OF THE MATCH");
    const playerOfMatchName = playerOfMatchIndex >= 0 ? bodyLines[playerOfMatchIndex + 1] || "" : "";
    const winnerTeam = teamCode(resultSummary);

    return {
      ok: true,
      capture: {
        schemaVersion: 1,
        captureMethod: "cricket-rivalries-browser-extension",
        sourceUrl: location.href,
        capturedAt: new Date().toISOString(),
        page: { title, heading: h1 },
        match: {
          matchNumber,
          homeTeam,
          awayTeam,
          firstInningsTeamName: teamName(selected[0].table),
          winnerTeam,
          resultSummary,
          playerOfMatchName,
        },
        tables: {
          firstInningsBatting: toTsv(selected[0], true),
          firstInningsBowling: toTsv(selected[1], false),
          secondInningsBatting: toTsv(selected[2], true),
          secondInningsBowling: toTsv(selected[3], false)
        }
      }
    };
  } catch (error) {
    return { ok: false, errorCode: "capture-failed", message: error instanceof Error ? error.message : "The rendered scorecard could not be captured." };
  }
})();
