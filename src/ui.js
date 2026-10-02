// All rendering is done with DOM APIs and textContent. Spreadsheet data is never
// inserted as HTML, so a cell containing markup cannot run script on the page.

const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return n;
};

const PHONE_RE = /^\+?[\d\s().-]{7,}$/;
const phoneLink = (p) =>
  PHONE_RE.test(p) ? el("a", { href: "tel:" + p.replace(/[^\d+]/g, "") }, p) : p;

const money = (v) => (/^\d+(\.\d+)?$/.test(v) ? "$" + Number(v).toFixed(2) : v);

const ISP_FIELDS = [
  ["Provider", "provider"],
  ["Bandwidth", "bandwidth"],
  ["Status", "status"],
  ["Account #", "account"],
  ["Support phone", "supportPhone", phoneLink],
  ["Static IP", "staticIp"],
  ["Gateway", "gateway"],
  ["DNS", "dns"],
  ["MRC", "mrc", money],
  ["Online portal", "portal"],
  ["Aggregated bill", "aggregatedBill"],
  ["Install / date", "date"],
  ["Contract end", "contractEnd"],
  ["Modem", "modemModel"],
  ["Modem MAC", "modemMac"],
  ["Modem serial", "modemSerial"],
  ["Notes", "notes"],
];

export function haystack(r) {
  const parts = [r.siteName, r.description, r.region, r.city, r.state, r.zip, r.address, r.thirdOctet, r.costCenter];
  for (const c of r.contacts || []) parts.push(c.name, c.phone);
  for (const k of ["primary", "secondary"]) {
    const i = r[k];
    if (i) parts.push(i.provider, i.account, i.staticIp, i.gateway, i.status, i.supportPhone, i.modemMac, i.modemSerial);
  }
  return parts.filter(Boolean).join(" ").toLowerCase();
}

export function filterRows(rows, f) {
  const terms = (f.query || "").toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter((r) => {
    if (f.region && r.region !== f.region) return false;
    if (f.state && r.state !== f.state) return false;
    if (f.status && r.status !== f.status) return false;
    if (f.secondaryOnly && !(r.secondary && r.secondary.provider)) return false;
    if (!f.includeClosed && r.status === "Closed") return false;
    const h = r._h || (r._h = haystack(r));
    return terms.every((t) => h.includes(t));
  });
}

const byName = (a, b) =>
  (a.siteName || "").localeCompare(b.siteName || "") || (a.description || "").localeCompare(b.description || "");

function ispBlock(title, isp) {
  const box = el("section", { class: "isp" }, el("h4", {}, title));
  if (!isp || !Object.keys(isp).length) {
    box.append(el("p", { class: "muted" }, "None on record"));
    return box;
  }
  const dl = el("dl");
  for (const [label, key, fmt] of ISP_FIELDS) {
    const v = isp[key];
    if (!v) continue;
    dl.append(el("dt", {}, label), el("dd", {}, fmt ? fmt(v) : v));
  }
  box.append(dl);
  return box;
}

function card(r) {
  const body = el("div", { class: "detail", hidden: true });
  const addr = [r.address, r.address2].filter(Boolean).join(", ");
  const cityLine = [r.city, [r.state, r.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  const meta = el("dl", { class: "meta" });
  for (const [label, v] of [
    ["Address", [addr, cityLine].filter(Boolean).join(" · ")],
    ["Region", r.region],
    ["3rd octet", r.thirdOctet],
    ["Cost center", r.costCenter],
    ["Users", r.users],
  ]) if (v) meta.append(el("dt", {}, label), el("dd", {}, v));

  const contacts = el("section", { class: "isp" }, el("h4", {}, "Contacts"));
  if (r.contacts && r.contacts.length) {
    const dl = el("dl");
    for (const c of r.contacts) dl.append(el("dt", {}, c.name || "—"), el("dd", {}, c.phone ? phoneLink(c.phone) : "—"));
    contacts.append(dl);
  } else contacts.append(el("p", { class: "muted" }, "None on record"));

  body.append(meta, el("div", { class: "cols" }, contacts, ispBlock("Primary ISP", r.primary), ispBlock("Secondary ISP", r.secondary)));

  const p = r.primary || {};
  const s = r.secondary || {};
  const first = (r.contacts && r.contacts[0]) || {};
  const head = el(
    "button",
    { class: "head", type: "button", "aria-expanded": "false" },
    el("span", { class: "name" }, el("strong", {}, r.siteName), el("small", {}, r.description || "")),
    el("span", { class: "loc" }, [r.city, r.state].filter(Boolean).join(", ")),
    el("span", { class: "isp-sum", "data-l": "Primary" }, p.provider ? `${p.provider}${p.bandwidth ? " · " + p.bandwidth : ""}` : "—"),
    el("span", { class: "isp-sum", "data-l": "Secondary" }, s.provider || "—"),
    el("span", { class: "who", "data-l": "Contact" }, first.name || "—"),
    el("span", { class: "badge s-" + (r.status || "").toLowerCase().replace(/\s+/g, "") }, r.status || "")
  );
  head.addEventListener("click", () => {
    const open = head.getAttribute("aria-expanded") === "true";
    head.setAttribute("aria-expanded", String(!open));
    body.hidden = open;
  });
  return el("article", { class: "card" }, head, body);
}

export function createUI(root, handlers) {
  const state = { active: [], closed: [], closedLoaded: false, f: { query: "", region: "", state: "", status: "", secondaryOnly: false, includeClosed: false } };
  let listEl, countEl, regionSel, stateSel, statusSel, closedMsg;

  const screen = (...kids) => { root.replaceChildren(...kids); };

  function renderList() {
    const rows = filterRows(state.active.concat(state.f.includeClosed ? state.closed : []), state.f).sort(byName);
    countEl.textContent = `${rows.length} site${rows.length === 1 ? "" : "s"}`;
    listEl.replaceChildren(...(rows.length ? rows.map(card) : [el("p", { class: "empty" }, "No sites match.")]));
  }

  function fillSelect(sel, label, values) {
    const cur = sel.value;
    sel.replaceChildren(el("option", { value: "" }, label), ...[...new Set(values.filter(Boolean))].sort().map((v) => el("option", { value: v }, v)));
    sel.value = cur;
  }

  function refreshFilters() {
    const all = state.active.concat(state.closed);
    fillSelect(regionSel, "All regions", all.map((r) => r.region));
    fillSelect(stateSel, "All states", all.map((r) => r.state));
    fillSelect(statusSel, "Any status", all.filter((r) => state.f.includeClosed || r.status !== "Closed").map((r) => r.status));
  }

  return {
    loading(msg = "Loading…") { screen(el("div", { class: "center" }, el("p", {}, msg))); },

    login(error) {
      screen(el("div", { class: "center box" },
        el("h1", {}, "Cornerstone CCB Branch ISP Info"),
        el("p", { class: "muted" }, "Internal use only. Sign in with your company Okta account."),
        error && el("p", { class: "err", role: "alert" }, error),
        el("button", { class: "primary", type: "button", id: "login", onclick: handlers.onLogin }, "Log in with Okta")));
    },

    denied({ email, provider }) {
      screen(el("div", { class: "center box" },
        el("h1", {}, "Access denied"),
        el("p", {}, "You signed in, but this account isn't on the allowed list for this page."),
        el("p", { class: "muted" }, `Signed in as: ${email || "(no email in token)"}`),
        el("p", { class: "muted" }, `Sign-in provider: ${provider || "(unknown)"}`),
        el("button", { class: "primary", type: "button", id: "logout", onclick: handlers.onLogout }, "Sign out")));
    },

    error(msg) {
      screen(el("div", { class: "center box" }, el("h1", {}, "Something went wrong"), el("p", { class: "err", role: "alert" }, msg),
        el("button", { class: "primary", type: "button", onclick: handlers.onLogout }, "Sign out")));
    },

    app({ email }) {
      const search = el("input", { type: "search", id: "q", placeholder: "Search site, city, contact, ISP, account, IP…", "aria-label": "Search" });
      regionSel = el("select", { "aria-label": "Region" });
      stateSel = el("select", { "aria-label": "State" });
      statusSel = el("select", { "aria-label": "Status" });
      countEl = el("span", { class: "count", "aria-live": "polite" });
      closedMsg = el("span", { class: "muted" });
      listEl = el("div", { class: "list" });

      const sec = el("input", { type: "checkbox", id: "sec" });
      const closed = el("input", { type: "checkbox", id: "closed" });

      search.addEventListener("input", () => { state.f.query = search.value; renderList(); });
      regionSel.addEventListener("change", () => { state.f.region = regionSel.value; renderList(); });
      stateSel.addEventListener("change", () => { state.f.state = stateSel.value; renderList(); });
      statusSel.addEventListener("change", () => { state.f.status = statusSel.value; renderList(); });
      sec.addEventListener("change", () => { state.f.secondaryOnly = sec.checked; renderList(); });
      closed.addEventListener("change", async () => {
        state.f.includeClosed = closed.checked;
        if (closed.checked && !state.closedLoaded) {
          closedMsg.textContent = "Loading closed sites…";
          try { state.closed = await handlers.onLoadClosed(); state.closedLoaded = true; closedMsg.textContent = ""; }
          catch (e) { closed.checked = false; state.f.includeClosed = false; closedMsg.textContent = "Couldn't load closed sites."; }
        }
        refreshFilters(); renderList();
      });

      screen(
        el("header", { class: "bar" },
          el("h1", {}, "Cornerstone CCB Branch ISP Info"),
          el("span", { class: "who-am-i" }, email),
          el("button", { type: "button", id: "logout", onclick: handlers.onLogout }, "Sign out")),
        el("div", { class: "filters" }, search, regionSel, stateSel, statusSel,
          el("label", {}, sec, " Has secondary ISP"),
          el("label", {}, closed, " Include closed sites"),
          countEl, closedMsg),
        el("div", { class: "colhead", "aria-hidden": "true" },
          el("span", {}, "Site"), el("span", {}, "Location"), el("span", {}, "Primary ISP"), el("span", {}, "Secondary ISP"), el("span", {}, "Contact"), el("span", {}, "Status")),
        listEl);
      refreshFilters();
      renderList();
    },

    setActive(rows) { state.active = rows; if (listEl) { refreshFilters(); renderList(); } },
  };
}
