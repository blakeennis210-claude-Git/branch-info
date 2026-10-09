// Demo page: same UI as the real site, but with made-up sample data and no login or database.
import { createUI, slugify } from "./ui.js";

const mk = (siteName, description, region, city, state, status, contact, p, s) => ({
  id: siteName.toLowerCase() + "-1", siteName, description, region, city, state, status,
  zip: "00000", address: "100 Example St", thirdOctet: String(10 + siteName.length), costCenter: "999",
  contacts: [{ name: contact, phone: "555-010-0100" }, { name: "Backup Contact", phone: "555-010-0101" }],
  primary: p, secondary: s,
});
const isp = (provider, bandwidth, ip, extra = {}) => ({
  provider, bandwidth, status: "Activated", account: "000000000000", supportPhone: "555-010-0199",
  staticIp: ip, gateway: ip.replace(/\.\d+\/\d+$/, ".1"), ...extra,
});

const active = [
  mk("DEMO1", "Example Branch One", "Central", "Springfield", "TX", "New", "Alex Sample", isp("Comcast", "300/35", "192.0.2.10/30"), isp("AT&T", "50/10", "192.0.2.14/30")),
  mk("DEMO2", "Example Branch Two", "Central", "Riverton", "TX", "New", "Pat Example", isp("Spectrum", "500/20", "192.0.2.20/30")),
  mk("DEMO3", "Example Branch Three", "Mountain West", "Fairview", "CO", "Original", "Sam Placeholder", isp("CenturyLink", "100/100", "192.0.2.30/30"), isp("Comcast", "100/10", "192.0.2.34/30")),
  mk("DEMO4", "Example Branch Four", "Mountain West", "Lakeside", "CO", "Off Net", "Jordan Test", { provider: "Cox", bandwidth: "150/20", status: "Activated", notes: "Sample note: tech visit 2-4pm" }),
  mk("DEMO5", "Example Branch Five", "Pacific NW", "Hillcrest", "WA", "New", "Taylor Demo", isp("Comcast", "1g/35", "192.0.2.40/30")),
  mk("DEMO6", "Example Branch Six", "Pacific NW", "Oakdale", "WA", "New", "Casey Mock", isp("Frontier", "200/200", "192.0.2.50/30"), isp("Spectrum", "100/10", "192.0.2.54/30")),
  mk("DEMO7", "Example Branch Seven", "South", "Brookfield", "NC", "New", "Morgan Fake", isp("Spectrum", "400/20", "192.0.2.60/30")),
  mk("DEMODC", "Example Data Center", "Corporate", "Capital City", "TX", "DC", "NOC Desk", isp("Comcast", "1g/1g", "192.0.2.70/29"), isp("Lumen", "1g/1g", "192.0.2.78/29")),
];
const closed = [
  mk("OLD1", "Example Closed Branch", "South", "Oldtown", "OK", "Closed", "Former Contact", { provider: "Cox", bandwidth: "50/10", status: "Disconnected" }),
  mk("OLD2", "Example Closed Branch Two", "Central", "Pinecrest", "AR", "Closed", "Former Contact", { provider: "AT&T", bandwidth: "25/5", status: "Disconnected" }),
];

const root = document.getElementById("root");
const ui = createUI(root, {
  onLogin: () => { ui.app({ email: "demo@example.com" }); ui.setActive(active); },
  onLogout: () => ui.login(),
  onLoadClosed: async () => closed,
  // Demo only: edits live in this page's memory and vanish on reload.
  onSave: async ({ id, data, existingIds }) => {
    let docId = id;
    for (let n = 1; !docId; n++) if (!existingIds.includes(`${slugify(data.siteName)}-${n}`)) docId = `${slugify(data.siteName)}-${n}`;
    return { id: docId, ...data };
  },
});
ui.login();
