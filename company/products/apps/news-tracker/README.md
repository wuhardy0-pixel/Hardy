# News Tracker

Status: **live** at play.hardywu.com/news (sign-in at lognews.hardywu.com); listed under Apps on hardywu.com.

One page, `index.html` (front-end only). The back end is the "News Tracker" section of corporate/server.py (`/api/news/*`).

What it does
- **Front pages**: the big outlets (Wall Street Journal, CNN, Reuters, AP, New York Times, BBC, Bloomberg, CNBC, The Guardian, Fox News, NPR) filed into five categories — Top stories, World, US, Business & Markets, Technology — with a publisher filter and a category filter.
- **Search**: look anything up (e.g. a town, a company); one tap follows it as a topic.
- **Your topics**: follow any words (a company, a place, a hobby) or a Google News section; fresh headlines for each.
- **Remembers three years**: every story it sees is kept for three years (an hourly collector keeps gathering even when nobody is looking) and shown under day headings with full dates.
- **Ask**: type a question — 'what is happening now with the Wichita crash?' — and it answers from today's stories plus its memory: right now, how it got here (dated), what to watch, with the sources listed.
- **What's new**: a green dot on stories you have not seen; counts on the chips; seen state is per login.
- **Saved**: tap ★ to keep a story in the Saved list.
- **One-minute briefing**: an AI summary of a topic or a category (OpenAI, cached per fetch).

Sources: Google News RSS (topics; also WSJ/CNN/Reuters/AP via site-restricted search, because their own feeds are stale) and the publishers' own RSS feeds. Feeds are cached 15 minutes and fetched in parallel.
