#!/usr/bin/env python3
"""Mescla fichas verificadas no cadastro interno sem alterar a oferta da loja."""
import argparse
import json
import os
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
IDENTITY = ("id", "sku", "slug")
RESEARCH = (
    "name", "category", "summary", "description", "fabric", "composition",
    "fit", "measurements", "sizeGuide", "care", "source",
)
MERCHANT_DEFAULTS = {
    "status": "draft", "images": [], "variants": [], "priceCents": None,
    "shipping": None,
}


def load_rows(path):
    with path.open(encoding="utf-8") as file:
        rows = json.load(file)
    if not isinstance(rows, list):
        raise ValueError(f"{path}: esperado um array de cadastros")
    return rows


def key_for(item):
    page = urlsplit(item["source"]["url"])
    if page.scheme != "https" or not page.hostname:
        raise ValueError(f"Origem inválida para {item.get('sku')}")
    return page.hostname.lower().removeprefix("www."), page.path.rstrip("/")


def validate_unique(rows):
    for key, getter in [(name, lambda r, n=name: r[n]) for name in IDENTITY] + [("origem", key_for)]:
        seen = set()
        for row in rows:
            value = getter(row)
            if not value or value in seen:
                raise ValueError(f"{key} ausente ou duplicado: {value!r}")
            seen.add(value)


def merge(existing, incoming):
    validate_unique(existing)
    validate_unique(incoming)
    by_origin = {key_for(row): row for row in existing}
    for source_row in incoming:
        key = key_for(source_row)
        if key in by_origin:
            item = by_origin[key]
            if any(item[field] != source_row[field] for field in IDENTITY):
                raise ValueError(f"Identidade conflitante na origem de {source_row['sku']}")
            item.update({field: source_row[field] for field in RESEARCH})
        else:
            # Uma coleta externa nunca inicia vendas, cria variantes ou aprova preços.
            item = {field: source_row[field] for field in IDENTITY + RESEARCH}
            item.update(MERCHANT_DEFAULTS)
            proposal = source_row.get("pricingProposal")
            if proposal:
                item["pricingProposal"] = {**proposal, "approved": False}
            existing.append(item)
            by_origin[key] = item
    validate_unique(existing)
    return existing


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="JSON com o lote revisado")
    parser.add_argument("--destino", type=Path, default=ROOT / "data" / "curadoria.json")
    args = parser.parse_args()
    existing = load_rows(args.destino) if args.destino.exists() else []
    incoming = load_rows(args.source)
    result = merge(existing, incoming)
    data = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if not args.destino.exists() or args.destino.read_text(encoding="utf-8") != data:
        args.destino.parent.mkdir(parents=True, exist_ok=True)
        with NamedTemporaryFile(mode="w", encoding="utf-8", dir=args.destino.parent, delete=False) as f:
            f.write(data)
            temp_path = f.name
        os.replace(temp_path, args.destino)
    print(f"{len(incoming)} fichas verificadas. Cadastro final: {len(result)} itens.")


if __name__ == "__main__":
    main()
