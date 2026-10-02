#!/usr/bin/env python3
"""Convert the 'Details' sheet of Site_Tracking_List.xlsx into data/branches.json.

Usage:  python3 scripts/convert.py path/to/Site_Tracking_List.xlsx

Only contact, address, primary-ISP and secondary-ISP columns are exported.
Aruba columns and the other sheets are intentionally left out.
"""
import datetime
import json
import re
import sys
from collections import Counter
from pathlib import Path

import openpyxl

SHEET = "Details"
EMPTY = {"", "none", "null"}


def clean(v):
    if v is None:
        return None
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.date().isoformat() if isinstance(v, datetime.datetime) else v.isoformat()
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    if isinstance(v, (int, float)):
        return str(v)
    s = str(v).strip()
    return None if s.lower() in EMPTY else s


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "site"


def main(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    rows = list(wb[SHEET].iter_rows(values_only=True))
    hdr = [str(h).strip() if h else None for h in rows[0]]
    ix = {h: i for i, h in enumerate(hdr) if h}

    def g(r, col):
        return clean(r[ix[col]]) if col in ix else None

    seen = Counter()
    out = []
    for r in rows[1:]:
        name = g(r, "Site Name")
        if not name:
            continue
        seen[name.lower()] += 1
        zip_ = g(r, "ZIP")
        if zip_ and zip_.isdigit():
            zip_ = zip_.zfill(5)
        out.append({
            "id": f"{slug(name)}-{seen[name.lower()]}",
            "siteName": name,
            "thirdOctet": g(r, "3rd Octet"),
            "status": g(r, "Status") or "Unknown",
            "description": g(r, "Site Description"),
            "region": g(r, "Region"),
            "costCenter": g(r, "Cost Center"),
            "users": g(r, "#Users"),
            "address": g(r, "Address"),
            "address2": g(r, "Address2"),
            "city": g(r, "City"),
            "state": g(r, "State"),
            "zip": zip_,
            "contacts": [c for c in (
                {"name": g(r, "Contact 1"), "phone": g(r, "Phone 1")},
                {"name": g(r, "Contact 2"), "phone": g(r, "Phone 2")},
            ) if c["name"] or c["phone"]],
            "primary": {
                "bandwidth": g(r, "INET BW"),
                "provider": g(r, "INET Provider"),
                "portal": g(r, "Online Portal"),
                "aggregatedBill": g(r, "Aggregated Bill"),
                "account": g(r, "INET Acct #"),
                "supportPhone": g(r, "INET Support Phone"),
                "mrc": g(r, "MRC"),
                "status": g(r, "INET Status"),
                "date": g(r, "INET Date"),
                "contractEnd": g(r, "Contract End"),
                "notes": g(r, "INET notes"),
                "staticIp": g(r, "INET Static IP"),
                "gateway": g(r, "INET GW"),
                "dns": g(r, "INET DNS"),
                "modemModel": g(r, "Modem make/model"),
                "modemMac": g(r, "Modem mac address"),
                "modemSerial": g(r, "Modem serial number"),
            },
            "secondary": {
                "bandwidth": g(r, "Secondary BW"),
                "provider": g(r, "Seconday Provider"),  # sic: header typo in the spreadsheet
                "portal": g(r, "Online Portal2"),
                "aggregatedBill": g(r, "Aggregated"),
                "account": g(r, "Secondary Acct#"),
                "supportPhone": g(r, "Support Number"),
                "mrc": g(r, "MRC2"),
                "status": g(r, "INET Status2"),
                "date": g(r, "Date"),
                "notes": g(r, "Notes2"),
                "staticIp": g(r, "Secondary Static IP"),
                "gateway": g(r, "Gateway"),
                "modemModel": g(r, "Modem make/model2"),
                "modemMac": g(r, "Modem mac address2"),
                "modemSerial": g(r, "Modem serial number2"),
            },
        })

    # drop empty values so Firestore docs stay small
    def prune(o):
        if isinstance(o, dict):
            o = {k: prune(v) for k, v in o.items()}
            return {k: v for k, v in o.items() if v not in (None, {}, [])}
        return o

    out = [prune(d) for d in out]
    dest = Path(__file__).resolve().parent.parent / "data" / "branches.json"
    dest.parent.mkdir(exist_ok=True)
    dest.write_text(json.dumps(out, indent=1, ensure_ascii=False))
    st = Counter(d["status"] for d in out)
    print(f"wrote {len(out)} sites to {dest}")
    print("by status:", dict(st))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
