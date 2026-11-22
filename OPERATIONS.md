# Operations

Startups 101 runs with no human in the loop. This file lists every automated job, how each fails safely, what to
watch, and the keys a human can turn later.

**Live:** https://learn.startupcollege.io/ (GitHub Pages, deployed by Actions from `main`). The original address,
https://theguysaccount.github.io/startup-college-startups-101/, redirects there.
**Base URL setting:** the repository variable `SITE_URL`, now `https://learn.startupcollege.io` (unset = the github.io
address). It is the only setting that moves the site; see key 1.

## Automated jobs

| Job | File | When | What it does | How it fails safely |
|---|---|---|---|---|
| Build, test and deploy | `.github/workflows/deploy.yml` | every push to `main`; by hand | content rule tests (front matter, a "Do the work" section, five sound quiz questions per module, builder fields all used in their documents, https-only links, **no promises of money, funding or success**), markdown safety and calculator math tests, a build test → build → **browser self-test** as a learner (reads module 1, takes its quiz, fills its builder to completion, checks XP and the progress page, opens every module and template, runs both calculators, phone layout, no console errors, no contact with any other site) → deploy (second attempt if Pages stalls) → live check of every page and file → IndexNow for changed pages | A failing test or build stops before `deploy`; the last good site stays live. |
| Weekly checks | `.github/workflows/weekly.yml` | **Mondays 11:23 UTC**; by hand | tests on `main`, the browser self-test **against the live site**, every page and file, and every outbound link in the lessons (a link that is gone fails; a site that refuses scripts only warns) | Never changes the site. Opens or updates one `site-health` issue on failure; closes it on recovery. |
| Keep-alive | `.github/scripts/keepalive.sh`, in the weekly job | every scheduled run | re-enables workflows GitHub disabled for inactivity; empty commit if the last commit is 45+ days old | Pushes with `GITHUB_TOKEN` trigger no workflows, so it cannot loop. |

The course has no data feed to refresh: the text changes only through the quarterly content routine (key 4), and
every change goes through the same tests before it can deploy.

## What to watch

- **Actions:** https://github.com/theguysaccount/startup-college-startups-101/actions (scheduled failures are emailed to the account owner).
- **Issues labelled `site-health`:** a broken page, file or outbound link. Warnings for outbound links appear in the weekly run's log.
- **Analytics** (after key 3): page counts per module and template.

## Recovering by hand

- A bad deploy that passed every test: re-run the last good deploy, or `git revert` and push.
- Locally: `npm test && node scripts/build.mjs && node scripts/selftest.mjs` (Node 22+, Chrome installed).

## Keys Jack can turn later

### 1. The custom domain (done: `learn.startupcollege.io`)

The domain rollout session moved the course to `learn.startupcollege.io` on 22 Nov 2026. It chose a subdomain because
`startupcollege.io` already serves the "Start Up College" site, and `blog`, `applicants`, `ingest` and `inst` are in
use; all of those stay as they are. **Never point the apex (`startupcollege.io`) or `www` at this repo:** that would
replace the existing site. What is set now:

- DNS at SiteGround (the startupcollege.io zone): `CNAME learn → theguysaccount.github.io.`
- Repository variable `SITE_URL` = `https://learn.startupcollege.io`.
- Pages custom domain `learn.startupcollege.io`, HTTPS enforced.

To move the course to another host later (a subdomain, or a domain that serves nothing today):

1. DNS: `CNAME <host> → theguysaccount.github.io.` for a subdomain. An unused apex takes four `A` records
   (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`) and four `AAAA` records
   (`2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`).
2. `gh variable set SITE_URL --body https://<host> --repo theguysaccount/startup-college-startups-101`
3. `gh api -X PUT repos/theguysaccount/startup-college-startups-101/pages -f cname=<host>`
4. `gh workflow run deploy.yml --repo theguysaccount/startup-college-startups-101` (2–4 back to back).
5. After the certificate is issued: `gh api -X PUT repos/theguysaccount/startup-college-startups-101/pages -F https_enforced=true`.
6. About 20 minutes later, send every page to IndexNow once. A new host answers 403 at first, and later deploys send
   only changed pages:
   `curl -s https://<host>/sitemap.xml | grep -o '<loc>[^<]*' | sed 's/<loc>//' > urls.txt && SITE_URL=https://<host> node scripts/indexnow.mjs --file urls.txt`

Optional, Jack's call: the other domains in the brief (`startupcollege.xyz`, `foundercollege.org`,
`collegeforentreprenuers.com`, `ventureu.org`, `californiabusinesscollege.com`) could send a 301 to
`https://learn.startupcollege.io` at the registrar, but only domains that serve nothing today. The domain rollout
left them alone, as asked. `college.rip` could host a "College is dead" campaign page later.

Every canonical URL, the sitemap, robots.txt and asset paths move with `SITE_URL` (a test builds for a root domain).

### 2. Money and the program link

GitHub Pages is non-commercial, and the course is free.
- **"Apply to be backed" link:** `gh variable set SC_APPLY_URL --body <program page> --repo theguysaccount/startup-college-startups-101`
  and redeploy. The progress page then shows a short note that the program is separate from the course and that
  finishing the course doesn't change anyone's chances. Point it only at a real, open program page.
- **Donations:** `SC_SUPPORT_URL` (GitHub Sponsors or similar) adds "Support this free course" to the footer.
- **Paid, reviewed certificates** (the optional key in the brief) need a separate host with Stripe and a human or
  AI reviewer; not on Pages. A certificate must never imply funding or employment outcomes.

### 3. Analytics (cookieless)

Create a GoatCounter site, then `gh variable set SC_GOATCOUNTER --body https://<code>.goatcounter.com/count --repo theguysaccount/startup-college-startups-101` and redeploy.

### 4. Content routine (quarterly)

AI writing can't run inside Actions (no API key). A quarterly Claude Code routine keeps the course current:

> In theguysaccount/startup-college-startups-101, read tools/CONTENT-BRIEF.md. Check each module in content/modules/
> for statements that may have gone out of date (tool names, YC SAFE versions, platform launch practices, links),
> fix them in place following the brief's rules (original wording, no promises, not legal advice), and replace any
> outbound link the last weekly run warned about or failed on. Run `npm test`, `node scripts/build.mjs` and
> `node scripts/selftest.mjs`, then open a pull request summarizing what changed and why.

### 5. Search Console

Add `https://learn.startupcollege.io/` as a URL-prefix property (or verify the `startupcollege.io` domain property
with a DNS `TXT` record, which changes nothing else in the zone), then submit `https://learn.startupcollege.io/sitemap.xml`.

## Configuration reference

| Variable | Where | Effect |
|---|---|---|
| `SITE_URL` | repo variable | public base URL, now `https://learn.startupcollege.io`; unset = `https://theguysaccount.github.io/startup-college-startups-101` |
| `SC_APPLY_URL` | repo variable | program link on the progress page (off when empty) |
| `SC_SUPPORT_URL` | repo variable | footer donation link (off when empty) |
| `SC_GOATCOUNTER` | repo variable | cookieless page counts (off when empty) |
| `SC_TODAY`, `SC_OUT` | env, local | build date; build folder |
