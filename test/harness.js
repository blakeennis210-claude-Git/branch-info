import { createUI } from "../src/ui.js";
import data from "../data/branches.json";
const root = document.getElementById("root");
window.calls = { login: 0, logout: 0, closedLoads: 0 };
const active = data.filter(r => r.status !== "Closed");
const closed = data.filter(r => r.status === "Closed");
// hostile row to prove data is rendered as text, not HTML
active.push({ id: "x-1", siteName: "<img src=x onerror=\"window.pwned=1\">", status: "New", description: "<b>bold</b>", city: "X", state: "TX",
  contacts: [{ name: "<script>window.pwned=2</script>", phone: "512-555-0100" }], primary: { provider: "<i>ISP</i>", notes: "<img src=y onerror=\"window.pwned=3\">" } });
window.ui = createUI(root, {
  onLogin: () => { window.calls.login++; },
  onLogout: () => { window.calls.logout++; },
  onLoadClosed: async () => { window.calls.closedLoads++; return closed; },
});
window.ui.login();
window.__counts = { active: active.length, closed: closed.length };
window.__active = active;
