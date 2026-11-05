"""Read-only XLSX -> private, reviewed Cockpit snapshot. Never edits the workbook.

Inputs must be a current SharePoint download and its connector metadata. The
output is private: do not place it in the repository or a public asset folder.
"""
import argparse
import hashlib
import json
import re
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path


def text(value):
    if value is None:
        return ""
    return value.isoformat() if isinstance(value, datetime) else str(value).strip()


def cents(value):
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        raise ValueError("Boolean monetary value")
    return int((Decimal(str(value)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def name_key(value):
    value = unicodedata.normalize("NFD", text(value)).casefold()
    return " ".join(sorted(re.findall(r"[a-z0-9]+", "".join(c for c in value if not unicodedata.combining(c)))))


def build(workbook, metadata):
    import openpyxl
    blob = workbook.read_bytes()
    sha = hashlib.sha256(blob).hexdigest()
    if len(blob) != metadata["size"]:
        raise ValueError("Source size differs from fresh SharePoint metadata")
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    wb = openpyxl.load_workbook(workbook, read_only=True, data_only=True)
    contacts, payments, history = (list(wb[s].values) for s in ["Contacts", "Versements", "Historique"])
    if contacts[5][0] != "Nº fiche" or payments[5][15] != "Clé du versement":
        raise ValueError("Workbook schema changed; review the importer")
    years = [2023, 2024, 2025, 2026]
    rows = []
    for source_row, r in enumerate(contacts[6:], 7):
        if not isinstance(r[0], (int, float)):
            continue
        rows.append({"id": str(int(r[0])), "name": text(r[1]), "language": text(r[2]),
                     "phone": text(r[3]), "email": text(r[4]),
                     "monetary": {str(y): cents(r[c]) for y, c in [(2023, 8), (2024, 5), (2025, 6), (2026, 7)]},
                     "inKind": {str(y): cents(r[c]) for y, c in [(2024, 9), (2025, 10), (2026, 11)]},
                     "relationship": text(r[12]), "organisation": text(r[13]),
                     "caller": text(r[14]), "beforeCall": text(r[15]), "callResult": text(r[16]),
                     "callDate": text(r[17]), "followUp": text(r[18]), "historicalNotes": text(r[19]),
                     "recurrence": text(r[20]), "origin": text(r[21]), "identityNote": text(r[22]),
                     "lastPayment": text(r[23])[:10], "sourceRow": source_row,
                     "payments": [], "history": [], "related": []})
    index = {r["id"]: r for r in rows}
    if len(index) != len(rows) or not rows:
        raise ValueError("Duplicate or empty contact IDs")
    keys = set()
    for source_row, p in enumerate(payments[6:], 7):
        if not isinstance(p[0], (int, float)):
            continue
        key, contact_id = text(p[15]), str(int(p[0]))
        if not key or key in keys or contact_id not in index:
            raise ValueError("Missing/duplicate payment key or unknown contact")
        keys.add(key)
        index[contact_id]["payments"].append({"key": key, "payer": text(p[1]), "date": text(p[2])[:10],
            "year": int(p[3]), "grossCents": cents(p[4]), "refundedCents": cents(p[5]),
            "netCents": cents(p[6]), "kind": text(p[7]), "campaign": text(p[8]), "method": text(p[9]),
            "recurrence": text(p[10]), "email": text(p[11]), "organisation": text(p[12]),
            "receipt": text(p[13]), "source": text(p[14]), "notes": text(p[16]),
            "matchingRule": text(p[17]), "sourceFullCents": cents(p[18]), "additionalOnly": text(p[19]),
            "sourceRow": source_row})
    # Historique includes several old layouts. Keep their actual headers and
    # section names, rather than reinterpreting all rows as a single table.
    by_name = defaultdict(list)
    for row in rows:
        by_name[name_key(row["name"])].append(row["id"])
    legacy_ids = {}
    for h in history:
        if text(h[0]).startswith("AP-") and text(h[7]) in ["FR", "EN", "À confirmer"]:
            possible = by_name[name_key(text(h[1]) + " " + text(h[2]))]
            if len(possible) == 1:
                legacy_ids[text(h[0])] = possible[0]
    section, headers, history_count = "Historique", [], 0
    for source_row, h in enumerate(history, 1):
        first = text(h[0])
        if first.startswith("Ancienne liste"):
            section, headers = first, []
        elif first in ["Identifiant", "Nº fiche", "Fiche", "N° fiche"]:
            headers = [text(v) for v in h]
        elif (isinstance(h[0], (int, float)) and str(int(h[0])) in index) or first in legacy_ids:
            # The later evidence appendix uses its own compact source layout.
            labels = headers
            if isinstance(h[2], (int, float)) and 1900 <= h[2] <= 2100:
                labels = ["Nº fiche", "Nom", "Année", "Type de pièce", "Référence", "Campagne", "Portée de la preuve"]
                section = "Pièces historiques"
            fields = [{"label": labels[i] if i < len(labels) and labels[i] else f"Colonne {i + 1}",
                       "value": text(v)} for i, v in enumerate(h) if v is not None and i > 0]
            contact_id = legacy_ids[first] if first in legacy_ids else str(int(h[0]))
            index[contact_id]["history"].append({"section": section, "sourceRow": source_row, "fields": fields})
            history_count += 1
    shared = defaultdict(list)
    for r in rows:
        digits = re.sub(r"\D", "", r["phone"])
        if len(digits) == 11 and digits.startswith("1"):
            digits = digits[1:]
        if len(digits) == 10:
            shared[("Téléphone partagé", digits)].append(r["id"])
        if "@" in r["email"]:
            shared[("Courriel partagé", r["email"].casefold())].append(r["id"])
    for (reason, _), ids in shared.items():
        if len(ids) < 2:
            continue
        for contact_id in ids:
            index[contact_id]["related"].extend({"id": other, "name": index[other]["name"], "reason": reason}
                                                  for other in ids if other != contact_id)
    for r in rows:
        for year in years:
            for kind, values in [("Monétaire", r["monetary"]), ("Nature", r["inKind"])]:
                total = sum(p["netCents"] or 0 for p in r["payments"] if p["year"] == year and p["kind"] == kind)
                if total != (values.get(str(year)) or 0):
                    raise ValueError(f"Contact/payment mismatch: fiche {r['id']}, {year}, {kind}")
        r["isMember"] = any((p["netCents"] or 0) > 0 and p["kind"] == "Monétaire" for p in r["payments"])
        r["hasInKind"] = any((p["netCents"] or 0) > 0 and p["kind"] == "Nature" for p in r["payments"])
        r["needsReview"] = bool(r["identityNote"] or r["related"])
        r["payments"].sort(key=lambda p: (p["date"], p["key"]), reverse=True)
    snapshot_id = "registre-" + sha[:20]
    chunks = [{"id": f"philanthropie-membres-{i // 100 + 1:02d}", "data": {"schemaVersion": 1,
               "snapshotId": snapshot_id, "rows": rows[i:i + 100]}} for i in range(0, len(rows), 100)]
    if len(chunks) > 20:
        raise ValueError("Registry exceeds reviewed read cap")
    source = {"label": metadata["name"], "url": metadata["web_url"].replace("action=default", "action=edit") + "&web=1",
              "driveId": metadata["parent_reference"]["drive_id"], "itemId": metadata["id"],
              "eTag": metadata["e_tag"], "modifiedAt": metadata["last_modified_date_time"],
              "checkedAt": metadata["checkedAt"], "sha256": sha}
    stats = {"files": len(rows), "memberFiles": sum(r["isMember"] for r in rows),
             "inKindOnlyFiles": sum(r["hasInKind"] and not r["isMember"] for r in rows),
             "withoutDocumentedPayment": sum(not r["payments"] for r in rows),
             "withPhone": sum(bool(r["phone"]) for r in rows), "withEmail": sum(bool(r["email"]) for r in rows),
             "reviewFiles": sum(r["needsReview"] for r in rows)}
    yearly = [{"year": y, "monetaryCents": sum(p["netCents"] or 0 for r in rows for p in r["payments"] if p["year"] == y and p["kind"] == "Monétaire"),
               "inKindCents": sum(p["netCents"] or 0 for r in rows for p in r["payments"] if p["year"] == y and p["kind"] == "Nature"),
               "memberFiles": sum(any(p["year"] == y and p["kind"] == "Monétaire" and (p["netCents"] or 0) > 0 for p in r["payments"]) for r in rows)} for y in years]
    manifest = {"schemaVersion": 1, "snapshotId": snapshot_id, "source": source, "generatedAt": now,
                "latestPaymentDate": max((p["date"] for r in rows for p in r["payments"] if p["date"]), default=""),
                "years": years, "rowCount": len(rows), "paymentCount": len(keys), "historyCount": history_count,
                "chunkIds": [c["id"] for c in chunks], "stats": stats, "yearly": yearly,
                "membershipDefinition": "Toute personne ou organisation ayant donné de l’argent à Bleu est membre. Les chiffres affichés comptent des fiches documentées, pas des personnes uniques.",
                "scopeNote": "Dons et adhésions documentés au registre; années civiles. Ces versements ne représentent pas à eux seuls l’ensemble des revenus comptables. Un montant absent ne signifie pas que la personne n’a jamais donné."}
    for c in chunks:
        if len(json.dumps(c["data"], ensure_ascii=False).encode()) > 750000:
            raise ValueError("Private chunk too large")
    return {"manifest": manifest, "chunks": chunks}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workbook", type=Path, required=True)
    parser.add_argument("--metadata", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    public_checkout = Path(__file__).resolve().parent.parent
    if args.output.resolve().is_relative_to(public_checkout):
        raise ValueError("Private snapshots must stay outside the public repository")
    result = build(args.workbook, json.loads(args.metadata.read_text(encoding="utf-8-sig")))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("x", encoding="utf-8") as file:
        json.dump(result, file, ensure_ascii=False, separators=(",", ":"))
    print(json.dumps({"output": str(args.output), "snapshotId": result["manifest"]["snapshotId"],
                      "stats": result["manifest"]["stats"], "yearly": result["manifest"]["yearly"],
                      "chunks": len(result["chunks"])}, ensure_ascii=False))
