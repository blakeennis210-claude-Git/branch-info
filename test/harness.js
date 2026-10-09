import { createUI, slugify } from "../src/ui.js";
import data from "../data/branches.json";
const root = document.getElementById("root");
window.calls = { login: 0, logout: 0, closedLoads: 0 };
window.saves = [];
const active = data.filter(r => r.status !== "Closed");
const closed = data.filter(r => r.status === "Closed");
// hostile row to prove data is rendered as text, not HTML
active.push({ id: "x-1", siteName: "<img src=x onerror=\"window.pwned=1\">", status: "New", description: "<b>bold</b>", city: "X", state: "TX",
  contacts: [{ name: "<script>window.pwned=2</script>", phone: "512-555-0100" }], primary: { provider: "<i>ISP</i>", notes: "<img src=y onerror=\"window.pwned=3\">" } });
window.ui = createUI(root, {
  onLogin: () => { window.calls.login++; },
  onLogout: () => { window.calls.logout++; },
  onLoadClosed: async () => { window.calls.closedLoads++; return closed; },
  onSave: async (arg) => {
    window.saves.push(arg);
    if (window.failSave) { const e = new Error("nope"); e.code = "permission-denied"; throw e; }
    let id = arg.id;
    for (let n = 1; !id; n++) if (!arg.existingIds.includes(`${slugify(arg.data.siteName)}-${n}`)) id = `${slugify(arg.data.siteName)}-${n}`;
    return { id, ...arg.data, updatedBy: "tester@example.com", updatedAt: { toDate: () => new Date("2026-10-08T12:00:00Z") } };
  },
});
window.ui.login();
window.__counts = { active: active.length, closed: closed.length };
window.__active = active;
