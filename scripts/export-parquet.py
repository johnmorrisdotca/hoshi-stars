#!/usr/bin/env python3
"""Convert the exported CSV tables using their declared Arrow types."""
import hashlib
import json
import pathlib
import sys

import pyarrow as pa
import pyarrow.csv as csv
import pyarrow.parquet as parquet

TYPES = {"string": pa.string(), "integer": pa.int64(), "number": pa.float64(), "boolean": pa.bool_()}


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: export-parquet.py <directory>")
    root = pathlib.Path(sys.argv[1])
    schemas = sorted(root.glob("*.schema.json"))
    if not schemas:
        raise SystemExit("no schemas found")
    for schema_file in schemas:
        schema = json.loads(schema_file.read_text(encoding="utf-8"))
        columns = schema["columns"]
        arrow_schema = pa.schema([pa.field(col["name"], TYPES[col["type"]]) for col in columns])
        table = csv.read_csv(root / (schema["table"] + ".csv"), convert_options=csv.ConvertOptions(
            column_types=arrow_schema, null_values=[schema["null"]], strings_can_be_null=True,
            quoted_strings_can_be_null=False,
        ))
        if table.column_names != arrow_schema.names or table.num_rows != schema["rows"]:
            raise ValueError(f"{schema_file}: columns or row count differ")
        parquet.write_table(table, root / (schema["table"] + ".parquet"))
    files = sorted(p for p in root.rglob("*") if p.is_file() and p.name != "SHA256SUMS" and p.suffix in {".csv", ".json", ".parquet", ".md", ".svg"})
    (root / "SHA256SUMS").write_text("".join(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.relative_to(root).as_posix()}\n" for path in files), encoding="utf-8")


if __name__ == "__main__":
    main()
