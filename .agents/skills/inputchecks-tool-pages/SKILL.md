---
name: inputchecks-tool-pages
description: Create or revise InputChecks tool landing pages using the project's compact tool-card, SEO, and approval workflow. Use whenever adding a tool, keyword landing page, or troubleshooting guide in this repository.
---

# InputChecks Tool Pages

## Required approval before page creation

Before adding any new tool page, keyword landing page, or troubleshooting guide:

1. Give the user a concise recommendation covering the keyword intent, proposed URL, page role, primary tool flow, and planned internal links.
2. Ask for the user's explicit approval before creating the page or its route. Do not treat a general request to grow the site as approval for a particular page set.
3. After approval, preserve the approved keyword-to-page mapping: one keyword intent group per page. Do not combine unrelated intents merely to make a page longer.

This gate applies to new routes only. It does not block a user-approved edit to an existing page.

## Tool-card layout

For a new tool page, the page-level H1 and its short hero description provide the explanatory context. The interactive tester card must begin directly with the test control or detection area.

Do not add an eyebrow, an H2, or descriptive introduction above the control inside the tester card. Keep only interaction-essential prompts, state, metrics, warnings, reset controls, and accessible labels within the card.

## SEO and content standard

Treat each tool page as a high-quality tool landing page: it must let a visitor use the tool immediately on the same route, while its static HTML explains the keyword intent clearly.

- Use one unique H1 containing the primary query. Include the primary query or a natural close variant in at least one H2.
- Write a distinct title of at most 60 characters and a distinct 140–160-character meta description. Do not reuse the opening paragraph as the description.
- Put the interactive control in the first viewport and ensure a useful visible input or control exists in static HTML; do not make the crawler depend on JavaScript to discover the tool.
- Aim for at least 800 useful words on a tool page and 1,200 on a core page. Use page-specific examples, measurements, caveats, or steps rather than template repetition.
- Include at least one relevant authoritative outbound reference when it improves factual grounding (for example, an official standard, university extension, or industry body).
- Give each tool page 3–6 Related Tests. Link the tool to directly relevant troubleshooting guides; each guide must link back to its primary tool and one or two related guides.
- Keep titles, meta descriptions, and H1s stable for the first 1–4 weeks after a new page goes live unless the user asks to change them or there is a clear error.

## Technical quality

Keep the tool usable without an intermediate landing page. Maintain fast, stable rendering: avoid avoidable layout shifts and heavy first-load work, and preserve Core Web Vitals targets of LCP below 2.5 seconds, INP below 200 milliseconds, and CLS below 0.1.
