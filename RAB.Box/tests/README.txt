Node tests: npm test (no npm install needed).
Optional DOM interactions: python tests/browser_interaction.py
Needs Python Playwright and a Chromium executable. Set CHROMIUM_PATH if necessary.
The browser test uses a virtual origin and a bridge to the real HTTP server because
this preparation environment forbids direct browser navigation. It is NOT a direct
browser-network/CSP test. The Node suite separately exercises the actual HTTP API.
All test project writes use temporary copies, not the supplied mock project.
