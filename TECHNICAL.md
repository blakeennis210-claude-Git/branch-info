# Technical notes (for whoever maintains this)

Static page (GitHub Pages) that signs in with Okta through Firebase Authentication and reads
branch data from a **separate named Firestore database** (`branch-info`) in the existing
`wildcats-tracker` project. The data is not in the page. The server refuses to send it unless the
visitor signed in through the Okta provider **and** their email is on the allowlist in the rules.

## What is and isn't verified

Verified against docs: named databases and per-database rules/deploy, SAML/OIDC providers need the
Identity Platform upgrade, SAML provider IDs start with `saml.`, the SAML email only reaches the
token if the IdP sends it in `NameID`, the web SDK calls used here.
Tested here: page behavior in a browser (search, filters, closed toggle, hostile cell content).
**Not tested here:** the Firestore rules (emulator download is blocked in this workspace), the
Okta login itself, and the deploy. Docs do not list what `firebase.sign_in_provider` equals for
SAML/OIDC. The rules assume it equals the provider ID. If an allowlisted user sees "Access denied",
the screen shows the provider value the token actually carries; put that value in the rules.
Rules fail closed, so a wrong guess blocks people, it does not let anyone in.

## Setup

1. **Create the database** (named databases can't be created in the console):
   `firebase firestore:databases:create branch-info --location=<region> --project wildcats-tracker`
2. **Okta / Auth** (your Okta team): upgrade the project to Firebase Authentication with Identity
   Platform, add a SAML or OIDC provider, and give it to Firebase. SAML: the Okta app must send the
   user's email as `NameID`. Note the provider ID (`saml.xxx` / `oidc.xxx`). This is project-wide, so
   it also shows up as a sign-in option in the Wildcats app's project.
3. **Edit**: `config.js` (Firebase web config, `providerId`),
   `branch-info.firestore.rules` (`oktaProviderId()` and `allowedEmails()`, lowercase emails).
4. **GitHub Pages**: repo Settings > Pages > Deploy from a branch > `main` / `(root)`. Then add the Pages
   domain (`<owner>.github.io`) under Firebase console > Authentication > Settings > Authorized domains.
5. **Deploy the rules** (from this folder): `firebase deploy --only firestore:branch-info`
6. **Load the data**: `npm install`, `gcloud auth application-default login`, then
   `node scripts/import.mjs --project wildcats-tracker --database branch-info`
   (writes only the `ccb_branch_info` collection; replaces that whole collection each run).

To refresh from a new spreadsheet: `python3 scripts/convert.py Site_Tracking_List.xlsx`, then step 6.
To change who can view: edit `allowedEmails()` and redeploy the rules (step 5, first command).
After editing `src/*.js`: `npx esbuild src/main.js --bundle --minify --format=iife --target=es2020 --outfile=app.js`

## Notes

- `data/` holds the real branch data and is gitignored. Don't commit it to a public repo.
- Rules only govern the web page. Anyone with IAM access to the Google Cloud project can still read
  the database from the console or Admin SDK, so check who has access.
- Sign-in uses session persistence: closing the tab signs out of this page (Okta may still be signed in).
- Exported: contact, address, primary ISP and secondary ISP columns of the `Details` sheet (305 sites,
  228 closed; closed are hidden until "Include closed sites" is ticked). Not exported: Aruba columns and
  the other sheets. The data includes account numbers, static IPs, modem MAC/serials and MRC; trim
  `scripts/convert.py` if that is more than viewers should see.
