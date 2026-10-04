# Source text check: stored text vs. source PDF text (letters and digits)

Word-level diff of each general permit's stored text against the body of its pdftotext source. A difference with identical letters and digits is *spacing* (free); a table difference with the same letters as a multiset is *table layout* (free); the rest are *extraction differences*, each either known (reason given) or **unknown** (fails).

| reg | corpus words | source words | equal | spacing | table layout | extraction | unknown |
|---|---|---|---|---|---|---|---|
| gp01 | 5684 | 5705 | 5374 | 0 | 2 | 0 | **0** |
| gp02 | 11787 | 11780 | 11577 | 0 | 2 | 1 | **0** |
| gp03 | 1697 | 1755 | 1697 | 0 | 0 | 1 | **0** |
| gp05 | 5575 | 5611 | 5265 | 0 | 2 | 0 | **0** |
| gp06 | 7165 | 7165 | 7165 | 0 | 0 | 0 | **0** |
| gp07 | 5794 | 5816 | 5630 | 0 | 1 | 0 | **0** |
| gp08 | 5887 | 5891 | 5583 | 0 | 1 | 1 | **0** |
| gp09 | 10539 | 10555 | 10231 | 0 | 3 | 0 | **0** |
| gp10 | 10989 | 11005 | 10681 | 0 | 3 | 0 | **0** |
| gp11 | 6190 | 6190 | 6190 | 0 | 0 | 0 | **0** |
| gp12 | 24260 | 24331 | 23618 | 0 | 8 | 0 | **0** |

## gp01

### Table layout differences (same letters, different cell order): 2

- `sec-gp01-IV-C-3` (source line ~340): corpus `Table 1 Monitoring Frequencies Effective Date of Registration 1 Classification P` / pdf `Table 1 Monitoring Frequencies Effective Classification Permitted VOC Monitoring`
- `sec-gp01-VI-D` (source line ~507): corpus `Table 2 Sampling Frequencies Effective Date of Registration 2 Classification Per` / pdf `Table 2 Sampling Frequencies Effective Classification Permitted VOC Frequency Da`

## gp02

### Extraction differences

- `sec-gp02-ATTACHMENT-A-5-3` (source line ~1278) known: the table is printed without a caption; the importer's UNCAPTIONED_TABLES entry labels it 'Table 1 in the Part B' (the words the sentence above it uses), so those five words occur once more in the corpus than in the PDF
  - corpus: `…Table 1 in the Part B` **`table words not in the source: Table 1 in the Part B NO X`**
  - pdf: **`source words not in the table: NOX`**

### Table layout differences (same letters, different cell order): 2

- `sec-gp02-II-B-3` (source line ~274): corpus `Table 1 Emission Standards g hp hr for Rich Burn and Lean Burn Engines Engine De` / pdf `Table 1 Emission Standards g hp hr for Rich Burn and Lean Burn Engines Engine De`
- `sec-gp02-II-B-4` (source line ~301): corpus `Table 2 Emission Standards g hp hr for Rich Burn and Lean Burn Engines Maximum E` / pdf `Table 2 Emission Standards g hp hr for Rich Burn and Lean Burn Engines Maximum E`

## gp03

### Extraction differences

- `sec-gp03-I` (source line ~1) known: GP03's cover (title block, issuance, signature and the 'Note: See the Land Development General Permit Guidance document' line) precedes Condition I on page 1; every general permit's cover is outside the parsed body, and GP03 has no table of contents to put the body start after it
  - corpus: `…` **`∅`**
  - pdf: **`GENERAL CONSTRUCTION PERMIT Land Development Projects PERMIT NO GP03 FINAL APPROVAL Issuance 2 January 24 2020 R K Hancock III P E Date Issued Construction Permits Unit Supervisor Note See the Land Development General Permit Guidance document available through the Division s Small Business Assistance Program for further information on demonstrating compliance with the requirements of this permit`**

## gp05

### Table layout differences (same letters, different cell order): 2

- `sec-gp05-IV-B-4` (source line ~342): corpus `Table 1 Monitoring Frequencies Effective Date of Registration 1 Classification P` / pdf `Table 1 Monitoring Frequencies Effective Classification Permitted Monitoring Dat`
- `sec-gp05-VI-D` (source line ~516): corpus `Table 2 Sampling Frequencies Effective Date of Registration 2 Classification Per` / pdf `Table 2 Sampling Frequencies Effective Classification Permitted Frequency Date o`

## gp06

## gp07

### Table layout differences (same letters, different cell order): 1

- `sec-gp07-IV-C-2` (source line ~378): corpus `Table 1 Monitoring Frequencies Effective Date of Registration 1 Classification P` / pdf `Table 1 Monitoring Frequencies Effective Classification Permitted VOC Monitoring`

## gp08

### Extraction differences

- `sec-gp08-VI-D` (source line ~517) known: the last row of Table 2 is printed across the page break (GP08.pdf pages 17-18: 'On or after' / 'Issuance 4', 'Severe Ozone Non-' / 'Attainment', 'Greater than or' / 'equal to 15 TPY'); pdfplumber returns the two halves as two rows, as printed, and the page-18 half falls outside the span this check anchors for the table
  - corpus: `…the Division for inspection upon request` **`table words not in the source: to Issuance 4 Attainment TPY equal 15`**
  - pdf: **`source words not in the table: `**

### Table layout differences (same letters, different cell order): 1

- `sec-gp08-IV-C` (source line ~359): corpus `Table 1 Monitoring Frequencies Effective Date of Registration 1 Classification P` / pdf `Table 1 Monitoring Frequencies Effective Classification Permitted VOC Monitoring`

## gp09

### Table layout differences (same letters, different cell order): 3

- `sec-gp09-IV-B-1` (source line ~472): corpus `Table 1 Emission Standards g hp hr for Rich Burn and Lean Burn Engines Engine De` / pdf `Table 1 Emission Standards g hp hr for Rich Burn and Lean Burn Engines Engine De`
- `sec-gp09-IV-B-2` (source line ~503): corpus `Table 2 Emission Standards g hp hr for Rich Burn and Lean Burn Engines Maximum E` / pdf `Table 2 Emission Standards g hp hr for Rich Burn and Lean Burn Engines Maximum C`
- `sec-gp09-VI-A-2` (source line ~1225): corpus `Table 5 Summary of monthly records requirements per emission source Emission Sou` / pdf `Table 5 Summary of monthly records requirements per emission source Emission Sou`

## gp10

### Table layout differences (same letters, different cell order): 3

- `sec-gp10-IV-B-1` (source line ~520): corpus `Table 1 Emission Standards g hp hr for Rich Burn and Lean Burn Engines Engine De` / pdf `Table 1 Emission Standards g hp hr for Rich Burn and Lean Burn Engines Engine De`
- `sec-gp10-IV-B-2` (source line ~550): corpus `Table 2 Emission Standards g hp hr for Rich Burn and Lean Burn Engines Maximum E` / pdf `Table 2 Emission Standards g hp hr for Rich Burn and Lean Burn Engines Construct`
- `sec-gp10-VI-A-2` (source line ~1274): corpus `Table 5 Summary of monthly records requirements per emission source Emission Sou` / pdf `Table 5 Summary of monthly records requirements per emission source Emission Sou`

## gp11

## gp12

### Table layout differences (same letters, different cell order): 8

- `sec-gp12-V-M-1` (source line ~722): corpus `Table 1 Emission Standards g hp hr for Rich Burn and Lean Burn Engines Engine De` / pdf `Table 1 Emission Standards g hp hr for Rich Burn and Lean Burn Engines Engine De`
- `sec-gp12-VI-E-5-h` (source line ~978): corpus `Table 2 ECD monitoring frequency Area classification Permitted facility wide VOC` / pdf `Table 2 ECD monitoring frequency Permitted facility Area classification Monitori`
- `sec-gp12-VI-F-5-f-(iii)` (source line ~1180): corpus `Table 3 Portable analyzer testing NOx and CO thresholds Area classification NOx ` / pdf `Table 3 Portable analyzer testing NOx and CO thresholds NOx monitoring CO monito`
- `sec-gp12-VI-G-6-c` (source line ~1273): corpus `Table 4 Portable analyzer testing NOx and CO thresholds Area classification NOx ` / pdf `Table 4 Portable analyzer testing NOx and CO thresholds NOx monitoring CO monito`
- `sec-gp12-VII-C-2-c-(ii)` (source line ~1482): corpus `Table 5 Sampling frequency Area classification Facility wide permitted VOC emiss` / pdf `Table 5 Sampling frequency Sampling frequency for Facility wide storage tanks Sa`
- `sec-gp12-VII-G-3` (source line ~1710): corpus `Table 6 Sampling and testing frequency Source type Minor sources Synthetic minor` / pdf `Table 6 Sampling and testing frequency Major sources Synthetic minor Source type`
- `sec-gp12-VIII-H` (source line ~1788): corpus `Table 7 EPA Ozone Classification Thresholds Criteria Pollutant Ozone attainment ` / pdf `Table 7 EPA Ozone Classification Thresholds Moderate Serious Severe Extreme Ozon`
- `sec-gp12-ATTACHMENT-A-7-3-1` (source line ~2613): corpus `Table 8 Table 1 from Regulation Number 26 Part B Max Engine HP Construction or R` / pdf `Table 8 Table 1 from Regulation Number 26 Part B Max Engine Construction or NOX `

