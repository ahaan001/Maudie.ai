#!/usr/bin/env python3
"""
WAT Tool: FDA MAUDE Adverse Event Ingestion
============================================
Downloads and ingests FDA MAUDE CSV data into the compliance platform database.

Usage:
  python tools/maude_ingest.py <path_to_mdrfoi.csv> [--keywords "exoskeleton,orthosis,prosthetic"]

MAUDE data download:
  https://www.fda.gov/medical-devices/mandatory-reporting-requirements-manufacturers-importers-and-device-user-facilities/manufacturer-and-user-facility-device-experience-database-maude

Notes:
  - MAUDE CSV uses latin-1 encoding (not UTF-8)
  - Large files (>1GB) are processed in streaming mode
  - Records with no report text are skipped
  - Existing records (by mdr_report_key) are not overwritten
"""

import csv
import os
import sys
import argparse
import psycopg2
from datetime import datetime

DEFAULT_KEYWORDS = [
    'exoskeleton',
    'orthosis',
    'orthotic',
    'prosthetic',
    'prosthesis',
    'wearable robot',
    'rehabilitation robot',
    'assistive robot',
    'powered exoskeleton',
    'powered orthosis',
    'lower limb robot',
    'upper limb robot',
]

def parse_args():
    parser = argparse.ArgumentParser(description='Ingest FDA MAUDE data into compliance platform')
    parser.add_argument('csv_path', help='Path to MAUDE mdrfoi.csv file')
    parser.add_argument('--keywords', default=','.join(DEFAULT_KEYWORDS),
                        help='Comma-separated device keywords to filter (default: assistive/wearable robotics)')
    parser.add_argument('--limit', type=int, default=10000, help='Max records to process (default: 10000)')
    parser.add_argument('--dry-run', action='store_true', help='Parse without inserting to DB')
    return parser.parse_args()

def matches_keywords(row: dict, keywords: list[str]) -> bool:
    searchable = ' '.join([
        row.get('BRAND_NAME', '') or '',
        row.get('GENERIC_NAME', '') or '',
        row.get('DEVICE_CLASS', '') or '',
        row.get('DEVICE_PRODUCT_CODE', '') or '',
    ]).lower()
    return any(kw.lower() in searchable for kw in keywords)

def parse_date(date_str: str) -> str | None:
    if not date_str or date_str.strip() == '':
        return None
    for fmt in ('%Y-%m-%d', '%m/%d/%Y', '%Y%m%d'):
        try:
            return datetime.strptime(date_str.strip(), fmt).isoformat()
        except ValueError:
            continue
    return None

def main():
    args = parse_args()
    keywords = [k.strip() for k in args.keywords.split(',') if k.strip()]

    db_url = os.environ.get('DATABASE_URL')
    if not db_url and not args.dry_run:
        print('ERROR: DATABASE_URL environment variable not set', file=sys.stderr)
        sys.exit(1)

    conn = psycopg2.connect(db_url) if not args.dry_run else None
    if conn:
        conn.autocommit = False

    batch = []
    batch_size = 500
    processed = 0
    matched = 0
    inserted = 0
    skipped = 0

    try:
        with open(args.csv_path, newline='', encoding='latin-1') as f:
            reader = csv.DictReader(f)

            for row in reader:
                processed += 1
                if processed > args.limit:
                    break

                if not matches_keywords(row, keywords):
                    continue

                matched += 1
                report_text = row.get('EVENT_DESCRIPTION') or row.get('FOI_TEXT') or ''
                if len(report_text.strip()) < 20:
                    skipped += 1
                    continue

                record = (
                    (row.get('MDR_REPORT_KEY') or '').strip() or None,
                    (row.get('BRAND_NAME') or '').strip()[:500] or None,
                    (row.get('GENERIC_NAME') or '').strip()[:500] or None,
                    ((row.get('BRAND_NAME') or '') + ' ' + (row.get('GENERIC_NAME') or '')).strip()[:500],
                    (row.get('EVENT_TYPE') or '').strip().lower() or None,
                    parse_date(row.get('DATE_RECEIVED') or ''),
                    report_text[:10000],
                )
                batch.append(record)

                if len(batch) >= batch_size:
                    inserted += flush_batch(conn, batch, args.dry_run)
                    batch = []

            if batch:
                inserted += flush_batch(conn, batch, args.dry_run)

        if conn and not args.dry_run:
            conn.commit()

    except Exception as e:
        if conn:
            conn.rollback()
        print(f'ERROR: {e}', file=sys.stderr)
        sys.exit(1)
    finally:
        if conn:
            conn.close()

    print(f'MAUDE Ingestion Complete:')
    print(f'  Rows processed:  {processed}')
    print(f'  Keyword matches: {matched}')
    print(f'  Inserted:        {inserted}')
    print(f'  Skipped (no text): {skipped}')

def flush_batch(conn, batch: list, dry_run: bool) -> int:
    if dry_run:
        for r in batch[:3]:
            print(f'  [dry-run] Would insert: {r[3][:60]} | type: {r[4]}')
        return len(batch)

    cur = conn.cursor()
    cur.executemany("""
        INSERT INTO regulatory_events (mdr_report_key, brand_name, generic_name, device_name, event_type, event_date, report_text, source)
        VALUES (%s, %s, %s, %s, %s, %s::timestamptz, %s, 'maude')
        ON CONFLICT (mdr_report_key) DO NOTHING
    """, batch)
    conn.commit()
    count = cur.rowcount
    cur.close()
    return count

if __name__ == '__main__':
    main()
