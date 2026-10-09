// Export helpers: flatten the branch records into a table, then write CSV or XLSX.
// Runs entirely in the browser; nothing is sent anywhere.
import writeExcelFile from "write-excel-file/universal";

export const ISP_COLS = [
  ["Provider", "provider"],
  ["Bandwidth", "bandwidth"],
  ["Status", "status"],
  ["Account #", "account"],
  ["Support phone", "supportPhone"],
  ["Static IP", "staticIp"],
  ["Gateway", "gateway"],
  ["DNS", "dns"],
  ["MRC", "mrc"],
  ["Online portal", "portal"],
  ["Aggregated bill", "aggregatedBill"],
  ["Install / date", "date"],
  ["Contract end", "contractEnd"],
  ["Modem", "modemModel"],
  ["Modem MAC", "modemMac"],
  ["Modem serial", "modemSerial"],
  ["Notes", "notes"],
];

export const SITE_COLS = [
  ["Site", "siteName"],
  ["Description", "description"],
  ["Status", "status"],
  ["Region", "region"],
  ["3rd octet", "thirdOctet"],
  ["Cost center", "costCenter"],
  ["Users", "users"],
  ["Address", "address"],
  ["Address 2", "address2"],
  ["City", "city"],
  ["State", "state"],
  ["Zip", "zip"],
];

const str = (v) => (v == null ? "" : String(v));

// Returns { header: string[], body: string[][] } with every cell as text.
export function buildTable(rows) {
  const maxContacts = Math.max(1, ...rows.map((r) => (r.contacts || []).length));
  const header = SITE_COLS.map((c) => c[0]);
  for (let i = 1; i <= maxContacts; i++) header.push(`Contact ${i} name`, `Contact ${i} phone`);
  for (const p of ["Primary ISP", "Secondary ISP"]) for (const [label] of ISP_COLS) header.push(`${p} ${label}`);

  const body = rows.map((r) => {
    const line = SITE_COLS.map(([, k]) => str(r[k]));
    for (let i = 0; i < maxContacts; i++) {
      const c = (r.contacts || [])[i] || {};
      line.push(str(c.name), str(c.phone));
    }
    for (const k of ["primary", "secondary"]) {
      const isp = r[k] || {};
      for (const [, key] of ISP_COLS) line.push(str(isp[key]));
    }
    return line;
  });
  return { header, body };
}

// Spreadsheet programs treat a cell starting with = + - @ as a formula. Prefix those with an
// apostrophe so a value like =HYPERLINK(...) stays text. Plain phone numbers like +1 555-0100 are left alone.
const looksLikeNumber = /^[+-]?[\d\s().-]+$/;
export function safeCell(s) {
  return /^[=+\-@\t\r]/.test(s) && !looksLikeNumber.test(s) ? "'" + s : s;
}

export function toCsv({ header, body }) {
  const q = (s) => '"' + safeCell(s).replace(/"/g, '""') + '"';
  // BOM so Excel opens it as UTF-8.
  return "﻿" + [header, ...body].map((row) => row.map(q).join(",")).join("\r\n") + "\r\n";
}

export async function toXlsxBlob({ header, body }) {
  const head = header.map((h) => ({ value: h, type: String, fontWeight: "bold" }));
  // Every data cell is written as a string, so Excel never evaluates it as a formula.
  const data = [head, ...body.map((row) => row.map((v) => (v === "" ? null : { value: v, type: String })))];
  const widths = header.map((h, i) => {
    const longest = Math.max(h.length, ...body.map((r) => r[i].length));
    return { width: Math.min(Math.max(longest + 2, 10), 50) };
  });
  return writeExcelFile(data, { columns: widths, sheet: "Branches" }).toBlob();
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
