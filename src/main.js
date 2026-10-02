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
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import { createUI } from "./ui.js";

const cfg = window.APP_CONFIG;
const root = document.getElementById("root");

if (!cfg || !cfg.firebase || String(cfg.firebase.apiKey).startsWith("REPLACE")) {
  root.textContent = "Not configured: edit config.js (Firebase config, database ID, provider ID).";
  throw new Error("APP_CONFIG missing or still has placeholders");
}

const app = initializeApp(cfg.firebase);
const auth = getAuth(app);
// Named (non-default) database, kept separate from any other Firestore data in the project.
const db = getFirestore(app, cfg.databaseId);

function makeProvider() {
  const id = cfg.providerId || "";
  if (id.startsWith("saml.")) return new SAMLAuthProvider(id);
  if (id.startsWith("oidc.")) return new OAuthProvider(id);
  throw new Error('providerId in config.js must start with "saml." or "oidc."');
}

const toRows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const branches = collection(db, "branches");

const ui = createUI(root, {
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
    ui.app({ email: user.email || "" });
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
