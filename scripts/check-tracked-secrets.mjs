import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const trackedFiles = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((file) => !file.endsWith("package-lock.json"));

const forbidden = [
  { name: "Supabase service-role key", pattern: /(?:service_role|SUPABASE_SERVICE_ROLE_KEY)\s*[=:]\s*["']?[A-Za-z0-9._-]{20,}/i },
  { name: "Postgres connection string", pattern: /postgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@/i },
  { name: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];

const findings = [];
for (const file of trackedFiles) {
  let contents;
  try {
    contents = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  for (const rule of forbidden) {
    if (rule.pattern.test(contents)) findings.push(`${file}: ${rule.name}`);
  }
}

if (findings.length) {
  console.error("Potential privileged secrets found in tracked files:\n" + findings.join("\n"));
  process.exit(1);
}

console.log(`Checked ${trackedFiles.length} tracked files; no privileged secret patterns found.`);
