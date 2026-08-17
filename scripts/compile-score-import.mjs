#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

function usage() {
  return [
    "Compile a normalized, mapped scorecard into a reviewable staging payload.",
    "",
    "Usage:",
    "  npm run score:compile -- --input <score-import.json> --output <review.json> [--rules <rules.json>]",
    "",
    "The command never connects to Supabase and never publishes scores.",
  ].join("\n");
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") values.help = true;
    else if (argument.startsWith("--")) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
      values[argument.slice(2)] = value;
      index += 1;
    } else throw new Error(`Unexpected argument: ${argument}`);
  }
  return values;
}

function loadTypeScriptModule(relativePath) {
  const filename = path.resolve(relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  if (errors.length > 0) throw new Error(`Unable to transpile ${relativePath}`);

  const module = { exports: {} };
  new Function("exports", "module", result.outputText)(module.exports, module);
  return module.exports;
}

function readJson(filename) {
  return JSON.parse(fs.readFileSync(path.resolve(filename), "utf8"));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function fingerprint(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function fingerprintDocument(document) {
  return {
    ...document,
    source: {
      provider: document.source?.provider,
      externalMatchId: document.source?.externalMatchId,
      sourceUrl: document.source?.sourceUrl,
    },
  };
}

let argumentsMap;
try {
  argumentsMap = parseArguments(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  console.error(usage());
  process.exit(2);
}

if (argumentsMap.help) {
  console.log(usage());
  process.exit(0);
}

if (!argumentsMap.input || !argumentsMap.output) {
  console.error("Both --input and --output are required.");
  console.error(usage());
  process.exit(2);
}

const { calculatePlayerPoints, calculatePointDetails, defaultScoringRules } = loadTypeScriptModule("scoringRules.ts");
const { compileScoreImport } = loadTypeScriptModule("scoreImportRules.ts");

let document;
let rules;
try {
  document = readJson(argumentsMap.input);
  rules = argumentsMap.rules ? readJson(argumentsMap.rules) : defaultScoringRules;
} catch (error) {
  console.error(`Unable to read import input: ${error.message}`);
  process.exit(2);
}

const compiled = compileScoreImport(document, {
  rules,
  calculatePoints: calculatePlayerPoints,
  calculateDetails: calculatePointDetails,
});

const issues = [...compiled.issues];
if (!argumentsMap.rules) {
  issues.push({
    severity: "warning",
    code: "default_rules_not_verified",
    path: "ruleSetId",
    message: "The local default rules were used. Before production staging, compare them with the fixture's immutable database rule set.",
  });
}

const errors = issues.filter((issue) => issue.severity === "error");
if (errors.length > 0) {
  console.error(JSON.stringify({ status: "rejected", issues }, null, 2));
  process.exit(1);
}

const output = {
  schemaVersion: 1,
  status: "ready-for-admin-review",
  generatedAt: new Date().toISOString(),
  // Retrieval time is audit metadata, not source content. Excluding it keeps a
  // retry of identical normalized facts idempotent while corrected facts still
  // produce a different fingerprint.
  sourceFingerprint: fingerprint({ document: fingerprintDocument(document), rules }),
  leagueId: document.leagueId,
  fixtureId: document.fixtureId,
  matchNumber: document.matchNumber,
  ruleSetId: document.ruleSetId,
  source: document.source,
  issues,
  reconciliation: compiled.reconciliation,
  stagingPayload: compiled.stagingPayload,
};

const outputPath = path.resolve(argumentsMap.output);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

console.log(`Score import compiled for Match ${document.matchNumber}.`);
console.log(`Players: ${compiled.reconciliation.playerCount}; total points: ${compiled.reconciliation.totalPoints}.`);
console.log(`Review artifact: ${outputPath}`);
console.log("No database write or publication was performed.");
