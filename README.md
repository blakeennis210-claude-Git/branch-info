# Cornerstone CCB Branch ISP Info

A private-by-login page that shows each branch's contact info and its primary and secondary ISP.
Only people on an approved email list can see the data, and only after logging in with Okta.

**How it fits together (one sentence):** this repo is just the page; the branch data lives in a
brand-new Firebase database that refuses to hand it over unless you logged in with Okta *and* your
email is on the list.

Nothing here touches your Wildcats app's data or its website.

---

## Setup: 6 steps, in this order

Tick them off as you go. Each step says who does it and how you know it worked.

### Step 1: Turn the website on (you, 1 minute)
1. At the top of this repo click **Settings**.
2. In the left menu click **Pages**.
3. Under **Branch** pick **main**, leave the folder as **/ (root)**, click **Save**.
4. Wait about a minute and refresh the page. A box at the top shows **your site's link**.

**Done when:** you can see a link like `https://something.github.io/branch-info/`.
It will say *"Not configured"* for now. That's expected.

### Step 2: Ask your Okta team (you, 2 minutes: copy and send this)

> Hi, I'm setting up an internal page that uses Firebase Authentication with Okta.
> Please:
> 1. Upgrade the Firebase project `wildcats-tracker` to "Firebase Authentication with Identity Platform".
> 2. Add an Okta sign-in provider (SAML or OIDC, your choice) in Firebase: Authentication > Sign-in method.
>    For SAML, Okta must send the user's email address as the NameID.
> 3. Send me the **provider ID** Firebase shows for it. It looks like `saml.something` or `oidc.something`.
>
> Note: this is set per Firebase project, so the provider also shows up as a sign-in option for the
> other app in that project. The branch data stays locked to Okta sign-ins on the approved list.

**Done when:** you have the provider ID (write it here: ____________).

### Step 3: Allow the website in Firebase (you, 2 minutes)
1. Open the [Firebase console](https://console.firebase.google.com/) and pick the **wildcats-tracker** project.
2. Go to **Authentication > Settings > Authorized domains**.
3. Click **Add domain** and paste your site's domain from Step 1, **only the part before the first slash**,
   for example `something.github.io`.

**Done when:** the domain shows in the list.

### Step 4: Paste your Firebase settings into this repo (you, 3 minutes)
1. In the Firebase console click the gear icon > **Project settings**. Scroll to **Your apps**.
   If there's no web app for this site, click the **`</>`** (web) icon and register one named `branch-info`
   (skip the hosting option).
2. Under **SDK setup and configuration** choose **Config**. You'll see values like `apiKey` and `appId`.
3. Back here on GitHub open the file **config.js** and click the **pencil icon** (top right of the file).
4. Replace each `REPLACE_ME` with the real value from Firebase.
5. Change `providerId` to the provider ID from Step 2.
6. Click **Commit changes** (green button).

These values are not secrets. Firebase's web config is meant to be public.

**Done when:** the site no longer says "Not configured" (refresh it; you should see a **Log in with Okta** button).

### Step 5: Make the database (you, on your computer, 10 minutes the first time)
*Install these once if you don't have them:* [Node.js](https://nodejs.org/), the Firebase CLI
(`npm install -g firebase-tools`), and the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install).

1. On this repo's main page click the green **Code** button > **Download ZIP**. Unzip it.
2. Open a terminal **inside that unzipped folder** and run these one at a time:
   ```
   firebase login
   firebase firestore:databases:create branch-info --location=us-central1 --project wildcats-tracker
   ```
   (Use the same region as your other database if you know it. `us-central1` is only an example.)
3. Open **branch-info.firestore.rules** in a text editor **on your computer (not on GitHub)**.
   - Replace `REPLACE-WITH-ALLOWED-EMAIL@example.com` with the email(s) allowed to view, **in lowercase**,
     for example `['name@company.com', 'other@company.com']`.
   - Make sure `oktaProviderId()` matches your provider ID from Step 2.
   - Don't upload this edited file back to GitHub. That would publish the email list.
4. Run:
   ```
   firebase deploy --only firestore:branch-info
   ```

**Done when:** the last command says the deploy completed.

### Step 6: Load the branch data (you, on your computer, 5 minutes)
1. Put your spreadsheet (`Site_Tracking_List.xlsx`) in the same folder.
2. Run these one at a time:
   ```
   pip install openpyxl
   python3 scripts/convert.py Site_Tracking_List.xlsx
   npm install
   gcloud auth application-default login
   node scripts/import.mjs --project wildcats-tracker --database branch-info
   ```

**Done when:** it prints `wrote 305 sites`. Now open your site's link and click **Log in with Okta**.

---

## If something looks wrong

| You see | It means | Fix |
|---|---|---|
| "Not configured" | `config.js` still has `REPLACE_ME` | Do Step 4 |
| Login pop-up never opens | Browser blocked pop-ups, or the domain isn't allowed | Allow pop-ups; redo Step 3 |
| "Access denied" with your email shown | Email isn't on the list, or the provider value differs | Check the email in Step 5. If it is right, the screen shows the provider value your login carries. Put exactly that in `oktaProviderId()` and redo `firebase deploy --only firestore:branch-info` |
| Page loads, list is empty | Data not loaded, or the rules weren't deployed | Redo Step 5 (deploy) and Step 6 |

## Changing things later
- **Add or remove a viewer:** edit the email list in the rules file on your computer, then
  `firebase deploy --only firestore:branch-info`.
- **Refresh the data from a new spreadsheet:** repeat Step 6.

Not yet tested: the Okta login and the Firestore rules (the author's workspace couldn't run them).
Expect to fix small things on the first real login. Technical details are in `TECHNICAL.md`.
