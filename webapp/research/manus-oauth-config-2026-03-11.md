# Manus OAuth Config Research

Date: 2026-03-11

## Summary

- Public Manus examples use the authorization entrypoint `https://manus.im/app-auth`.
- Observed query parameters are `appId`, `redirectUri`, `state`, and `responseType=code`.
- Public examples show callback URLs on Manus-hosted domains such as `https://<app>.manus.space/manus-oauth/callback`.
- Community reports indicate OAuth redirect URIs may need to be explicitly allowlisted by Manus for custom domains.
- I did not find a clear official public developer page explaining where to create a custom OAuth app, how to obtain `appId`, or how to manage allowed redirect URIs in self-service UI.

## Evidence

### Public authorization URL examples

- https://academy.manus.im/activity/019c1c4e-ac80-76b7-aa5f-ae7157f95fdb
- https://academy.manus.im/activity/019c137c-902b-78ff-83b5-b21edad57f89

Observed pattern:

```text
https://manus.im/app-auth?appId=<id>&redirectUri=<encoded>&state=<encoded>&responseType=code
```

### Related official docs

- Access control / built-in login overview:
  https://manus.im/docs/website-builder/access-control
- Integrations overview:
  https://open.manus.im/docs/integrations

These docs confirm OAuth is used in Manus products, but they do not document a full custom app OAuth setup flow.

### Community reports

- Custom domain callback issue:
  https://www.reddit.com/r/ManusOfficial/comments/1ql89d4/has_anyone_got_manus_oauth_to_work_with_a_custom/
- Redirect URI allowlist/support request:
  https://www.reddit.com/r/ManusOfficial/comments/1qxni3p/manus_support_not_responding_to_email_request/

## Practical Takeaways

1. Use `https://manus.im/app-auth` as the login entrypoint.
2. Include `appId`, `redirectUri`, `state`, and `responseType=code`.
3. Expect callback URL validation on Manus side.
4. If localhost or custom domain callback fails, the likely issue is redirect URI registration/allowlisting rather than URL shape.

## Gaps

- No public official page found for:
  - creating a custom OAuth app
  - retrieving or rotating `appId`
  - self-service management of redirect URI allowlists
