# mocks/

Network scenarios applied with `page.route()`: the states a real backend rarely produces on
demand (401, 500, empty, slow, partial failure, rate limited, quota exceeded). Each scenario is a
method of the `mocks` fixture, so a test reads `await mocks.serverError()`.
