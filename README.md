# Startups 101 (Startup College)

**A free course for first-time founders where you build as you learn.**

Live: https://theguysaccount.github.io/startup-college-startups-101/

Nine short modules, from choosing a problem to hiring your first teammate. Each module ends with a builder: a guided
form that produces a real document (a pitch memo, a customer discovery plan, an MVP and launch plan, growth
experiments, a monthly update, a raise plan, a first-hire plan…). Readers earn XP for reading, for a five-question
self-check and for each finished document. Everything stays in the reader's browser; there is no server and no
sign-up. Two calculators (post-money SAFE dilution, runway) support the money module.

The course promises no income, funding or outcome, and its parts about equity, SAFEs and hiring explain how things
commonly work; they are not legal, tax or investment advice.

## Layout

- `content/modules/NN-slug.md`: lesson text (front matter + a small markdown subset).
- `content/quizzes/NN.json`: five self-check questions per module.
- `content/builders/<slug>.json`: the guided form and the document template for each module.
- `tools/CONTENT-BRIEF.md`: the writing rules every module follows (and the content routine uses).
- `src/`: the browser code (progress and XP, quizzes, builders, calculators) and the markdown renderer.
- `scripts/build.mjs`: builds `dist/`.

## Run, test, deploy

Needs Node 22+ (and Google Chrome for the browser self-test).

```bash
npm test                     # content rules, markdown safety, calculator math, build
node scripts/build.mjs       # build into dist/
node scripts/serve.mjs 4863  # http://127.0.0.1:4863/startup-college-startups-101/
node scripts/selftest.mjs    # walk the course in headless Chrome (or pass the live URL)
```

Deploy: push to `main`; Actions tests, builds, runs the browser self-test and deploys to GitHub Pages. A weekly job
re-tests the live site and its links. See `OPERATIONS.md`.

## License

Code MIT. Course text, quizzes and templates CC BY 4.0: reuse them with a link back.
