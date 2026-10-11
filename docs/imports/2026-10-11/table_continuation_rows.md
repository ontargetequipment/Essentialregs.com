# Table continuation rows: every changed table, before and after (11 Oct 2026)

`pipeline/table_rows.py` (Sprint 7, PR 1). Both trees parsed all 58 documents
from the committed sources: `main` at 1bceb6e (before) and this branch
(after). 16 tables in 16 provisions of 12 documents changed; nothing else
changed in any document: every other field is identical, the text outside the
tables is identical, and each changed row has the same words (a multiset
check). The 16 "before" rows match production byte for byte (md5 of
`full_text`, 11 Oct 2026).

The regex query in the brief (a `<tr>` with an empty plain `<td>`) found 68
provisions in 29 documents. The other 52 provisions are legitimate blank
cells, which the rule leaves alone: a horsepower class spanned over two
construction dates (GP02, GP12 Attachment A; Regulation 26 Part B), a
category row with no limit of its own (Regulation 21 II.F "Specialty
coatings", "Shellacs"), a units or sub-header row (49 CFR 192.327(a)
"Inches (Millimeters)", Regulation 26 "Percent (%) of engines ...",
Regulation 8 "1 year / 3 years / 5 years"), and every table read from the
eCFR XML (IIII, JJJJ, OOOO, ZZZZ, 49 CFR 192/194/195), whose blank cells are
as published.

"Body rows" counts the rows under the header row.

| reg | provision | table | body rows before | body rows after | header cols before | after |
|---|---|---|---|---|---|---|
| 11 | sec-11-H-APPENDIX-A-2.11-F | 1 | 11 | 10 | 3 | 3 |
| 21 | sec-21-A-II-O | 1 | 179 | 176 | 3 | 3 |
| 22 | sec-22-B-I-E-1 | 1 | 51 | 39 | 4 | 4 |
| 22 | sec-22-B-I-E-2 | 1 | 11 | 8 | 8 | 8 |
| 23 | sec-23-A-IV-F-3 | 3 | 38 | 37 | 4 | 4 |
| 25 | sec-25-C-I | 1 | 32 | 26 | 6 | 6 |
| 8 | sec-8-B-II-B-2 | 1 | 5 | 3 | 4 | 4 |
| gp05 | sec-gp05-IV-B-4 | 1 | 11 | 9 | 4 | 4 |
| gp05 | sec-gp05-VI-D | 1 | 9 | 7 | 4 | 4 |
| gp08 | sec-gp08-IV-C | 1 | 10 | 9 | 4 | 4 |
| gp08 | sec-gp08-VI-D | 1 | 8 | 7 | 4 | 4 |
| gp09 | sec-gp09-VI-A-2 | 1 | 11 | 10 | 2 | 2 |
| gp12 | sec-gp12-VI-E-5-h | 1 | 10 | 9 | 3 | 3 |
| gp12 | sec-gp12-VII-C-2-c-(ii) | 1 | 10 | 9 | 4 | 4 |
| ooooa | sec-ooooa-TABLE-3 | 1 | 20 | 19 | 4 | 4 |
| ooooc | sec-ooooc-TABLE-4 | 1 | 21 | 20 | 4 | 4 |

## Problems

none

## Tables

### sec-11-H-APPENDIX-A-2.11-F (table 1): body rows 11 -> 10, header columns 3 -> 3

Before:

    | Channel | Range | Accuracy |
    | HC ppm | 0-400 | ±12ppm |
    |  | 401-1000 | ±30ppm |
    |  | 1001- | ±80ppm |
    |  | 2000 |  |
    | CO% | 0-2.00 | ±0.15% |
    |  | 2.01-5.00 | 2.040% |
    | CO2% | 04.0% | ±0.6 |
    |  | 4.1-14.0 | ±0.5% |
    |  | 14.1-16.0 | ±0.6% |
    | O2% | 0-10.0 | ±0.5% |
    |  | 0-10 | ±1.3% |

After:

    | Channel | Range | Accuracy |
    | HC ppm | 0-400 | ±12ppm |
    |  | 401-1000 | ±30ppm |
    |  | 1001- 2000 | ±80ppm |
    | CO% | 0-2.00 | ±0.15% |
    |  | 2.01-5.00 | 2.040% |
    | CO2% | 04.0% | ±0.6 |
    |  | 4.1-14.0 | ±0.5% |
    |  | 14.1-16.0 | ±0.6% |
    | O2% | 0-10.0 | ±0.5% |
    |  | 0-10 | ±1.3% |

### sec-21-A-II-O (table 1): body rows 179 -> 176, header columns 3 -> 3

Before:

    |  | Manufactured on or after May 1, 2020 | Manufactured on or after 60 days after the effective date of a finding by EPA of a failure by Colorado to attain by the severe ozone attainment date or meet an applicable milestone under the 2008 ozone NAAQS |
    | Product category | VOC content limit (percent VOCs by weight) |  |
    | Adhesive removers |  |  |
    | * Floor or wall covering | 5 |  |
    | * Gasket or thread locking | 50 |  |
    | * General purpose | 20 |  |
    | * Specialty | 70 |  |
    | Adhesives |  |  |
    | * Aerosol mist spray | 65 | 30 |
    | * Aerosol web spray | 55 | 40 |
    | * Specialty purpose spray adhesive – mounting, automotive engine compartment, and flexible vinyl | 70 |  |
    | * Specialty purpose spray adhesive – polystyrene foam and automotive headliner | 65 |  |
    | * Specialty purpose spray adhesive – polylolefin and laminate repair/edgebanding | 60 |  |
    | * Specialty purpose spray adhesive – screen printing |  | 55 |
    | * Construction, panel, and floor covering | 7 |  |
    | * Contact general purpose | 55 |  |
    | * Contact special purpose | 80 |  |
    | * General purpose | 10 |  |
    | * Structural waterproof | 15 | NA |
    | Air fresheners |  |  |
    | * Single-phase aerosol | 30 |  |
    | * Double-phase aerosol | 25 | 20 |
    | * Dual purpose air freshener/disinfectant aerosol | 60 |  |
    | * Liquid/pump sprays | 18 |  |
    | * Solids/semisolids | 3 |  |
    | Antiperspirants |  |  |
    | * Aerosol | 40 HVOC, 10 MVOC |  |
    | * Non-aerosol | 0 HVOC, 0 MVOC |  |
    | Anti-static product |  |  |
    | * Aerosol | 80 |  |
    | * Non-aerosol | 11 |  |
    | Astringent/toner |  | 35 |
    | Automotive rubbing or polishing compound | 17 |  |
    | Automotive wax, polish, sealant, or glaze |  |  |
    | * Hard paste waxes | 45 |  |
    | * Instant detailers | 3 |  |
    | * All other forms | 15 |  |
    | Automotive windshield cleaner | 35 |  |
    | Automotive windshield washer fluids | 35 |  |
    | Bathroom and tile cleaners |  |  |
    | * Aerosol | 7 |  |
    | * Non-aerosol | 1 |  |
    | Brake cleaner | 10 |  |
    | Bug and tar remover | 40 |  |
    | Carburetor or fuel-injection air intake cleaners | 10 |  |
    | Carpet/upholstery cleaners |  |  |
    | * Aerosol | 7 | 5 |
    | * Non-aerosol (dilutables) | 0.1 |  |
    | * Non-aerosol (ready-to-use) | 3 | 1 |
    | Charcoal lighter material | See Section II.F. |  |
    | Cooking spray, aerosol | 18 |  |
    | Deodorants |  |  |
    | * Aerosol | 0 HVOC, 10 MVOC |  |
    | * Non-aerosol | 0 HVOC, 0 MVOC |  |
    | Disinfectant |  |  |
    | * Aerosol | 70 |  |
    | * Non-aerosol | 1 |  |
    | Dusting aids |  |  |
    | * Aerosol | 25 | 17 |
    | * Non-aerosol | 7 | 3 |
    | Electrical cleaner | 45 |  |
    | Electronic cleaner | 75 |  |
    | Engine degreasers |  |  |
    | * Aerosol | 10 |  |
    | * Non-aerosol | 5 |  |
    | Fabric protectants | 60 | NA |
    | * Aerosol |  | 60 |
    | * Non-aerosol |  | 1 |
    | Fabric refresher |  |  |
    | * Aerosol | 15 |  |
    | * Non-aerosol | 6 |  |
    | Fabric softener-single use dryer product |  | 0.05 grams of VOC per use per recommended delivery substrate |
    | Floor maintenance product |  | 1 |
    | Floor polishes or waxes |  |  |
    | * Resilient flooring materials | 1 |  |
    | * Non-resilient flooring materials | 1 |  |
    | * Wood floor wax | 90 | 70 |
    | Footwear or leather care products |  |  |
    | * Aerosol | 75 |  |
    | * Solid | 55 |  |
    | * Other forms | 15 |  |
    | Furniture maintenance products |  |  |
    | * Aerosol | 17 | 12 |
    | * Non-aerosol (except solid or paste) | 3 |  |
    | General purpose cleaners |  |  |
    | * Aerosol | 8 |  |
    | * Non-aerosol | 4 | 0.5 |
    | General purpose degreasers |  |  |
    | * Aerosol | 10 |  |
    | * Non-aerosol | 4 | 0.5 |
    | Glass cleaners |  |  |
    | * Aerosol | 12 | 10 |
    | * Non-aerosol | 4 | 3 |
    | Graffiti remover |  |  |
    | * Aerosol | 50 |  |
    | * Non-aerosol | 30 |  |
    | Hair mousses | 6 |  |
    | Hairshines | 55 |  |
    | Hairsprays | 55 | NA |
    | Hair finishing spray |  | 55 |
    | Hair styling products |  |  |
    | * Aerosol and pump sprays | 6 |  |
    | * All other forms | 2 |  |
    | Heavy-duty hand cleaner or soap | 8 | NA |
    | * All forms |  | 8 |
    | * Non-aerosol |  | 1 |
    | Insect repellent, aerosol |  | 65 |
    | Insecticides |  |  |
    | * Crawling bug, aerosol | 15 |  |
    | * Crawling bug, all other forms | 20 |  |
    | * Flea and tick | 25 |  |
    | * Flying bug, aerosol | 25 | 20 |
    | * Flying bug, all other forms | 35 |  |
    | * Foggers | 45 |  |
    | * Lawn or garden, non-aerosol | 3 |  |
    | * Lawn or garden, all other forms | 20 |  |
    | * Wasp or hornet | 40 | 10 |
    | Laundry prewash |  |  |
    | * Aerosols/solids | 22 |  |
    | * All other forms | 5 |  |
    | Laundry starch/sizing/fabric finish products | 4.5 |  |
    | Lubricant |  |  |
    | * Anti-seize - aerosol |  | 40 |
    | * Anti-seize – non-aerosol |  | 3 |
    | * Cutting or tapping oil – aerosol |  | 25 |
    | * Cutting or tapping oil – non- aerosol |  | 3 |
    | * Multi-purpose lubricant (excluding solid or semi-solid products) | 50 | 25 |
    | * Penetrant | 50 |  |
    | * Rust preventative or rust control - aerosol |  | 25 |
    | * Rust preventative or rust control – non-aerosol |  | 3 |
    | * Silicone-based multi-purpose lubricants (excluding solid or semi-solid products) | 60 |  |
    | Metal polishes/cleansers | 30 | NA |
    | * Aerosol |  | 15 |
    | * Non-aerosol |  | 3 |
    | Motor vehicle wash, non-aerosol |  | 0.2 |
    |  |  |  |
    | Multi-purpose solvent | 3 | NA |
    | * Aerosol |  | 10 |
    | * Non-aerosol |  | 3 |
    | Nail polish remover | 1 |  |
    | Non-selective terrestrial herbicide, non-aerosols | 3 |  |
    | Odor remover/eliminator |  |  |
    | * Aerosol |  | 25 |
    | * Non-aerosol |  | 6 |
    | Oven or grill cleaners |  |  |
    | * Aerosol | 8 |  |
    | * Non-aerosol | 4 |  |
    | Paint remover or strippers | 50 |  |
    | Paint thinner | 3 | NA |
    | * Aerosol |  | 10 |
    | * Non-aerosol |  | 3 |
    |  |  |  |
    | Pressurized gas duster |  | 1 |
    | Rubber/vinyl protectants |  |  |
    | * Aerosol | 10 |  |
    | * Non-aerosol | 3 |  |
    | Sanitizer |  |  |
    | * Aerosol | 70 |  |
    | * Non-aerosol | 1 |  |
    | Sealants and caulking compounds | 4 | NA |
    | Chemically curing, non-aerosol |  | 3 |
    | Nonchemically curing, non- aerosol |  | 1.5 |
    | Shaving creams | 5 |  |
    | Shaving gel | 4 |  |
    |  |  |  |
    | Spot removers |  |  |
    | * Aerosol | 25 | 15 |
    | * Non-aerosol | 8 | 3 |
    | Temporary hair color, aerosol | 55 |  |
    | Tire or wheel cleaner |  |  |
    | * Aerosol |  | 8 |
    | * Non-aerosol |  | 2 |
    | Tire sealants and inflators | 20 |  |
    | Toilet/urinal care |  |  |
    | * Aerosol | 10 |  |
    | * Non-aerosol | 3 |  |
    | Undercoatings, aerosol | 40 |  |
    | Wood cleaner |  |  |
    | * Aerosol | 17 |  |
    | * Non-aerosol | 4 |  |

After:

    |  | Manufactured on or after May 1, 2020 | Manufactured on or after 60 days after the effective date of a finding by EPA of a failure by Colorado to attain by the severe ozone attainment date or meet an applicable milestone under the 2008 ozone NAAQS |
    | Product category | VOC content limit (percent VOCs by weight) |  |
    | Adhesive removers |  |  |
    | * Floor or wall covering | 5 |  |
    | * Gasket or thread locking | 50 |  |
    | * General purpose | 20 |  |
    | * Specialty | 70 |  |
    | Adhesives |  |  |
    | * Aerosol mist spray | 65 | 30 |
    | * Aerosol web spray | 55 | 40 |
    | * Specialty purpose spray adhesive – mounting, automotive engine compartment, and flexible vinyl | 70 |  |
    | * Specialty purpose spray adhesive – polystyrene foam and automotive headliner | 65 |  |
    | * Specialty purpose spray adhesive – polylolefin and laminate repair/edgebanding | 60 |  |
    | * Specialty purpose spray adhesive – screen printing |  | 55 |
    | * Construction, panel, and floor covering | 7 |  |
    | * Contact general purpose | 55 |  |
    | * Contact special purpose | 80 |  |
    | * General purpose | 10 |  |
    | * Structural waterproof | 15 | NA |
    | Air fresheners |  |  |
    | * Single-phase aerosol | 30 |  |
    | * Double-phase aerosol | 25 | 20 |
    | * Dual purpose air freshener/disinfectant aerosol | 60 |  |
    | * Liquid/pump sprays | 18 |  |
    | * Solids/semisolids | 3 |  |
    | Antiperspirants |  |  |
    | * Aerosol | 40 HVOC, 10 MVOC |  |
    | * Non-aerosol | 0 HVOC, 0 MVOC |  |
    | Anti-static product |  |  |
    | * Aerosol | 80 |  |
    | * Non-aerosol | 11 |  |
    | Astringent/toner |  | 35 |
    | Automotive rubbing or polishing compound | 17 |  |
    | Automotive wax, polish, sealant, or glaze |  |  |
    | * Hard paste waxes | 45 |  |
    | * Instant detailers | 3 |  |
    | * All other forms | 15 |  |
    | Automotive windshield cleaner | 35 |  |
    | Automotive windshield washer fluids | 35 |  |
    | Bathroom and tile cleaners |  |  |
    | * Aerosol | 7 |  |
    | * Non-aerosol | 1 |  |
    | Brake cleaner | 10 |  |
    | Bug and tar remover | 40 |  |
    | Carburetor or fuel-injection air intake cleaners | 10 |  |
    | Carpet/upholstery cleaners |  |  |
    | * Aerosol | 7 | 5 |
    | * Non-aerosol (dilutables) | 0.1 |  |
    | * Non-aerosol (ready-to-use) | 3 | 1 |
    | Charcoal lighter material | See Section II.F. |  |
    | Cooking spray, aerosol | 18 |  |
    | Deodorants |  |  |
    | * Aerosol | 0 HVOC, 10 MVOC |  |
    | * Non-aerosol | 0 HVOC, 0 MVOC |  |
    | Disinfectant |  |  |
    | * Aerosol | 70 |  |
    | * Non-aerosol | 1 |  |
    | Dusting aids |  |  |
    | * Aerosol | 25 | 17 |
    | * Non-aerosol | 7 | 3 |
    | Electrical cleaner | 45 |  |
    | Electronic cleaner | 75 |  |
    | Engine degreasers |  |  |
    | * Aerosol | 10 |  |
    | * Non-aerosol | 5 |  |
    | Fabric protectants | 60 | NA |
    | * Aerosol |  | 60 |
    | * Non-aerosol |  | 1 |
    | Fabric refresher |  |  |
    | * Aerosol | 15 |  |
    | * Non-aerosol | 6 |  |
    | Fabric softener-single use dryer product |  | 0.05 grams of VOC per use per recommended delivery substrate |
    | Floor maintenance product |  | 1 |
    | Floor polishes or waxes |  |  |
    | * Resilient flooring materials | 1 |  |
    | * Non-resilient flooring materials | 1 |  |
    | * Wood floor wax | 90 | 70 |
    | Footwear or leather care products |  |  |
    | * Aerosol | 75 |  |
    | * Solid | 55 |  |
    | * Other forms | 15 |  |
    | Furniture maintenance products |  |  |
    | * Aerosol | 17 | 12 |
    | * Non-aerosol (except solid or paste) | 3 |  |
    | General purpose cleaners |  |  |
    | * Aerosol | 8 |  |
    | * Non-aerosol | 4 | 0.5 |
    | General purpose degreasers |  |  |
    | * Aerosol | 10 |  |
    | * Non-aerosol | 4 | 0.5 |
    | Glass cleaners |  |  |
    | * Aerosol | 12 | 10 |
    | * Non-aerosol | 4 | 3 |
    | Graffiti remover |  |  |
    | * Aerosol | 50 |  |
    | * Non-aerosol | 30 |  |
    | Hair mousses | 6 |  |
    | Hairshines | 55 |  |
    | Hairsprays | 55 | NA |
    | Hair finishing spray |  | 55 |
    | Hair styling products |  |  |
    | * Aerosol and pump sprays | 6 |  |
    | * All other forms | 2 |  |
    | Heavy-duty hand cleaner or soap | 8 | NA |
    | * All forms |  | 8 |
    | * Non-aerosol |  | 1 |
    | Insect repellent, aerosol |  | 65 |
    | Insecticides |  |  |
    | * Crawling bug, aerosol | 15 |  |
    | * Crawling bug, all other forms | 20 |  |
    | * Flea and tick | 25 |  |
    | * Flying bug, aerosol | 25 | 20 |
    | * Flying bug, all other forms | 35 |  |
    | * Foggers | 45 |  |
    | * Lawn or garden, non-aerosol | 3 |  |
    | * Lawn or garden, all other forms | 20 |  |
    | * Wasp or hornet | 40 | 10 |
    | Laundry prewash |  |  |
    | * Aerosols/solids | 22 |  |
    | * All other forms | 5 |  |
    | Laundry starch/sizing/fabric finish products | 4.5 |  |
    | Lubricant |  |  |
    | * Anti-seize - aerosol |  | 40 |
    | * Anti-seize – non-aerosol |  | 3 |
    | * Cutting or tapping oil – aerosol |  | 25 |
    | * Cutting or tapping oil – non- aerosol |  | 3 |
    | * Multi-purpose lubricant (excluding solid or semi-solid products) | 50 | 25 |
    | * Penetrant | 50 |  |
    | * Rust preventative or rust control - aerosol |  | 25 |
    | * Rust preventative or rust control – non-aerosol |  | 3 |
    | * Silicone-based multi-purpose lubricants (excluding solid or semi-solid products) | 60 |  |
    | Metal polishes/cleansers | 30 | NA |
    | * Aerosol |  | 15 |
    | * Non-aerosol |  | 3 |
    | Motor vehicle wash, non-aerosol |  | 0.2 |
    | Multi-purpose solvent | 3 | NA |
    | * Aerosol |  | 10 |
    | * Non-aerosol |  | 3 |
    | Nail polish remover | 1 |  |
    | Non-selective terrestrial herbicide, non-aerosols | 3 |  |
    | Odor remover/eliminator |  |  |
    | * Aerosol |  | 25 |
    | * Non-aerosol |  | 6 |
    | Oven or grill cleaners |  |  |
    | * Aerosol | 8 |  |
    | * Non-aerosol | 4 |  |
    | Paint remover or strippers | 50 |  |
    | Paint thinner | 3 | NA |
    | * Aerosol |  | 10 |
    | * Non-aerosol |  | 3 |
    | Pressurized gas duster |  | 1 |
    | Rubber/vinyl protectants |  |  |
    | * Aerosol | 10 |  |
    | * Non-aerosol | 3 |  |
    | Sanitizer |  |  |
    | * Aerosol | 70 |  |
    | * Non-aerosol | 1 |  |
    | Sealants and caulking compounds | 4 | NA |
    | Chemically curing, non-aerosol |  | 3 |
    | Nonchemically curing, non- aerosol |  | 1.5 |
    | Shaving creams | 5 |  |
    | Shaving gel | 4 |  |
    | Spot removers |  |  |
    | * Aerosol | 25 | 15 |
    | * Non-aerosol | 8 | 3 |
    | Temporary hair color, aerosol | 55 |  |
    | Tire or wheel cleaner |  |  |
    | * Aerosol |  | 8 |
    | * Non-aerosol |  | 2 |
    | Tire sealants and inflators | 20 |  |
    | Toilet/urinal care |  |  |
    | * Aerosol | 10 |  |
    | * Non-aerosol | 3 |  |
    | Undercoatings, aerosol | 40 |  |
    | Wood cleaner |  |  |
    | * Aerosol | 17 |  |
    | * Non-aerosol | 4 |  |

### sec-22-B-I-E-1 (table 1): body rows 51 -> 39, header columns 4 -> 4

Before:

    |  |  |  |  |
    |  |  |  |  |
    |  |  |  |  |
    | End-Use Category: Aerosol Propellants |  |  |  |
    |  |  |  |  |
    | End-Use | Prohibited Substances | Date of Prohibition |  |
    | Aerosol Propellants | HFC-125, HFC-134a, HFC-227ea and blends of HFC-227ea and HFC-134a | January 1, 2021 |  |
    |  |  |  |  |
    | End-Use Category: Air Conditioning |  |  |  |
    |  |  |  |  |
    | End-Use | Prohibited Substances | Date of Prohibition |  |
    | Centrifugal Chillers (New) | FOR12A, FOR12B, HFC-134a, HFC-227ea, HFC-236fa, HFC245fa, R- 125/ 134a/ 600a (28.1/70/1.9), R-125/ 290/ 134a/ 600a (55.0/1.0/42.5/1.5), R-404A, R-407C, R-410A, R-410B, R-417A, R- 421A, R-422B, R-422C, R-422D, R-423A, R-424A, R-434A, R438A, R- 507A, RS-44 (2003 composition), THR-03 | January 1, 2024 |  |
    | Positive Displacement Chillers (New) | FOR12A, FOR12B, HFC-134a, HFC-227ea, KDD6, R125/ 134a/ 600a (28.1/70/1.9), R-125/ 290/ 134a/ 600a (55.0/1.0/42.5/1.5), R-404A, R- 407C, R-410A, R-410B, R-417A, R-421A, R-422B, R-422C, R-422D, R- 424A, R-434A, R-437A, R438A, R-507A, RS-44 (2003 composition), SP34E, THR-03 | January 1, 2024 |  |
    |  |  |  |  |
    |  |  |  |  |
    | End-Use Category: Refrigeration |  |  |  |
    |  |  |  |  |
    | End-Use | Prohibited Substances | Date of Prohibition |  |
    | Cold Storage Warehouses (New) | HFC-227ea, R-125/290/134a/600a (55.0/1.0/42.5/1.5), R404A, R-407A, R-407B, R-410A, R-410B, R-417A, R-421A, R421B, R-422A, R-422B, R-422C, R-422D, R-423A, R-424A, R428A, R-434A, R-438A, R-507A, RS-44 (2003 composition) | January 1, 2023 |  |
    | Household Refrigerators and Freezers (New) | FOR12A, FOR12B, HFC-134a, KDD6, R-125/290/134a/600a (55.0/1.0/42.5/1.5), R-404A, R-407C, R-407F, R-410A, R-410B, R-417A, R-421A, R-421B, R-422A, R-422B, R-422C, R-422D, R424A, R-426A, R-428A, R-434A, R-437A, R-438A, R-507A, RS24 (2002 formulation), RS-44 (2003 formulation), SP34E, THR-03 | January 1, 2022 |  |
    | Household Refrigerators and Freezers—Compact (New) | FOR12A, FOR12B, HFC-134a, KDD6, R-125/290/134a/600a (55.0/1.0/42.5/1.5), R-404A, R-407C, R-407F, R-410A, R-410B, R-417A, R-421A, R-421B, R-422A, R-422B, R-422C, R-422D, R424A, R-426A, R-428A, R-434A, R-437A, R-438A, R-507A, RS24 (2002 formulation), RS-44 (2003 formulation), SP34E, THR-03 | January 1, 2021 |  |
    | Household Refrigerators and Freezers—Built-in (New) | FOR12A, FOR12B, HFC-134a, KDD6, R-125/290/134a/600a (55.0/1.0/42.5/1.5), R-404A, R-407C, R-407F, R-410A, R-410B, R-417A, R-421A, R-421B, R-422A, R-422B, R-422C, R-422D, R424A, R-426A, R-428A, R-434A, R-437A, R-438A, R-507A, RS24 (2002 formulation), RS-44 (2003 formulation), SP34E, THR-03 | January 1, 2023 |  |
    | Supermarket Systems (Retrofit) | R-404A, R-407B, R-421B, R-422A, R-422C, R-422D, R428A, R-434A, R-507A | January 1, 2021 |  |
    | Supermarket Systems (New) | HFC-227ea, R-404A, R-407B, R-421B, R-422A, R-422C, R-422D, R-428A, R-434A, R-507A | January 1, 2021 |  |
    | Remote Condensing Units (Retrofit) | R-404A, R-407B, R-421B, R-422A, R-422C, R-422D, R428A, R-434A, R-507A | January 1, 2021 |  |
    | Remote Condensing Units (New) | HFC-227ea, R-404A, R-407B, R-421B, R-422A, R-422C, R-422D, R-428A, R-434A, R-507A | January 1, 2021 |  |
    | Stand-alone Units (Retrofit) | R-404A, R-507A | January 1, 2021 |  |
    | Stand-alone Medium- Temperature Units (New) | FOR12A, FOR12B, HFC-134a, HFC-227ea, KDD6, R125/290/134a/600a (55.0/1.0/42.5/1.5), R-404A, R407A, R-407B, R-407C, R-407F, R-410A, R-410B, R417A, R-421A, R-421B, R-422A, R-422B, R-422C, R422D, R-424A, R-426A, R-428A, R-434A, R-437A, R438A, R-507A, RS-24 (2002 formulation), RS-44 (2003 formulation), SP34E, THR-03 | January 1, 2021 |  |
    | Stand-alone Low- Temperature Units (New) | HFC-227ea, KDD6, R-125/290/134a/600a (55.0/1.0/42.5/1.5), R-404A, R-407A, R-407B, R-407C, R-407F, R-410A, R-410B, R-417A, R-421A, R-421B, R422A, R-422B, R-422C, R-422D, R-424A, R-428A, R434A, R-437A, R-438A, R-507A, RS-44 (2003 formulation) | January 1, 2021 |  |
    | Refrigerated Food Processing and Dispensing Equipment (New) | HFC-227ea, KDD6, R-125/ 290/ 134a/ 600a (55.0/1.0/42.5/1.5), R-404A, R-407A, R-407B, R-407C, R-407F, R-410A, R-410B, R417A, R-421A, R-421B, R-422A, R-422B, R-422C, R-422D, R424A, R-428A, R-434A, R-437A, R-438A, R-507A, RS-44 (2003 formulation) | January 1, 2021 |  |
    |  |  |  |  |
    | Vending Machines (New) | FOR12A, FOR12B, HFC-134a, KDD6, R125/290/134a/600a (55.0/1.0/42.5/1.5), R-404A, R407C, R-410A, R-410B, R-417A, R-421A, R-422B, R422C, R-422D, R-426A, R-437A, R-438A, R-507A, RS-24 (2002 formulation), SP34E | January 1, 2022 |  |
    | Vending Machines (Retrofit) | R-404A, R-507A | January 1, 2021 |  |
    |  |  |  |  |
    | End-Use Category: Foams |  |  |  |
    |  |  |  |  |
    | End-Use | Prohibited Substances | Date of Prohibition |  |
    | Rigid Polyurethane and Polyisocyanurate Laminated Boardstock | HFC-134a, HFC-245fa, HFC-365mfc, and blends thereof | January 1, 2021 |  |
    | Flexible Polyurethane | HFC-134a, HFC-245fa, HFC-365mfc, and blends thereof | January 1, 2021 |  |
    | Integral Skin Polyurethane | HFC-134a, HFC-245fa, HFC-365mfc, and blends thereof; Formacel TI, Formacel Z-6 | January 1, 2021 |  |
    | Polystyrene Extruded Sheet | HFC-134a, HFC-245fa, HFC-365mfc, and blends thereof; Formacel TI, Formacel Z-6 | January 1, 2021 |  |
    | Phenolic Insulation Board and Bunstock | HFC-143a, HFC-134a, HFC-245fa, HFC-365mfc, and blends thereof | January 1, 2021 |  |
    | Rigid Polyurethane Slabstock and Other | HFC-134a, HFC-245fa, HFC-365mfc and blends thereof; Formacel TI, Formacel Z-6 | January 1, 2021 |  |
    | Rigid Polyurethane Appliance Foam | HFC-134a, HFC-245fa, HFC-365mfc and blends thereof; Formacel TI, Formacel Z-6 | January 1, 2021 |  |
    | Rigid Polyurethane Commercial Refrigeration and Sandwich Panels | HFC-134a, HFC-245fa, HFC-365mfc, and blends thereof; Formacel TI, Formacel Z-6 | January 1, 2021 |  |
    | Polyolefin | HFC-134a, HFC-245fa, HFC-365mfc, and blends thereof; Formacel TI, Formacel Z-6 | January 1, 2021 |  |
    | Rigid Polyurethane Marine Flotation Foam | HFC-134a, HFC-245fa, HFC-365mfc and blends thereof; Formacel TI, Formacel Z-6 | January 1, 2021 |  |
    | Polystyrene Extruded Boardstock and Billet (XPS) | HFC-134a, HFC-245fa, HFC-365mfc, and blends thereof; Formacel TI, Formacel B, Formacel Z-6 | January 1, 2021 |  |
    | Rigid Polyurethane High-pressure Two- component Spray Foam | HFC-134a, HFC-245fa, and blends thereof; blends of HFC365mfc with at least 4 percent HFC-245fa, and commercial blends of HFC-365mfc with 7 to 13 percent HFC-227ea and the remainder HFC-365mfc; Formacel TI | January 1, 2021 |  |
    |  |  |  |  |
    | Rigid Polyurethane Low-pressure Two- component Spray Foam | HFC-134a, HFC-245fa, and blends thereof; blends of HFC365mfc with at least 4 percent HFC-245fa, and commercial blends of HFC-365mfc with 7 to 13 percent HFC-227ea and the remainder HFC-365mfc; Formacel TI | January 1, 2021 |  |
    | Rigid Polyurethane One-component foam sealants | HFC-134a, HFC-245fa, and blends thereof; blends of HFC365mfc with at least 4 percent HFC-245fa, and commercial blends of HFC-365mfc with 7 to 13 percent HFC-227ea and the remainder HFC-365mfc; Formacel TI | January 1, 2021 |  |

After:

    |  |  |  |  |
    | End-Use Category: Aerosol Propellants |  |  |  |
    | End-Use | Prohibited Substances | Date of Prohibition |  |
    | Aerosol Propellants | HFC-125, HFC-134a, HFC-227ea and blends of HFC-227ea and HFC-134a | January 1, 2021 |  |
    | End-Use Category: Air Conditioning |  |  |  |
    | End-Use | Prohibited Substances | Date of Prohibition |  |
    | Centrifugal Chillers (New) | FOR12A, FOR12B, HFC-134a, HFC-227ea, HFC-236fa, HFC245fa, R- 125/ 134a/ 600a (28.1/70/1.9), R-125/ 290/ 134a/ 600a (55.0/1.0/42.5/1.5), R-404A, R-407C, R-410A, R-410B, R-417A, R- 421A, R-422B, R-422C, R-422D, R-423A, R-424A, R-434A, R438A, R- 507A, RS-44 (2003 composition), THR-03 | January 1, 2024 |  |
    | Positive Displacement Chillers (New) | FOR12A, FOR12B, HFC-134a, HFC-227ea, KDD6, R125/ 134a/ 600a (28.1/70/1.9), R-125/ 290/ 134a/ 600a (55.0/1.0/42.5/1.5), R-404A, R- 407C, R-410A, R-410B, R-417A, R-421A, R-422B, R-422C, R-422D, R- 424A, R-434A, R-437A, R438A, R-507A, RS-44 (2003 composition), SP34E, THR-03 | January 1, 2024 |  |
    | End-Use Category: Refrigeration |  |  |  |
    | End-Use | Prohibited Substances | Date of Prohibition |  |
    | Cold Storage Warehouses (New) | HFC-227ea, R-125/290/134a/600a (55.0/1.0/42.5/1.5), R404A, R-407A, R-407B, R-410A, R-410B, R-417A, R-421A, R421B, R-422A, R-422B, R-422C, R-422D, R-423A, R-424A, R428A, R-434A, R-438A, R-507A, RS-44 (2003 composition) | January 1, 2023 |  |
    | Household Refrigerators and Freezers (New) | FOR12A, FOR12B, HFC-134a, KDD6, R-125/290/134a/600a (55.0/1.0/42.5/1.5), R-404A, R-407C, R-407F, R-410A, R-410B, R-417A, R-421A, R-421B, R-422A, R-422B, R-422C, R-422D, R424A, R-426A, R-428A, R-434A, R-437A, R-438A, R-507A, RS24 (2002 formulation), RS-44 (2003 formulation), SP34E, THR-03 | January 1, 2022 |  |
    | Household Refrigerators and Freezers—Compact (New) | FOR12A, FOR12B, HFC-134a, KDD6, R-125/290/134a/600a (55.0/1.0/42.5/1.5), R-404A, R-407C, R-407F, R-410A, R-410B, R-417A, R-421A, R-421B, R-422A, R-422B, R-422C, R-422D, R424A, R-426A, R-428A, R-434A, R-437A, R-438A, R-507A, RS24 (2002 formulation), RS-44 (2003 formulation), SP34E, THR-03 | January 1, 2021 |  |
    | Household Refrigerators and Freezers—Built-in (New) | FOR12A, FOR12B, HFC-134a, KDD6, R-125/290/134a/600a (55.0/1.0/42.5/1.5), R-404A, R-407C, R-407F, R-410A, R-410B, R-417A, R-421A, R-421B, R-422A, R-422B, R-422C, R-422D, R424A, R-426A, R-428A, R-434A, R-437A, R-438A, R-507A, RS24 (2002 formulation), RS-44 (2003 formulation), SP34E, THR-03 | January 1, 2023 |  |
    | Supermarket Systems (Retrofit) | R-404A, R-407B, R-421B, R-422A, R-422C, R-422D, R428A, R-434A, R-507A | January 1, 2021 |  |
    | Supermarket Systems (New) | HFC-227ea, R-404A, R-407B, R-421B, R-422A, R-422C, R-422D, R-428A, R-434A, R-507A | January 1, 2021 |  |
    | Remote Condensing Units (Retrofit) | R-404A, R-407B, R-421B, R-422A, R-422C, R-422D, R428A, R-434A, R-507A | January 1, 2021 |  |
    | Remote Condensing Units (New) | HFC-227ea, R-404A, R-407B, R-421B, R-422A, R-422C, R-422D, R-428A, R-434A, R-507A | January 1, 2021 |  |
    | Stand-alone Units (Retrofit) | R-404A, R-507A | January 1, 2021 |  |
    | Stand-alone Medium- Temperature Units (New) | FOR12A, FOR12B, HFC-134a, HFC-227ea, KDD6, R125/290/134a/600a (55.0/1.0/42.5/1.5), R-404A, R407A, R-407B, R-407C, R-407F, R-410A, R-410B, R417A, R-421A, R-421B, R-422A, R-422B, R-422C, R422D, R-424A, R-426A, R-428A, R-434A, R-437A, R438A, R-507A, RS-24 (2002 formulation), RS-44 (2003 formulation), SP34E, THR-03 | January 1, 2021 |  |
    | Stand-alone Low- Temperature Units (New) | HFC-227ea, KDD6, R-125/290/134a/600a (55.0/1.0/42.5/1.5), R-404A, R-407A, R-407B, R-407C, R-407F, R-410A, R-410B, R-417A, R-421A, R-421B, R422A, R-422B, R-422C, R-422D, R-424A, R-428A, R434A, R-437A, R-438A, R-507A, RS-44 (2003 formulation) | January 1, 2021 |  |
    | Refrigerated Food Processing and Dispensing Equipment (New) | HFC-227ea, KDD6, R-125/ 290/ 134a/ 600a (55.0/1.0/42.5/1.5), R-404A, R-407A, R-407B, R-407C, R-407F, R-410A, R-410B, R417A, R-421A, R-421B, R-422A, R-422B, R-422C, R-422D, R424A, R-428A, R-434A, R-437A, R-438A, R-507A, RS-44 (2003 formulation) | January 1, 2021 |  |
    | Vending Machines (New) | FOR12A, FOR12B, HFC-134a, KDD6, R125/290/134a/600a (55.0/1.0/42.5/1.5), R-404A, R407C, R-410A, R-410B, R-417A, R-421A, R-422B, R422C, R-422D, R-426A, R-437A, R-438A, R-507A, RS-24 (2002 formulation), SP34E | January 1, 2022 |  |
    | Vending Machines (Retrofit) | R-404A, R-507A | January 1, 2021 |  |
    | End-Use Category: Foams |  |  |  |
    | End-Use | Prohibited Substances | Date of Prohibition |  |
    | Rigid Polyurethane and Polyisocyanurate Laminated Boardstock | HFC-134a, HFC-245fa, HFC-365mfc, and blends thereof | January 1, 2021 |  |
    | Flexible Polyurethane | HFC-134a, HFC-245fa, HFC-365mfc, and blends thereof | January 1, 2021 |  |
    | Integral Skin Polyurethane | HFC-134a, HFC-245fa, HFC-365mfc, and blends thereof; Formacel TI, Formacel Z-6 | January 1, 2021 |  |
    | Polystyrene Extruded Sheet | HFC-134a, HFC-245fa, HFC-365mfc, and blends thereof; Formacel TI, Formacel Z-6 | January 1, 2021 |  |
    | Phenolic Insulation Board and Bunstock | HFC-143a, HFC-134a, HFC-245fa, HFC-365mfc, and blends thereof | January 1, 2021 |  |
    | Rigid Polyurethane Slabstock and Other | HFC-134a, HFC-245fa, HFC-365mfc and blends thereof; Formacel TI, Formacel Z-6 | January 1, 2021 |  |
    | Rigid Polyurethane Appliance Foam | HFC-134a, HFC-245fa, HFC-365mfc and blends thereof; Formacel TI, Formacel Z-6 | January 1, 2021 |  |
    | Rigid Polyurethane Commercial Refrigeration and Sandwich Panels | HFC-134a, HFC-245fa, HFC-365mfc, and blends thereof; Formacel TI, Formacel Z-6 | January 1, 2021 |  |
    | Polyolefin | HFC-134a, HFC-245fa, HFC-365mfc, and blends thereof; Formacel TI, Formacel Z-6 | January 1, 2021 |  |
    | Rigid Polyurethane Marine Flotation Foam | HFC-134a, HFC-245fa, HFC-365mfc and blends thereof; Formacel TI, Formacel Z-6 | January 1, 2021 |  |
    | Polystyrene Extruded Boardstock and Billet (XPS) | HFC-134a, HFC-245fa, HFC-365mfc, and blends thereof; Formacel TI, Formacel B, Formacel Z-6 | January 1, 2021 |  |
    | Rigid Polyurethane High-pressure Two- component Spray Foam | HFC-134a, HFC-245fa, and blends thereof; blends of HFC365mfc with at least 4 percent HFC-245fa, and commercial blends of HFC-365mfc with 7 to 13 percent HFC-227ea and the remainder HFC-365mfc; Formacel TI | January 1, 2021 |  |
    | Rigid Polyurethane Low-pressure Two- component Spray Foam | HFC-134a, HFC-245fa, and blends thereof; blends of HFC365mfc with at least 4 percent HFC-245fa, and commercial blends of HFC-365mfc with 7 to 13 percent HFC-227ea and the remainder HFC-365mfc; Formacel TI | January 1, 2021 |  |
    | Rigid Polyurethane One-component foam sealants | HFC-134a, HFC-245fa, and blends thereof; blends of HFC365mfc with at least 4 percent HFC-245fa, and commercial blends of HFC-365mfc with 7 to 13 percent HFC-227ea and the remainder HFC-365mfc; Formacel TI | January 1, 2021 |  |

### sec-22-B-I-E-2 (table 1): body rows 11 -> 8, header columns 8 -> 8

Before:

    |  |  |  |  |  |  |  |  |
    |  |  |  |  |  |  |  |  |
    |  |  |  |  |  |  |  |  |
    | End-Use Category |  |  | Prohibited Substances |  |  | Acceptable Uses |  |
    |  |  |  |  |  |  |  |  |
    | Aerosol Propellants |  | HFC-134a |  |  | Cleaning products for removal of grease, flux and other soils from electrical equipment; refrigerant flushes; products for sensitivity testing of smoke detectors; lubricants and freeze sprays for electrical equipment or electronics; sprays for aircraft maintenance; sprays containing corrosion preventive compounds used in the maintenance of aircraft, electrical equipment or electronics, or military equipment; pesticides for use near electrical wires, in aircraft, in total release insecticide foggers, or in certified organic use pesticides for which EPA has specifically disallowed all other lower-GWP propellants; mold release agents and mold cleaners; lubricants and cleaners for spinnerettes for synthetic fabrics; duster sprays specifically for removal of dust from photographic negatives, semiconductor chips, specimens under electron microscopes, and energized electrical equipment; adhesives and sealants in large canisters; document preservation sprays; U.S. Food and Drug Administration (FDA)-approved MDIs for medical purposes; wound care sprays; topical coolant sprays for pain relief; products for removing bandage adhesives from skin; bear spray; and law enforcement pepper spray. |  |  |
    | Aerosol Propellants |  | HFC-227ea and blends of HFC-227ea and HFC-134a |  |  | FDA-approved MDIs for medical purposes. |  |  |
    | Air Conditioning |  | HFC–134a |  |  | Military marine vessels where reasonable efforts have been made to ascertain that other alternatives are not technically feasible due to performance or safety requirements. |  |  |
    | Air Conditioning |  | HFC-134a and R-404A |  |  | Human-rated spacecraft and related support equipment where reasonable efforts have been made to ascertain that other alternatives are not technically feasible due to performance or safety requirements. |  |  |
    | Foams – Except Rigid polyurethane spray foam |  | All substances |  |  | Military applications where reasonable efforts have been made to ascertain that other alternatives are not technically feasible due to performance or safety requirements until January 1, 2022. |  |  |
    | Foams – Except Rigid polyurethane spray foam |  | All substances |  |  | Space- and aeronautics-related applications where reasonable efforts have been made to ascertain that other alternatives are not technically feasible due to performance or safety requirements until January 1, 2025. |  |  |
    | Rigid polyurethane two-component spray foam |  | All substances |  |  | Military or space- and aeronautics-related applications where reasonable efforts have been made to ascertain that other alternatives are not technically feasible due to performance or safety requirements until January 1, 2025. |  |  |

After:

    |  |  |  |  |  |  |  |  |
    | End-Use Category |  |  | Prohibited Substances |  |  | Acceptable Uses |  |
    | Aerosol Propellants |  | HFC-134a |  |  | Cleaning products for removal of grease, flux and other soils from electrical equipment; refrigerant flushes; products for sensitivity testing of smoke detectors; lubricants and freeze sprays for electrical equipment or electronics; sprays for aircraft maintenance; sprays containing corrosion preventive compounds used in the maintenance of aircraft, electrical equipment or electronics, or military equipment; pesticides for use near electrical wires, in aircraft, in total release insecticide foggers, or in certified organic use pesticides for which EPA has specifically disallowed all other lower-GWP propellants; mold release agents and mold cleaners; lubricants and cleaners for spinnerettes for synthetic fabrics; duster sprays specifically for removal of dust from photographic negatives, semiconductor chips, specimens under electron microscopes, and energized electrical equipment; adhesives and sealants in large canisters; document preservation sprays; U.S. Food and Drug Administration (FDA)-approved MDIs for medical purposes; wound care sprays; topical coolant sprays for pain relief; products for removing bandage adhesives from skin; bear spray; and law enforcement pepper spray. |  |  |
    | Aerosol Propellants |  | HFC-227ea and blends of HFC-227ea and HFC-134a |  |  | FDA-approved MDIs for medical purposes. |  |  |
    | Air Conditioning |  | HFC–134a |  |  | Military marine vessels where reasonable efforts have been made to ascertain that other alternatives are not technically feasible due to performance or safety requirements. |  |  |
    | Air Conditioning |  | HFC-134a and R-404A |  |  | Human-rated spacecraft and related support equipment where reasonable efforts have been made to ascertain that other alternatives are not technically feasible due to performance or safety requirements. |  |  |
    | Foams – Except Rigid polyurethane spray foam |  | All substances |  |  | Military applications where reasonable efforts have been made to ascertain that other alternatives are not technically feasible due to performance or safety requirements until January 1, 2022. |  |  |
    | Foams – Except Rigid polyurethane spray foam |  | All substances |  |  | Space- and aeronautics-related applications where reasonable efforts have been made to ascertain that other alternatives are not technically feasible due to performance or safety requirements until January 1, 2025. |  |  |
    | Rigid polyurethane two-component spray foam |  | All substances |  |  | Military or space- and aeronautics-related applications where reasonable efforts have been made to ascertain that other alternatives are not technically feasible due to performance or safety requirements until January 1, 2025. |  |  |

### sec-23-A-IV-F-3 (table 3): body rows 38 -> 37, header columns 4 -> 4

Before:

    | Emission Unit | NOx Emission Limit | SO2 Emission Limit | Particulate Emission Limit |
    |  |  |  | clinker S013 (Iron/Silica Feed Belt) – 0.0031 lb/ton of clinker |
    | Holcim Florence Kiln | 2.73 lb/ton of clinker (30-day rolling average) 2,086.8 tpy (12-month rolling total) | 1.3 lb/ton of clinker (30-day rolling average) 721.4 tpy (12-month rolling total) | 247.6 tpy (12-month rolling total) |
    | Holcim Florence Quarry | N/A * | N/A * | 67.3 tpy (12-month rolling total) |
    | Holcim Florence Finish Mill | N/A+ | N/A+ | 34.3 tpy (12-month rolling total) |
    | GCC Pueblo Kiln | 2.70 lb/ton of clinker (30-day rolling average) 2.32 lb/ton of clinker (12-month rolling average) 1,100.0 tpy (12-month rolling total) | N/A * | 36.01 tpy (Filterable, 12-month rolling total) 293.56 tpy (Condensable, 12-month rolling total) |
    | GCC Pueblo Clinker Cooler | N/A+ | N/A+ | 33.92 tpy (12-month rolling total) |
    | Boiler Support Facility (Formerly CENC) Boiler 1 (operating on gaseous fuel) | 0.20 lb/MMBtu 625.4 tpy (Combined 12-month rolling total for Boilers 1, 2, 4, and 5) | N/A* | N/A * |
    | Boiler Support Facility (Formerly CENC) Boiler 2 (operating on gaseous fuel) | 0.20 lb/MMBtu 625.4 tpy (Combined 12-month rolling total for Boilers 1, 2, 4, and 5) | N/A* | N/A * |
    | Boiler Support Facility (Formerly CENC) Boiler 4 (operating on gaseous fuel 7/2/2013) | 0.12 lb/MMBtu (30-day rolling average) 242.9 tpy (12-month rolling total, Boiler 4 only) 625.4 tpy (Combined 12-month rolling total for Boilers 1, 2, 4, and 5) | N/A * | N/A * |
    | Boiler Support Facility (Formerly CENC) Boiler 5 (operating on gaseous fuel 4/18/2016) | 0.10 lb/MMBtu (30-day rolling average) 256.3 tpy (12-month rolling total, Boiler 5 only) 625.4 tpy (Combined 12-month rolling | N/A * | N/A * |
    |  | total for Boilers 1, 2, 4, and 5) |  |  |
    | EVRAZ Electric Arc Furnace (EAF) | 0.28 lb/ton of steel (30-day rolling average) 189.0 tpy (12-month rolling total) | 0.15 lb/ton of steel (30-day rolling average) 101.25 tpy (12-month rolling total) | 0.0018 grains/dscf (filterable) 0.0052 grains/dscf (filterable+condensable) 163.11 tpy (12-month rolling total) |
    | EVRAZ Ladle Metallurgy Station (LMS) | 84.1 tpy (12-month rolling total) | 2 ton/day (3-hour rolling average) 234.3 tpy (12-month rolling total) | N/A * |
    | EVRAZ Round Caster | 35.6 tpy (12-month rolling total) | N/A* | 19.10 tpy (12-month rolling total) |
    | EVRAZ Seamless Mill Rotary Furnace | 169.26 tpy (12-month rolling total) | N/A * | N/A * |
    | EVRAZ Seamless Mill Quench Furnace | Reporting based on 280 lbs/MMscf AP-42 emission factor | N/A * | N/A * |
    | EVRAZ Seamless Mill Tempering Furnace | Reporting based on 280 lbs/MMscf AP-42 emission factor | N/A * | N/A * |
    | EVRAZ Rod/Bar Mill Furnace | 0.07 lb/MMBtu 30.28 tpy (12-month rolling total) | N/A * | N/A * |
    | EVRAZ Rail Mill Furnace | 0.07 lb/MMBtu (30-day rolling average) 32.34 tpy (12-month rolling total) | N/A * | N/A * |
    | EVRAZ Haul Roads | N/A+ | N/A+ | Compliance with Fugitive Dust Control Plan |
    | EVRAZ Vacuum Tank Degasser Boiler | 16.21 tpy (12-month rolling total) | N/A* | N/A * |
    | EVRAZ Ladle Preheaters | 23.91 tpy (12-month rolling total, combined for 6 preheaters) | N/A * | N/A * |
    | Rocky Mountain Bottle Company Furnaces B+ and C (common stack) | 157.8 tpy (12-month rolling total) | 114.8 tpy (12-month rolling total) | 0.27 lb/ton of glass (Performance testing every 5 years) 38.7 tpy (Filterable + Condensable, 12-month rolling total) |
    | Suncor Plant 1 Fluidized Catalytic Cracking Unit Catalyst Regenerator (FCCU) | 58.7 ppmvd @ 0% O2 (365-day rolling average) | 25 ppmvd @ 0% O2 (365-day rolling average) | 85.4 tpy (12-month rolling total) |
    | Suncor Plant 2 Fluidized Catalytic Cracking Unit Catalyst Regenerator (FCCU) | 160 ppmvd @ 0% O2 (7-day rolling average) 80 ppmvd @ 0% O2 (365-day rolling average) | 37.2 ppmvd @ 0% O2 (365-day rolling average) | 53.1 tpy (12-month rolling total) |
    | Suncor Plant 1 Sulfur Recovery Unit Tail Gas Unit (SRC TGU) | N/A* | 59.7 tons/year (12-month rolling total) | N/A* |
    | Suncor Plant 2 Sulfur Recovery Unit Tail Gas Incinerator (SRC TGI) | N/A* | 1.20% volume SO2 (12-hour rolling average) 271 tons/year (12-month rolling total) 120 tons/year (12-month rolling total) Optimization no later than 12/31/2023 and compliance with 12-month rolling total 12 months after optimization is complete and no later than 12/31/2024. Application for permit modification and limits based on operating data no later than 18 months after optimization project implementation or Comply with alternative in Section IV.F.7.c. and Section V.A.1.d.(ii)(C). | N/A* |
    | Suncor Plant 1 Main Plant Flare |  | 162 ppmv H2S (3-hour rolling average) | N/A* |
    | Suncor Heater H-11 | 12.78 tpy (12-month rolling total) | N/A* | N/A* |
    | Suncor Heater H-17 | 24.83 tpy (12-month rolling total) | N/A* | N/A* |
    | Suncor Heater H-27 | 32.84 tpy (12-month rolling total) | N/A* | N/A* |
    | Suncor Heaters H-28/29/30 | 20.40 tpy (12-month rolling total) | N/A* | N/A* |
    | Suncor Heater H-37 | 10.41 tpy (12-month rolling total) | N/A* | N/A* |
    | Suncor Heater H-101 | 55.85 tpy (12-month rolling total) | N/A* | N/A* |
    | Suncor Heater H-402 | 21.16 tpy (12-month rolling total) | N/A* | N/A* |
    | Suncor Heater H-2101 | 52.19 tpy (365-day rolling total) | N/A* | N/A* |
    | Suncor Boiler 4 | 0.06 lb/MMBtu (30-day rolling average) | N/A* | N/A* |
    | Suncor Boiler 505 | 0.044 lb/MMBtu (30-day rolling average) | N/A* | N/A* |

After:

    | Emission Unit | NOx Emission Limit | SO2 Emission Limit | Particulate Emission Limit |
    |  |  |  | clinker S013 (Iron/Silica Feed Belt) – 0.0031 lb/ton of clinker |
    | Holcim Florence Kiln | 2.73 lb/ton of clinker (30-day rolling average) 2,086.8 tpy (12-month rolling total) | 1.3 lb/ton of clinker (30-day rolling average) 721.4 tpy (12-month rolling total) | 247.6 tpy (12-month rolling total) |
    | Holcim Florence Quarry | N/A * | N/A * | 67.3 tpy (12-month rolling total) |
    | Holcim Florence Finish Mill | N/A+ | N/A+ | 34.3 tpy (12-month rolling total) |
    | GCC Pueblo Kiln | 2.70 lb/ton of clinker (30-day rolling average) 2.32 lb/ton of clinker (12-month rolling average) 1,100.0 tpy (12-month rolling total) | N/A * | 36.01 tpy (Filterable, 12-month rolling total) 293.56 tpy (Condensable, 12-month rolling total) |
    | GCC Pueblo Clinker Cooler | N/A+ | N/A+ | 33.92 tpy (12-month rolling total) |
    | Boiler Support Facility (Formerly CENC) Boiler 1 (operating on gaseous fuel) | 0.20 lb/MMBtu 625.4 tpy (Combined 12-month rolling total for Boilers 1, 2, 4, and 5) | N/A* | N/A * |
    | Boiler Support Facility (Formerly CENC) Boiler 2 (operating on gaseous fuel) | 0.20 lb/MMBtu 625.4 tpy (Combined 12-month rolling total for Boilers 1, 2, 4, and 5) | N/A* | N/A * |
    | Boiler Support Facility (Formerly CENC) Boiler 4 (operating on gaseous fuel 7/2/2013) | 0.12 lb/MMBtu (30-day rolling average) 242.9 tpy (12-month rolling total, Boiler 4 only) 625.4 tpy (Combined 12-month rolling total for Boilers 1, 2, 4, and 5) | N/A * | N/A * |
    | Boiler Support Facility (Formerly CENC) Boiler 5 (operating on gaseous fuel 4/18/2016) | 0.10 lb/MMBtu (30-day rolling average) 256.3 tpy (12-month rolling total, Boiler 5 only) 625.4 tpy (Combined 12-month rolling total for Boilers 1, 2, 4, and 5) | N/A * | N/A * |
    | EVRAZ Electric Arc Furnace (EAF) | 0.28 lb/ton of steel (30-day rolling average) 189.0 tpy (12-month rolling total) | 0.15 lb/ton of steel (30-day rolling average) 101.25 tpy (12-month rolling total) | 0.0018 grains/dscf (filterable) 0.0052 grains/dscf (filterable+condensable) 163.11 tpy (12-month rolling total) |
    | EVRAZ Ladle Metallurgy Station (LMS) | 84.1 tpy (12-month rolling total) | 2 ton/day (3-hour rolling average) 234.3 tpy (12-month rolling total) | N/A * |
    | EVRAZ Round Caster | 35.6 tpy (12-month rolling total) | N/A* | 19.10 tpy (12-month rolling total) |
    | EVRAZ Seamless Mill Rotary Furnace | 169.26 tpy (12-month rolling total) | N/A * | N/A * |
    | EVRAZ Seamless Mill Quench Furnace | Reporting based on 280 lbs/MMscf AP-42 emission factor | N/A * | N/A * |
    | EVRAZ Seamless Mill Tempering Furnace | Reporting based on 280 lbs/MMscf AP-42 emission factor | N/A * | N/A * |
    | EVRAZ Rod/Bar Mill Furnace | 0.07 lb/MMBtu 30.28 tpy (12-month rolling total) | N/A * | N/A * |
    | EVRAZ Rail Mill Furnace | 0.07 lb/MMBtu (30-day rolling average) 32.34 tpy (12-month rolling total) | N/A * | N/A * |
    | EVRAZ Haul Roads | N/A+ | N/A+ | Compliance with Fugitive Dust Control Plan |
    | EVRAZ Vacuum Tank Degasser Boiler | 16.21 tpy (12-month rolling total) | N/A* | N/A * |
    | EVRAZ Ladle Preheaters | 23.91 tpy (12-month rolling total, combined for 6 preheaters) | N/A * | N/A * |
    | Rocky Mountain Bottle Company Furnaces B+ and C (common stack) | 157.8 tpy (12-month rolling total) | 114.8 tpy (12-month rolling total) | 0.27 lb/ton of glass (Performance testing every 5 years) 38.7 tpy (Filterable + Condensable, 12-month rolling total) |
    | Suncor Plant 1 Fluidized Catalytic Cracking Unit Catalyst Regenerator (FCCU) | 58.7 ppmvd @ 0% O2 (365-day rolling average) | 25 ppmvd @ 0% O2 (365-day rolling average) | 85.4 tpy (12-month rolling total) |
    | Suncor Plant 2 Fluidized Catalytic Cracking Unit Catalyst Regenerator (FCCU) | 160 ppmvd @ 0% O2 (7-day rolling average) 80 ppmvd @ 0% O2 (365-day rolling average) | 37.2 ppmvd @ 0% O2 (365-day rolling average) | 53.1 tpy (12-month rolling total) |
    | Suncor Plant 1 Sulfur Recovery Unit Tail Gas Unit (SRC TGU) | N/A* | 59.7 tons/year (12-month rolling total) | N/A* |
    | Suncor Plant 2 Sulfur Recovery Unit Tail Gas Incinerator (SRC TGI) | N/A* | 1.20% volume SO2 (12-hour rolling average) 271 tons/year (12-month rolling total) 120 tons/year (12-month rolling total) Optimization no later than 12/31/2023 and compliance with 12-month rolling total 12 months after optimization is complete and no later than 12/31/2024. Application for permit modification and limits based on operating data no later than 18 months after optimization project implementation or Comply with alternative in Section IV.F.7.c. and Section V.A.1.d.(ii)(C). | N/A* |
    | Suncor Plant 1 Main Plant Flare |  | 162 ppmv H2S (3-hour rolling average) | N/A* |
    | Suncor Heater H-11 | 12.78 tpy (12-month rolling total) | N/A* | N/A* |
    | Suncor Heater H-17 | 24.83 tpy (12-month rolling total) | N/A* | N/A* |
    | Suncor Heater H-27 | 32.84 tpy (12-month rolling total) | N/A* | N/A* |
    | Suncor Heaters H-28/29/30 | 20.40 tpy (12-month rolling total) | N/A* | N/A* |
    | Suncor Heater H-37 | 10.41 tpy (12-month rolling total) | N/A* | N/A* |
    | Suncor Heater H-101 | 55.85 tpy (12-month rolling total) | N/A* | N/A* |
    | Suncor Heater H-402 | 21.16 tpy (12-month rolling total) | N/A* | N/A* |
    | Suncor Heater H-2101 | 52.19 tpy (365-day rolling total) | N/A* | N/A* |
    | Suncor Boiler 4 | 0.06 lb/MMBtu (30-day rolling average) | N/A* | N/A* |
    | Suncor Boiler 505 | 0.044 lb/MMBtu (30-day rolling average) | N/A* | N/A* |

### sec-25-C-I (table 1): body rows 32 -> 26, header columns 6 -> 6

Before:

    | Year of rule adoption | Date of rule adoption | Summary of rule(s) adopted | Regulation 7 Section (pre-2019 numbering) | Regulation 7 Section (numbering as of 12.2022) | Rule & Section (as of 4.2023) |
    | 1995 | Dec. 21 | Clarify substances that are negligibly reactive VOCs. | Section II.B. | Part A, Section II.B. | Regulations 7 and 24- 26, Part A |
    | 1996 | Mar. 21 | Revisions related to the maintenance demonstration. | Sections I.A.1. through I.A.4.; II.D.; II.E. | Part A, Sections I.A.1. through I.A.4.; II.D.; II.E. | Regulations 7 and 24- 26, Part A |
    | 1996 | Nov. 21 | Updated NRVOC list. Removed control of VOC emissions from dry cleaning facilities using perchloroethylene. | Section XII. | NA | NA |
    | 1998 | Oct. 15 | Revisions specific to Gates Rubber Company. | Section II.F. | NA | Regulation 24-25, Part A |
    | 2001 | Jan. 11 | Correct discrepancies in posted versus adopted provisions. | Sections III.C.; IX.L.2.c.(1); X.D.2. through XI.A.3. | Part B, Section I.; Part C, Section I.; Part C, Sections II. through III. | Regulation 24, Part B; Regulation 25, Part B (fkna Part C) |
    | 2003 | Nov. 20 | Repealed provisions establishing a procedure for granting exemptions for de minimis sources | Sections I.A.2. through I.A.4.; II.D.; II.E. | Part A, Sections I.A.1. through I.A.4.; II.D.; II.E. | Regulations 7 and 24- 26, Part A |
    |  |  | and for approving alternative compliance plans. |  |  |  |
    | 2004 | Mar. 12 | Revisions adopted in conjunction with the early action compact ozone action plan – control of emissions from condensate operation at oil and gas facilities, emissions from internal combustion engines, emissions from gas processing plants, and emissions from oil and gas operations dehydrators. | Sections I.A.; I.B.; XII.; XVI. | Part A, Section I.A.; Part A, Section I.B.; Part D, Section I.; Part E, Section I. | Regulations 7 and 24- 26, Part A |
    | 2004 | Dec. 16 | Revisions adopted in response to EPA comments (re practical enforceability) on the ozone action plan adopted 3/2004. | Sections I.A.; II.A.; XII.; XVI.; | Part A, Section I.A.; Part A, Section II.A.; Part D, Section I.; Part E, Section I. | Regulations 7 and 24- 26, Part A |
    | 2006 | Dec. 17 | Expanding oil and gas condensate tank emission controls. | Section XII. | Part D, Section I. | Regulation 7, Part B (fkna Part D) |
    | 2006 | Dec. 17 | Reduce emissions from oil and gas operations and natural gas fired engines. | Sections I.A.1.b.; XVII. | Part A, Section I.A.; Part D., Section II. & Part E. Section I. (for engines) | Regulation 7, Part A and Part B (fkna Part D); Regulation 26, Part A and Part B (fkna Part E) |
    | 2008 | Dec. 12 | Expand VOC RACT requirements for 100 tpy sources and clarify how RACT requirements in Regulation Numbers 3 and 7 interact in the ozone nonattainment area. Make typographical and formatting changes. Revise oil and gas condensate tank and pneumatic controller requirements. | Title; Sections I.; II.; VI. through XIII.; XVII.; XVIII.; and Appendices A through F | Part A, Section I.; Part A, Section II.; Part B, Sections IV. through VI. & Part C, Sections I. through IV. & Part D, Section I.; Part D, Section II. and Part E, Section I. (for engines); Part D, Section III.; Part A, Appendix A. & Part B, Appendices B and C & Part C, | Regulation 24, Part B; Regulation 25, Part B (fkna Part C); Regulation 7, Part B (fkna Part D); Regulation 26, Part B (fkna Part E) |
    |  |  |  |  | Appendices D and E (formerly Appendix F) |  |
    | 2011 | Jan. 7 | Include engine requirements in the Regional Haze SIP. | Outline; Sections I.; XVII. | Part A, Section I.; Part E, Section I. | Regulation 26, Part B (fkna Part E) |
    | 2012 | Dec. 20 | Address EPA comments on the June 2009 submittal. Revise state-only requirements for consistency. | Sections II.; XII.; XVII. | Part A, Section II.; Part D, Section I.; Part D, Section II. | Regulation 7, Part B (fkna Part D) |
    | 2014 | Feb. 23 | Adopt additional oil and gas emission reduction requirements – auto-igniters, expand condensate tank controls, limit storage tank venting, expand dehydrator control, establish leak detection and repair program, limit venting during well maintenance and liquids unloading, expand pneumatic controller | Sections II.; XVII.; XVIII. | Part A, Section II.; Part D, Section II.; Part D, Section III. | Regulation 7, Part B (fkna Part D) |
    |  |  | requirements. |  |  |  |
    | 2016 | Nov. 17 | Adopt RACT requirements for industrial cleaning solvents, lithographic and letterpress printing, and specific major sources. Including existing combustion device auto-igniter and storage tank inspection requirements in the SIP. Adopting major source combustion equipment combustion process adjustment requirements and incorporate by reference NSPS and NESHAP for specific major sources. | Sections I.; X.; XII.; XIII.; XVI.; XIX. | Part A, Section I.; Part C, Section II.; Part D, Section I.; Part C, Section IV.; Part C, Section V.; Part E, Section III. | Regulation 25, Part B (fkna Part C); Regulation 7, Part B (fkna Part D); Regulation 26, Part B (fkna Part E) |
    | 2017 | Nov. 16 | Adopt provisions based on recommendations in EPA’s Oil and Gas Control Techniques Guideline. Revise state-only requirements for | Sections II.; XII.; XVII.; XVIII. | Part A, Section II.; Part D, Section I.; Part D, Section II.; Part D, Section III. | Regulation 7, Part B (fkna Part D) |
    |  |  | consistency. |  |  |  |
    | 2018 | July 19 | Adopt requirements for existing major source boilers, turbines, lightweight aggregate kilns, glass melting furnaces, engines. | Sections XVI.; XIX. | Part E, Section II., Part E, Section III. | Regulation 26, Part B (fkna Part E) |
    | 2018 | Nov. 15 | Adopt requirements for major source breweries and wood furniture manufacturing. Address EPA concerns with requirements for industrial cleaning solvents, metal furniture surface coating, and miscellaneous metal surface coating. Updated incorporation by reference dates. | Sections I.; II.; VI.; VIII.; IX.; X.; XII.; XIII.; XVI.; XVII.; XIX.; XX.; XXI. | Part A, Section I.; Part A, Section II.; Part B, Section IV; Part B, Section VI.; Part C, Section I.; Part C, Section X.; Part D, Section I.; Part C, Section IV.; Part C, Section V.; Part D, Section II.; Part E, Section III.; Part E, Section IV. Part F | Regulation 24, Part B; Regulation 25, Part B (fkna Part C); Regulation 7, Part B (fkna Part D); Regulation 26, Part B (fkna Part E); Regulation 23 (fkna Part F) |
    | 2019 | Dec. 19 | Reorganized into Parts A through F. Replaced the SIP system-wide condensate tank control program with a fixed threshold storage tank control program. Increased state-only, state- wide storage tank controls. Adopted oil and gas storage tank measurement system, hydrocarbon liquids loadout, leak detection and repair, well plugging, and pneumatic controller requirements. Adopted an oil and gas transmission and storage segment methane intensity program. Adopted an annual oil and gas inventory program. Expanded SIP requirements to 50 tpy sources. | Sections I. through XX. and Appendices A through F | (see reorganization cross walk) |  |
    |  |  | Aligned gasoline tank truck testing requirements with federal requirements as SIP clean-up. |  |  |  |
    | 2020 | Sept. 23 | Adopted requirements for natural gas fired 1,000 horsepower engines. Adopted flowback vessel control requirements and pre- and early- production monitoring requirements. Expanded hydrocarbon liquids loadout requirements to class II disposal well facilities. |  | Part D, Sections II.; IV.; V.; VI.; Part E, Section I. | Regulation 7, Part B (fkna Part D); Regulation 26, Part B (fkna Part E) |
    | 2020 | Dec. 18 | Adopted requirements for major source foam manufacturing, boilers, turbines, landfill and biogas fired engines, and wood surface coating. |  | Part D, Section II.; Part E, Sections II.; IV.; V. | Regulation 7, Part B (fkna Part D); Regulation 26, Part B (fkna Part E) |
    | 2021 | Feb. 18 | Adopted non- emitting pneumatic controller requirements for new facilities and existing pneumatic controller retrofit requirements for existing facilities. |  | Part D, Section III. | Regulation 7, Part B (fkna Part D) |
    | 2021 | July 16 | Adopted requirements for metal parts surface coating and major source process heaters. |  | Part C, Section I.; Part D, Section III.; Part E, Section II. | Regulation 25, Part B (fkna Part C); Regulation 7, Part B (fkna Part D); Regulation 26, Part B (fkna Part E) |
    | 2021 | Dec. 17 | Adopted SIP revisions to address EPA concerns with the EPA Oil and Gas CTG. Adopted oil and gas combustion device performance testing requirements. Expanded reciprocating compressor rod packing, leak |  | Part D, Sections I., II., III., V., VI. | Regulation 7, Part B (fkna Part D) |
    |  |  | detection and repair, and pneumatic controller requirements at natural gas processing plants. Expanded leak detection and repair, separator, and well maintenance requirements. Adopted pigging and blowdown requirements. |  |  |  |
    | 2022 | Dec. 15 | Adopted requirements for major source combustion equipment, wood coating, solvent use, bakery operation, digital printing, poultry waste processing, oil stabilization facilities, class II injection well facilities, and industrial waste; included state only provisions as SIP strengthening |  | Part E, Sections I., II., III., VI., VII., and VIII., Part C., Sections I., II., and IV., and Part D, Section II.; Part D, Sections II., ; Part A, Sections I. and II.; Part C, Section I.; and Part B, Section IV. | Regulation 24, Part B (fkna Part B); Regulation 25, Part B (fkna Part C); Regulation 7, Part B (fkna Part D); Regulation 26, Part B (fkna Part E) |
    |  |  | measures; clarified the applicability of requirements to newly classified ozone nonattainment areas; included requirements for motor vehicle materials and automotive coatings; expanded gasoline tank truck testing requirements. |  |  |  |

After:

    | Year of rule adoption | Date of rule adoption | Summary of rule(s) adopted | Regulation 7 Section (pre-2019 numbering) | Regulation 7 Section (numbering as of 12.2022) | Rule & Section (as of 4.2023) |
    | 1995 | Dec. 21 | Clarify substances that are negligibly reactive VOCs. | Section II.B. | Part A, Section II.B. | Regulations 7 and 24- 26, Part A |
    | 1996 | Mar. 21 | Revisions related to the maintenance demonstration. | Sections I.A.1. through I.A.4.; II.D.; II.E. | Part A, Sections I.A.1. through I.A.4.; II.D.; II.E. | Regulations 7 and 24- 26, Part A |
    | 1996 | Nov. 21 | Updated NRVOC list. Removed control of VOC emissions from dry cleaning facilities using perchloroethylene. | Section XII. | NA | NA |
    | 1998 | Oct. 15 | Revisions specific to Gates Rubber Company. | Section II.F. | NA | Regulation 24-25, Part A |
    | 2001 | Jan. 11 | Correct discrepancies in posted versus adopted provisions. | Sections III.C.; IX.L.2.c.(1); X.D.2. through XI.A.3. | Part B, Section I.; Part C, Section I.; Part C, Sections II. through III. | Regulation 24, Part B; Regulation 25, Part B (fkna Part C) |
    | 2003 | Nov. 20 | Repealed provisions establishing a procedure for granting exemptions for de minimis sources and for approving alternative compliance plans. | Sections I.A.2. through I.A.4.; II.D.; II.E. | Part A, Sections I.A.1. through I.A.4.; II.D.; II.E. | Regulations 7 and 24- 26, Part A |
    | 2004 | Mar. 12 | Revisions adopted in conjunction with the early action compact ozone action plan – control of emissions from condensate operation at oil and gas facilities, emissions from internal combustion engines, emissions from gas processing plants, and emissions from oil and gas operations dehydrators. | Sections I.A.; I.B.; XII.; XVI. | Part A, Section I.A.; Part A, Section I.B.; Part D, Section I.; Part E, Section I. | Regulations 7 and 24- 26, Part A |
    | 2004 | Dec. 16 | Revisions adopted in response to EPA comments (re practical enforceability) on the ozone action plan adopted 3/2004. | Sections I.A.; II.A.; XII.; XVI.; | Part A, Section I.A.; Part A, Section II.A.; Part D, Section I.; Part E, Section I. | Regulations 7 and 24- 26, Part A |
    | 2006 | Dec. 17 | Expanding oil and gas condensate tank emission controls. | Section XII. | Part D, Section I. | Regulation 7, Part B (fkna Part D) |
    | 2006 | Dec. 17 | Reduce emissions from oil and gas operations and natural gas fired engines. | Sections I.A.1.b.; XVII. | Part A, Section I.A.; Part D., Section II. & Part E. Section I. (for engines) | Regulation 7, Part A and Part B (fkna Part D); Regulation 26, Part A and Part B (fkna Part E) |
    | 2008 | Dec. 12 | Expand VOC RACT requirements for 100 tpy sources and clarify how RACT requirements in Regulation Numbers 3 and 7 interact in the ozone nonattainment area. Make typographical and formatting changes. Revise oil and gas condensate tank and pneumatic controller requirements. | Title; Sections I.; II.; VI. through XIII.; XVII.; XVIII.; and Appendices A through F | Part A, Section I.; Part A, Section II.; Part B, Sections IV. through VI. & Part C, Sections I. through IV. & Part D, Section I.; Part D, Section II. and Part E, Section I. (for engines); Part D, Section III.; Part A, Appendix A. & Part B, Appendices B and C & Part C, Appendices D and E (formerly Appendix F) | Regulation 24, Part B; Regulation 25, Part B (fkna Part C); Regulation 7, Part B (fkna Part D); Regulation 26, Part B (fkna Part E) |
    | 2011 | Jan. 7 | Include engine requirements in the Regional Haze SIP. | Outline; Sections I.; XVII. | Part A, Section I.; Part E, Section I. | Regulation 26, Part B (fkna Part E) |
    | 2012 | Dec. 20 | Address EPA comments on the June 2009 submittal. Revise state-only requirements for consistency. | Sections II.; XII.; XVII. | Part A, Section II.; Part D, Section I.; Part D, Section II. | Regulation 7, Part B (fkna Part D) |
    | 2014 | Feb. 23 | Adopt additional oil and gas emission reduction requirements – auto-igniters, expand condensate tank controls, limit storage tank venting, expand dehydrator control, establish leak detection and repair program, limit venting during well maintenance and liquids unloading, expand pneumatic controller requirements. | Sections II.; XVII.; XVIII. | Part A, Section II.; Part D, Section II.; Part D, Section III. | Regulation 7, Part B (fkna Part D) |
    | 2016 | Nov. 17 | Adopt RACT requirements for industrial cleaning solvents, lithographic and letterpress printing, and specific major sources. Including existing combustion device auto-igniter and storage tank inspection requirements in the SIP. Adopting major source combustion equipment combustion process adjustment requirements and incorporate by reference NSPS and NESHAP for specific major sources. | Sections I.; X.; XII.; XIII.; XVI.; XIX. | Part A, Section I.; Part C, Section II.; Part D, Section I.; Part C, Section IV.; Part C, Section V.; Part E, Section III. | Regulation 25, Part B (fkna Part C); Regulation 7, Part B (fkna Part D); Regulation 26, Part B (fkna Part E) |
    | 2017 | Nov. 16 | Adopt provisions based on recommendations in EPA’s Oil and Gas Control Techniques Guideline. Revise state-only requirements for consistency. | Sections II.; XII.; XVII.; XVIII. | Part A, Section II.; Part D, Section I.; Part D, Section II.; Part D, Section III. | Regulation 7, Part B (fkna Part D) |
    | 2018 | July 19 | Adopt requirements for existing major source boilers, turbines, lightweight aggregate kilns, glass melting furnaces, engines. | Sections XVI.; XIX. | Part E, Section II., Part E, Section III. | Regulation 26, Part B (fkna Part E) |
    | 2018 | Nov. 15 | Adopt requirements for major source breweries and wood furniture manufacturing. Address EPA concerns with requirements for industrial cleaning solvents, metal furniture surface coating, and miscellaneous metal surface coating. Updated incorporation by reference dates. | Sections I.; II.; VI.; VIII.; IX.; X.; XII.; XIII.; XVI.; XVII.; XIX.; XX.; XXI. | Part A, Section I.; Part A, Section II.; Part B, Section IV; Part B, Section VI.; Part C, Section I.; Part C, Section X.; Part D, Section I.; Part C, Section IV.; Part C, Section V.; Part D, Section II.; Part E, Section III.; Part E, Section IV. Part F | Regulation 24, Part B; Regulation 25, Part B (fkna Part C); Regulation 7, Part B (fkna Part D); Regulation 26, Part B (fkna Part E); Regulation 23 (fkna Part F) |
    | 2019 | Dec. 19 | Reorganized into Parts A through F. Replaced the SIP system-wide condensate tank control program with a fixed threshold storage tank control program. Increased state-only, state- wide storage tank controls. Adopted oil and gas storage tank measurement system, hydrocarbon liquids loadout, leak detection and repair, well plugging, and pneumatic controller requirements. Adopted an oil and gas transmission and storage segment methane intensity program. Adopted an annual oil and gas inventory program. Expanded SIP requirements to 50 tpy sources. | Sections I. through XX. and Appendices A through F | (see reorganization cross walk) |  |
    |  |  | Aligned gasoline tank truck testing requirements with federal requirements as SIP clean-up. |  |  |  |
    | 2020 | Sept. 23 | Adopted requirements for natural gas fired 1,000 horsepower engines. Adopted flowback vessel control requirements and pre- and early- production monitoring requirements. Expanded hydrocarbon liquids loadout requirements to class II disposal well facilities. |  | Part D, Sections II.; IV.; V.; VI.; Part E, Section I. | Regulation 7, Part B (fkna Part D); Regulation 26, Part B (fkna Part E) |
    | 2020 | Dec. 18 | Adopted requirements for major source foam manufacturing, boilers, turbines, landfill and biogas fired engines, and wood surface coating. |  | Part D, Section II.; Part E, Sections II.; IV.; V. | Regulation 7, Part B (fkna Part D); Regulation 26, Part B (fkna Part E) |
    | 2021 | Feb. 18 | Adopted non- emitting pneumatic controller requirements for new facilities and existing pneumatic controller retrofit requirements for existing facilities. |  | Part D, Section III. | Regulation 7, Part B (fkna Part D) |
    | 2021 | July 16 | Adopted requirements for metal parts surface coating and major source process heaters. |  | Part C, Section I.; Part D, Section III.; Part E, Section II. | Regulation 25, Part B (fkna Part C); Regulation 7, Part B (fkna Part D); Regulation 26, Part B (fkna Part E) |
    | 2021 | Dec. 17 | Adopted SIP revisions to address EPA concerns with the EPA Oil and Gas CTG. Adopted oil and gas combustion device performance testing requirements. Expanded reciprocating compressor rod packing, leak detection and repair, and pneumatic controller requirements at natural gas processing plants. Expanded leak detection and repair, separator, and well maintenance requirements. Adopted pigging and blowdown requirements. |  | Part D, Sections I., II., III., V., VI. | Regulation 7, Part B (fkna Part D) |
    | 2022 | Dec. 15 | Adopted requirements for major source combustion equipment, wood coating, solvent use, bakery operation, digital printing, poultry waste processing, oil stabilization facilities, class II injection well facilities, and industrial waste; included state only provisions as SIP strengthening measures; clarified the applicability of requirements to newly classified ozone nonattainment areas; included requirements for motor vehicle materials and automotive coatings; expanded gasoline tank truck testing requirements. |  | Part E, Sections I., II., III., VI., VII., and VIII., Part C., Sections I., II., and IV., and Part D, Section II.; Part D, Sections II., ; Part A, Sections I. and II.; Part C, Section I.; and Part B, Section IV. | Regulation 24, Part B (fkna Part B); Regulation 25, Part B (fkna Part C); Regulation 7, Part B (fkna Part D); Regulation 26, Part B (fkna Part E) |

### sec-8-B-II-B-2 (table 1): body rows 5 -> 3, header columns 4 -> 4

Before:

    | Certification | Amount |  |  |
    |  | 1 year | 2 years | 3 years |
    | GAC (initial) | $2,000.00 | N/A | N/A |
    | GAC (renewal) | $1,000.00 | $2,000.00 | $3,000.00 |
    |  |  |  |  |
    |  |  |  |  |

After:

    | Certification | Amount |  |  |
    |  | 1 year | 2 years | 3 years |
    | GAC (initial) | $2,000.00 | N/A | N/A |
    | GAC (renewal) | $1,000.00 | $2,000.00 | $3,000.00 |

### sec-gp05-IV-B-4 (table 1): body rows 11 -> 9, header columns 4 -> 4

Before:

    | Effective Date of Registration1 | Classification | Permitted VOC Emissions | Monitoring Frequency |
    | Prior to Issuance 5 | Any | Any | Weekly |
    | On or after Issuance 5 | Attainment | Less than 80 TPY | Weekly |
    | On or after Issuance 5 | Attainment | Greater than or equal to | Daily |
    |  |  | 80 TPY |  |
    | On or after Issuance 5 | Marginal/Moderate Ozone Non- Attainment | Less than 80 TPY | Weekly |
    | On or after Issuance 5 | Marginal/Moderate Ozone Non- Attainment | Greater than or equal to 80 TPY | Daily |
    | On or after Issuance 5 | Serious Ozone Non-Attainment | Less than 40 TPY | Weekly |
    | On or after Issuance 5 | Serious Ozone Non-Attainment | Greater than or equal to 40 TPY | Daily |
    | On or after Issuance 5 | Severe Ozone Non- Attainment | Less than 15 TPY | Weekly |
    | On or after Issuance 5 | Severe Ozone Non- Attainment | Greater than or equal to | Daily |
    |  |  | 15 TPY |  |

After:

    | Effective Date of Registration1 | Classification | Permitted VOC Emissions | Monitoring Frequency |
    | Prior to Issuance 5 | Any | Any | Weekly |
    | On or after Issuance 5 | Attainment | Less than 80 TPY | Weekly |
    | On or after Issuance 5 | Attainment | Greater than or equal to 80 TPY | Daily |
    | On or after Issuance 5 | Marginal/Moderate Ozone Non- Attainment | Less than 80 TPY | Weekly |
    | On or after Issuance 5 | Marginal/Moderate Ozone Non- Attainment | Greater than or equal to 80 TPY | Daily |
    | On or after Issuance 5 | Serious Ozone Non-Attainment | Less than 40 TPY | Weekly |
    | On or after Issuance 5 | Serious Ozone Non-Attainment | Greater than or equal to 40 TPY | Daily |
    | On or after Issuance 5 | Severe Ozone Non- Attainment | Less than 15 TPY | Weekly |
    | On or after Issuance 5 | Severe Ozone Non- Attainment | Greater than or equal to 15 TPY | Daily |

### sec-gp05-VI-D (table 1): body rows 9 -> 7, header columns 4 -> 4

Before:

    | Effective Date of Registration2 | Classification | Permitted VOC Emissions | Frequency |
    | Prior to | Any | Any | Every 5 |
    | Issuance 5 |  |  | years |
    | On or after Issuance 5 | Marginal/Moderate Ozone Non- Attainment | Less than 90 TPY | Every 5 years |
    | On or after Issuance 5 | Marginal/Moderate Ozone Non- Attainment | Greater than or equal to 90 TPY | Annually |
    | On or after Issuance 5 | Serious Ozone Non-Attainment | Less than 40 TPY | Every 5 years |
    | On or after Issuance 5 | Serious Ozone Non-Attainment | Greater than or equal to 40 TPY | Annually |
    | On or after Issuance 5 | Severe Ozone Non- Attainment | Less than 15 TPY | Every 5 years |
    | On or after | Severe Ozone Non- | Greater | Annually |
    | Issuance 5 | Attainment | than or equal to 15 TPY |  |

After:

    | Effective Date of Registration2 | Classification | Permitted VOC Emissions | Frequency |
    | Prior to Issuance 5 | Any | Any | Every 5 years |
    | On or after Issuance 5 | Marginal/Moderate Ozone Non- Attainment | Less than 90 TPY | Every 5 years |
    | On or after Issuance 5 | Marginal/Moderate Ozone Non- Attainment | Greater than or equal to 90 TPY | Annually |
    | On or after Issuance 5 | Serious Ozone Non-Attainment | Less than 40 TPY | Every 5 years |
    | On or after Issuance 5 | Serious Ozone Non-Attainment | Greater than or equal to 40 TPY | Annually |
    | On or after Issuance 5 | Severe Ozone Non- Attainment | Less than 15 TPY | Every 5 years |
    | On or after Issuance 5 | Severe Ozone Non- Attainment | Greater than or equal to 15 TPY | Annually |

### sec-gp08-IV-C (table 1): body rows 10 -> 9, header columns 4 -> 4

Before:

    | Effective Date of Registration1 | Classification | Permitted VOC Emissions | Monitoring Frequency |
    | Prior to Issuance 4 | Any | Any | Weekly |
    | On or after Issuance 4 | Attainment | Less than 80 TPY | Weekly |
    | On or after Issuance 4 | Attainment | Greater than or equal to 80 TPY | Daily |
    | On or after Issuance 4 | Marginal/Moderate Ozone Non- Attainment | Less than 80 TPY | Weekly |
    | On or after Issuance 4 | Marginal/Moderate Ozone Non- Attainment | Greater than or equal to 80 TPY | Daily |
    | On or after Issuance 4 | Serious Ozone Non- Attainment | Less than 40 TPY | Weekly |
    | On or after | Serious Ozone Non- | Greater than or | Daily |
    | Issuance 4 | Attainment | equal to 40 TPY |  |
    | On or after Issuance 4 | Severe Ozone Non- Attainment | Less than 15 TPY | Weekly |
    | On or after Issuance 4 | Severe Ozone Non- Attainment | Greater than or equal to 15 TPY | Daily |

After:

    | Effective Date of Registration1 | Classification | Permitted VOC Emissions | Monitoring Frequency |
    | Prior to Issuance 4 | Any | Any | Weekly |
    | On or after Issuance 4 | Attainment | Less than 80 TPY | Weekly |
    | On or after Issuance 4 | Attainment | Greater than or equal to 80 TPY | Daily |
    | On or after Issuance 4 | Marginal/Moderate Ozone Non- Attainment | Less than 80 TPY | Weekly |
    | On or after Issuance 4 | Marginal/Moderate Ozone Non- Attainment | Greater than or equal to 80 TPY | Daily |
    | On or after Issuance 4 | Serious Ozone Non- Attainment | Less than 40 TPY | Weekly |
    | On or after Issuance 4 | Serious Ozone Non- Attainment | Greater than or equal to 40 TPY | Daily |
    | On or after Issuance 4 | Severe Ozone Non- Attainment | Less than 15 TPY | Weekly |
    | On or after Issuance 4 | Severe Ozone Non- Attainment | Greater than or equal to 15 TPY | Daily |

### sec-gp08-VI-D (table 1): body rows 8 -> 7, header columns 4 -> 4

Before:

    | Effective Date of Registration2 | Classification | Permitted VOC Emissions | Frequency |
    | Prior to Issuance 4 | Any | Any | Every 5 years |
    | On or after Issuance 4 | Marginal/Moderate Ozone Non- Attainment | Less than 90 TPY | Every 5 years |
    | On or after Issuance 4 | Marginal/Moderate Ozone Non- Attainment | Greater than or equal to 90 TPY | Annually |
    | On or after Issuance 4 | Serious Ozone Non- Attainment | Less than 40 TPY | Every 5 years |
    | On or after Issuance 4 | Serious Ozone Non- Attainment | Greater than or equal to 40 TPY | Annually |
    | On or after Issuance 4 | Severe Ozone Non- Attainment | Less than 15 TPY | Every 5 years |
    | On or after | Severe Ozone Non- | Greater than or | Annually |
    | Issuance 4 | Attainment | equal to 15 TPY |  |

After:

    | Effective Date of Registration2 | Classification | Permitted VOC Emissions | Frequency |
    | Prior to Issuance 4 | Any | Any | Every 5 years |
    | On or after Issuance 4 | Marginal/Moderate Ozone Non- Attainment | Less than 90 TPY | Every 5 years |
    | On or after Issuance 4 | Marginal/Moderate Ozone Non- Attainment | Greater than or equal to 90 TPY | Annually |
    | On or after Issuance 4 | Serious Ozone Non- Attainment | Less than 40 TPY | Every 5 years |
    | On or after Issuance 4 | Serious Ozone Non- Attainment | Greater than or equal to 40 TPY | Annually |
    | On or after Issuance 4 | Severe Ozone Non- Attainment | Less than 15 TPY | Every 5 years |
    | On or after Issuance 4 | Severe Ozone Non- Attainment | Greater than or equal to 15 TPY | Annually |

### sec-gp09-VI-A-2 (table 1): body rows 11 -> 10, header columns 2 -> 2

Before:

    | Emission Source | Monthly records of the following data |
    | Natural gas fired engine | Natural gas fuel consumption |
    | Storage tanks | Produced water, crude oil, condensate, and intermediate hydrocarbon liquid throughput. When a vapor recovery unit (VRU) is present: produced water, crude oil, condensate, and intermediate |
    |  | hydrocarbon liquid throughput during VRU downtime. |
    | Hydrocarbon liquid loadout to tanker trucks | Crude oil, condensate, and intermediate hydrocarbon liquid throughput. When a vapor recovery unit (VRU) is present: Produced water, crude oil, condensate and intermediate hydrocarbon liquid throughput during VRU downtime |
    | Gas venting from separators | Natural gas vented to combustion device |
    | Natural gas-driven diaphragm pneumatic pumps | Natural gas actuation throughput |
    | Natural gas fired turbines | Natural gas fuel consumption |
    | Natural gas-driven pneumatic controllers | Number and type of pneumatic controller |
    | Fugitive component leaks | Number, type, and gas/liquid service of components |
    | Routine or predictable gas | Emitted volume of gas and data necessary |
    | venting emissions | to complete calculation of emitted mass of pollutants |

After:

    | Emission Source | Monthly records of the following data |
    | Natural gas fired engine | Natural gas fuel consumption |
    | Storage tanks | Produced water, crude oil, condensate, and intermediate hydrocarbon liquid throughput. When a vapor recovery unit (VRU) is present: produced water, crude oil, condensate, and intermediate hydrocarbon liquid throughput during VRU downtime. |
    | Hydrocarbon liquid loadout to tanker trucks | Crude oil, condensate, and intermediate hydrocarbon liquid throughput. When a vapor recovery unit (VRU) is present: Produced water, crude oil, condensate and intermediate hydrocarbon liquid throughput during VRU downtime |
    | Gas venting from separators | Natural gas vented to combustion device |
    | Natural gas-driven diaphragm pneumatic pumps | Natural gas actuation throughput |
    | Natural gas fired turbines | Natural gas fuel consumption |
    | Natural gas-driven pneumatic controllers | Number and type of pneumatic controller |
    | Fugitive component leaks | Number, type, and gas/liquid service of components |
    | Routine or predictable gas | Emitted volume of gas and data necessary |
    | venting emissions | to complete calculation of emitted mass of pollutants |

### sec-gp12-VI-E-5-h (table 1): body rows 10 -> 9, header columns 3 -> 3

Before:

    | Area classification | Permitted facility- wide VOC emissions | Monitoring Frequency |
    | Attainment | Less than 90 TPY | Weekly |
    | Attainment | Greater than or equal to 90 TPY | Daily |
    | Marginal/Moderate Non- | Less than 90 TPY | Weekly |
    | Attainment |  |  |
    | Marginal/Moderate Non- Attainment | Greater than or equal to 90 TPY | Daily |
    | Serious Non-Attainment | Less than 40 TPY | Weekly |
    | Serious Non-Attainment | Greater than or equal to 40 TPY | Daily |
    | Severe Non-Attainment | Less than 15 TPY | Weekly |
    | Severe Non-Attainment | Greater than or equal to 15 TPY | Daily |
    | Extreme Ozone Non- attainment | Any emissions | Daily |

After:

    | Area classification | Permitted facility- wide VOC emissions | Monitoring Frequency |
    | Attainment | Less than 90 TPY | Weekly |
    | Attainment | Greater than or equal to 90 TPY | Daily |
    | Marginal/Moderate Non- Attainment | Less than 90 TPY | Weekly |
    | Marginal/Moderate Non- Attainment | Greater than or equal to 90 TPY | Daily |
    | Serious Non-Attainment | Less than 40 TPY | Weekly |
    | Serious Non-Attainment | Greater than or equal to 40 TPY | Daily |
    | Severe Non-Attainment | Less than 15 TPY | Weekly |
    | Severe Non-Attainment | Greater than or equal to 15 TPY | Daily |
    | Extreme Ozone Non- attainment | Any emissions | Daily |

### sec-gp12-VII-C-2-c-(ii) (table 1): body rows 10 -> 9, header columns 4 -> 4

Before:

    | Area classification | Facility-wide permitted VOC emissions | Sampling Frequency | Sampling frequency for storage tanks with actual uncontrolled VOC emissions ≥ 80 tons per year. |
    | Attainment | Less than 90 TPY | Every five years | Every two years |
    | Attainment | Greater than or equal to 90 TPY | Annually | Annually |
    | Marginal/Moderate Non- Attainment | Less than 90 TPY | Every five years | Every two years |
    | Marginal/Moderate Non- Attainment | Greater than or equal to 90 TPY | Annually | Annually |
    | Serious Non-Attainment | Less than 40 TPY | Every five | Every two years |
    |  |  | years |  |
    | Serious Non-Attainment | Greater than or equal to 40 TPY | Annually | Annually |
    | Severe Non-Attainment | Less than 15 TPY | Every five years | Every two years |
    | Severe Non-Attainment | Greater than or equal to 15 TPY | Annually | Annually |
    | Extreme Ozone Non- attainment | Any emissions | Annually | Annually |

After:

    | Area classification | Facility-wide permitted VOC emissions | Sampling Frequency | Sampling frequency for storage tanks with actual uncontrolled VOC emissions ≥ 80 tons per year. |
    | Attainment | Less than 90 TPY | Every five years | Every two years |
    | Attainment | Greater than or equal to 90 TPY | Annually | Annually |
    | Marginal/Moderate Non- Attainment | Less than 90 TPY | Every five years | Every two years |
    | Marginal/Moderate Non- Attainment | Greater than or equal to 90 TPY | Annually | Annually |
    | Serious Non-Attainment | Less than 40 TPY | Every five years | Every two years |
    | Serious Non-Attainment | Greater than or equal to 40 TPY | Annually | Annually |
    | Severe Non-Attainment | Less than 15 TPY | Every five years | Every two years |
    | Severe Non-Attainment | Greater than or equal to 15 TPY | Annually | Annually |
    | Extreme Ozone Non- attainment | Any emissions | Annually | Annually |

### sec-ooooa-TABLE-3 (table 1): body rows 20 -> 19, header columns 4 -> 4

Before:

    | General provisions | Subject of | Applies to | Explanation |
    | citation | citation | subpart? |  |
    | § 60.1 | General applicability of the General Provisions | Yes |  |
    | § 60.2 | Definitions | Yes | Additional terms defined in § 60.5430a. |
    | § 60.3 | Units and abbreviations | Yes |  |
    | § 60.4 § 60.5 | Address Determination Yes of construction or modification | Yes |  |
    | § 60.6 | Review of plans | Yes |  |
    | § 60.7 | Notification and record keeping | Yes | Except that § 60.7 only applies as specified in § 60.5420a(a). |
    | § 60.8 | Performance tests | Yes | Except that the format of performance test reports is described in § 60.5420a(b). Performance testing is required for control devices used on storage vessels, centrifugal compressors, and pneumatic pumps, except that performance testing is not required for a control device used solely on pneumatic pump(s). |
    | § 60.9 | Availability of information | Yes |  |
    | § 60.10 | State authority | Yes |  |
    | § 60.11 General | Compliance with standards and Subject of | No Applies | Requirements are specified in subpart OOOOa. |
    | provisions citation | citation maintenance requirements | to subpart? | Explanation |
    | § 60.12 | Circumvention | Yes |  |
    | § 60.13 | Monitoring requirements | Yes | Continuous monitors are required for storage vessels. |
    | § 60.14 | Modification | Yes | To the extent any provision in § 60.14 conflicts with specific provisions in subpart OOOOa, it is superseded by subpart OOOOa provisions. |
    | § 60.15 | Reconstruction Yes |  | Except that § 60.15(d) does not apply to wells, pneumatic controllers, pneumatic pumps, centrifugal compressors, reciprocating compressors, storage vessels, or the collection of fugitive emissions components at a well site or the collection of fugitive emissions components at a compressor station. |
    | § 60.16 | Priority list | Yes |  |
    | § 60.17 | Incorporations by reference | Yes |  |
    | § 60.18 | General control device and work practice requirements | Yes |  |
    | § 60.19 | General notification and reporting requirement | Yes |  |

After:

    | General provisions citation | Subject of citation | Applies to subpart? | Explanation |
    | § 60.1 | General applicability of the General Provisions | Yes |  |
    | § 60.2 | Definitions | Yes | Additional terms defined in § 60.5430a. |
    | § 60.3 | Units and abbreviations | Yes |  |
    | § 60.4 § 60.5 | Address Determination Yes of construction or modification | Yes |  |
    | § 60.6 | Review of plans | Yes |  |
    | § 60.7 | Notification and record keeping | Yes | Except that § 60.7 only applies as specified in § 60.5420a(a). |
    | § 60.8 | Performance tests | Yes | Except that the format of performance test reports is described in § 60.5420a(b). Performance testing is required for control devices used on storage vessels, centrifugal compressors, and pneumatic pumps, except that performance testing is not required for a control device used solely on pneumatic pump(s). |
    | § 60.9 | Availability of information | Yes |  |
    | § 60.10 | State authority | Yes |  |
    | § 60.11 General | Compliance with standards and Subject of | No Applies | Requirements are specified in subpart OOOOa. |
    | provisions citation | citation maintenance requirements | to subpart? | Explanation |
    | § 60.12 | Circumvention | Yes |  |
    | § 60.13 | Monitoring requirements | Yes | Continuous monitors are required for storage vessels. |
    | § 60.14 | Modification | Yes | To the extent any provision in § 60.14 conflicts with specific provisions in subpart OOOOa, it is superseded by subpart OOOOa provisions. |
    | § 60.15 | Reconstruction Yes |  | Except that § 60.15(d) does not apply to wells, pneumatic controllers, pneumatic pumps, centrifugal compressors, reciprocating compressors, storage vessels, or the collection of fugitive emissions components at a well site or the collection of fugitive emissions components at a compressor station. |
    | § 60.16 | Priority list | Yes |  |
    | § 60.17 | Incorporations by reference | Yes |  |
    | § 60.18 | General control device and work practice requirements | Yes |  |
    | § 60.19 | General notification and reporting requirement | Yes |  |

### sec-ooooc-TABLE-4 (table 1): body rows 21 -> 20, header columns 4 -> 4

Before:

    | General provisions | Subject of | Applies to | Explanation |
    | citation | citation | subpart? |  |
    | § 60.1 General | General Subject of | Yes Applies |  |
    | provisions citation | citation applicability of the General Provisions | to subpart? | Explanation |
    | § 60.2 | Definitions | Yes | Additional terms defined in § 60.5430c. |
    | § 60.3 | Units and abbreviations | Yes |  |
    | § 60.4 § 60.5 | Address Determination Yes of construction or modification | Yes |  |
    | § 60.6 | Review of plans | Yes |  |
    | § 60.7 | Notification and record keeping | Yes | Except that § 60.7 only applies as specified in §§ 60.5417c(c) and 60.5420c(a). |
    | § 60.8 | Performance tests | Yes | Except that the format and submittal of performance test reports is described in § 60.5420c(b) and (d). Performance testing is required for control devices used on wells, storage vessels, centrifugal compressors, reciprocating compressors, process controllers, and pumps, as applicable, except that performance testing is not required for a control device used solely on pump(s). |
    | § 60.9 | Availability of information | Yes |  |
    | § 60.10 | State authority | Yes |  |
    | § 60.11 | Compliance with standards and maintenance requirements | No | Requirements are specified in subpart OOOOc. |
    | § 60.12 | Circumvention | Yes |  |
    | § 60.13 | Monitoring requirements | Yes | Continuous monitors are required for storage vessels. |
    | § 60.14 | Modification | Yes | To the extent any provision in § 60.14 conflicts with specific provisions in subpart OOOOc, it is superseded by subpart OOOOc provisions. |
    | § 60.15 General | Reconstruction Yes Subject of | Applies | Except that § 60.15(d) does not apply to wells (i.e., well completions, well liquids unloading, associated gas wells), process controllers, pumps, centrifugal compressors, reciprocating compressors, storage vessels, or fugitive |
    | provisions citation | citation | to subpart? | Explanation emissions components designated facilities. |
    | § 60.16 | Priority list | Yes |  |
    | § 60.17 | Incorporations by reference | Yes |  |
    | § 60.18 | General control device and work practice requirements | Yes |  |
    | § 60.19 | General notification and reporting requirement | Yes |  |

After:

    | General provisions citation | Subject of citation | Applies to subpart? | Explanation |
    | § 60.1 General | General Subject of | Yes Applies |  |
    | provisions citation | citation applicability of the General Provisions | to subpart? | Explanation |
    | § 60.2 | Definitions | Yes | Additional terms defined in § 60.5430c. |
    | § 60.3 | Units and abbreviations | Yes |  |
    | § 60.4 § 60.5 | Address Determination Yes of construction or modification | Yes |  |
    | § 60.6 | Review of plans | Yes |  |
    | § 60.7 | Notification and record keeping | Yes | Except that § 60.7 only applies as specified in §§ 60.5417c(c) and 60.5420c(a). |
    | § 60.8 | Performance tests | Yes | Except that the format and submittal of performance test reports is described in § 60.5420c(b) and (d). Performance testing is required for control devices used on wells, storage vessels, centrifugal compressors, reciprocating compressors, process controllers, and pumps, as applicable, except that performance testing is not required for a control device used solely on pump(s). |
    | § 60.9 | Availability of information | Yes |  |
    | § 60.10 | State authority | Yes |  |
    | § 60.11 | Compliance with standards and maintenance requirements | No | Requirements are specified in subpart OOOOc. |
    | § 60.12 | Circumvention | Yes |  |
    | § 60.13 | Monitoring requirements | Yes | Continuous monitors are required for storage vessels. |
    | § 60.14 | Modification | Yes | To the extent any provision in § 60.14 conflicts with specific provisions in subpart OOOOc, it is superseded by subpart OOOOc provisions. |
    | § 60.15 General | Reconstruction Yes Subject of | Applies | Except that § 60.15(d) does not apply to wells (i.e., well completions, well liquids unloading, associated gas wells), process controllers, pumps, centrifugal compressors, reciprocating compressors, storage vessels, or fugitive |
    | provisions citation | citation | to subpart? | Explanation emissions components designated facilities. |
    | § 60.16 | Priority list | Yes |  |
    | § 60.17 | Incorporations by reference | Yes |  |
    | § 60.18 | General control device and work practice requirements | Yes |  |
    | § 60.19 | General notification and reporting requirement | Yes |  |
