# Sprint 3 re-import dry run: old parse vs new parse

Produced by comparing `import_ccr.py parse` output at the merge base (old) with this branch (new), same sources, same corpus id index. Nothing here touched the database.

## Per document

| reg | rows | changed rows | rows with link changes | new links | equation | [sic] | table | spacing | TEXT | new/removed rows |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 344 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| 10 | 79 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| 11 | 715 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| 12 | 455 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| 15 | 36 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| 16 | 71 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| 18 | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| 19 | 731 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| 2 | 310 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| 20 | 327 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| 21 | 509 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| 22 | 344 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| 23 | 221 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| 24 | 415 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| 25 | 993 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| 26 | 626 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| 27 | 413 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| 28 | 282 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| 29 | 51 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| 3 | 2065 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| 30 | 444 | 2 | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| 31 | 757 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| 4 | 348 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| 6 | 462 | 25 | 5 | 14 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| 7 | 2182 | 13 | 13 | 76 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| 8 | 1340 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| 9 | 217 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| aqs | 80 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| cp | 220 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| ecmc | 6754 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| gp01 | 103 | 11 | 2 | 4 | 0 | 1 | 2 | 8 | 2 | 0/0 |
| gp02 | 210 | 6 | 3 | 13 | 0 | 1 | 2 | 0 | 3 | 0/0 |
| gp03 | 59 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| gp05 | 111 | 5 | 1 | 2 | 0 | 0 | 2 | 1 | 4 | 0/0 |
| gp06 | 174 | 2 | 0 | 0 | 2 | 1 | 0 | 0 | 0 | 0/0 |
| gp07 | 124 | 1 | 1 | 2 | 0 | 0 | 1 | 0 | 1 | 0/0 |
| gp08 | 119 | 2 | 1 | 2 | 0 | 0 | 4 | 0 | 0 | 0/0 |
| gp09 | 251 | 6 | 4 | 4 | 0 | 0 | 2 | 0 | 1 | 0/0 |
| gp10 | 254 | 5 | 4 | 4 | 0 | 0 | 0 | 0 | 1 | 0/0 |
| gp11 | 129 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| gp12 | 541 | 13 | 5 | 9 | 2 | 3 | 3 | 0 | 3 | 1/0 |
| proc | 791 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |
| sip | 173 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 |

Totals: {'changed rows': 91, 'links': 41, 'markup only': 20, '[sic]': 6, 'spacing': 9, 'table header': 11, 'TEXT': 15, 'table added': 5, 'equation': 4, 'new row': 1}

## New federal-reference links per document and target

| reg | jjjj | iiii | zzzz | ooooa | oooob | ooooc | other |
|---|---|---|---|---|---|---|---|
| 30 | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| 6 | 5 | 9 | 0 | 0 | 0 | 0 | 0 |
| 7 | 12 | 7 | 9 | 38 | 8 | 2 | 0 |
| gp01 | 0 | 0 | 0 | 0 | 0 | 0 | 4 |
| gp02 | 8 | 0 | 0 | 0 | 0 | 0 | 5 |
| gp05 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| gp07 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| gp08 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| gp09 | 1 | 0 | 1 | 1 | 1 | 0 | 0 |
| gp10 | 1 | 0 | 1 | 1 | 1 | 0 | 0 |
| gp12 | 8 | 1 | 0 | 0 | 0 | 0 | 0 |

## Every new link

| reg | provision | link text | href | n |
|---|---|---|---|---|
| 30 | `sec-30-B-III-D-2-c-(iii)-(D)` | MACT ZZZZ | `/regulations/zzzz` | 1 |
| 30 | `sec-30-C-III` | NSPS JJJJ | `/regulations/jjjj` | 1 |
| 6 | `sec-6-A-XXIV` | 40 C.F.R. Part 60, Subpart IIII | `/regulations/iiii` | 1 |
| 6 | `sec-6-A-XXX` | 40 C.F.R. Part 60, Subpart IIII | `/regulations/iiii` | 1 |
| 6 | `sec-6-B-I-C-1` | 40 CFR Part 60, Subparts IIII | `/regulations/iiii` | 1 |
| 6 | `sec-6-B-I-C-2-b` | 40 CFR Part 60, Subparts IIII | `/regulations/iiii` | 1 |
| 6 | `sec-6-B-IX-G` | NSPS IIII | `/regulations/iiii` | 5 |
| 6 | `sec-6-B-IX-G` | NSPS JJJJ | `/regulations/jjjj` | 5 |
| 7 | `sec-7-C-O` | NSPS IIII | `/regulations/iiii` | 1 |
| 7 | `sec-7-C-O` | NSPS JJJJ | `/regulations/jjjj` | 1 |
| 7 | `sec-7-C-O` | NSPS OOOOa | `/regulations/ooooa` | 6 |
| 7 | `sec-7-C-O` | MACT ZZZZ | `/regulations/zzzz` | 1 |
| 7 | `sec-7-C-O` | NESHAP ZZZZ | `/regulations/zzzz` | 1 |
| 7 | `sec-7-C-P` | NSPS OOOOa | `/regulations/ooooa` | 5 |
| 7 | `sec-7-C-Q` | NSPS IIII | `/regulations/iiii` | 1 |
| 7 | `sec-7-C-Q` | NSPS JJJJ | `/regulations/jjjj` | 1 |
| 7 | `sec-7-C-Q` | NSPS OOOOa | `/regulations/ooooa` | 1 |
| 7 | `sec-7-C-Q` | MACT ZZZZ | `/regulations/zzzz` | 1 |
| 7 | `sec-7-C-S` | NSPS IIII | `/regulations/iiii` | 1 |
| 7 | `sec-7-C-S` | NSPS JJJJ | `/regulations/jjjj` | 1 |
| 7 | `sec-7-C-S` | NSPS OOOOa | `/regulations/ooooa` | 4 |
| 7 | `sec-7-C-S` | MACT ZZZZ | `/regulations/zzzz` | 1 |
| 7 | `sec-7-C-T` | NESHAP JJJJ | `/regulations/jjjj` | 1 |
| 7 | `sec-7-C-T` | NSPS JJJJ | `/regulations/jjjj` | 3 |
| 7 | `sec-7-C-T` | NSPS OOOOa | `/regulations/ooooa` | 5 |
| 7 | `sec-7-C-T` | NESHAP ZZZZ | `/regulations/zzzz` | 1 |
| 7 | `sec-7-C-U-7` | NSPS IIII | `/regulations/iiii` | 1 |
| 7 | `sec-7-C-U-7` | NSPS JJJJ | `/regulations/jjjj` | 2 |
| 7 | `sec-7-C-U-7` | NSPS OOOOa | `/regulations/ooooa` | 2 |
| 7 | `sec-7-C-U-7` | MACT ZZZZ | `/regulations/zzzz` | 1 |
| 7 | `sec-7-C-V` | NSPS OOOOa | `/regulations/ooooa` | 2 |
| 7 | `sec-7-C-X` | NSPS OOOOa | `/regulations/ooooa` | 6 |
| 7 | `sec-7-C-Z-7` | NSPS IIII | `/regulations/iiii` | 1 |
| 7 | `sec-7-C-Z-7` | NSPS JJJJ | `/regulations/jjjj` | 1 |
| 7 | `sec-7-C-Z-7` | NSPS OOOOa | `/regulations/ooooa` | 1 |
| 7 | `sec-7-C-Z-7` | MACT ZZZZ | `/regulations/zzzz` | 1 |
| 7 | `sec-7-C-CC-7` | NSPS IIII | `/regulations/iiii` | 1 |
| 7 | `sec-7-C-CC-7` | NSPS JJJJ | `/regulations/jjjj` | 1 |
| 7 | `sec-7-C-CC-7` | NSPS OOOOa | `/regulations/ooooa` | 1 |
| 7 | `sec-7-C-CC-7` | MACT ZZZZ | `/regulations/zzzz` | 1 |
| 7 | `sec-7-C-EE` | NSPS OOOOa | `/regulations/ooooa` | 2 |
| 7 | `sec-7-C-EE` | NSPS OOOOb | `/regulations/oooob` | 4 |
| 7 | `sec-7-C-EE` | 40 C.F.R. Part 60, Subpart OOOOc | `/regulations/ooooc` | 1 |
| 7 | `sec-7-C-GG` | NSPS IIII | `/regulations/iiii` | 1 |
| 7 | `sec-7-C-GG` | NSPS JJJJ | `/regulations/jjjj` | 1 |
| 7 | `sec-7-C-GG` | NSPS OOOOa | `/regulations/ooooa` | 1 |
| 7 | `sec-7-C-GG` | NSPS OOOOb | `/regulations/oooob` | 1 |
| 7 | `sec-7-C-GG` | MACT ZZZZ | `/regulations/zzzz` | 1 |
| 7 | `sec-7-C-HH` | NSPS OOOOa | `/regulations/ooooa` | 2 |
| 7 | `sec-7-C-HH` | NSPS OOOOb | `/regulations/oooob` | 3 |
| 7 | `sec-7-C-HH` | 40 C.F.R. Part 60, Subpart OOOOc | `/regulations/ooooc` | 1 |
| gp01 | `sec-gp01-IV-C-3` | Regulation Number 7 | `/regulations/7` | 1 |
| gp01 | `sec-gp01-IV-C-3` | Part B | `/regulations/7#sec-7-P-B` | 1 |
| gp01 | `sec-gp01-VI-C` | Section I.C.1. | `/regulations/7#sec-7-B-I-C-1` | 1 |
| gp01 | `sec-gp01-VI-C` | II.B.2. | `/regulations/7#sec-7-B-II-B-2` | 1 |
| gp02 | `sec-gp02-ATTACHMENT-A` | Regulation Number 3 | `/regulations/3` | 3 |
| gp02 | `sec-gp02-ATTACHMENT-A` | Part B | `/regulations/3#sec-3-P-B` | 1 |
| gp02 | `sec-gp02-ATTACHMENT-A` | Part D | `/regulations/3#sec-3-P-D` | 1 |
| gp02 | `sec-gp02-ATTACHMENT-A-5-1` | NSPS JJJJ | `/regulations/jjjj` | 3 |
| gp02 | `sec-gp02-ATTACHMENT-A-5-9` | NSPS JJJJ | `/regulations/jjjj` | 5 |
| gp05 | `sec-gp05-IV-B-4` | Regulation Number 7 | `/regulations/7` | 1 |
| gp05 | `sec-gp05-IV-B-4` | Part B | `/regulations/7#sec-7-P-B` | 1 |
| gp07 | `sec-gp07-IV-C-2` | Regulation Number 7 | `/regulations/7` | 1 |
| gp07 | `sec-gp07-IV-C-2` | Part B | `/regulations/7#sec-7-P-B` | 1 |
| gp08 | `sec-gp08-IV-C` | Regulation Number 7 | `/regulations/7` | 1 |
| gp08 | `sec-gp08-IV-C` | Part B | `/regulations/7#sec-7-P-B` | 1 |
| gp09 | `sec-gp09-IV-A-3-c` | NSPS JJJJ | `/regulations/jjjj` | 1 |
| gp09 | `sec-gp09-IV-A-3-f` | NSPS OOOOa | `/regulations/ooooa` | 1 |
| gp09 | `sec-gp09-IV-A-3-g` | NSPS OOOOb | `/regulations/oooob` | 1 |
| gp09 | `sec-gp09-IV-A-3-j` | MACT ZZZZ | `/regulations/zzzz` | 1 |
| gp10 | `sec-gp10-IV-A-3-c` | NSPS JJJJ | `/regulations/jjjj` | 1 |
| gp10 | `sec-gp10-IV-A-3-f` | NSPS OOOOa | `/regulations/ooooa` | 1 |
| gp10 | `sec-gp10-IV-A-3-g` | NSPS OOOOb | `/regulations/oooob` | 1 |
| gp10 | `sec-gp10-IV-A-3-j` | MACT ZZZZ | `/regulations/zzzz` | 1 |
| gp12 | `sec-gp12-ATTACHMENT-A-7-1-2-1` | NSPS JJJJ | `/regulations/jjjj` | 1 |
| gp12 | `sec-gp12-ATTACHMENT-A-7-1-2-2` | NSPS JJJJ | `/regulations/jjjj` | 1 |
| gp12 | `sec-gp12-ATTACHMENT-A-7-1-2-3` | NSPS JJJJ | `/regulations/jjjj` | 1 |
| gp12 | `sec-gp12-ATTACHMENT-A-7-9-3` | NSPS JJJJ | `/regulations/jjjj` | 5 |
| gp12 | `sec-gp12-ATTACHMENT-B-7-1-2` | NSPS IIII | `/regulations/iiii` | 1 |

## Other changed rows (equations, [sic], tables, spacing, text)

- **gp01** `sec-gp01-II-A-1`: [sic]
- **gp01** `sec-gp01-II-A-2`: spacing
  - old: `For facilities located within the boundaries of an ozone nonattainment area (for reclassifications of an existing nonattainment area, the limit applies for the `
  - new: `For facilities located within the boundaries of an ozone nonattainment area (for reclassifications of an existing nonattainment area, the limit applies for the `
- **gp01** `sec-gp01-II-C-4`: spacing
  - old: `The o w n e r o r o p e r a t o r must follow the Operating and Maintenance / Recordkeeping a n d R e p o r t i n g specified in Sections IV and V. (Reference: `
  - new: `The owner or operator must follow the Operating and Maintenance / Recordkeeping and Reporting specified in Sections IV and V. (Reference: Regulation Number 3, P`
- **gp01** `sec-gp01-III-A`: spacing
  - old: `Provided that there are no emissions increases, and the emission limits set forth in Section II.A and Section II.B. are still met, the o w n e r o r o p e r a t`
  - new: `Provided that there are no emissions increases, and the emission limits set forth in Section II.A and Section II.B. are still met, the owner or operator may inv`
- **gp01** `sec-gp01-III-B`: spacing
  - old: `The o w n e r o r o p e r a t o r must maintain a log to contemporaneously record the date and description of any change made under the provisions of this AOS. `
  - new: `The owner or operator must maintain a log to contemporaneously record the date and description of any change made under the provisions of this AOS. (Reference: `
- **gp01** `sec-gp01-IV-C-3`: links, table header, TEXT
  - old: `The owner or operator must commence monitoring the pilot light/auto-igniter and visible emissions observation and document the proper operation of the control d`
  - new: `The owner or operator must commence monitoring the pilot light/auto-igniter and visible emissions observation and document the proper operation of the control d`
- **gp01** `sec-gp01-VI-C`: links, spacing
  - old: `Control devices used to comply with Regulation Number 7, Part B, Sections I.D.3. and II.D.2. must be a combustion device or a vapor recovery unit and must meet `
  - new: `Control devices used to comply with Regulation Number 7, Part B, Sections I.D.3. and II.D.2. must be a combustion device or a vapor recovery unit and must meet `
- **gp01** `sec-gp01-VI-D`: table header, TEXT
  - old: `At the frequency specified in Table 2, the owner or operator of storage tanks utilizing site-specific emission factors must complete site-specific sampling as n`
  - new: `At the frequency specified in Table 2, the owner or operator of storage tanks utilizing site-specific emission factors must complete site-specific sampling as n`
- **gp01** `sec-gp01-VIII-C-3`: spacing
  - old: `Sources covered by this General Permit are subject to the Common Provisions Regulation Part II, Subpart E, Upset Conditions and Breakdowns. The o w n e r o r o `
  - new: `Sources covered by this General Permit are subject to the Common Provisions Regulation Part II, Subpart E, Upset Conditions and Breakdowns. The owner or operato`
- **gp01** `sec-gp01-VIII-E-3`: spacing
  - old: `If a revised general permit is issued by the Division, any existing registration to use the general permit will be automatically converted to a registration to `
  - new: `If a revised general permit is issued by the Division, any existing registration to use the general permit will be automatically converted to a registration to `
- **gp01** `sec-gp01-IX-B`: spacing
  - old: `The o w n e r o r o p e r a t o r must maintain documentation clearly outlining applicable requirements of New Source Performance Standard (NSPS) Subpart OOOO, `
  - new: `The owner or operator must maintain documentation clearly outlining applicable requirements of New Source Performance Standard (NSPS) Subpart OOOO, OOOOa, or OO`
- **gp02** `sec-gp02-II-B-3`: TEXT
  - old: `Engines registered to operate in accordance with the provisions of this general permit shall be subject to and shall not exceed the emissions standards containe`
  - new: `Engines registered to operate in accordance with the provisions of this general permit shall be subject to and shall not exceed the emissions standards containe`
- **gp02** `sec-gp02-II-B-4`: TEXT
  - old: `Engines registered to operate in accordance with the provisions of this general permit with emissions from natural gas fired RICE that are greater than or equal`
  - new: `Engines registered to operate in accordance with the provisions of this general permit with emissions from natural gas fired RICE that are greater than or equal`
- **gp02** `sec-gp02-ATTACHMENT-A`: links, TEXT
  - old: `Attachment A: 2/14/2024`
  - new: `Attachment A: 2/14/2024Alternative Operating ScenariosThe following Alternative Operating Scenario (AOS) for the temporary and permanent replacement of natural `
- **gp02** `sec-gp02-ATTACHMENT-A-5-3`: [sic], table header, table added
  - old: `Regulation Number 26, Part B, Section I.D.3 – New, Modified and Relocated Natural Gas Fired Reciprocating Internal Combustion Engines (State Only)A natural gas-`
  - new: `Regulation Number 26, Part B, Section I.D.3 – New, Modified and Relocated Natural Gas Fired Reciprocating Internal Combustion Engines (State Only)A natural gas-`
- **gp05** `sec-gp05-IV-B-4`: links, table header, TEXT
  - old: `The owner or operator must commence monitoring the pilot light/auto- igniter and visible emissions observation and document the proper operation of the control `
  - new: `The owner or operator must commence monitoring the pilot light/auto- igniter and visible emissions observation and document the proper operation of the control `
- **gp05** `sec-gp05-VI-D`: table header, TEXT
  - old: `At the frequency specified in Table 2, the owner or operator of storage tanks utilizing site-specific emission factors must complete site-specific sampling as n`
  - new: `At the frequency specified in Table 2, the owner or operator of storage tanks utilizing site-specific emission factors must complete site-specific sampling as n`
- **gp05** `sec-gp05-VIII-C-1`: TEXT
  - old: `A revised APEN must be filed: (Reference: Regulation Number 3, Part A, Section II.C.)VIII.C.1.a.Annually by April 30th of the year following a significant incre`
  - new: `A revised APEN must be filed: (Reference: Regulation Number 3, Part A, Section II.C.)`
- **gp05** `sec-gp05-VIII-C-1-a`: TEXT
  - old: `VIII.C.1.a.`
  - new: `Annually by April 30th of the year following a significant increase in emissions as follows:`
- **gp05** `sec-gp05-VIII-D-2`: spacing
  - old: `A registration under this general permit may be reissued to a new owner o r i n a n e w c o m p a n y n a m e by the Division as provided in Regulation Number 3`
  - new: `A registration under this general permit may be reissued to a new owner or in a new company name by the Division as provided in Regulation Number 3, Part B, Sec`
- **gp06** `sec-gp06-IV-C-1-b-(i)`: equation
  - old: `Emission estimates based upon hours of operation must be calculated using either Eq. 1 with the appropriate emission factor:𝑡𝑡𝑡𝑡𝑡𝑡 𝑋𝑋 𝑙𝑙𝑙𝑙 𝑏𝑏𝑏𝑏𝑏𝑏 ℎ𝑟𝑟𝑟𝑟 𝑔𝑔𝑔𝑔𝑔𝑔 E`
  - new: `Emission estimates based upon hours of operation must be calculated using either Eq. 1 with the appropriate emission factor:`
- **gp06** `sec-gp06-IV-C-1-b-(ii)`: equation, [sic]
  - old: `Emission estimates based upon fuel consumption must be calculated using either Eq. 2 with the appropriate emission factor: 𝒕𝒕𝒕𝒕𝒕𝒕 𝑿𝑿 𝒍𝒍𝒍𝒍 𝒃𝒃𝒃𝒃𝒃𝒃 𝒈𝒈𝒈𝒈𝒈𝒈 𝟏𝟏 𝒕𝒕𝒕𝒕𝒕`
  - new: `Emission estimates based upon fuel consumption must be calculated using either Eq. 2 with the appropriate emission factor:`
- **gp07** `sec-gp07-IV-C-2`: links, table header, TEXT
  - old: `The owner or operator must commence monitoring the pilot light/auto- igniter and visible emissions observation and document the proper operation of the control `
  - new: `The owner or operator must commence monitoring the pilot light/auto- igniter and visible emissions observation and document the proper operation of the control `
- **gp08** `sec-gp08-IV-C`: links, table header, table added
  - old: `The owner or operator must commence monitoring the pilot light/auto-igniter and visible emissions observation and document the proper operation of the control d`
  - new: `The owner or operator must commence monitoring the pilot light/auto-igniter and visible emissions observation and document the proper operation of the control d`
- **gp08** `sec-gp08-VI-D`: table header, table added
  - old: `At the frequency specified in Table 2, the owner or operator of storage tanks utilizing site-specific emission factors must complete site-specific sampling as n`
  - new: `At the frequency specified in Table 2, the owner or operator of storage tanks utilizing site-specific emission factors must complete site-specific sampling as n`
- **gp09** `sec-gp09-IV-B-2`: table header, table added
  - old: `The owner or operator of natural gas fired reciprocating internal combustion engines that are greater than or equal to 100 hp and constructed in or relocated to`
  - new: `The owner or operator of natural gas fired reciprocating internal combustion engines that are greater than or equal to 100 hp and constructed in or relocated to`
- **gp09** `sec-gp09-VI-A-2`: TEXT
  - old: `For emission sources registered to this general permit, the owner or operator must maintain monthly process records used to support monthly actual emissions cal`
  - new: `For emission sources registered to this general permit, the owner or operator must maintain monthly process records used to support monthly actual emissions cal`
- **gp10** `sec-gp10-VI-A-2`: TEXT
  - old: `For emission sources registered to this general permit, the owner or operator must maintain monthly process records used to support monthly actual emissions cal`
  - new: `For emission sources registered to this general permit, the owner or operator must maintain monthly process records used to support monthly actual emissions cal`
- **gp12** `sec-gp12-III-F-3`: equation
  - old: `for engines placed in service on or after the issuance date of Issuance 1 of this permit, the owner or operator must use the fuel gas heat content obtained from`
  - new: `for engines placed in service on or after the issuance date of Issuance 1 of this permit, the owner or operator must use the fuel gas heat content obtained from`
- **gp12** `sec-gp12-IV-A-6-b`: equation
  - old: `Engines placed in service before the issuance date of Issuance 1 of this permit: The owner or operator must maintain monthly records of hours of operation. The `
  - new: `Engines placed in service before the issuance date of Issuance 1 of this permit: The owner or operator must maintain monthly records of hours of operation. The `
- **gp12** `sec-gp12-IV-A-6-b-(i)`: [sic]
- **gp12** `sec-gp12-VI-E-5-h`: TEXT
  - old: `Visual inspections of air pollution control equipment must follow the schedule below:Table 2 - ECD monitoring frequencyArea classificationPermitted facility- wi`
  - new: `Visual inspections of air pollution control equipment must follow the schedule below:Table 2 - ECD monitoring frequencyArea classificationPermitted facility- wi`
- **gp12** `sec-gp12-VII-C-1`: [sic]
- **gp12** `sec-gp12-VII-C-2-c-(ii)`: TEXT
  - old: `a site-specific sampling including a compositional analysis of the pre-flash pressurized condensate, crude oil, intermediate hydrocarbons, or produced water rou`
  - new: `a site-specific sampling including a compositional analysis of the pre-flash pressurized condensate, crude oil, intermediate hydrocarbons, or produced water rou`
- **gp12** `sec-gp12-VIII-H`: table header, table added
  - old: `The owner or operator of facilities not subject to Condition I.F must track and keep records of potential emissions from all insignificant activities at the sta`
  - new: `The owner or operator of facilities not subject to Condition I.F must track and keep records of potential emissions from all insignificant activities at the sta`
- **gp12** `sec-gp12-ATTACHMENT-A-7-3-1`: [sic], table header, TEXT
  - old: `A natural gas-fired reciprocating internal combustion engines that is either constructed or relocated to the state of Colorado from another state after the date`
  - new: `A natural gas-fired reciprocating internal combustion engines that is either constructed or relocated to the state of Colorado from another state after the date`
