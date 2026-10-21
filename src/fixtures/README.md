# fixtures/

Everything a test receives instead of building it: page objects, API clients, a per-worker
account with a saved session, mocks, and the cross-cutting checks that run around every test
(feature ID present, console-error guard, failure evidence).

| File       | For                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------ |
| `base.ts`  | Traceability, Allure labels, console guard, evidence attachments, HAR recording            |
| `sauce.ts` | Sauce Demo pages + the saved Sauce session                                                 |
| `app.ts`   | The self-hosted app: per-worker account, session, API seeding with verified cleanup, mocks |
| `live.ts`  | dotstrap.com public pages, polite visitor settings                                         |
