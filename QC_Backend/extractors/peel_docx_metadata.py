"""Metadata extraction for the PO & Cell DOCX files shipped with Auto Peel results."""

import io
import re
import zipfile
from typing import Dict, Iterable, Optional
from xml.etree import ElementTree


FIELD_PATTERNS = {
    "po_number": re.compile(r"\b(?:P\s*\.?\s*O\s*\.?|production\s+order)(?:\s*(?:number|no\.?))?\s*[:\-–]?\s*([^:\-–].*)", re.IGNORECASE),
    "cell_vendor": re.compile(r"\b(?:cell\s+(?:vendor|supplier)|vendor)\s*[:\-–]?\s*([^:\-–].*)", re.IGNORECASE),
    "wp": re.compile(r"\b(?:W\s*p|watt\s*peak|module\s+(?:rating|wattage))\s*[:\-–]?\s*([^:\-–].*)", re.IGNORECASE),
}
LABEL_ONLY_PATTERNS = {
    "po_number": re.compile(r"^\s*(?:P\s*\.?\s*O\s*\.?|production\s+order)(?:\s*(?:number|no\.?))?\s*[:\-–]?\s*$", re.IGNORECASE),
    "cell_vendor": re.compile(r"^\s*(?:cell\s+(?:vendor|supplier)|vendor)\s*[:\-–]?\s*$", re.IGNORECASE),
    "wp": re.compile(r"^\s*(?:W\s*p|watt\s*peak|module\s+(?:rating|wattage))\s*[:\-–]?\s*$", re.IGNORECASE),
}


def _document_blocks(content: bytes) -> Iterable[str]:
    """Yield paragraph/cell text in document order, including text split across runs."""
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        xml = archive.read("word/document.xml")
    root = ElementTree.fromstring(xml)
    namespace = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    for element in root.iter():
        if element.tag not in {f"{namespace}p", f"{namespace}tc"}:
            continue
        parts = [node.text or "" for node in element.iter(f"{namespace}t")]
        text = "".join(parts).strip()
        if text:
            yield text


def extract_docx_metadata(content: bytes) -> Dict[str, Optional[str]]:
    result: Dict[str, Optional[str]] = {"po_number": None, "cell_vendor": None, "wp": None}
    blocks = list(dict.fromkeys(_document_blocks(content)))
    for index, block in enumerate(blocks):
        candidates = [block, re.sub(r"\s+", " ", block).strip()]
        for field, pattern in FIELD_PATTERNS.items():
            if result[field] is not None:
                continue
            for candidate in candidates:
                match = pattern.search(candidate)
                if match:
                    value = match.group(1).strip()
                    if value:
                        result[field] = value
                        break
            if result[field] is None and LABEL_ONLY_PATTERNS[field].match(candidates[-1]) and index + 1 < len(blocks):
                value = blocks[index + 1].strip()
                if value:
                    result[field] = value
    return result
