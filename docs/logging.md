# Logging and Render log search (PRD s6.3, s9)

## What we log
- One JSON line per request (pino-http): request ID, method, path without query string, status code, response time.
- Every response has an `x-request-id` header. If the client sends one, we reuse it.
- Errors are logged by `errorHandler` with type, code, status, message and stack. Malformed-JSON errors log no message or stack, because they echo the raw body.
- `/health` is not logged.
- Never logged: request bodies, query strings, NINs, Authorization or Cookie headers.
- Enforced in CI by `tests/logging-nin.test.js`.

## Find a request in Render
1. Render Dashboard -> Servana-Backend service -> **Logs** tab.
2. Set the time range to cover when the request happened.
3. Get the request ID from the `x-request-id` response header (browser DevTools -> Network -> the request -> Response Headers), or from the user's report.
4. Paste the ID into the log search box. Every line for that request appears.
5. Open a line to see the JSON: `req.id`, `res.statusCode`, `responseTime`.
6. To find failures, search `request failed`, copy the `req.id` from the line, then search that ID.

## Verify no NIN leaks on staging
1. Send a request with a fake NIN, for example:
   `curl -i -X POST https://<staging-url>/verifications/nin -H "Content-Type: application/json" -d '{"nin":"98765432101"'`
   (the body is deliberately malformed, so it returns 400 without needing a token)
2. Copy the `x-request-id` from the response headers.
3. In Render Logs, search `98765432101`. Expected: no results.
4. Search the request ID. Expected: log lines for the request, with no body.

## If a NIN ever appears in logs
1. Fix the log line, add a test case, redeploy.
2. Tell the team lead and follow the PRD s9 steps.

