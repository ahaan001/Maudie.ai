#!/usr/bin/env python3
"""
WAT Tool: PDF Text Extraction
==============================
Extracts text from PDFs with page metadata. Outputs JSON for downstream ingestion.

Usage:
  python tools/pdf_extract.py <path_to_pdf> [--output output.json]

Notes:
  - Requires: pip install pdfminer.six
  - For scanned PDFs, use --ocr flag (requires tesseract + pytesseract)
  - Outputs structured JSON with page-level text and metadata
"""

import json
import sys
import argparse
from pathlib import Path

def parse_args():
    parser = argparse.ArgumentParser(description='Extract text from PDF with page metadata')
    parser.add_argument('pdf_path', help='Path to PDF file')
    parser.add_argument('--output', help='Output JSON file path (default: stdout)')
    parser.add_argument('--ocr', action='store_true', help='Use OCR for scanned PDFs (requires tesseract)')
    return parser.parse_args()

def extract_with_pdfminer(pdf_path: str) -> dict:
    try:
        from pdfminer.high_level import extract_pages, extract_text
        from pdfminer.layout import LTTextContainer
    except ImportError:
        print('ERROR: pdfminer.six not installed. Run: pip install pdfminer.six', file=sys.stderr)
        sys.exit(1)

    pages = []
    full_text_parts = []

    for page_num, page_layout in enumerate(extract_pages(pdf_path), start=1):
        page_text_parts = []
        for element in page_layout:
            if isinstance(element, LTTextContainer):
                page_text_parts.append(element.get_text())
        page_text = '\n'.join(page_text_parts).strip()
        if page_text:
            pages.append({'page': page_num, 'text': page_text})
            full_text_parts.append(page_text)

    return {
        'file': str(pdf_path),
        'page_count': len(pages),
        'full_text': '\n\n'.join(full_text_parts),
        'pages': pages,
        'extraction_method': 'pdfminer',
    }

def extract_with_ocr(pdf_path: str) -> dict:
    try:
        import pytesseract
        from pdf2image import convert_from_path
        from PIL import Image
    except ImportError:
        print('ERROR: OCR dependencies not installed. Run: pip install pytesseract pdf2image Pillow', file=sys.stderr)
        sys.exit(1)

    images = convert_from_path(pdf_path, dpi=200)
    pages = []
    full_text_parts = []

    for page_num, image in enumerate(images, start=1):
        text = pytesseract.image_to_string(image, lang='eng')
        if text.strip():
            pages.append({'page': page_num, 'text': text.strip()})
            full_text_parts.append(text.strip())

    return {
        'file': str(pdf_path),
        'page_count': len(pages),
        'full_text': '\n\n'.join(full_text_parts),
        'pages': pages,
        'extraction_method': 'ocr_tesseract',
    }

def main():
    args = parse_args()
    pdf_path = Path(args.pdf_path)

    if not pdf_path.exists():
        print(f'ERROR: File not found: {pdf_path}', file=sys.stderr)
        sys.exit(1)

    result = extract_with_ocr(str(pdf_path)) if args.ocr else extract_with_pdfminer(str(pdf_path))

    if not result['full_text'].strip():
        print('WARNING: No text extracted. PDF may be scanned. Try --ocr flag.', file=sys.stderr)

    output = json.dumps(result, indent=2, ensure_ascii=False)

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(output)
        print(f'Extracted {result["page_count"]} pages to {args.output}')
    else:
        print(output)

if __name__ == '__main__':
    main()
