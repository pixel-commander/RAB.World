AUTH WRAPPER
Default: no session, so render LoginPage inside SiteChrome with no header/nav,
footer, model switcher or mascot drag handle. Rabbit remains interactive.
LoginBox has_create_account defaults to false; enable explicitly where needed.

Integration: supply the auth provider's verified session.user (DataKeys), login,
optional google and onDone callbacks. Session data should come from the provider,
not localStorage flags or a successful demo callback. Missing login fails with
an honest unavailable message. No passwords are persisted by this wrapper.
This component gates UI only; APIs still require server authentication.
No authentication provider or session endpoint is implemented in this change.
