# pages/

One class per page, grouped by target (`sauce/`, `app/`, `live/`). A page exposes intent-level
methods (`addToCart`, `checkout`) and the locators tests assert on. Locator order of preference:
role + accessible name, then label/placeholder/text, then test id. No CSS or XPath chains.
