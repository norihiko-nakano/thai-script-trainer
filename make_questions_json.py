#!/usr/bin/env python3
"""Convert the "Thai" sheet in an ODS vocabulary notebook to questions.json.

Usage:
    python make_questions_json.py
    python make_questions_json.py "Thai language.ods" questions.json
    python make_questions_json.py --input "Thai language.ods" --output questions.json

The script uses only Python's standard library. It preserves the contents of
columns A-G without automatically correcting the source data.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree as ET


NS = {
    "office": "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
    "table": "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
    "text": "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
}

TABLE_CELL = f"{{{NS['table']}}}table-cell"
COVERED_CELL = f"{{{NS['table']}}}covered-table-cell"
COL_REPEAT = f"{{{NS['table']}}}number-columns-repeated"
SHEET_NAME = f"{{{NS['table']}}}name"
TEXT_SPACE = f"{{{NS['text']}}}s"
TEXT_SPACE_COUNT = f"{{{NS['text']}}}c"
TEXT_TAB = f"{{{NS['text']}}}tab"
TEXT_LINE_BREAK = f"{{{NS['text']}}}line-break"

COLUMN_COUNT = 7
DEFAULT_INPUT = Path("Thai language.ods")
DEFAULT_OUTPUT = Path("questions.json")
DEFAULT_SHEET = "Thai"


LEVEL_1_CATEGORIES = {291: "基本動詞", 325: "基本動詞", 33: "基本動詞", 147: "基本動詞", 235: "基本動詞", 239: "基本動詞", 149: "基本動詞", 148: "基本動詞", 315: "基本動詞", 309: "基本動詞", 520: "基本動詞", 72: "基本動詞", 383: "基本動詞", 435: "基本動詞", 127: "基本動詞", 131: "基本動詞", 63: "基本動詞", 110: "基本動詞", 289: "基本動詞", 286: "基本動詞", 205: "基本動詞", 188: "基本動詞", 166: "基本動詞", 379: "基本動詞", 90: "基本動詞", 111: "基本動詞", 393: "基本動詞", 302: "基本動詞", 225: "基本動詞", 360: "基本動詞", 368: "基本動詞", 307: "基本動詞", 394: "基本動詞", 460: "基本動詞", 503: "基本動詞", 246: "基本名詞", 66: "基本名詞", 73: "基本名詞", 234: "基本名詞", 28: "基本名詞", 532: "基本名詞", 47: "基本名詞", 278: "基本名詞", 38: "基本名詞", 49: "基本名詞", 75: "基本名詞", 305: "基本名詞", 313: "基本名詞", 78: "基本名詞", 472: "基本名詞", 262: "基本名詞", 483: "基本名詞", 268: "基本名詞", 39: "基本名詞", 180: "基本名詞", 177: "基本名詞", 183: "基本名詞", 162: "基本名詞", 372: "基本名詞", 371: "基本名詞", 100: "基本名詞", 199: "基本名詞", 193: "基本名詞", 124: "基本名詞", 464: "基本名詞", 431: "基本名詞", 283: "基本名詞", 143: "基本名詞", 473: "基本名詞", 340: "基本名詞", 232: "基本名詞", 103: "基本名詞", 282: "基本名詞", 489: "基本名詞", 221: "基本名詞", 96: "基本形容詞・疑問語・時間", 512: "基本形容詞・疑問語・時間", 208: "基本形容詞・疑問語・時間", 407: "基本形容詞・疑問語・時間", 304: "基本形容詞・疑問語・時間", 125: "基本形容詞・疑問語・時間", 212: "基本形容詞・疑問語・時間", 211: "基本形容詞・疑問語・時間", 46: "基本形容詞・疑問語・時間", 48: "基本形容詞・疑問語・時間", 50: "基本形容詞・疑問語・時間", 130: "基本形容詞・疑問語・時間", 99: "基本形容詞・疑問語・時間", 344: "基本形容詞・疑問語・時間", 194: "基本形容詞・疑問語・時間", 314: "基本形容詞・疑問語・時間", 363: "基本形容詞・疑問語・時間", 468: "基本形容詞・疑問語・時間", 488: "基本形容詞・疑問語・時間", 509: "基本形容詞・疑問語・時間", 298: "基本形容詞・疑問語・時間", 19: "基本形容詞・疑問語・時間", 97: "基本形容詞・疑問語・時間", 145: "基本形容詞・疑問語・時間", 280: "基本形容詞・疑問語・時間"}


def clean_text(value: str) -> str:
    """Normalize whitespace while preserving intentional line breaks."""
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    lines = [re.sub(r"[ \t\u00a0]+", " ", line).strip() for line in value.split("\n")]
    return "\n".join(line for line in lines if line).strip()


def element_text(element: ET.Element) -> str:
    """Read ODS text, including repeated spaces, tabs and line breaks."""
    parts: list[str] = []

    def walk(node: ET.Element) -> None:
        if node.text:
            parts.append(node.text)

        for child in node:
            if child.tag == TEXT_SPACE:
                count_text = child.attrib.get(TEXT_SPACE_COUNT, "1")
                try:
                    count = max(1, int(count_text))
                except ValueError:
                    count = 1
                parts.append(" " * count)
            elif child.tag == TEXT_TAB:
                parts.append("\t")
            elif child.tag == TEXT_LINE_BREAK:
                parts.append("\n")
            else:
                walk(child)

            if child.tail:
                parts.append(child.tail)

    walk(element)
    return clean_text("".join(parts))


def read_sheet_rows(ods_path: Path, sheet_name: str) -> list[list[str]]:
    """Return non-empty physical rows from the requested ODS sheet.

    Empty rows repeated to the spreadsheet limit are deliberately not expanded.
    Only columns A-G are read because those are the app's source columns.
    """
    if not ods_path.exists():
        raise FileNotFoundError(f"ODS file not found: {ods_path}")

    try:
        with zipfile.ZipFile(ods_path) as archive:
            content_xml = archive.read("content.xml")
    except zipfile.BadZipFile as exc:
        raise ValueError(f"Not a valid ODS file: {ods_path}") from exc
    except KeyError as exc:
        raise ValueError("content.xml was not found inside the ODS file.") from exc

    root = ET.fromstring(content_xml)
    sheets = root.findall(".//table:table", NS)
    sheet = next((item for item in sheets if item.attrib.get(SHEET_NAME) == sheet_name), None)

    if sheet is None:
        names = [item.attrib.get(SHEET_NAME, "") for item in sheets]
        raise ValueError(
            f'Sheet "{sheet_name}" was not found. Available sheets: {", ".join(names)}'
        )

    rows: list[list[str]] = []

    for row in sheet.findall("table:table-row", NS):
        values: list[str] = []

        for cell in row:
            if cell.tag not in {TABLE_CELL, COVERED_CELL}:
                continue

            repeat_text = cell.attrib.get(COL_REPEAT, "1")
            try:
                repeat = max(1, int(repeat_text))
            except ValueError:
                repeat = 1

            value = "" if cell.tag == COVERED_CELL else element_text(cell)
            remaining = COLUMN_COUNT - len(values)
            if remaining <= 0:
                break

            values.extend([value] * min(repeat, remaining))

        values.extend([""] * (COLUMN_COUNT - len(values)))
        values = values[:COLUMN_COUNT]

        if any(values):
            rows.append(values)

    return rows


def unique_in_order(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        value = clean_text(value)
        if value and value not in seen:
            seen.add(value)
            result.append(value)
    return result


def parse_records(rows: list[list[str]]) -> tuple[list[dict], list[str]]:
    """Map columns A-G to app records without correcting source content."""
    raw_records: list[dict] = []
    warnings: list[str] = []

    for sheet_row_number, columns in enumerate(rows, start=1):
        source_id, japanese, thai, reading, _private_mnemonic, usage_note, word_order_note = (
            clean_text(value) for value in columns
        )

        # The heading row has ID 0. Any other non-numeric line is skipped safely.
        if not source_id or source_id == "0":
            continue
        if not re.fullmatch(r"\d+", source_id):
            warnings.append(
                f"Sheet row {sheet_row_number}: skipped because ID is not an integer: {source_id!r}"
            )
            continue
        if not japanese or not thai:
            warnings.append(
                f"ID {source_id}: skipped because Japanese or Thai is blank."
            )
            continue

        raw_records.append(
            {
                "id": int(source_id),
                "japanese": japanese,
                "thai": thai,
                "reading": reading,
                "usageNote": usage_note,
                "wordOrderNote": word_order_note,
            }
        )

    # A Japanese prompt can legitimately have more than one Thai answer in the
    # source notebook. Likewise, one Thai item can have multiple Japanese glosses.
    japanese_to_thai: dict[str, list[str]] = defaultdict(list)
    thai_to_japanese: dict[str, list[str]] = defaultdict(list)

    for record in raw_records:
        japanese_to_thai[record["japanese"]].append(record["thai"])
        thai_to_japanese[record["thai"]].append(record["japanese"])

    records: list[dict] = []
    seen_pairs: set[tuple[str, str]] = set()

    for record in raw_records:
        pair = (record["japanese"], record["thai"])
        if pair in seen_pairs:
            # Avoid exact duplicate quiz prompts while leaving the source ODS unchanged.
            continue
        seen_pairs.add(pair)

        difficulty = 1 if record["id"] in LEVEL_1_CATEGORIES else 0
        records.append(
            {
                **record,
                "acceptedThai": unique_in_order(japanese_to_thai[record["japanese"]]),
                "acceptedJapanese": unique_in_order(thai_to_japanese[record["thai"]]),
                "difficulty": difficulty,
                "category": LEVEL_1_CATEGORIES.get(record["id"], ""),
            }
        )

    duplicate_pair_count = len(raw_records) - len(records)
    if duplicate_pair_count:
        warnings.append(
            f"Merged {duplicate_pair_count} duplicate Japanese/Thai pair(s) in the JSON output."
        )

    missing_reading = sum(1 for record in records if not record["reading"])
    if missing_reading:
        warnings.append(f"{missing_reading} question(s) have no reading in column D.")

    return records, warnings


def build_payload(records: list[dict], source_path: Path, sheet_name: str) -> dict:
    return {
        "meta": {
            "title": "Thai Vocabulary Trainer Ver2.3.2",
            "sourceFile": source_path.name,
            "sourceSheet": sheet_name,
            "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "questionCount": len(records),
            "difficultyCounts": {
                "1": sum(1 for record in records if record.get("difficulty") == 1),
                "unassigned": sum(1 for record in records if record.get("difficulty") == 0),
            },
            "columns": {
                "A": "id",
                "B": "japanese",
                "C": "thai",
                "D": "reading",
                "E": "ignoredPrivateNote",
                "F": "usageNote",
                "G": "wordOrderNote",
            },
        },
        "questions": records,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Convert the "Thai" sheet in an ODS file to questions.json.'
    )
    parser.add_argument("input_pos", nargs="?", type=Path, help="Input ODS file")
    parser.add_argument("output_pos", nargs="?", type=Path, help="Output JSON file")
    parser.add_argument("--input", "-i", dest="input_opt", type=Path)
    parser.add_argument("--output", "-o", dest="output_opt", type=Path)
    parser.add_argument("--sheet", "-s", default=DEFAULT_SHEET)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    input_path = args.input_opt or args.input_pos or DEFAULT_INPUT
    output_path = args.output_opt or args.output_pos or DEFAULT_OUTPUT

    try:
        rows = read_sheet_rows(input_path, args.sheet)
        records, warnings = parse_records(rows)

        if not records:
            raise ValueError("No usable vocabulary rows were found.")

        payload = build_payload(records, input_path, args.sheet)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    except (FileNotFoundError, ValueError, ET.ParseError, OSError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    print(f"Created: {output_path}")
    print(f"Questions: {len(records)}")
    for warning in warnings:
        print(f"WARNING: {warning}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
