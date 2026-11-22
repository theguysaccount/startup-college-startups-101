#!/usr/bin/env bash
# Keep scheduled workflows alive. GitHub disables schedules in a public repository after 60 days with no
# repository activity. Two layers:
#  1. re-enable every workflow through the API (a no-op while they are enabled; never touches one a person
#     disabled on purpose, whose state is "disabled_manually");
#  2. if the last commit is 45 or more days old, push an empty commit, which counts as activity.
# Commits pushed with GITHUB_TOKEN do not trigger other workflows, so this cannot loop.
set -euo pipefail
repo="${GITHUB_REPOSITORY:?}"
gh api "repos/$repo/actions/workflows" --jq '.workflows[] | "\(.id) \(.state)"' | while read -r id st; do
  if [ "$st" = "disabled_inactivity" ] || [ "$st" = "active" ]; then
    gh api -X PUT "repos/$repo/actions/workflows/$id/enable" >/dev/null && echo "workflow $id: $st -> enabled"
  else
    echo "workflow $id: $st (left alone)"
  fi
done
git fetch --quiet origin main && git checkout --quiet main && git reset --quiet --hard origin/main
last=$(git log -1 --format=%ct)
age_days=$(( ( $(date +%s) - last ) / 86400 ))
echo "last commit ${age_days} days ago"
if (( age_days >= 45 )); then
  git config user.name "github-actions[bot]"
  git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
  git commit --allow-empty -m "keepalive: scheduled workflows stay enabled ($(date -u +%F))"
  git push origin main
fi
