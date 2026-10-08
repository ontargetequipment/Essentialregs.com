# Source text check: stored text vs. source PDF text (letters and digits)

Word-level diff of each document's stored text against the body of its pdftotext source. A difference with identical letters and digits is *spacing* (free); a table difference with the same letters as a multiset is *table layout* (free); the rest are *extraction differences*, each either known (reason given) or **unknown** (fails).

| reg | corpus words | source words | equal | spacing | table layout | extraction | unknown |
|---|---|---|---|---|---|---|---|
| oooo | 34618 | 34618 | 34033 | 0 | 1 | 0 | **0** |

## oooo

### Table layout differences (same letters, different cell order): 1

- `sec-oooo-TABLE-1` (source line ~3802): corpus `Table 1 to Subpart OOOO of Part 60 Required Minimum Initial SO2 Emission Reducti` / pdf `Table 1 to Subpart OOOO of Part 60 Required Minimum Initial SO2 Emission Reducti`

