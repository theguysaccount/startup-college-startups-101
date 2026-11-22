# Launch

- Live: https://learn.startupcollege.io/ (GitHub Pages; https://theguysaccount.github.io/startup-college-startups-101/
  redirects there). Production deploy = push to `main`; tests and the browser self-test gate every deploy.
- Domain: `learn.startupcollege.io`, set up by the domain rollout session. The apex `startupcollege.io` keeps serving
  the existing Start Up College site. The base URL is one repository variable, `SITE_URL` (OPERATIONS.md, key 1).

## Distribution (machine channels only)

Running now:
- **Template pages for high-intent searches:** pitch memo template, customer discovery plan, MVP and launch plan,
  co-founder agreement checklist, growth experiment board, investor update email, raise plan, first hire plan.
- **Module pages** that answer "how to start a startup" questions plainly, with LearningResource and Course data.
- **Calculators:** post-money SAFE dilution and runway ("SAFE calculator", "startup runway calculator").
- **Sitemap, robots.txt, canonical URLs, share cards, IndexNow** on every deploy; the account's host-root
  robots.txt lists the sitemap daily.
- **Share loop:** every document can be printed or downloaded and carries the course name; the course record is
  printable.

## First 1,000 users (what a human could add; nothing here is sent or posted)

University entrepreneurship clubs and incubators (a free, structured curriculum they can assign), r/startups and
r/Entrepreneur (template pages answer frequent questions), and founder communities outside the US. Jack's
"Day 1 of…" content series could point to module pages. Draft only; send nothing.

## 14-day calendar (machine)

- Day 0: deploy; IndexNow for every page; host-root rebuild.
- Weekly: live self-test and link check.
- Quarterly: content routine (OPERATIONS.md, key 4).
