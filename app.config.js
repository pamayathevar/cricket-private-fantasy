const { execFileSync } = require("node:child_process");
const baseConfig = require("./app.json").expo;

const localCommit = () => {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "local-development";
  }
};

module.exports = {
  ...baseConfig,
  extra: {
    ...baseConfig.extra,
    release: {
      commit: process.env.COMMIT_REF || process.env.GITHUB_SHA || localCommit(),
      builtAt: new Date().toISOString(),
    },
  },
};
