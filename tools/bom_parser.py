#!/usr/bin/env python3
"""
WAT Tool: BOM / Parts List Parser
===================================
Parses Bill of Materials (CSV or XLSX) into structured JSON for ingestion.

Usage:
  python tools/bom_parser.py <bom_file.csv> [--output output.json]

Expected CSV columns (flexible mapping):
  Part Number, Part Name, Description, Material, Quantity, Manufacturer, Notes, etc.
"""

import json
import sys
import argparse
import csv
from pathlib import Path

# Common column name aliases
COLUMN_MAP = {
    'part_number': ['part number', 'part no', 'part_number', 'item number', 'item no', 'p/n', 'pn'],
    'part_name': ['part name', 'part_name', 'name', 'item name', 'description', 'component'],
    'quantity': ['quantity', 'qty', 'count', 'amount'],
    'material': ['material', 'material type', 'matl', 'substrate'],
    'manufacturer': ['manufacturer', 'mfr', 'vendor', 'supplier', 'make'],
    'model': ['model', 'model number', 'part model', 'catalog number'],
    'notes': ['notes', 'comments', 'remarks', 'annotation'],
}

def find_column(headers: list[str], aliases: list[str]) -> str | None:
    headers_lower = [h.lower().strip() for h in headers]
    for alias in aliases:
        if alias in headers_lower:
            return headers[headers_lower.index(alias)]
    return None

def parse_csv_bom(file_path: str) -> dict:
    items = []
    unrecognized_columns = []

    with open(file_path, newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []

        col_map = {field: find_column(headers, aliases) for field, aliases in COLUMN_MAP.items()}

        for row in reader:
            item = {}
            for field, col in col_map.items():
                if col and col in row:
                    value = row[col].strip()
                    if value:
                        item[field] = value

            # Capture any unmapped columns
            mapped_cols = {v for v in col_map.values() if v}
            for h in headers:
                if h not in mapped_cols and row.get(h, '').strip():
                    item.setdefault('extra', {})[h] = row[h].strip()

            if item.get('part_number') or item.get('part_name'):
                items.append(item)

    return {
        'file': file_path,
        'item_count': len(items),
        'column_mapping': {k: v for k, v in col_map.items() if v},
        'items': items,
    }

def parse_args():
    parser = argparse.ArgumentParser(description='Parse BOM CSV to structured JSON')
    parser.add_argument('bom_file', help='Path to BOM CSV file')
    parser.add_argument('--output', help='Output JSON file (default: stdout)')
    return parser.parse_args()

def main():
    args = parse_args()
    path = Path(args.bom_file)

    if not path.exists():
        print(f'ERROR: File not found: {path}', file=sys.stderr)
        sys.exit(1)

    suffix = path.suffix.lower()
    if suffix == '.csv':
        result = parse_csv_bom(str(path))
    else:
        print(f'ERROR: Unsupported format: {suffix}. Only .csv supported for MVP.', file=sys.stderr)
        sys.exit(1)

    output = json.dumps(result, indent=2, ensure_ascii=False)

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(output)
        print(f'Parsed {result["item_count"]} BOM items to {args.output}')
    else:
        print(output)

if __name__ == '__main__':
    main()
