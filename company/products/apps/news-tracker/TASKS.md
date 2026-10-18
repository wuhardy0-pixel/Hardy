# News Tracker — done and next

## 2026-10-18
- First version: topics (default 3D printing, Robotics, Indie games, Small business), Google News RSS, seen/saved per login, AI briefing.
- Same day, Barbara: 'remember dates, similar categories, pull from Wall Street and CNN and the big sites' → publisher front pages in four categories, publisher + category filters, day headings, 7/14-day memory in `news_items`. WSJ and CNN direct feeds are stale (2023/2025) so they come via Google News site: search. Parallel fetching: cold load a few seconds, warm load instant.

- Barbara asked about the Wichita soccer-field crash (Oct 17): it was findable as a topic but not on the front pages, which only carried each outlet's section feeds. Added a **Top stories** category (Google News top + nation headlines, real outlet names kept) shown first, per-feed take 20→30, site: searches now when:1d, and a **search box** (`/api/news/search?q=`) with a Follow button. Also: the same headline from the same outlet under two links shows once; story lines show date + time.

## Next
- Push a morning digest by email once the mail sender is configured.
- Let a topic be pinned to a category.
