import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  SAMLAuthProvider,
  OAuthProvider,
} from "firebase/auth";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, serverTimestamp, query, where } from "firebase/firestore";
import { createUI, slugify } from "./ui.js";

const cfg = window.APP_CONFIG;
const root = document.getElementById("root");

if (!cfg || !cfg.firebase || String(cfg.firebase.apiKey).startsWith("REPLACE")) {
  root.textContent = "Not configured: edit config.js (Firebase config, database ID, provider ID).";
  throw new Error("APP_CONFIG missing or still has placeholders");
}

const app = initializeApp(cfg.firebase);
const auth = getAuth(app);
// Uses its own collection (cfg.collection) so it cannot collide with other apps sharing this database.
const db = cfg.databaseId && cfg.databaseId !== "(default)" ? getFirestore(app, cfg.databaseId) : getFirestore(app);

function makeProvider() {
  const id = cfg.providerId || "";
  if (id.startsWith("saml.")) return new SAMLAuthProvider(id);
  if (id.startsWith("oidc.")) return new OAuthProvider(id);
  throw new Error('providerId in config.js must start with "saml." or "oidc."');
}

const toRows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const branches = collection(db, cfg.collection || "ccb_branch_info");

let currentEmail = "";

// Save one site. New sites get an id like "main-street-1"; an id that already exists on the server is never reused.
async function saveSite({ id, data, existingIds }) {
  let docId = id;
  if (!docId) {
    const base = slugify(data.siteName);
    for (let n = 1; !docId; n++) {
      const cand = `${base}-${n}`;
      if (existingIds.includes(cand)) continue;
      if (!(await getDoc(doc(branches, cand))).exists()) docId = cand;
    }
  }
  await setDoc(doc(branches, docId), { ...data, updatedBy: currentEmail, updatedAt: serverTimestamp() });
  return { id: docId, ...data, updatedBy: currentEmail, updatedAt: { toDate: () => new Date() } };
}

const ui = createUI(root, {
  onSave: saveSite,
  onLogin: async () => {
    try {
      await signInWithPopup(auth, makeProvider());
    } catch (e) {
      const msg =
        e.code === "auth/popup-blocked" ? "Your browser blocked the sign-in pop-up. Allow pop-ups for this site and try again."
        : e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request" ? ""
        : `Sign-in failed (${e.code || e.message}).`;
      ui.login(msg);
    }
  },
  onLogout: () => signOut(auth),
  onLoadClosed: async () => toRows(await getDocs(query(branches, where("status", "==", "Closed")))),
});

ui.loading();
// Session persistence: closing the tab signs the user out of this page.
setPersistence(auth, browserSessionPersistence).catch(() => {});

onAuthStateChanged(auth, async (user) => {
  if (!user) return ui.login();
  ui.loading("Checking access…");
  try {
    const rows = toRows(await getDocs(query(branches, where("status", "!=", "Closed"))));
    currentEmail = user.email || "";
    ui.app({ email: currentEmail });
    ui.setActive(rows);
  } catch (e) {
    if (e.code === "permission-denied") {
      const t = await user.getIdTokenResult().catch(() => null);
      ui.denied({ email: user.email, provider: t && t.signInProvider });
    } else {
      ui.error(`Couldn't load data (${e.code || e.message}).`);
    }
  }
});
