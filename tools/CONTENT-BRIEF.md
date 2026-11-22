# Writing brief: Startups 101 (a free course from Startup College)

Startups 101 is a free, public, nine-module course for first-time founders. Each module teaches one stage of
building a company and ends with a **builder**: a guided form, in the browser, that produces a real document the
founder keeps (a pitch memo, an MVP plan, a launch post, a raise plan…). Progress, XP and answers stay in the
reader's browser. You are writing one or more modules from scratch.

## Voice and rules

- **Original writing only.** Don't quote or closely paraphrase any book, essay, course or blog (no famous pitch
  "frames", no borrowed acronyms presented as your own, no well-known example scripts). Explain ideas in your own
  words. You may name widely known public facts (for example that Y Combinator publishes a standard SAFE) and link
  to primary sources.
- **Practical and specific.** Short paragraphs, concrete steps, small worked examples with invented companies
  (clearly fictional: "a dog-walking scheduling app", not real startups). Every section should leave the reader
  able to *do* something today.
- **No promises.** Never promise or imply income, funding, investment, acceptance into a program, or success.
  No "become a millionaire", "get funded", "guaranteed", "10x". Prefer "investors often ask…", "this makes it
  easier to…". Mention that most startups fail and that many good companies never raise money, where relevant.
- **Not legal, tax or investment advice.** When you explain SAFEs, equity, vesting, incorporation or securities
  rules, explain how they generally work, say it varies by country, and tell the reader to have a lawyer review
  real documents. Never recommend a specific valuation, split or legal structure as right for them.
- **Inclusive and global.** Readers are often outside the US and without a startup network. Note where things
  differ (US-centric terms like SAFE, Delaware C-corp, 83(b) should be labeled as US practices).
- **Plain English**, second person ("you"), no hype, no emojis, no exclamation marks in body text.
- Length per module: **1,400–2,000 words** of lesson text, in 4–6 sections.

## Files you write (exactly these formats)

### 1. `content/modules/NN-slug.md`

```
---
n: 3
slug: validate-before-you-build
title: Validate before you build
summary: One sentence, 120–160 characters, that would work as a search-result description.
minutes: 18
builder: discovery-plan
outcome: One line: what the reader will have at the end of the module.
---

## First section heading

Paragraphs. **Bold** and *italic* are fine. Links: [text](https://example.com).

- bullet lists are fine
- keep bullets short

1. numbered lists are fine

> A blockquote is fine for a single worked example or a short script.

## Second section heading
…
```

Only these markdown features: `##` and `###` headings, paragraphs, `**bold**`, `*italic*`, `[links](https://…)`,
`-` bullets, `1.` numbered lists, `>` blockquotes. No tables, no images, no HTML, no code blocks. Links must be
https URLs to stable primary sources (government sites, YC's SAFE page, Stripe Atlas guides, Wikipedia) and at
most 4 per module. The first section should state the module's goal plainly; the last section should be titled
"Do the work" and explain how to fill in the builder and what "done" looks like.

### 2. `content/quizzes/NN.json`

Five multiple-choice self-check questions that test understanding (not trivia), each with 4 options, the index
of the right one (0–3), and a one- or two-sentence explanation shown after answering:

```
[
  {"q": "Question?", "options": ["A", "B", "C", "D"], "answer": 2, "why": "Explanation."}
]
```

Vary the position of the right answer. Wrong options should be plausible mistakes a beginner makes.

### 3. `content/builders/<builder-slug>.json`

The guided form that produces the module's document:

```
{
  "slug": "discovery-plan",
  "title": "Customer discovery plan",
  "intro": "One or two sentences on what this document is and who it's for.",
  "fields": [
    {"id": "customer", "label": "Who exactly is your customer?", "help": "One sentence of guidance with a tiny example.", "type": "text", "required": true, "placeholder": "e.g. …"},
    {"id": "assumptions", "label": "Your three riskiest assumptions", "help": "…", "type": "list", "min": 3, "required": true},
    {"id": "notes", "label": "…", "help": "…", "type": "textarea", "required": false}
  ],
  "doc": "# Customer discovery plan: {{company}}\n\n**Customer:** {{customer}}\n\n## Riskiest assumptions\n{{assumptions}}\n\n…"
}
```

Field types: `text` (one line), `textarea` (a paragraph), `list` (several short lines; rendered as a bulleted list
in the document; `min` = how many lines are needed), `number`. Every builder starts with a `company` text field
("Company or project name") and has 6–10 fields. `doc` is the finished document in markdown with `{{id}}`
placeholders for every field (use `\n` for line breaks). The document must read well when printed and shared.

## Before you finish

Re-read your module against the rules (originality, no promises, not legal advice, US-specific terms labeled).
Check that every JSON file parses (for example with `python3 -m json.tool <file>`), that every builder field id
appears in `doc`, and that quiz answers are 0–3. Do not edit any file other than your own.
