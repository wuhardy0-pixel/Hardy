# News Tracker — how to prove it works

Server on 127.0.0.1:5000 (local = signed in as `news_local`).
- `GET /api/news/home` → topics with items (each has title, link, source, published, seen, saved), `front.categories` (4) with items from several publishers incl. Wall Street Journal and CNN.
- `POST /api/news/topics {"add":"Tesla"}` → topic appears; `{"remove":"Tesla"}` removes it.
- `POST /api/news/seen {"links":[…]}` then home again → those items `seen: true`.
- `POST /api/news/save {"item":{…},"topic":"x"}` → in `saved`; `{"remove":link}` removes.
- `POST /api/news/summary {"topic":"Robotics"}` → `summary` text (needs OPENAI_API_KEY; cached per fetch).
- In a 390-px browser: Front pages chip, category headings, day headings (Today/Yesterday/date), publisher filter narrows the list, green dots vanish on reload.
Clean up: `DELETE FROM news_topics/news_seen/news_saved WHERE user_key='news_local'` if you added test data.
