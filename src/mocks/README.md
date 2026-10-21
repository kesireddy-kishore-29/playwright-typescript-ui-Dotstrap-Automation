# mocks/

Network scenarios applied with `page.route()`: the states a real backend rarely produces on
demand (401, 500, empty, slow, partial failure, rate limited, unread). Each scenario is a
function so a test reads `await mock.messages.serverError()`.
