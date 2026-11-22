"""Build data.csv from Sheet3 of the Yug register. Marks are copied, not invented.

The workbook stays in local/. This script writes:
  data.csv            anonymized rows for the repo
  local/id-map.csv    student_id back to the sheet row and roll (not pushed)

It refuses to write data.csv if the checks in PLAN.md fail.
"""

from __future__ import annotations

import csv
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "local" / "Copy of Revised Result Register cluster HS MOUD 2024.xlsx"
DATA_CSV = ROOT / "data.csv"
ID_MAP = ROOT / "local" / "id-map.csv"

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
HEADER = [
    "student_id",
    "class",
    "session",
    "subject",
    "f1",
    "f2",
    "f3",
    "f4",
    "f5",
    "f6",
    "fa_total",
    "co_curricular",
    "summative",
    "subject_total",
    "grand_total",
    "grade",
    "remark",
    "source",
]
SUBJECTS = [
    (17, "English"),
    (27, "Mathematics"),
    (37, "Science"),
    (47, "Social Science"),
    (57, "Urdu/Hindi"),
    (67, "Kashmiri/Dogri/Punjabi"),
]
ZERO_SUBJECT = "Kashmiri/Dogri/Punjabi"
PHONE = re.compile(r"(?<!\d)(?:\+91[\s-]?)?[6-9]\d{9}(?!\d)")
AADHAAR = re.compile(r"(?<!\d)\d{12}(?!\d)")


def col_n(ref: str) -> int:
    n = 0
    for ch in ref:
        if ch.isalpha():
            n = n * 26 + (ord(ch.upper()) - 64)
        else:
            break
    return n


def row_n(ref: str) -> int:
    digits = "".join(ch for ch in ref if ch.isdigit())
    return int(digits) if digits else 0


def load_sheet3(path: Path) -> dict[int, dict[int, str]]:
    with zipfile.ZipFile(path) as zipped:
        shared = ET.fromstring(zipped.read("xl/sharedStrings.xml"))
        strings = [
            "".join(node.text or "" for node in si.iter(f"{NS}t"))
            for si in shared.findall(f"{NS}si")
        ]
        root = ET.fromstring(zipped.read("xl/worksheets/sheet3.xml"))
    data: dict[int, dict[int, str]] = {}
    for cell in root.iter(f"{NS}c"):
        ref = cell.attrib.get("r", "")
        row, col = row_n(ref), col_n(ref)
        if row == 0:
            continue
        value = cell.find(f"{NS}v")
        if cell.attrib.get("t") == "s" and value is not None and value.text:
            text = strings[int(value.text)]
        elif value is not None and value.text is not None:
            text = value.text
        else:
            text = ""
        data.setdefault(row, {})[col] = text.strip()
    return data


def as_number(raw: str) -> str:
    if raw == "":
        raise ValueError("blank mark")
    number = float(raw)
    if number.is_integer():
        return str(int(number))
    return str(number)


def build_rows(sheet: dict[int, dict[int, str]]) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    student_rows = [
        row
        for row in sorted(sheet)
        if row >= 6 and sheet[row].get(10, "").strip()
    ]
    if len(student_rows) != 8:
        raise SystemExit(f"expected 8 students on Sheet3, found {len(student_rows)}")

    public: list[dict[str, str]] = []
    mapping: list[dict[str, str]] = []
    for index, row in enumerate(student_rows, start=1):
        cells = sheet[row]
        student_id = f"Student_{index:02d}"
        source = f"sheet3:{row}"
        mapping.append(
            {
                "student_id": student_id,
                "source_row": str(row),
                "roll": cells.get(6, ""),
            }
        )
        grade = cells.get(78, "")
        grand = as_number(cells.get(77, ""))
        for start, subject in SUBJECTS:
            marks = [as_number(cells.get(start + offset, "")) for offset in range(10)]
            public.append(
                {
                    "student_id": student_id,
                    "class": "8",
                    "session": "2023-24",
                    "subject": subject,
                    "f1": marks[0],
                    "f2": marks[1],
                    "f3": marks[2],
                    "f4": marks[3],
                    "f5": marks[4],
                    "f6": marks[5],
                    "fa_total": marks[6],
                    "co_curricular": marks[7],
                    "summative": marks[8],
                    "subject_total": marks[9],
                    "grand_total": grand,
                    "grade": grade,
                    "remark": "",
                    "source": source,
                }
            )
    return public, mapping


def assert_safe(rows: list[dict[str, str]]) -> None:
    if len(rows) != 48:
        raise SystemExit(f"expected 48 rows, found {len(rows)}")
    blob = "\n".join(",".join(row[key] for key in HEADER) for row in rows)
    if AADHAAR.search(blob) or PHONE.search(blob):
        raise SystemExit("refusing to write data.csv: an identity number is still in the rows")
    for row in rows:
        parts = [int(row[key]) for key in ("f1", "f2", "f3", "f4", "f5", "f6")]
        if sum(parts) != int(row["fa_total"]):
            raise SystemExit(f"formative total does not match for {row['student_id']} {row['subject']}")
        if row["subject"] == ZERO_SUBJECT:
            numbers = [int(row[key]) for key in ("f1", "f2", "f3", "f4", "f5", "f6", "fa_total", "co_curricular", "summative", "subject_total")]
            if any(numbers):
                raise SystemExit("the language subject is no longer all zeros; stop and look at the sheet")
        if row["remark"] != "":
            raise SystemExit("remark was empty on the sheet; refusing a filled remark")


def write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    if not XLSX.exists():
        raise SystemExit(f"missing workbook: {XLSX}")
    public, mapping = build_rows(load_sheet3(XLSX))
    assert_safe(public)
    write_csv(DATA_CSV, HEADER, public)
    write_csv(ID_MAP, ["student_id", "source_row", "roll"], mapping)
    print(f"wrote {DATA_CSV.name} ({len(public)} rows) and local/id-map.csv ({len(mapping)} ids)")


if __name__ == "__main__":
    sys.exit(main())
