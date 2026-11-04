# Search results, filters and detail pages

Sources: Baymard Institute public articles on result lists (2023-05-30, 2024-05-08), mobile list loading (2020-01-07), applied filters (updated 2026-05-13), search no-results (updated 2025-02-18), inline validation (2024-01-09); NN/g on batch filtering (2016, updated 2025), card layouts (2016), list thumbnails (2015-12-06) and hidden costs; Laws of UX (lawsofux.com). Items marked _inference_ have no public source and are design decisions made here; the spec for each feature decides them finally.

These patterns are for search-and-browse screens. Vocabulary comes from the project's glossary, if it has one; money, numbers and dates go through `Intl`. The `craft.md` rules on layout stability, waiting, empty states and optimistic updates apply to the same screens.

## Search results

- A row shows what people scan for: a thumbnail (a neutral placeholder when there is none or it does not load), the title, the one or two attributes people compare on (price, status), a short line of key facts, and where the result comes from or how recent it is. The attributes people compare on are in the list, not only on the detail page (Baymard on list attributes).
- Homogeneous results go in a uniform list, not free-form cards: "Card layouts are less scannable than lists" (NN/g). One column of rows at 412 px; two or three columns from 1024 px (_inference_).
- A thumbnail sits at the start edge of its row, with the text starting beside it (NN/g on list thumbnails).
- Load 15 to 30 items, then a "Show more" button, which performed best on mobile (Baymard). Never infinite scroll on pages with a footer people need.
- Sorting: one default that serves the main task (for a search, best match first; _inference_) and a few others such as lowest price or newest. Sort is a select at the top, not a sheet of radio buttons.
- Prices are never hidden: "People view companies that hide costs as being evasive and untrustworthy" (NN/g). A negotiable price says so ("Negotiable") and gets no rating or badge.

## Filters and facets

- On phones filter in a batch: a sheet with all filters and one "Apply" button carrying the result count ("Show 128 results"). "err on the side of batch filtering and include an Apply button" (NN/g).
- Applied filters show as removable chips above the list, not as a bare count ("Filters (3)" is not enough) (Baymard).
- Dependent filters (a category and its subcategory) narrow each other; long option lists (brand, city) get a search field inside the filter.
- Ranges (price, size, date) are two typable fields with words between them ("From … to …"); common bands may appear as chips next to the fields, never instead of them (_inference_).
- Filter state lives in the URL so results can be shared and the Back button works (Vercel guidelines on URL state).

## Search box and query

- Natural-language search ("blue jacket under 80") shows the filters it understood as chips at once, so the person can correct them; words it could not use are said, never dropped silently (_inference_).
- Normalise the query before matching, and tolerate typos and alternative spellings of the same name (_inference_).
- A no-results page is never a dead end (Baymard): keep the query, say which filter emptied the list, offer to widen it (a higher price, a wider date range) (_inference_ for the widening).

## Detail pages

- Above the fold at 412 px: the image or gallery, the title, the attribute that decides (price, status), a key-facts row, and one primary action.
- Anything computed (a score, a label, an estimate) shows its basis: two or three plain sentences, then the items it rests on; with little basis, say the result is uncertain instead of showing false precision (_inference_).
- When an attribute is extracted from text (by a model or a parser), tapping it shows the passage it was read from, so a wrong extraction is visible (_inference_).
- A value that changes over time is shown from the item's own snapshots as a step chart.
- Warnings are sentences, not bare icons ("The listed price excludes tax").
- No horizontal tabs for core content: stack sections in reading order.

## Saved searches and alerts

- Saving the current filters is one tap; the first save explains in one sentence how alerts will arrive (by email or push, for example); the saved search says what triggers a message ("A new result that matches", "A price drop") and how to stop it (_inference_).

## Shareability

Search and detail pages are addressable URLs, and where the content is public they render without login, so a person can send one to someone else.
