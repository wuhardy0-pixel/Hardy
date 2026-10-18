# News Tracker — done and next

## 2026-10-18
- First version: topics (default 3D printing, Robotics, Indie games, Small business), Google News RSS, seen/saved per login, AI briefing.
- Same day, Barbara: 'remember dates, similar categories, pull from Wall Street and CNN and the big sites' → publisher front pages in four categories, publisher + category filters, day headings, 7/14-day memory in `news_items`. WSJ and CNN direct feeds are stale (2023/2025) so they come via Google News site: search. Parallel fetching: cold load a few seconds, warm load instant.

- Barbara asked about the Wichita soccer-field crash (Oct 17): it was findable as a topic but not on the front pages, which only carried each outlet's section feeds. Added a **Top stories** category (Google News top + nation headlines, real outlet names kept) shown first, per-feed take 20→30, site: searches now when:1d, and a **search box** (`/api/news/search?q=`) with a Follow button. Also: the same headline from the same outlet under two links shows once; story lines show date + time.

- Barbara: 'it keeps track so past 3 years it remembers, and if you ask what is happening now about it, it will tell you'. Memory is now three years (`NEWS_KEEP_DAYS`), an hourly background collector refreshes front pages and every followed topic so the memory fills even when nobody opens the app, and **Ask** (`POST /api/news/ask`) answers a question from today's stories plus everything remembered: 'Right now / How it got here (dated timeline) / Watch for', with the dated source stories listed under it. A question typed in the search box goes to Ask automatically.

## Next
- Push a morning digest by email once the mail sender is configured.
- Let a topic be pinned to a category.
