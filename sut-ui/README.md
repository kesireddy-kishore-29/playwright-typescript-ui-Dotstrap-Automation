# sut-ui/

The self-hosted app under test ("Relay"): a Node server with an in-memory JSON API and a vanilla-JS single-page app. It provides what public demo sites cannot: per-user API data for hybrid tests, unread/notification state, a deliberately inaccessible page and test ids that can be broken on demand (`SUT_UI_CHAOS=rename-testid`). Start it with `npm run sut`; Playwright starts it automatically through `webServer`.
