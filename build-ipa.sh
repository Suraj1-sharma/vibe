#!/usr/bin/env bash
# One-shot: create the GitHub repo, push, build the unsigned IPA, download it.
# Prerequisite: run `gh auth login` once first.
set -euo pipefail

export PATH="$PATH:/c/Program Files/GitHub CLI"
WF="Build unsigned iOS IPA"
OUT="$PWD/ipa-out"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

if ! gh auth status >/dev/null 2>&1; then
  echo "Not logged in. Run this first:  gh auth login"
  exit 1
fi

USER_LOGIN="$(gh api user --jq .login)"
say "Logged in as $USER_LOGIN"

# 1. repo + push (idempotent: reuses the repo/remote if they already exist)
if git remote get-url origin >/dev/null 2>&1; then
  say "Remote 'origin' already set: $(git remote get-url origin)"
  git push -u origin "$(git branch --show-current)"
else
  say "Creating public repo and pushing"
  gh repo create vibe --public --source=. --remote=origin --push
fi

# 2. trigger the build
say "Starting the iOS build on a macOS runner"
gh workflow run "$WF"

say "Waiting for the run to register"
RUN_ID=""
for _ in $(seq 1 30); do
  RUN_ID="$(gh run list --workflow="$WF" --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null || true)"
  [ -n "$RUN_ID" ] && break
  sleep 2
done
[ -z "$RUN_ID" ] && { echo "Could not find the run. Check the Actions tab."; exit 1; }

say "Run $RUN_ID started - this takes 15-25 min. Live log:"
echo "   $(gh repo view --json url --jq .url)/actions/runs/$RUN_ID"
gh run watch "$RUN_ID" --exit-status || {
  say "BUILD FAILED - fetching the failing step's log"
  gh run view "$RUN_ID" --log-failed | tail -80
  echo ""
  echo "Send the output above to Claude and it will fix the workflow."
  exit 1
}

# 3. download
say "Build succeeded - downloading the IPA"
rm -rf "$OUT"; mkdir -p "$OUT"
gh run download "$RUN_ID" --name Vibe-unsigned-ipa --dir "$OUT"
IPA="$(find "$OUT" -name '*.ipa' | head -1)"
say "DONE"
echo "IPA: $IPA"
echo "Size: $(du -h "$IPA" | cut -f1)"
echo ""
echo "Next: open Sideloadly, drag in that .ipa, enter your free Apple ID, press Start."
