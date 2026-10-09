// Loads data/branches.json into a Firestore database, replacing ONLY the `ccb_branch_info`
// collection (sites removed from the spreadsheet are deleted).
//
//   node scripts/import.mjs --project <firebase-project-id>   (add --replace to overwrite existing data) 
//
// Auth: Application Default Credentials. Run `gcloud auth application-default login`
// first, or set GOOGLE_APPLICATION_CREDENTIALS to a service-account key file.
// For a local emulator, set FIRESTORE_EMULATOR_HOST (e.g. 127.0.0.1:8080).
import { readFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const arg = (name, dflt) => {
  const i = process.argv.indexOf("--" + name);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const project = arg("project");
const database = arg("database", "(default)");
const collName = arg("collection", "ccb_branch_info");
const file = arg("file", new URL("../data/branches.json", import.meta.url).pathname);

if (!project) { console.error("Missing --project <firebase-project-id>"); process.exit(1); }

const rows = JSON.parse(readFileSync(file, "utf8"));
const app = initializeApp({ projectId: project });
const db = database === "(default)" ? getFirestore(app) : getFirestore(app, database);
const col = db.collection(collName);

const keep = new Set(rows.map((r) => r.id));
const existing = await col.listDocuments();

// Sites can now be edited and added in the web page. Re-importing the spreadsheet would overwrite those
// edits and delete sites that are not in the spreadsheet, so it only runs on an empty collection
// unless you pass --replace on purpose.
if (existing.length && !process.argv.includes("--replace")) {
  console.error(`Collection "${collName}" already has ${existing.length} documents. Importing would overwrite edits made in the web page. Re-run with --replace if that is what you want.`);
  process.exit(1);
}
const stale = existing.filter((d) => !keep.has(d.id));

// Firestore batches are limited to 500 operations.
const ops = [
  ...rows.map(({ id, ...data }) => (b) => b.set(col.doc(id), data)),
  ...stale.map((d) => (b) => b.delete(d)),
];
for (let i = 0; i < ops.length; i += 400) {
  const batch = db.batch();
  ops.slice(i, i + 400).forEach((op) => op(batch));
  await batch.commit();
}
console.log(`database "${database}", collection "${collName}": wrote ${rows.length} sites, deleted ${stale.length} stale`);
