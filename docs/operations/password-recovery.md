# Production password recovery

The public forgot-password flow always returns the same response and uses Better Auth's one-hour, one-time reset tokens. Until a production email adapter is configured, an authenticated Netlify operator can generate the initial Platform Super Admin reset link from the repository root:

```bash
npm run auth:reset-link -- --email livingitsolutions@gmail.com --production living-cms
```

The command requires an authenticated Netlify CLI linked to the `living-cms` project. It validates that the requested email is the active Platform Super Admin, captures the provider-neutral reset email callback in memory, and prints only the reset link once. It does not print database credentials, authentication secrets, or plaintext passwords.

Open the printed link, choose a new password, and sign in normally. The reset consumes the token and revokes all active sessions.

Remove the maintenance script and its package command after a production `PasswordResetEmailPort` adapter is configured. No public endpoint returns reset tokens.
