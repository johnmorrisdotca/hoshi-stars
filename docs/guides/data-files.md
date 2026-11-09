---
title: Data files
section: how-to
order: 30
description: Download the tables as CSV or Parquet and use them in other languages.
---

[日本語](ja/data-files.md)


Download `hoshi-stars-data-v<version>.zip` or the individual files from a GitHub Release. Each table has a UTF-8 CSV, a Parquet file and a `<table>.schema.json`. `SHA256SUMS` lists SHA-256 hashes; `LICENCE-DATA.md` gives the complete credits and source terms. The package code is MIT; the data keeps each source's own terms. The Yale GCTP and Roman boundary notices say no licence is stated: do not mistake that for an explicit permission. See `LICENCE-DATA.md` before redistribution.

| Table | Contents |
| --- | --- |
| `stars` | HR number, English and Japanese names, designation, constellation, J2000 coordinates, magnitude, colour index, spectral class, proper motion and parallax. |
| `nearby-stars` | GCTP and other identifiers, names, J2000 coordinates and source, position error, parallax and error, distance and error, proper motion, magnitude, spectral type and quality flags. |
| `constellations` | IAU abbreviation, Latin name and genitive, English name, Japanese name and reading. |
| `constellation-lines` | Constellation abbreviation, chain and position (both one-based), and HR number. Join successive positions in each chain. |
| `boundaries` | Roman table order, lower and upper right ascension in hours, lower declination in degrees and constellation abbreviation; frame B1875. |
| `messier`, `ngc-ic` | Catalogue identifiers and aliases, name, type, constellation, J2000 coordinates, visual magnitude and angular size. |
| `star-names` | HR number and English and Japanese names. |

The schema lists every column's type, unit, meaning and source. Positions are degrees unless a schema says otherwise; proper motion is milliarcseconds per year. CSV uses `\N` for missing values. The `aliases` and `otherIds` fields are JSON arrays encoded as strings. A missing value is not zero. Nearby-star uncertainties and flags should be retained when using distances.

The following non-JavaScript examples are **untested**; run them from the folder containing the downloaded files.

Python with pandas:

```text
import pandas as pd
stars = pd.read_csv("stars.csv", na_values=[r"\N"])
nearby = pd.read_parquet("nearby-stars.parquet")
```

Python with polars:

```text
import polars as pl
stars = pl.read_csv("stars.csv", null_values=r"\N")
nearby = pl.read_parquet("nearby-stars.parquet")
```

R with arrow:

```text
library(arrow)
stars <- read_parquet("stars.parquet")
```

Rust with the Apache Arrow `parquet` crate and its `arrow` feature:

```text
use std::fs::File;
use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;
let file = File::open("stars.parquet").unwrap();
let batches = ParquetRecordBatchReaderBuilder::try_new(file).unwrap().build().unwrap();
for batch in batches { println!("{}", batch.unwrap().num_rows()); }
```
