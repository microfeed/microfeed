---
title: Domains and authentication
description: Add a custom hostname and protect the Admin dashboard with built-in login or Cloudflare Access.
---

The public hostname and dashboard authentication solve different problems. A
custom domain gives the site a memorable address. Authentication protects who
can open the Admin dashboard.

| Goal | Use |
| --- | --- |
| Give the site your own web address | `npx @microfeed/cli manage domain` |
| Use microfeed’s email-and-password login | `npx @microfeed/cli manage auth setup` |
| Change a known password or sign-in email | **Account settings** in the dashboard |
| Recover a forgotten password or change the dashboard path | `npx @microfeed/cli manage auth <action>` |
| Add Cloudflare’s identity screen in front of the dashboard | `npx @microfeed/cli manage access` |

## Add or inspect a custom domain

From any folder, run:

```console
npx @microfeed/cli manage domain
```

Follow the prompts for the exact saved instance and hostname. A hostname is the
domain name without `https://` or a path, such as `feed.example.com`. The command
checks the relationship between the Worker, Cloudflare zone, and desired route.
If Cloudflare still needs DNS or certificate time, wait and run the command
again rather than creating unrelated records by guesswork.

Afterward, open the public site, RSS feed, JSON feed, and dashboard at the new
hostname.

## Built-in login

Built-in login stores an administrator email and password verifier in the
microfeed database.

### Enable built-in login

On the computer where you installed microfeed, open the microfeed project
folder in a terminal. If you do not know the saved name for your site, list the
available sites first:

```console
npx @microfeed/cli manage instances
```

Then run this command, replacing `<instance-name>` with the name shown above:

```console
npx @microfeed/cli manage auth setup --instance <instance-name>
```

Check the site and dashboard shown by the command, then follow its prompts. For
a deployed site, it opens or prints a private, one-time page where you create
the administrator password.

The setup command automatically redeploys microfeed when enabling built-in
login requires a configuration change. If built-in login is already enabled,
it skips the redeploy. You do not need to run `npx @microfeed/cli manage deploy` separately.
After setup, verify the result:

```console
npx @microfeed/cli manage status --instance <instance-name>
```

You can also ask an AI coding agent that has access to your microfeed project:

> Enable built-in login for my microfeed site and verify it. If more than one
> site is saved, ask me which one.

The agent can run the setup command and any required redeploy. You must complete
Cloudflare browser authorization and create the password in the private browser
page yourself. Never paste the password or private page URL into a conversation.

If you are signed in and know the current password, use **Account settings**
for routine email or password changes. Use `npx @microfeed/cli manage auth` for
forgotten-password recovery, dashboard-path changes, or
disabling the built-in login. Always include an action:

```console
npx @microfeed/cli manage auth reset-password
npx @microfeed/cli manage auth change-email
npx @microfeed/cli manage auth change-path
npx @microfeed/cli manage auth disable
```

Running `npx @microfeed/cli manage auth` by itself only prints help. Password creation and
reset use a private browser page; do not paste the password or private URL into
the terminal or a conversation.

## Change your built-in login

Sign in to the protected dashboard, open the avatar menu in the top-right
corner, and select **Account settings**. The **Login & identity** section shows
the current built-in login email and provides **Change password** and **Change
email** buttons.

### Change the current password

1. Select **Change password** in the built-in login box.
2. In the dialog, enter the current password, a new password of at least 12
   characters, and the new password again.
3. Select **Change password**.

The current browser remains signed in and microfeed CLI connections stay
authorized. Every other built-in dashboard session is signed out. Cloudflare
Access sessions, when present, remain managed separately by Cloudflare.

### Change the sign-in email

1. Select **Change email** in the built-in login box.
2. In the dialog, enter the new email and the current password.
3. Select **Change email**.

Every built-in dashboard session, including the current browser, is signed
out. Sign in again with the new email. microfeed CLI connections stay
authorized, and a separate Cloudflare Access identity does not change.

### Recover a forgotten password

The dashboard dialogs require the current password. If you cannot sign in or
do not know it, run this from any folder:

```console
npx @microfeed/cli manage auth reset-password --instance <instance-name>
```

For a deployed site, the command opens or prints a private, single-use browser
link. For a local site, it securely prompts for the replacement password.
Completing recovery signs out all built-in dashboard sessions and revokes the
owner's app authorizations and credentials. Do not use recovery for a routine
password change when the current password is available.

## Optional Cloudflare Access

Cloudflare Access can add an outer identity layer in front of the dashboard:

```console
npx @microfeed/cli manage access
```

The dashboard can have built-in login, Access, or both. When both are enabled,
sign-out clears the built-in session and routes through the Cloudflare Access
logout flow.

:::caution
Do not disable the final authentication layer on a public production dashboard
unless you deliberately accept that anyone who finds its address can manage the
site.
:::

Verify with `npx @microfeed/cli manage status`, then test sign-in and sign-out in a private
browser window.

## Review account security

Open **Account settings** from the avatar menu in a protected dashboard. The
page keeps owner-specific security controls separate from site-wide settings:

- **Login & identity** changes the built-in email or password and shows a
  Cloudflare Access identity separately when one is present.
- **Passkeys** adds, renames, or removes passkeys for the current site address.
  Keep the password as the recovery path if that address changes.
- **Active sessions** reviews built-in dashboard sessions and signs out other
  browsers. Cloudflare Access sessions remain managed in Cloudflare Zero Trust.
- **App access** reviews each computer connected through microfeed CLI. Revoke
  one computer without affecting the others, or revoke every CLI connection.

Account settings are unavailable when the dashboard has no built-in login or
Cloudflare Access identity. Initial setup and forgotten-password recovery stay
in `npx @microfeed/cli manage auth` so a signed-out owner cannot weaken account security from
the dashboard.
