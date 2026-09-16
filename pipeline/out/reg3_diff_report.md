# Reg 3 import diff report

- Parsed rows: **2133**
- DB rows: **2022**
- Ids in both: **1587**
- Ids only in DB (parser gap or DB junk): **435**
- Ids only in parsed (parser found something DB doesn't have): **546**
- Text identical: **1228**
- Text where DB is a suffix of parsed (truncation confirmed): **316**
- Text different (neither identical nor a clean truncation): **43**
  - of which text also found verbatim on a nearby sibling id (amendment-driven renumbering, not a parser bug): **1**
- parent_id mismatches among shared ids: **53**
- DB rows with page-furniture leaked into full_text: **26**
- Parsed rows whose full_text starts with a lowercase letter: **2**

## Ids only in DB

(435 total)

- `sec-3-A-I-B-1-a-i`
- `sec-3-A-I-B-1-a-ii`
- `sec-3-A-I-B-1-a-iii`
- `sec-3-A-I-B-1-a-iv`
- `sec-3-A-I-B-30-b-i`
- `sec-3-A-I-B-30-b-ii`
- `sec-3-A-I-B-30-b-iii`
- `sec-3-A-I-B-30-b-iv`
- `sec-3-A-I-B-30-b-ix`
- `sec-3-A-I-B-30-b-v`
- `sec-3-A-I-B-30-b-vi`
- `sec-3-A-I-B-30-b-vii`
- `sec-3-A-I-B-30-b-viii`
- `sec-3-A-I-B-30-b-x`
- `sec-3-A-I-B-30-b-xi`
- `sec-3-A-I-B-30-b-xii`
- `sec-3-A-I-B-30-b-xiii`
- `sec-3-A-I-B-30-b-xiv`
- `sec-3-A-I-B-30-b-xix`
- `sec-3-A-I-B-30-b-xv`
- `sec-3-A-I-B-30-b-xvi`
- `sec-3-A-I-B-30-b-xvii`
- `sec-3-A-I-B-30-b-xviii`
- `sec-3-A-I-B-30-b-xx`
- `sec-3-A-I-B-30-b-xxi`
- `sec-3-A-I-B-30-b-xxii`
- `sec-3-A-I-B-30-b-xxiii`
- `sec-3-A-I-B-30-b-xxiv`
- `sec-3-A-I-B-30-b-xxv`
- `sec-3-A-I-B-30-b-xxvi`
- `sec-3-A-I-B-30-b-xxvii`
- `sec-3-A-I-B-33-b-i`
- `sec-3-A-I-B-33-b-ii`
- `sec-3-A-I-B-33-b-iii`
- `sec-3-A-I-B-33-b-iv`
- `sec-3-A-I-B-33-b-v`
- `sec-3-A-I-B-36-a-i`
- `sec-3-A-I-B-36-a-ii`
- `sec-3-A-I-B-36-a-iii`
- `sec-3-A-I-B-36-b-i`
- `sec-3-A-I-B-36-b-ii`
- `sec-3-A-I-B-36-b-iii`
- `sec-3-A-I-B-36-c-i`
- `sec-3-A-I-B-36-c-ii`
- `sec-3-A-I-B-36-c-iii`
- `sec-3-A-I-B-36-d-i`
- `sec-3-A-I-B-36-d-ii`
- `sec-3-A-I-B-36-d-iii`
- `sec-3-A-I-B-4-a-i`
- `sec-3-A-I-B-4-a-ii`
- `sec-3-A-I-B-4-a-iii`
- `sec-3-A-I-B-46-a-i`
- `sec-3-A-I-B-46-a-ii`
- `sec-3-A-I-B-46-d-i`
- `sec-3-A-I-B-46-d-ii`
- `sec-3-A-I-B-53-b-i`
- `sec-3-A-I-B-53-b-ii`
- `sec-3-A-I-B-53-d-i`
- `sec-3-A-I-B-53-d-ii`
- `sec-3-A-II-C-1-i-i`
- `sec-3-A-II-C-2-b-i`
- `sec-3-A-II-C-2-b-ii`
- `sec-3-A-II-C-2-b-iii`
- `sec-3-A-II-C-2-b-iv`
- `sec-3-A-II-D-1-aaaa-i`
- `sec-3-A-II-D-1-aaaa-ii`
- `sec-3-A-II-D-1-fff-i`
- `sec-3-A-II-D-1-fff-ii`
- `sec-3-A-II-D-1-fff-ii-A`
- `sec-3-A-II-D-1-fff-ii-B`
- `sec-3-A-II-D-1-fff-ii-C`
- `sec-3-A-II-D-1-fff-ii-D`
- `sec-3-A-II-D-1-i-i`
- `sec-3-A-II-D-1-i-ii`
- `sec-3-A-II-D-1-i-iii`
- `sec-3-A-II-D-4-b-i`
- `sec-3-A-II-D-4-b-ii`
- `sec-3-A-II-D-4-b-iii`
- `sec-3-A-II-D-4-b-iv`
- `sec-3-A-IX-A-1-c-i`
- `sec-3-A-IX-A-1-c-ii`
- `sec-3-A-IX-A-1-c-iii`
- `sec-3-A-IX-A-2-b-i`
- `sec-3-A-IX-A-2-b-ii`
- `sec-3-A-IX-A-2-b-iii`
- `sec-3-A-IX-A-2-b-iv`
- `sec-3-A-IX-A-2-b-ix`
- `sec-3-A-IX-A-2-b-l`
- `sec-3-A-IX-A-2-b-li`
- `sec-3-A-IX-A-2-b-lii`
- `sec-3-A-IX-A-2-b-liii`
- `sec-3-A-IX-A-2-b-v`
- `sec-3-A-IX-A-2-b-vi`
- `sec-3-A-IX-A-2-b-vii`
- `sec-3-A-IX-A-2-b-viii`
- `sec-3-A-IX-A-2-b-x`
- `sec-3-A-IX-A-2-b-xi`
- `sec-3-A-IX-A-2-b-xii`
- `sec-3-A-IX-A-2-b-xiii`
- `sec-3-A-IX-A-2-b-xiv`
- `sec-3-A-IX-A-2-b-xix`
- `sec-3-A-IX-A-2-b-xl`
- `sec-3-A-IX-A-2-b-xli`
- `sec-3-A-IX-A-2-b-xlii`
- `sec-3-A-IX-A-2-b-xliii`
- `sec-3-A-IX-A-2-b-xliv`
- `sec-3-A-IX-A-2-b-xlix`
- `sec-3-A-IX-A-2-b-xlv`
- `sec-3-A-IX-A-2-b-xlvi`
- `sec-3-A-IX-A-2-b-xlvii`
- `sec-3-A-IX-A-2-b-xlvii-A`
- `sec-3-A-IX-A-2-b-xlvii-B`
- `sec-3-A-IX-A-2-b-xv`
- `sec-3-A-IX-A-2-b-xvi`
- `sec-3-A-IX-A-2-b-xvii`
- `sec-3-A-IX-A-2-b-xviii`
- `sec-3-A-IX-A-2-b-xx`
- `sec-3-A-IX-A-2-b-xxi`
- `sec-3-A-IX-A-2-b-xxii`
- `sec-3-A-IX-A-2-b-xxiii`
- `sec-3-A-IX-A-2-b-xxiv`
- `sec-3-A-IX-A-2-b-xxix`
- `sec-3-A-IX-A-2-b-xxv`
- `sec-3-A-IX-A-2-b-xxvi`
- `sec-3-A-IX-A-2-b-xxvii`
- `sec-3-A-IX-A-2-b-xxx`
- `sec-3-A-IX-A-2-b-xxxi`
- `sec-3-A-IX-A-2-b-xxxii`
- `sec-3-A-IX-A-2-b-xxxiv`
- `sec-3-A-IX-A-2-b-xxxix`
- `sec-3-A-IX-A-2-b-xxxv`
- `sec-3-A-IX-A-2-b-xxxvi`
- `sec-3-A-PART-A`
- `sec-3-A-V-A-3`
- `sec-3-A-V-B-1-h`
- `sec-3-A-VI-D-1-a-i`
- `sec-3-A-VI-E-4-a-i`
- `sec-3-A-VI-E-4-a-ii`
- `sec-3-A-VI-E-4-b-i`
- `sec-3-A-VI-E-4-b-ii`
- `sec-3-A-VI-E-4-c-i`
- `sec-3-A-VI-E-4-c-ii`
- `sec-3-A-VIII-D-2-b-i`
- `sec-3-A-VIII-D-2-b-ii`
- `sec-3-A-VIII-D-2-b-iii`
- `sec-3-A-VIII-D-3-c-i`
- `sec-3-A-VIII-D-3-c-ii`
- `sec-3-A-VIII-D-3-c-iii`
- `sec-3-A-VIII-D-5-b-i`
- `sec-3-A-VIII-D-5-b-ii`
- `sec-3-A-VIII-D-5-b-iii`
- `sec-3-B-II-D-1-c-i`
- `sec-3-B-II-D-1-c-ii`
- `sec-3-B-II-D-1-c-iii`
- `sec-3-B-III-B-5-c-i`
- `sec-3-B-III-B-5-e-i`
- `sec-3-B-III-B-5-e-ii`
- `sec-3-B-III-B-5-e-iii`
- `sec-3-B-III-C-1-c-i`
- `sec-3-B-III-C-1-c-ii`
- `sec-3-B-III-C-1-c-iii`
- `sec-3-B-III-D-2-c-i`
- `sec-3-B-III-I-3-c-i`
- `sec-3-B-III-I-3-c-i-A`
- `sec-3-B-III-I-3-c-i-B`
- `sec-3-B-III-I-3-c-ii`
- `sec-3-B-III-I-3-c-iii`
- `sec-3-B-III-I-3-c-iv`
- `sec-3-B-III-I-3-c-v`
- `sec-3-B-III-J-2-b-i`
- `sec-3-B-III-J-2-b-ii`
- `sec-3-B-III-J-2-b-iii`
- `sec-3-B-III-J-2-f-i`
- `sec-3-B-III-J-4-a-i`
- `sec-3-B-III-J-4-b-i`
- `sec-3-B-III-J-4-c-i`
- `sec-3-B-PART-B`
- `sec-3-C-I-A-7-h-i`
- `sec-3-C-I-A-7-h-ii`
- `sec-3-C-II-E-3-eeee-i`
- `sec-3-C-II-E-3-eeee-ii`
- `sec-3-C-II-E-3-fff-i`
- `sec-3-C-II-E-3-fff-ii`
- `sec-3-C-II-E-3-fff-ii-A`
- `sec-3-C-II-E-3-fff-ii-B`
- `sec-3-C-II-E-3-fff-ii-C`
- `sec-3-C-II-E-3-fff-ii-D`
- `sec-3-C-II-E-3-i-i`
- `sec-3-C-II-E-3-i-ii`
- `sec-3-C-II-E-3-i-iii`
- `sec-3-C-III-C-14-a-i`
- `sec-3-C-III-C-14-a-ii`
- `sec-3-C-III-C-14-a-iii`
- `sec-3-C-III-C-14-a-iii-A`
- `sec-3-C-III-C-14-a-iii-B`
- `sec-3-C-PART-C`
- `sec-3-C-V-C-16-b-i`
- `sec-3-C-V-C-16-b-ii`
- `sec-3-C-V-C-16-b-iii`
- `sec-3-C-V-C-16-b-iv`
- `sec-3-C-V-C-16-d-i`
- `sec-3-C-V-C-16-d-ii`
- `sec-3-C-V-C-16-e-i`
- `sec-3-C-V-C-16-e-ii`
- `sec-3-C-V-C-16-e-iii`
- `sec-3-C-V-C-16-e-iii-A`
- `sec-3-C-V-C-16-e-iii-B`
- `sec-3-C-V-C-16-e-iii-C`
- `sec-3-C-V-C-16-e-iii-D`
- `sec-3-C-V-C-16-e-iii-E`
- `sec-3-C-V-C-16-e-iv`
- `sec-3-C-V-C-16-e-v`
- `sec-3-C-V-C-16-e-vi`
- `sec-3-C-V-C-5-d-i`
- `sec-3-C-V-C-5-d-i-A`
- `sec-3-C-V-C-5-d-i-B`
- `sec-3-C-V-C-5-d-i-C`
- `sec-3-C-V-C-5-d-ii`
- `sec-3-C-V-C-5-d-iii`
- `sec-3-C-V-C-5-d-iv`
- `sec-3-C-V-C-5-d-iv-A`
- `sec-3-C-V-C-5-d-iv-B`
- `sec-3-C-V-C-5-d-iv-C`
- `sec-3-C-V-C-5-d-v`
- `sec-3-C-V-C-6-a-i`
- `sec-3-C-V-C-6-a-ii`
- `sec-3-C-V-C-6-a-iii`
- `sec-3-C-V-C-6-a-iv`
- `sec-3-C-V-C-6-a-v`
- `sec-3-C-V-C-6-a-vi`
- `sec-3-D-II-A-11-a-i`
- `sec-3-D-II-A-11-a-ii`
- `sec-3-D-II-A-11-a-iii`
- `sec-3-D-II-A-11-a-iv`
- `sec-3-D-II-A-11-a-v`
- `sec-3-D-II-A-11-a-vi`
- `sec-3-D-II-A-11-a-vii`
- `sec-3-D-II-A-11-a-viii`
- `sec-3-D-II-A-13-a-i`
- `sec-3-D-II-A-13-a-ii`
- `sec-3-D-II-A-13-b-i`
- `sec-3-D-II-A-13-b-ii`
- `sec-3-D-II-A-23-d-i`
- `sec-3-D-II-A-23-d-ii`
- `sec-3-D-II-A-23-d-iii`
- `sec-3-D-II-A-23-d-iv`
- `sec-3-D-II-A-23-d-iv-A`
- `sec-3-D-II-A-23-d-iv-B`
- `sec-3-D-II-A-23-d-iv-C`
- `sec-3-D-II-A-23-d-ix`
- `sec-3-D-II-A-23-d-ix-A`
- `sec-3-D-II-A-23-d-ix-B`
- `sec-3-D-II-A-23-d-v`
- `sec-3-D-II-A-23-d-vi`
- `sec-3-D-II-A-23-d-vii`
- `sec-3-D-II-A-23-d-viii`
- `sec-3-D-II-A-23-d-viii-A`
- `sec-3-D-II-A-23-d-viii-B`
- `sec-3-D-II-A-23-d-x`
- `sec-3-D-II-A-25-a-i`
- `sec-3-D-II-A-25-a-i-A`
- `sec-3-D-II-A-25-a-i-B`
- `sec-3-D-II-A-25-a-i-C`
- `sec-3-D-II-A-25-a-i-D`
- `sec-3-D-II-A-25-a-i-E`
- `sec-3-D-II-A-25-a-i-F`
- `sec-3-D-II-A-25-a-i-G`
- `sec-3-D-II-A-25-a-i-H`
- `sec-3-D-II-A-25-a-i-I`
- `sec-3-D-II-A-25-a-i-J`
- `sec-3-D-II-A-25-a-i-K`
- `sec-3-D-II-A-25-a-i-L`
- `sec-3-D-II-A-25-a-i-M`
- `sec-3-D-II-A-25-a-i-N`
- `sec-3-D-II-A-25-a-i-O`
- `sec-3-D-II-A-25-a-i-P`
- `sec-3-D-II-A-25-a-i-Q`
- `sec-3-D-II-A-25-a-i-R`
- `sec-3-D-II-A-25-a-i-S`
- `sec-3-D-II-A-25-a-i-T`
- `sec-3-D-II-A-25-a-i-U`
- `sec-3-D-II-A-25-a-i-V`
- `sec-3-D-II-A-25-a-i-W`
- `sec-3-D-II-A-25-a-i-X`
- `sec-3-D-II-A-25-a-i-Y`
- `sec-3-D-II-A-25-a-i-Z`
- `sec-3-D-II-A-25-a-ii`
- `sec-3-D-II-A-25-b-i`
- `sec-3-D-II-A-25-b-ii`
- `sec-3-D-II-A-25-b-iii`
- `sec-3-D-II-A-25-b-iv`
- `sec-3-D-II-A-25-b-v`
- `sec-3-D-II-A-25-b-vi`
- `sec-3-D-II-A-26-a-i`
- `sec-3-D-II-A-26-a-ii`
- `sec-3-D-II-A-26-a-iii`
- `sec-3-D-II-A-26-b-i`
- `sec-3-D-II-A-26-b-ii`
- `sec-3-D-II-A-27-a-i`
- `sec-3-D-II-A-27-a-ii`
- `sec-3-D-II-A-27-c-i`
- `sec-3-D-II-A-27-c-ii`
- `sec-3-D-II-A-27-c-iii`
- `sec-3-D-II-A-27-c-iv`
- `sec-3-D-II-A-27-f-i`
- `sec-3-D-II-A-27-f-ii`
- `sec-3-D-II-A-27-f-iii`
- `sec-3-D-II-A-27-f-iv`
- `sec-3-D-II-A-38-b-i`
- `sec-3-D-II-A-38-b-ii`
- `sec-3-D-II-A-38-b-iii`
- `sec-3-D-II-A-38-b-iv`
- `sec-3-D-II-A-4-a-i`
- `sec-3-D-II-A-4-a-ii`
- `sec-3-D-II-A-4-a-iii`
- `sec-3-D-II-A-4-a-iv`
- `sec-3-D-II-A-4-b-i`
- `sec-3-D-II-A-4-b-ii`
- `sec-3-D-II-A-4-b-iii`
- `sec-3-D-II-A-4-b-iv`
- `sec-3-D-II-A-4-b-v`
- `sec-3-D-II-A-4-f-i`
- `sec-3-D-II-A-4-f-ii`
- `sec-3-D-II-A-4-f-iii`
- `sec-3-D-II-A-4-f-iv`
- `sec-3-D-II-A-40-c-i`
- `sec-3-D-II-A-40-c-ii`
- `sec-3-D-II-A-40-c-iii`
- `sec-3-D-II-A-5-b-i`
- `sec-3-D-II-A-5-b-ii`
- `sec-3-D-II-A-6-c-i`
- `sec-3-D-II-A-6-c-ii`
- `sec-3-D-PART-D`
- `sec-3-D-V-A-3-a-ii`
- `sec-3-D-V-A-3-a-iii`
- `sec-3-D-V-A-3-b-i`
- `sec-3-D-V-A-3-b-ii`
- `sec-3-D-V-A-3-b-iii`
- `sec-3-D-V-A-3-b-iv`
- `sec-3-D-V-A-7-c-i`
- `sec-3-D-V-A-7-c-i-A`
- `sec-3-D-V-A-7-c-i-B`
- `sec-3-D-V-A-7-c-i-C`
- `sec-3-D-V-A-7-c-ii`
- `sec-3-D-V-A-7-c-iii`
- `sec-3-D-V-A-7-c-iv`
- `sec-3-D-V-A-7-c-v`
- `sec-3-D-V-A-7-c-v-A`
- `sec-3-D-V-A-7-c-v-B`
- `sec-3-D-V-A-7-c-v-C`
- `sec-3-D-V-A-8-a-i-A`
- `sec-3-D-V-A-8-a-i-B`
- `sec-3-D-V-A-8-a-i-C`
- `sec-3-D-V-A-8-a-i-D`
- `sec-3-D-V-A-8-a-i-E`
- `sec-3-D-VI-B-1-c-i`
- `sec-3-D-VI-B-1-c-ii`
- `sec-3-D-VI-B-1-c-iii`
- `sec-3-D-VI-B-1-c-iv`
- `sec-3-D-VI-B-3-a-i`
- `sec-3-D-VI-B-3-a-ii`
- `sec-3-D-VI-B-3-a-iii`
- `sec-3-D-VI-B-3-a-iv`
- `sec-3-D-VI-B-3-a-ix`
- `sec-3-D-VI-B-3-a-v`
- `sec-3-D-VI-B-3-a-vi`
- `sec-3-D-VI-B-3-a-vii`
- `sec-3-D-VI-B-3-a-viii`
- `sec-3-D-VI-B-5-a-i`
- `sec-3-D-VI-B-5-a-ii`
- `sec-3-D-VI-B-5-a-iii`
- `sec-3-D-VI-B-5-e-i`
- `sec-3-D-VI-B-5-e-ii`
- `sec-3-D-VI-B-5-e-iii`
- `sec-3-D-X-A-5-a-i`
- `sec-3-D-X-A-5-a-i-A`
- `sec-3-D-X-A-5-a-i-B`
- `sec-3-D-XII-B-4-a-i`
- `sec-3-D-XIV-D-2-c-i`
- `sec-3-D-XIV-D-2-c-ii`
- `sec-3-D-XIV-D-2-c-iii`
- `sec-3-D-XIV-D-2-c-iv`
- `sec-3-D-XIV-D-2-c-v`
- `sec-3-D-XIV-D-2-c-vi`
- `sec-3-D-XIV-D-2-c-vii`
- `sec-3-D-XIV-F-1-c-i`
- `sec-3-D-XIV-F-1-c-ii`
- `sec-3-D-XIV-F-1-c-iii`
- `sec-3-D-XIV-F-1-c-iv`
- `sec-3-D-XIV-F-1-c-v`
- `sec-3-D-XIV-F-1-c-vi`
- `sec-3-D-XIV-F-1-c-vii`
- `sec-3-D-XIV-G-3-b-i`
- `sec-3-D-XIV-G-3-b-ii`
- `sec-3-D-XIV-G-3-b-iii`
- `sec-3-D-XIV-G-3-b-iv`
- `sec-3-D-XIV-G-3-b-v`
- `sec-3-D-XV-I-4-c-i`
- `sec-3-D-XV-I-4-c-ii`
- `sec-3-E-PART-E`
- `sec-3-F-APPENDIX-A`
- `sec-3-F-APPENDIX-B`
- `sec-3-F-APPENDIX-C`
- `sec-3-F-APPENDIX-D`
- `sec-3-F-C`
- `sec-3-F-D`
- `sec-3-F-I-B-44`
- `sec-3-F-I-G-2`
- `sec-3-F-II`
- `sec-3-F-II-B`
- `sec-3-F-II-D-2`
- `sec-3-F-II-D-4-a-vi-A`
- `sec-3-F-II-D-4-a-vi-C`
- `sec-3-F-II-D-7`
- `sec-3-F-II-E-3-aaa`
- `sec-3-F-II-E-3-ee`
- `sec-3-F-III`
- `sec-3-F-III-D-1-c`
- `sec-3-F-IV`
- `sec-3-F-IV-C-3`
- `sec-3-F-IV-C-4-e-iii`
- `sec-3-F-IV-D-2-a-iv`
- `sec-3-F-IV-D-3-e`
- `sec-3-F-IX`
- `sec-3-F-PART-F`
- `sec-3-F-V`
- `sec-3-F-VI`
- `sec-3-F-VI-A-4`
- `sec-3-F-VI-D`
- `sec-3-F-VII`
- `sec-3-F-VIII`
- `sec-3-F-VIII-S`
- `sec-3-F-X-A-5`
- `sec-3-F-XIII-B-2`
- `sec-3-F-XVII-B-2`

## Ids only in parsed

(546 total)

- `sec-3-A-I-B-1-a-(i)`
- `sec-3-A-I-B-1-a-(ii)`
- `sec-3-A-I-B-1-a-(iii)`
- `sec-3-A-I-B-1-a-(iv)`
- `sec-3-A-I-B-30-b-(i)`
- `sec-3-A-I-B-30-b-(ii)`
- `sec-3-A-I-B-30-b-(iii)`
- `sec-3-A-I-B-30-b-(iv)`
- `sec-3-A-I-B-30-b-(ix)`
- `sec-3-A-I-B-30-b-(v)`
- `sec-3-A-I-B-30-b-(vi)`
- `sec-3-A-I-B-30-b-(vii)`
- `sec-3-A-I-B-30-b-(viii)`
- `sec-3-A-I-B-30-b-(x)`
- `sec-3-A-I-B-30-b-(xi)`
- `sec-3-A-I-B-30-b-(xii)`
- `sec-3-A-I-B-30-b-(xiii)`
- `sec-3-A-I-B-30-b-(xiv)`
- `sec-3-A-I-B-30-b-(xix)`
- `sec-3-A-I-B-30-b-(xv)`
- `sec-3-A-I-B-30-b-(xvi)`
- `sec-3-A-I-B-30-b-(xvii)`
- `sec-3-A-I-B-30-b-(xviii)`
- `sec-3-A-I-B-30-b-(xx)`
- `sec-3-A-I-B-30-b-(xxi)`
- `sec-3-A-I-B-30-b-(xxii)`
- `sec-3-A-I-B-30-b-(xxiii)`
- `sec-3-A-I-B-30-b-(xxiv)`
- `sec-3-A-I-B-30-b-(xxv)`
- `sec-3-A-I-B-30-b-(xxvi)`
- `sec-3-A-I-B-30-b-(xxvii)`
- `sec-3-A-I-B-33-b-(i)`
- `sec-3-A-I-B-33-b-(ii)`
- `sec-3-A-I-B-33-b-(iii)`
- `sec-3-A-I-B-33-b-(iv)`
- `sec-3-A-I-B-33-b-(v)`
- `sec-3-A-I-B-36-a-(i)`
- `sec-3-A-I-B-36-a-(ii)`
- `sec-3-A-I-B-36-a-(iii)`
- `sec-3-A-I-B-36-b-(i)`
- `sec-3-A-I-B-36-b-(ii)`
- `sec-3-A-I-B-36-b-(iii)`
- `sec-3-A-I-B-36-c-(i)`
- `sec-3-A-I-B-36-c-(ii)`
- `sec-3-A-I-B-36-c-(iii)`
- `sec-3-A-I-B-36-d-(i)`
- `sec-3-A-I-B-36-d-(ii)`
- `sec-3-A-I-B-36-d-(iii)`
- `sec-3-A-I-B-4-a-(i)`
- `sec-3-A-I-B-4-a-(ii)`
- `sec-3-A-I-B-4-a-(iii)`
- `sec-3-A-I-B-46-a-(i)`
- `sec-3-A-I-B-46-a-(ii)`
- `sec-3-A-I-B-46-d-(i)`
- `sec-3-A-I-B-46-d-(ii)`
- `sec-3-A-I-B-53-b-(i)`
- `sec-3-A-I-B-53-b-(ii)`
- `sec-3-A-I-B-53-d-(i)`
- `sec-3-A-I-B-53-d-(ii)`
- `sec-3-A-II-C-1-i-(i)`
- `sec-3-A-II-C-2-b-(i)`
- `sec-3-A-II-C-2-b-(ii)`
- `sec-3-A-II-C-2-b-(iii)`
- `sec-3-A-II-C-2-b-(iv)`
- `sec-3-A-II-D-1-aaaa-(i)`
- `sec-3-A-II-D-1-aaaa-(ii)`
- `sec-3-A-II-D-1-fff-(i)`
- `sec-3-A-II-D-1-fff-(ii)`
- `sec-3-A-II-D-1-fff-(ii)-(A)`
- `sec-3-A-II-D-1-fff-(ii)-(B)`
- `sec-3-A-II-D-1-fff-(ii)-(C)`
- `sec-3-A-II-D-1-fff-(ii)-(D)`
- `sec-3-A-II-D-1-i-(i)`
- `sec-3-A-II-D-1-i-(ii)`
- `sec-3-A-II-D-1-i-(iii)`
- `sec-3-A-II-D-4-b-(i)`
- `sec-3-A-II-D-4-b-(ii)`
- `sec-3-A-II-D-4-b-(iii)`
- `sec-3-A-II-D-4-b-(iv)`
- `sec-3-A-IV-C-5`
- `sec-3-A-IX-A-1-c-(i)`
- `sec-3-A-IX-A-1-c-(ii)`
- `sec-3-A-IX-A-1-c-(iii)`
- `sec-3-A-IX-A-2-b-(i)`
- `sec-3-A-IX-A-2-b-(ii)`
- `sec-3-A-IX-A-2-b-(iii)`
- `sec-3-A-IX-A-2-b-(iv)`
- `sec-3-A-IX-A-2-b-(ix)`
- `sec-3-A-IX-A-2-b-(l)`
- `sec-3-A-IX-A-2-b-(li)`
- `sec-3-A-IX-A-2-b-(lii)`
- `sec-3-A-IX-A-2-b-(liii)`
- `sec-3-A-IX-A-2-b-(liv)`
- `sec-3-A-IX-A-2-b-(lix)`
- `sec-3-A-IX-A-2-b-(lv)`
- `sec-3-A-IX-A-2-b-(lvi)`
- `sec-3-A-IX-A-2-b-(lvii)`
- `sec-3-A-IX-A-2-b-(lviii)`
- `sec-3-A-IX-A-2-b-(lx)`
- `sec-3-A-IX-A-2-b-(lxi)`
- `sec-3-A-IX-A-2-b-(lxii)`
- `sec-3-A-IX-A-2-b-(lxiii)`
- `sec-3-A-IX-A-2-b-(lxiv)`
- `sec-3-A-IX-A-2-b-(lxvi)`
- `sec-3-A-IX-A-2-b-(lxvii)`
- `sec-3-A-IX-A-2-b-(v)`
- `sec-3-A-IX-A-2-b-(vi)`
- `sec-3-A-IX-A-2-b-(vii)`
- `sec-3-A-IX-A-2-b-(viii)`
- `sec-3-A-IX-A-2-b-(x)`
- `sec-3-A-IX-A-2-b-(xi)`
- `sec-3-A-IX-A-2-b-(xii)`
- `sec-3-A-IX-A-2-b-(xiii)`
- `sec-3-A-IX-A-2-b-(xiv)`
- `sec-3-A-IX-A-2-b-(xix)`
- `sec-3-A-IX-A-2-b-(xl)`
- `sec-3-A-IX-A-2-b-(xli)`
- `sec-3-A-IX-A-2-b-(xlii)`
- `sec-3-A-IX-A-2-b-(xliii)`
- `sec-3-A-IX-A-2-b-(xliv)`
- `sec-3-A-IX-A-2-b-(xlix)`
- `sec-3-A-IX-A-2-b-(xlv)`
- `sec-3-A-IX-A-2-b-(xlvi)`
- `sec-3-A-IX-A-2-b-(xlvii)`
- `sec-3-A-IX-A-2-b-(xlvii)-(A)`
- `sec-3-A-IX-A-2-b-(xlvii)-(B)`
- `sec-3-A-IX-A-2-b-(xlviii)`
- `sec-3-A-IX-A-2-b-(xv)`
- `sec-3-A-IX-A-2-b-(xvi)`
- `sec-3-A-IX-A-2-b-(xvii)`
- `sec-3-A-IX-A-2-b-(xviii)`
- `sec-3-A-IX-A-2-b-(xx)`
- `sec-3-A-IX-A-2-b-(xxi)`
- `sec-3-A-IX-A-2-b-(xxii)`
- `sec-3-A-IX-A-2-b-(xxiii)`
- `sec-3-A-IX-A-2-b-(xxiv)`
- `sec-3-A-IX-A-2-b-(xxix)`
- `sec-3-A-IX-A-2-b-(xxv)`
- `sec-3-A-IX-A-2-b-(xxvi)`
- `sec-3-A-IX-A-2-b-(xxvii)`
- `sec-3-A-IX-A-2-b-(xxviii)`
- `sec-3-A-IX-A-2-b-(xxx)`
- `sec-3-A-IX-A-2-b-(xxxi)`
- `sec-3-A-IX-A-2-b-(xxxii)`
- `sec-3-A-IX-A-2-b-(xxxiii)`
- `sec-3-A-IX-A-2-b-(xxxiv)`
- `sec-3-A-IX-A-2-b-(xxxix)`
- `sec-3-A-IX-A-2-b-(xxxv)`
- `sec-3-A-IX-A-2-b-(xxxvi)`
- `sec-3-A-IX-A-2-b-(xxxvii)`
- `sec-3-A-IX-A-2-b-(xxxviii)`
- `sec-3-A-IX-B-1-a-(i)`
- `sec-3-A-IX-B-1-a-(ii)`
- `sec-3-A-IX-B-1-a-(iii)`
- `sec-3-A-IX-B-1-a-(iv)`
- `sec-3-A-IX-B-2-c-(i)`
- `sec-3-A-IX-B-2-c-(ii)`
- `sec-3-A-IX-B-2-c-(iii)`
- `sec-3-A-IX-B-3-a-(i)`
- `sec-3-A-IX-B-3-a-(ii)`
- `sec-3-A-IX-B-3-a-(iii)`
- `sec-3-A-IX-B-3-a-(iv)`
- `sec-3-A-IX-B-3-a-(v)`
- `sec-3-A-V-D-2`
- `sec-3-A-VI-D-1-a-(i)`
- `sec-3-A-VI-E-4-a-(i)`
- `sec-3-A-VI-E-4-a-(ii)`
- `sec-3-A-VI-E-4-b-(i)`
- `sec-3-A-VI-E-4-b-(ii)`
- `sec-3-A-VI-E-4-c-(i)`
- `sec-3-A-VI-E-4-c-(ii)`
- `sec-3-A-VI-E-6-a-(i)`
- `sec-3-A-VI-E-6-a-(ii)`
- `sec-3-A-VIII-D-2-b-(i)`
- `sec-3-A-VIII-D-2-b-(ii)`
- `sec-3-A-VIII-D-2-b-(iii)`
- `sec-3-A-VIII-D-3-c-(i)`
- `sec-3-A-VIII-D-3-c-(ii)`
- `sec-3-A-VIII-D-3-c-(iii)`
- `sec-3-A-VIII-D-5-b-(i)`
- `sec-3-A-VIII-D-5-b-(ii)`
- `sec-3-A-VIII-D-5-b-(iii)`
- `sec-3-B-II-D-1-c-(i)`
- `sec-3-B-II-D-1-c-(ii)`
- `sec-3-B-II-D-1-c-(iii)`
- `sec-3-B-III-B-5-c-(i)`
- `sec-3-B-III-B-5-e-(i)`
- `sec-3-B-III-B-5-e-(ii)`
- `sec-3-B-III-B-5-e-(iii)`
- `sec-3-B-III-C-1-c-(i)`
- `sec-3-B-III-C-1-c-(ii)`
- `sec-3-B-III-C-1-c-(iii)`
- `sec-3-B-III-D-2-c-(i)`
- `sec-3-B-III-D-2-d-(i)`
- `sec-3-B-III-I-3-c-(i)`
- `sec-3-B-III-I-3-c-(i)-(A)`
- `sec-3-B-III-I-3-c-(i)-(B)`
- `sec-3-B-III-I-3-c-(ii)`
- `sec-3-B-III-I-3-c-(iii)`
- `sec-3-B-III-I-3-c-(iv)`
- `sec-3-B-III-I-3-c-(v)`
- `sec-3-B-III-J-2-b-(i)`
- `sec-3-B-III-J-2-b-(ii)`
- `sec-3-B-III-J-2-b-(iii)`
- `sec-3-B-III-J-2-f-(i)`
- `sec-3-B-III-J-4-a-(i)`
- `sec-3-B-III-J-4-b-(i)`
- `sec-3-B-III-J-4-c-(i)`
- `sec-3-C-I-A-7-h-(i)`
- `sec-3-C-I-A-7-h-(ii)`
- `sec-3-C-II-E-3-eeee-(i)`
- `sec-3-C-II-E-3-eeee-(ii)`
- `sec-3-C-II-E-3-fff-(i)`
- `sec-3-C-II-E-3-fff-(ii)`
- `sec-3-C-II-E-3-fff-(ii)-(A)`
- `sec-3-C-II-E-3-fff-(ii)-(B)`
- `sec-3-C-II-E-3-fff-(ii)-(C)`
- `sec-3-C-II-E-3-fff-(ii)-(D)`
- `sec-3-C-II-E-3-i-(i)`
- `sec-3-C-II-E-3-i-(ii)`
- `sec-3-C-II-E-3-i-(iii)`
- `sec-3-C-III-C-14-a-(i)`
- `sec-3-C-III-C-14-a-(ii)`
- `sec-3-C-III-C-14-a-(iii)`
- `sec-3-C-III-C-14-a-(iii)-(A)`
- `sec-3-C-III-C-14-a-(iii)-(B)`
- `sec-3-C-V-C-16-b-(i)`
- `sec-3-C-V-C-16-b-(ii)`
- `sec-3-C-V-C-16-b-(iii)`
- `sec-3-C-V-C-16-b-(iv)`
- `sec-3-C-V-C-16-d-(i)`
- `sec-3-C-V-C-16-d-(ii)`
- `sec-3-C-V-C-16-e-(i)`
- `sec-3-C-V-C-16-e-(ii)`
- `sec-3-C-V-C-16-e-(iii)`
- `sec-3-C-V-C-16-e-(iii)-(A)`
- `sec-3-C-V-C-16-e-(iii)-(B)`
- `sec-3-C-V-C-16-e-(iii)-(C)`
- `sec-3-C-V-C-16-e-(iii)-(D)`
- `sec-3-C-V-C-16-e-(iii)-(E)`
- `sec-3-C-V-C-16-e-(iv)`
- `sec-3-C-V-C-16-e-(v)`
- `sec-3-C-V-C-16-e-(vi)`
- `sec-3-C-V-C-5-d-(i)`
- `sec-3-C-V-C-5-d-(i)-(A)`
- `sec-3-C-V-C-5-d-(i)-(B)`
- `sec-3-C-V-C-5-d-(i)-(C)`
- `sec-3-C-V-C-5-d-(ii)`
- `sec-3-C-V-C-5-d-(iii)`
- `sec-3-C-V-C-5-d-(iv)`
- `sec-3-C-V-C-5-d-(iv)-(A)`
- `sec-3-C-V-C-5-d-(iv)-(B)`
- `sec-3-C-V-C-5-d-(iv)-(B)-(1)`
- `sec-3-C-V-C-5-d-(iv)-(C)`
- `sec-3-C-V-C-5-d-(v)`
- `sec-3-C-V-C-6-a-(i)`
- `sec-3-C-V-C-6-a-(ii)`
- `sec-3-C-V-C-6-a-(iii)`
- `sec-3-C-V-C-6-a-(iv)`
- `sec-3-C-V-C-6-a-(v)`
- `sec-3-C-V-C-6-a-(vi)`
- `sec-3-C-XIV-A`
- `sec-3-D-II-A-11-a-(i)`
- `sec-3-D-II-A-11-a-(ii)`
- `sec-3-D-II-A-11-a-(iii)`
- `sec-3-D-II-A-11-a-(iv)`
- `sec-3-D-II-A-11-a-(v)`
- `sec-3-D-II-A-11-a-(vi)`
- `sec-3-D-II-A-11-a-(vii)`
- `sec-3-D-II-A-11-a-(viii)`
- `sec-3-D-II-A-13-a-(i)`
- `sec-3-D-II-A-13-a-(ii)`
- `sec-3-D-II-A-13-b-(i)`
- `sec-3-D-II-A-13-b-(ii)`
- `sec-3-D-II-A-23-d-(i)`
- `sec-3-D-II-A-23-d-(ii)`
- `sec-3-D-II-A-23-d-(iii)`
- `sec-3-D-II-A-23-d-(iv)`
- `sec-3-D-II-A-23-d-(iv)-(A)`
- `sec-3-D-II-A-23-d-(iv)-(B)`
- `sec-3-D-II-A-23-d-(iv)-(C)`
- `sec-3-D-II-A-23-d-(ix)`
- `sec-3-D-II-A-23-d-(ix)-(A)`
- `sec-3-D-II-A-23-d-(ix)-(B)`
- `sec-3-D-II-A-23-d-(v)`
- `sec-3-D-II-A-23-d-(vi)`
- `sec-3-D-II-A-23-d-(vii)`
- `sec-3-D-II-A-23-d-(viii)`
- `sec-3-D-II-A-23-d-(viii)-(A)`
- `sec-3-D-II-A-23-d-(viii)-(B)`
- `sec-3-D-II-A-23-d-(x)`
- `sec-3-D-II-A-25-a-(i)`
- `sec-3-D-II-A-25-a-(i)-(A)`
- `sec-3-D-II-A-25-a-(i)-(B)`
- `sec-3-D-II-A-25-a-(i)-(C)`
- `sec-3-D-II-A-25-a-(i)-(D)`
- `sec-3-D-II-A-25-a-(i)-(E)`
- `sec-3-D-II-A-25-a-(i)-(F)`
- `sec-3-D-II-A-25-a-(i)-(G)`
- `sec-3-D-II-A-25-a-(i)-(H)`
- `sec-3-D-II-A-25-a-(i)-(I)`
- `sec-3-D-II-A-25-a-(i)-(J)`
- `sec-3-D-II-A-25-a-(i)-(K)`
- `sec-3-D-II-A-25-a-(i)-(L)`
- `sec-3-D-II-A-25-a-(i)-(M)`
- `sec-3-D-II-A-25-a-(i)-(N)`
- `sec-3-D-II-A-25-a-(i)-(O)`
- `sec-3-D-II-A-25-a-(i)-(P)`
- `sec-3-D-II-A-25-a-(i)-(Q)`
- `sec-3-D-II-A-25-a-(i)-(R)`
- `sec-3-D-II-A-25-a-(i)-(S)`
- `sec-3-D-II-A-25-a-(i)-(T)`
- `sec-3-D-II-A-25-a-(i)-(U)`
- `sec-3-D-II-A-25-a-(i)-(V)`
- `sec-3-D-II-A-25-a-(i)-(W)`
- `sec-3-D-II-A-25-a-(i)-(X)`
- `sec-3-D-II-A-25-a-(i)-(Y)`
- `sec-3-D-II-A-25-a-(i)-(Z)`
- `sec-3-D-II-A-25-a-(ii)`
- `sec-3-D-II-A-25-b-(i)`
- `sec-3-D-II-A-25-b-(ii)`
- `sec-3-D-II-A-25-b-(iii)`
- `sec-3-D-II-A-25-b-(iv)`
- `sec-3-D-II-A-25-b-(v)`
- `sec-3-D-II-A-25-b-(vi)`
- `sec-3-D-II-A-26-a-(i)`
- `sec-3-D-II-A-26-a-(ii)`
- `sec-3-D-II-A-26-a-(iii)`
- `sec-3-D-II-A-26-b-(i)`
- `sec-3-D-II-A-26-b-(ii)`
- `sec-3-D-II-A-27-a-(i)`
- `sec-3-D-II-A-27-a-(ii)`
- `sec-3-D-II-A-27-c-(i)`
- `sec-3-D-II-A-27-c-(ii)`
- `sec-3-D-II-A-27-c-(iii)`
- `sec-3-D-II-A-27-c-(iv)`
- `sec-3-D-II-A-27-f-(i)`
- `sec-3-D-II-A-27-f-(ii)`
- `sec-3-D-II-A-27-f-(iii)`
- `sec-3-D-II-A-27-f-(iv)`
- `sec-3-D-II-A-38-b-(i)`
- `sec-3-D-II-A-38-b-(ii)`
- `sec-3-D-II-A-38-b-(iii)`
- `sec-3-D-II-A-38-b-(iv)`
- `sec-3-D-II-A-4-a-(i)`
- `sec-3-D-II-A-4-a-(ii)`
- `sec-3-D-II-A-4-a-(iii)`
- `sec-3-D-II-A-4-a-(iv)`
- `sec-3-D-II-A-4-b-(i)`
- `sec-3-D-II-A-4-b-(ii)`
- `sec-3-D-II-A-4-b-(iii)`
- `sec-3-D-II-A-4-b-(iv)`
- `sec-3-D-II-A-4-b-(v)`
- `sec-3-D-II-A-4-f-(i)`
- `sec-3-D-II-A-4-f-(ii)`
- `sec-3-D-II-A-4-f-(iii)`
- `sec-3-D-II-A-4-f-(iv)`
- `sec-3-D-II-A-40-c-(i)`
- `sec-3-D-II-A-40-c-(ii)`
- `sec-3-D-II-A-40-c-(iii)`
- `sec-3-D-II-A-5-b-(i)`
- `sec-3-D-II-A-5-b-(ii)`
- `sec-3-D-II-A-6-c-(i)`
- `sec-3-D-II-A-6-c-(ii)`
- `sec-3-D-V-A-3-a-(ii)`
- `sec-3-D-V-A-3-a-(iii)`
- `sec-3-D-V-A-3-b-(i)`
- `sec-3-D-V-A-3-b-(ii)`
- `sec-3-D-V-A-3-b-(iii)`
- `sec-3-D-V-A-3-b-(iv)`
- `sec-3-D-V-A-7-c-(i)`
- `sec-3-D-V-A-7-c-(i)-(A)`
- `sec-3-D-V-A-7-c-(i)-(B)`
- `sec-3-D-V-A-7-c-(i)-(C)`
- `sec-3-D-V-A-7-c-(ii)`
- `sec-3-D-V-A-7-c-(iii)`
- `sec-3-D-V-A-7-c-(iv)`
- `sec-3-D-V-A-7-c-(v)`
- `sec-3-D-V-A-7-c-(v)-(A)`
- `sec-3-D-V-A-7-c-(v)-(B)`
- `sec-3-D-V-A-7-c-(v)-(C)`
- `sec-3-D-V-A-8-a-(i)`
- `sec-3-D-V-A-8-a-(i)-(A)`
- `sec-3-D-V-A-8-a-(i)-(B)`
- `sec-3-D-V-A-8-a-(i)-(C)`
- `sec-3-D-V-A-8-a-(i)-(D)`
- `sec-3-D-V-A-8-a-(i)-(E)`
- `sec-3-D-VI-B-1-c-(i)`
- `sec-3-D-VI-B-1-c-(ii)`
- `sec-3-D-VI-B-1-c-(iii)`
- `sec-3-D-VI-B-1-c-(iv)`
- `sec-3-D-VI-B-3-a-(i)`
- `sec-3-D-VI-B-3-a-(ii)`
- `sec-3-D-VI-B-3-a-(iii)`
- `sec-3-D-VI-B-3-a-(iv)`
- `sec-3-D-VI-B-3-a-(ix)`
- `sec-3-D-VI-B-3-a-(v)`
- `sec-3-D-VI-B-3-a-(vi)`
- `sec-3-D-VI-B-3-a-(vii)`
- `sec-3-D-VI-B-3-a-(viii)`
- `sec-3-D-VI-B-5-a-(i)`
- `sec-3-D-VI-B-5-a-(ii)`
- `sec-3-D-VI-B-5-a-(iii)`
- `sec-3-D-VI-B-5-e-(i)`
- `sec-3-D-VI-B-5-e-(ii)`
- `sec-3-D-VI-B-5-e-(iii)`
- `sec-3-D-X-A-5-a-(i)`
- `sec-3-D-X-A-5-a-(i)-(A)`
- `sec-3-D-X-A-5-a-(i)-(B)`
- `sec-3-D-XII-B-4-a-(i)`
- `sec-3-D-XIV-D-2-c-(i)`
- `sec-3-D-XIV-D-2-c-(ii)`
- `sec-3-D-XIV-D-2-c-(iii)`
- `sec-3-D-XIV-D-2-c-(iv)`
- `sec-3-D-XIV-D-2-c-(v)`
- `sec-3-D-XIV-D-2-c-(vi)`
- `sec-3-D-XIV-D-2-c-(vii)`
- `sec-3-D-XIV-F-1-c-(i)`
- `sec-3-D-XIV-F-1-c-(ii)`
- `sec-3-D-XIV-F-1-c-(iii)`
- `sec-3-D-XIV-F-1-c-(iv)`
- `sec-3-D-XIV-F-1-c-(v)`
- `sec-3-D-XIV-F-1-c-(vi)`
- `sec-3-D-XIV-F-1-c-(vii)`
- `sec-3-D-XIV-G-3-b-(i)`
- `sec-3-D-XIV-G-3-b-(ii)`
- `sec-3-D-XIV-G-3-b-(iii)`
- `sec-3-D-XIV-G-3-b-(iv)`
- `sec-3-D-XIV-G-3-b-(v)`
- `sec-3-D-XV-I-4-c-(i)`
- `sec-3-D-XV-I-4-c-(ii)`
- `sec-3-F-I-AA`
- `sec-3-F-I-AAA`
- `sec-3-F-I-BB`
- `sec-3-F-I-BB-1`
- `sec-3-F-I-BBB`
- `sec-3-F-I-C-1`
- `sec-3-F-I-C-202`
- `sec-3-F-I-C-3`
- `sec-3-F-I-C-4`
- `sec-3-F-I-C-5`
- `sec-3-F-I-CC`
- `sec-3-F-I-CCC`
- `sec-3-F-I-DD`
- `sec-3-F-I-DDD`
- `sec-3-F-I-EE`
- `sec-3-F-I-EEE`
- `sec-3-F-I-F-1`
- `sec-3-F-I-F-2`
- `sec-3-F-I-F-3`
- `sec-3-F-I-F-4`
- `sec-3-F-I-F-5`
- `sec-3-F-I-F-6`
- `sec-3-F-I-FF`
- `sec-3-F-I-FFF`
- `sec-3-F-I-GG`
- `sec-3-F-I-GGG`
- `sec-3-F-I-HH`
- `sec-3-F-I-HHH`
- `sec-3-F-I-II`
- `sec-3-F-I-III`
- `sec-3-F-I-J-1`
- `sec-3-F-I-J-10`
- `sec-3-F-I-J-2`
- `sec-3-F-I-J-3`
- `sec-3-F-I-J-4`
- `sec-3-F-I-J-5`
- `sec-3-F-I-J-6`
- `sec-3-F-I-J-7`
- `sec-3-F-I-J-8`
- `sec-3-F-I-J-9`
- `sec-3-F-I-JJ`
- `sec-3-F-I-JJJ`
- `sec-3-F-I-K-1`
- `sec-3-F-I-KK`
- `sec-3-F-I-KKK`
- `sec-3-F-I-KKK-1`
- `sec-3-F-I-L-1`
- `sec-3-F-I-L-10`
- `sec-3-F-I-L-11`
- `sec-3-F-I-L-12`
- `sec-3-F-I-L-2`
- `sec-3-F-I-L-3`
- `sec-3-F-I-L-4`
- `sec-3-F-I-L-5`
- `sec-3-F-I-L-6`
- `sec-3-F-I-L-7`
- `sec-3-F-I-L-8`
- `sec-3-F-I-L-9`
- `sec-3-F-I-LL`
- `sec-3-F-I-LLL`
- `sec-3-F-I-MM`
- `sec-3-F-I-MMM`
- `sec-3-F-I-NN`
- `sec-3-F-I-O-1`
- `sec-3-F-I-O-10`
- `sec-3-F-I-O-11`
- `sec-3-F-I-O-12`
- `sec-3-F-I-O-13`
- `sec-3-F-I-O-14`
- `sec-3-F-I-O-2`
- `sec-3-F-I-O-3`
- `sec-3-F-I-O-4`
- `sec-3-F-I-O-5`
- `sec-3-F-I-O-6`
- `sec-3-F-I-O-7`
- `sec-3-F-I-O-8`
- `sec-3-F-I-O-9`
- `sec-3-F-I-OO`
- `sec-3-F-I-PP`
- `sec-3-F-I-QQ`
- `sec-3-F-I-RR`
- `sec-3-F-I-SS`
- `sec-3-F-I-TT`
- `sec-3-F-I-TT-3`
- `sec-3-F-I-UU`
- `sec-3-F-I-V-1`
- `sec-3-F-I-V-2`
- `sec-3-F-I-V-3`
- `sec-3-F-I-V-4`
- `sec-3-F-I-VV`
- `sec-3-F-I-WW`
- `sec-3-F-I-XX`
- `sec-3-F-I-YY`
- `sec-3-F-I-Z-1`
- `sec-3-F-I-Z-10`
- `sec-3-F-I-Z-11`
- `sec-3-F-I-Z-12`
- `sec-3-F-I-Z-13`
- `sec-3-F-I-Z-14`
- `sec-3-F-I-Z-15`
- `sec-3-F-I-Z-16`
- `sec-3-F-I-Z-2`
- `sec-3-F-I-Z-3`
- `sec-3-F-I-Z-5`
- `sec-3-F-I-Z-6`
- `sec-3-F-I-Z-7`
- `sec-3-F-I-Z-8`
- `sec-3-F-I-Z-9`
- `sec-3-F-I-ZZ`
- `sec-3-P-A`
- `sec-3-P-B`
- `sec-3-P-C`
- `sec-3-P-D`
- `sec-3-P-E`
- `sec-3-P-F`

## Duplicate ids in the parsed output (two markers, one id — merged)

Every id below was produced by more than one marker during parsing. This script keeps the first occurrence's citation/parent/title and appends the later occurrence's text as trailing paragraphs so no content is silently dropped. As of this run, the only expected entry is `sec-7-B-VI-D-3-a-(iii)` — the source PDF really does print that exact label twice in a row for two different paragraphs (see "Source-text corrections and anomalies" below). The two other duplicates seen in earlier runs (`sec-7-B-II-J-1-c`, `sec-7-B-III-C-5-b-(iv)-(A)-(2)`, both citation-shaped continuation-line false positives) and the label-typo collision (`sec-7-B-VII-A-20`) are fixed — see the same section and the marker audit below. Anything else appearing here is new and should be reviewed by hand.

- `sec-3-C-II`
- `sec-3-C-II`
- `sec-3-C-II`
- `sec-3-F-I-C-1`
- `sec-3-F-I-C-2`
- `sec-3-F-I-C-1`
- `sec-3-F-I-C-2`
- `sec-3-F-I-C-3`
- `sec-3-F-I-C-4`
- `sec-3-F-I-C-5`
- `sec-3-F-I-C-1`
- `sec-3-F-I-C-2`
- `sec-3-F-I-C-3`
- `sec-3-F-I-C-4`
- `sec-3-F-I-C-1`
- `sec-3-F-I-C-2`
- `sec-3-F-I-C-3`
- `sec-3-F-I-C-1`
- `sec-3-F-I-C-2`
- `sec-3-F-I-C-3`
- `sec-3-F-I-C-4`
- `sec-3-F-I-C-5`
- `sec-3-F-I-F-1`
- `sec-3-F-I-F-2`
- `sec-3-F-I-F-3`
- `sec-3-F-I-F-4`
- `sec-3-F-I-F-1`
- `sec-3-F-I-F-2`
- `sec-3-F-I-F-3`
- `sec-3-F-I-F-4`
- `sec-3-F-I-F-5`
- `sec-3-F-I-F-1`
- `sec-3-F-I-F-2`
- `sec-3-F-I-F-3`
- `sec-3-F-I-F-4`
- `sec-3-F-I-F-5`
- `sec-3-F-I-F-1`
- `sec-3-F-I-F-2`
- `sec-3-F-I-F-3`
- `sec-3-F-I-F-1`
- `sec-3-F-I-F-2`
- `sec-3-F-I-J-1`
- `sec-3-F-I-J-2`
- `sec-3-F-I-J-1`
- `sec-3-F-I-J-2`
- `sec-3-F-I-J-3`
- `sec-3-F-I-J-4`
- `sec-3-F-I-J-1`
- `sec-3-F-I-J-2`
- `sec-3-F-I-J-3`
- `sec-3-F-I-J-4`
- `sec-3-F-I-J-5`
- `sec-3-F-I-J-6`
- `sec-3-F-I-J-7`
- `sec-3-F-I-J-8`
- `sec-3-F-I-L-1`
- `sec-3-F-I-L-2`
- `sec-3-F-I-L-3`
- `sec-3-F-I-L-1`
- `sec-3-F-I-L-2`
- `sec-3-F-I-L-3`
- `sec-3-F-I-L-4`
- `sec-3-F-I-L-5`
- `sec-3-F-I-L-6`
- `sec-3-F-I-L-7`
- `sec-3-F-I-L-1`
- `sec-3-F-I-L-2`
- `sec-3-F-I-L-3`
- `sec-3-F-I-L-4`
- `sec-3-F-I-L-5`
- `sec-3-F-I-L-1`
- `sec-3-F-I-L-2`
- `sec-3-F-I-L-1`
- `sec-3-F-I-L-2`
- `sec-3-F-I-L-1`
- `sec-3-F-I-L-2`
- `sec-3-F-I-L-3`
- `sec-3-F-I-L-3`

## Source-text corrections and anomalies

Confirmed by reading the actual printed PDF (not a pdftotext artifact). Fixes are applied to the raw lines before marker scanning, matched by (old label + enough of the following words to be unique in the document) so they can't misfire.

### Label typos corrected

| line ~ | printed (wrong) | corrected to | hits | note |
|---|---|---|---|---|
| 2527 | `V.D.2` | `V.D.2.` | OK (1) | Printed as "V.D.2 Non-creditable reductions" — missing the trailing period every sibling heading in this same list has ("V.D.1.", "V.D.3.", "V.D.4.", "V.D.5." all end in a period). Without it, "V.D.2" does not tokenize as a label at all, so it — and all 7 of its children, "V.D.2.a." through "V.D.2.g." — were silently dropped (no parent for them to attach to). |

## Marker column / continuation-line audit

Every Part A/B label candidate flagged by the continuation-line guard (its column deviates by more than 2 characters from the learned column for its depth, and/or its previous non-blank line lacks terminal punctuation), whether ultimately accepted as a real label or rejected as a continuation. See IMPORTER_SPEC.md and `_marker_column_signals` for the rule.

- Flagged candidates: **257** (column-deviating: **247**, prev-line-lacks-terminal-punctuation: **39**)
- Rejected as continuations: **59**
- Kept as real labels despite the flag: **198**

| line | citation | part | indent | learned col | col dev | lacks term. | page seam | accepted |
|---|---|---|---|---|---|---|---|---|
| 3 | `I.` | A | 4 | None | False | True | False | True |
| 26 | `I.B.` | A | 0 | 4 | True | False | False | True |
| 164 | `I.B.12.b.` | A | 11 | 14 | True | False | False | True |
| 167 | `I.B.12.c.` | A | 11 | 14 | True | False | False | True |
| 172 | `I.B.12.d.` | A | 11 | 14 | True | False | False | True |
| 179 | `I.B.12.e.` | A | 11 | 14 | True | False | False | True |
| 185 | `I.B.12.f.` | A | 11 | 14 | True | False | False | True |
| 188 | `I.B.12.g.` | A | 11 | 14 | True | False | False | True |
| 191 | `I.B.12.h.` | A | 11 | 14 | True | False | False | True |
| 424 | `I.B.30.b.(i).` | A | 18 | 21 | True | False | False | True |
| 426 | `I.B.30.b.(ii).` | A | 18 | 21 | True | False | False | True |
| 428 | `I.B.30.b.(iii).` | A | 18 | 21 | True | False | False | True |
| 430 | `I.B.30.b.(iv).` | A | 18 | 21 | True | False | False | True |
| 432 | `I.B.30.b.(v).` | A | 18 | 21 | True | False | False | True |
| 544 | `I.A.2.` | A | 18 | 5 | True | True | False | False |
| 1077 | `I.B.57.` | A | 8 | 5 | True | False | False | True |
| 1085 | `II.` | A | 0 | 4 | True | False | False | True |
| 1086 | `II.A.` | A | 0 | 4 | True | False | False | True |
| 1088 | `II.A.1.` | A | 8 | 5 | True | False | False | True |
| 1101 | `II.A.1.a.` | A | 15 | 11 | True | False | False | True |
| 1105 | `II.A.2.` | A | 8 | 5 | True | False | False | True |
| 1146 | `II.A.2.d.` | A | 14 | 11 | True | False | False | True |
| 1148 | `II.D.` | A | 21 | 0 | True | True | False | False |
| 1150 | `II.A.2.e.` | A | 14 | 11 | True | False | False | True |
| 1151 | `VI.D.` | A | 21 | 0 | True | False | False | False |
| 1154 | `II.A.3.` | A | 8 | 5 | True | False | False | True |
| 1165 | `II.B.1.` | A | 8 | 5 | True | False | False | True |
| 1174 | `II.B.1.a.` | A | 14 | 11 | True | False | False | True |
| 1177 | `II.B.1.b.` | A | 14 | 11 | True | False | False | True |
| 1253 | `II.B.4.c.` | A | 15 | 11 | True | False | True | True |
| 1257 | `II.B.4.d.` | A | 15 | 11 | True | False | False | True |
| 1260 | `II.B.4.e.` | A | 15 | 11 | True | False | False | True |
| 1265 | `II.B.4.f.` | A | 15 | 11 | True | False | False | True |
| 1277 | `II.B.5.` | A | 8 | 5 | True | False | False | True |
| 1280 | `II.B.6.` | A | 8 | 5 | True | False | False | True |
| 1286 | `II.C.1.` | A | 8 | 5 | True | False | False | True |
| 1288 | `II.C.1.a.` | A | 15 | 11 | True | False | False | True |
| 1395 | `II.C.3.c.` | A | 21 | 11 | True | False | True | False |
| 1398 | `II.C.4.` | A | 8 | 5 | True | False | False | True |
| 1400 | `II.C.4.a.` | A | 14 | 11 | True | False | False | True |
| 1406 | `II.C.4.b.` | A | 14 | 11 | True | False | False | True |
| 1412 | `II.D.1.` | A | 8 | 5 | True | False | False | True |
| 1752 | `I.B.36.c.` | A | 20 | 11 | True | True | False | False |
| 1826 | `III.` | A | 0 | 4 | True | False | False | True |
| 1838 | `III.` | A | 13 | 0 | True | True | False | False |
| 1861 | `IV.A.1.` | A | 9 | 5 | True | False | False | True |
| 1865 | `IV.A.2.` | A | 9 | 5 | True | False | False | True |
| 1868 | `IV.A.3.` | A | 9 | 5 | True | False | False | True |
| 1918 | `IV.C.5.a.` | A | 14 | 11 | True | False | False | True |
| 1920 | `IV.C.5.b.` | A | 14 | 11 | True | False | False | True |
| 1924 | `IV.C.5.c.` | A | 14 | 11 | True | False | False | True |
| 1945 | `V.B.1.a.` | A | 14 | 11 | True | False | False | True |
| 1949 | `V.B.1.b.` | A | 14 | 11 | True | False | False | True |
| 1953 | `V.B.1.c.` | A | 14 | 11 | True | False | False | True |
| 1983 | `V.C.2.a.` | A | 14 | 11 | True | False | False | True |
| 2016 | `V.A.3.` | A | 5 | 5 | False | True | False | False |
| 2033 | `V.C.9.c.` | A | 14 | 11 | True | False | True | True |
| 2044 | `V.D.1.a.` | A | 14 | 11 | True | False | False | True |
| 2052 | `V.D.1.b.` | A | 14 | 11 | True | False | False | True |
| 2053 | `V.C.9.` | A | 22 | 5 | True | False | False | False |
| 2056 | `V.D.1.c.` | A | 14 | 11 | True | False | False | True |
| 2064 | `V.D.1.d.` | A | 14 | 11 | True | False | False | True |
| 2068 | `V.D.1.e.` | A | 14 | 11 | True | False | False | True |
| 2230 | `V.E.2.a.` | A | 14 | 11 | True | False | False | True |
| 2232 | `V.E.2.b.` | A | 14 | 11 | True | False | False | True |
| 2235 | `V.E.2.c.` | A | 14 | 11 | True | False | False | True |
| 2238 | `V.E.2.d.` | A | 14 | 11 | True | False | False | True |
| 2241 | `V.E.2.e.` | A | 14 | 11 | True | False | False | True |
| 2247 | `V.E.2.f.` | A | 14 | 11 | True | False | False | True |
| 2250 | `V.E.2.g.` | A | 14 | 11 | True | False | False | True |
| 2334 | `V.E.3.c.` | A | 18 | 11 | True | False | False | False |
| 2605 | `VI.E.` | A | 12 | 0 | True | False | False | False |
| 2688 | `VI.E.6.a.(i).` | A | 23 | 18 | True | False | True | True |
| 2701 | `VI.E.4.` | A | 23 | 5 | True | True | False | False |
| 2705 | `VI.E.6.a.(ii).` | A | 23 | 18 | True | False | False | True |
| 2711 | `V.C.6.` | A | 0 | 5 | True | True | False | False |
| 2746 | `VIII.A.1.` | A | 8 | 5 | True | False | False | True |
| 2764 | `VIII.B.2.a.` | A | 14 | 11 | True | False | False | True |
| 2766 | `VIII.B.2.b.` | A | 14 | 11 | True | False | False | True |
| 2791 | `VIII.D.1.a.` | A | 14 | 11 | True | False | False | True |
| 2794 | `VIII.D.1.b.` | A | 14 | 11 | True | False | False | True |
| 2887 | `VIII.D.3.b.` | A | 19 | 11 | True | False | False | False |
| 2999 | `IX.A.1.c.` | A | 25 | 11 | True | True | False | False |
| 3009 | `IX.B.2.` | A | 18 | 5 | True | True | False | False |
| 3233 | `IX.A.2.b.(xlvii).(A).` | A | 24 | 29 | True | False | False | True |
| 3236 | `IX.A.2.b.(xlvii).(B).` | A | 24 | 29 | True | False | False | True |
| 3261 | `IX.A.2.b.(liii).` | A | 11 | 17 | True | False | False | True |
| 5238 | `II.D.2.` | B | 5 | 8 | True | False | False | True |
| 5263 | `II.D.3.` | B | 5 | 8 | True | False | False | True |
| 5287 | `II.D.2.` | B | 14 | 8 | True | False | False | False |
| 5300 | `III.B.1.` | B | 14 | 8 | True | False | False | False |
| 5357 | `III.B.4.` | B | 20 | 7 | True | True | False | False |
| 5421 | `III.B.5.e.(i).` | B | 17 | 21 | True | False | True | True |
| 5425 | `III.B.5.e.(ii).` | B | 17 | 21 | True | False | False | True |
| 5443 | `III.B.5.a.` | B | 19 | 12 | True | True | False | False |
| 5476 | `VI.` | B | 12 | 0 | True | False | False | False |
| 5711 | `II.D.2.` | B | 23 | 7 | True | True | False | False |
| 5812 | `III.G.5.` | B | 9 | 5 | True | False | False | True |
| 5818 | `III.G.6.` | B | 9 | 5 | True | False | False | True |
| 5821 | `III.G.7.` | B | 9 | 5 | True | False | False | True |
| 5823 | `III.G.7.a.` | B | 16 | 12 | True | False | False | True |
| 5826 | `III.G.7.b.` | B | 16 | 12 | True | False | False | True |
| 5829 | `III.G.7.c.` | B | 16 | 12 | True | False | False | True |
| 5839 | `III.I.1.` | B | 9 | 5 | True | False | False | True |
| 5898 | `III.I.3.c.(ii).` | B | 17 | 21 | True | False | False | True |
| 5903 | `III.I.3.c.(iii).` | B | 17 | 21 | True | False | False | True |
| 5909 | `III.I.3.c.(iv).` | B | 17 | 21 | True | False | False | True |
| 5916 | `III.I.3.c.(v).` | B | 17 | 21 | True | False | False | True |
| 5919 | `III.I.4.` | B | 9 | 5 | True | False | True | True |
| 5923 | `III.I.5.` | B | 9 | 5 | True | False | False | True |
| 5926 | `III.I.6.` | B | 9 | 5 | True | False | False | True |
| 5929 | `III.I.6.a.` | B | 16 | 12 | True | False | False | True |
| 5932 | `III.I.6.b.` | B | 16 | 12 | True | False | False | True |
| 5934 | `III.I.6.c.` | B | 16 | 12 | True | False | False | True |
| 5936 | `III.I.6.d.` | B | 16 | 12 | True | False | False | True |
| 5940 | `III.I.7.` | B | 9 | 5 | True | False | False | True |
| 5946 | `III.J.1.` | B | 9 | 5 | True | False | False | True |
| 5956 | `III.J.2.` | B | 9 | 5 | True | False | False | True |
| 5975 | `III.B.4.` | B | 19 | 5 | True | False | False | False |
| 6129 | `III.J.2.` | B | 20 | 5 | True | True | False | False |
| 6197 | `III.J.3.` | B | 19 | 5 | True | False | False | False |
| 6277 | `I.A.7.d.` | C | 14 | 11 | True | False | True | True |
| 6280 | `I.A.7.e.` | C | 14 | 11 | True | False | False | True |
| 6283 | `I.A.7.f.` | C | 14 | 11 | True | False | False | True |
| 6286 | `I.A.7.g.` | C | 14 | 11 | True | False | False | True |
| 6319 | `II.A.1.a.` | C | 11 | 14 | True | False | False | True |
| 6321 | `II.A.1.b.` | C | 11 | 14 | True | False | False | True |
| 6325 | `II.A.1.c.` | C | 11 | 14 | True | False | False | True |
| 6329 | `II.A.1.d.` | C | 11 | 14 | True | False | False | True |
| 6358 | `II.A.1.f.` | C | 15 | 11 | True | False | False | True |
| 6361 | `II.A.1.g.` | C | 15 | 11 | True | False | False | True |
| 6472 | `II.E.3.a.` | C | 14 | 11 | True | False | False | True |
| 6482 | `II.E.3.b.` | C | 14 | 11 | True | False | False | True |
| 6486 | `II.E.3.c.` | C | 11 | 14 | True | False | True | True |
| 6746 | `II.` | C | 19 | 0 | True | False | False | True |
| 6748 | `II.` | C | 19 | 0 | True | False | False | True |
| 6751 | `II.` | C | 19 | 0 | True | False | False | True |
| 6818 | `II.E.3.ffff.` | C | 15 | 11 | True | False | True | True |
| 6822 | `II.E.3.gggg.` | C | 15 | 11 | True | False | False | True |
| 6838 | `III.` | C | 0 | 19 | True | False | False | True |
| 6986 | `III.C.3.a.` | C | 20 | 11 | True | False | False | False |
| 7104 | `III.C.14.a.(iii).(A).` | C | 26 | 29 | True | False | False | True |
| 7109 | `III.C.14.a.(iii).(B).` | C | 26 | 29 | True | False | False | True |
| 7156 | `III.E.2.` | C | 9 | 5 | True | False | True | True |
| 7159 | `III.E.3.` | C | 9 | 5 | True | False | False | True |
| 7186 | `IV.B.1.` | C | 9 | 5 | True | False | False | True |
| 7275 | `III.G.` | C | 13 | 0 | True | True | False | False |
| 7338 | `V.B.6.b.` | C | 14 | 11 | True | False | True | True |
| 7341 | `V.B.6.c.` | C | 14 | 11 | True | False | False | True |
| 7344 | `V.B.6.d.` | C | 14 | 11 | True | False | False | True |
| 7362 | `V.C.1.a.` | C | 14 | 11 | True | False | False | True |
| 7367 | `V.C.1.b.` | C | 14 | 11 | True | False | False | True |
| 7373 | `V.C.1.c.` | C | 14 | 11 | True | False | False | True |
| 7440 | `V.C.5.d.(i).(A).` | C | 24 | 29 | True | False | False | True |
| 7444 | `V.C.5.d.(i).(B).` | C | 25 | 29 | True | False | True | True |
| 7449 | `V.C.5.d.(i).(C).` | C | 25 | 29 | True | False | False | True |
| 7472 | `V.C.5.d.(iv).(A).` | C | 25 | 29 | True | False | False | False |
| 7476 | `V.C.5.d.(iv).(A).` | C | 25 | 29 | True | False | False | True |
| 7491 | `V.C.5.d.(iv).(B).` | C | 23 | 29 | True | False | False | True |
| 7520 | `V.C.5.d.(iv).(C).` | C | 24 | 29 | True | False | False | True |
| 7769 | `V.C.16.e.(iii).(A).` | C | 24 | 29 | True | False | False | True |
| 7772 | `V.C.16.e.(iii).(B).` | C | 24 | 29 | True | False | False | True |
| 7774 | `V.C.16.e.(iii).(C).` | C | 24 | 29 | True | False | False | True |
| 7794 | `V.C.16.e.(v).` | C | 21 | 17 | True | False | True | True |
| 7797 | `V.C.16.e.(vi).` | C | 21 | 17 | True | False | False | True |
| 7970 | `VI.H.1.` | C | 8 | 5 | True | False | False | True |
| 7974 | `VI.H.2.` | C | 8 | 5 | True | False | False | True |
| 7978 | `VI.H.3.` | C | 8 | 5 | True | False | False | True |
| 7984 | `VI.H.4.` | C | 8 | 5 | True | False | False | True |
| 8020 | `VIII.A.5.a.` | C | 14 | 11 | True | False | False | True |
| 8024 | `VIII.A.5.b.` | C | 14 | 11 | True | False | False | True |
| 8027 | `VIII.A.5.c.` | C | 14 | 11 | True | False | False | True |
| 8031 | `VIII.A.5.d.` | C | 14 | 11 | True | False | False | True |
| 8124 | `X.A.4.a.` | C | 14 | 11 | True | False | False | True |
| 8131 | `X.A.4.b.` | C | 14 | 11 | True | False | False | True |
| 8172 | `X.D.5.a.` | C | 14 | 11 | True | False | False | True |
| 8174 | `X.D.5.b.` | C | 14 | 11 | True | False | False | True |
| 8177 | `X.D.5.c.` | C | 14 | 11 | True | False | False | True |
| 8179 | `X.D.5.d.` | C | 14 | 11 | True | False | True | True |
| 8265 | `XI.C.4.` | C | 6 | 5 | False | True | False | False |
| 8372 | `XII.A.1.a.` | C | 14 | 11 | True | False | False | True |
| 8380 | `XII.A.1.b.` | C | 14 | 11 | True | False | False | True |
| 8386 | `XII.A.1.c.` | C | 14 | 11 | True | False | False | True |
| 8410 | `I.A.3.` | C | 6 | 5 | False | True | False | False |
| 8429 | `XII.B.3.` | C | 8 | 5 | True | False | False | True |
| 8432 | `XII.B.4.` | C | 8 | 5 | True | False | False | True |
| 8439 | `XII.B.5.` | C | 8 | 5 | True | False | False | True |
| 8446 | `XIII.A.1.` | C | 8 | 5 | True | False | False | True |
| 8455 | `XIII.A.2.` | C | 8 | 5 | True | False | False | True |
| 8510 | `I.` | D | 0 | None | False | True | False | True |
| 8549 | `II.A.4.b.` | D | 14 | None | False | True | False | False |
| 8611 | `D.` | D | 8 | 0 | True | False | False | False |
| 8640 | `II.A.4.` | D | 22 | 7 | True | True | False | False |
| 8694 | `II.A.4.b.` | D | 11 | 14 | True | False | False | True |
| 8740 | `II.A.4.c.` | D | 11 | 14 | True | False | False | True |
| 8746 | `II.A.4.d.` | D | 11 | 14 | True | False | False | True |
| 8754 | `II.A.4.e.` | D | 11 | 14 | True | False | False | True |
| 8764 | `II.A.4.f.` | D | 11 | 14 | True | False | False | True |
| 8953 | `VI.A.6.` | D | 26 | 5 | True | False | False | False |
| 8958 | `III.G.2.` | D | 26 | 5 | True | False | False | False |
| 9174 | `II.A.23.d.(ix).(B).` | D | 27 | 24 | True | False | True | True |
| 9339 | `II.A.25.a.(i).` | D | 20 | 18 | False | True | False | False |
| 9410 | `II.A.4.b.(iv).` | D | 29 | 18 | True | True | False | False |
| 9525 | `II.A.26.` | D | 12 | 5 | True | True | False | False |
| 9600 | `II.A.38.b.(i).` | D | 26 | 18 | True | False | False | False |
| 9650 | `II.A.40.e.` | D | 20 | 12 | True | True | False | False |
| 9925 | `XIII.A.` | D | 14 | 0 | True | True | False | False |
| 10082 | `II.A.38.b.(iii).` | D | 18 | 18 | False | True | False | False |
| 10126 | `V.A.7.c.(iii).` | D | 24 | 18 | True | True | False | False |
| 10136 | `II.A.44.` | D | 24 | 5 | True | True | False | False |
| 10293 | `VI.A.3.a.` | D | 18 | 12 | True | True | False | False |
| 10395 | `VI.A.5.` | D | 11 | 5 | True | True | False | False |
| 10434 | `VI.A.` | D | 18 | 0 | True | True | False | False |
| 10479 | `VI.B.5.a.` | D | 18 | 12 | True | True | False | False |
| 10622 | `VIII.A.1.` | D | 8 | 5 | True | False | False | True |
| 10624 | `VIII.A.1.a.` | D | 15 | 12 | True | False | False | True |
| 10626 | `VIII.A.1.b.` | D | 15 | 12 | True | False | False | True |
| 10628 | `VIII.A.2.` | D | 8 | 5 | True | False | False | True |
| 10630 | `VIII.A.2.a.` | D | 15 | 12 | True | False | False | True |
| 10632 | `VIII.A.2.b.` | D | 15 | 12 | True | False | False | True |
| 10634 | `VIII.A.2.c.` | D | 15 | 12 | True | False | False | True |
| 10636 | `VIII.A.2.d.` | D | 15 | 12 | True | False | False | True |
| 10638 | `VIII.A.2.e.` | D | 15 | 12 | True | False | False | True |
| 10640 | `VIII.A.2.f.` | D | 15 | 12 | True | False | False | True |
| 10642 | `VIII.A.2.g.` | D | 15 | 12 | True | False | False | True |
| 10644 | `VIII.A.2.h.` | D | 15 | 12 | True | False | False | True |
| 10646 | `VIII.A.2.i.` | D | 15 | 12 | True | False | False | True |
| 10648 | `VIII.A.2.j.` | D | 15 | 12 | True | False | False | True |
| 10792 | `X.A.1.` | D | 8 | 5 | True | False | False | True |
| 11019 | `XII.B.4.a.(i).` | D | 21 | 18 | True | False | False | True |
| 11021 | `XII.B.5.` | D | 8 | 5 | True | False | True | True |
| 11024 | `XII.B.6.` | D | 8 | 5 | True | False | False | True |
| 11031 | `XII.C.1.` | D | 8 | 5 | True | False | False | True |
| 11034 | `XII.C.2.` | D | 8 | 5 | True | False | False | True |
| 11037 | `XII.C.3.` | D | 8 | 5 | True | False | False | True |
| 11236 | `XIV.C.1.` | D | 9 | 5 | True | False | False | True |
| 11237 | `XIV.E.` | D | 16 | 0 | True | False | False | False |
| 11374 | `XIV.D.2.c.(vii).` | D | 21 | 18 | True | False | True | True |
| 11381 | `XIV.D.2.d.` | D | 14 | 11 | True | False | False | True |
| 11403 | `XIV.F.1.a.` | D | 14 | 11 | True | False | False | True |
| 11407 | `XIV.F.1.b.` | D | 14 | 11 | True | False | False | True |
| 11458 | `XIV.G.3.b.` | D | 17 | 11 | True | False | False | False |
| 11472 | `XIV.G.3.b.` | D | 17 | 11 | True | False | False | False |
| 11484 | `XIV.G.3.b.(i).` | D | 22 | 18 | True | False | True | True |
| 11487 | `XIV.G.3.b.(ii).` | D | 22 | 18 | True | False | False | True |
| 11490 | `XIV.G.3.b.(iii).` | D | 22 | 18 | True | False | False | True |
| 11492 | `XIV.G.3.b.(iv).` | D | 22 | 18 | True | False | False | True |
| 11494 | `XIV.G.3.b.(v).` | D | 22 | 18 | True | False | False | True |
| 11544 | `II.A.46.` | D | 13 | 5 | True | True | False | False |
| 11565 | `II.A.24.b.` | D | 12 | 11 | False | True | False | False |
| 11593 | `XV.F.` | D | 20 | 0 | True | False | False | False |
| 11607 | `XV.K.` | D | 20 | 0 | True | True | False | False |
| 11703 | `XV.H.` | D | 12 | 0 | True | True | False | False |
| 11774 | `XV.H.1.` | D | 11 | 5 | True | True | False | False |
| 11816 | `XV.A.2.c.` | D | 13 | 11 | False | True | False | False |
| 11864 | `XV.E.` | D | 18 | 0 | True | False | False | False |
| 11976 | `XV.K.3.` | D | 11 | 5 | True | True | False | False |

## parent_id mismatches

- `sec-3-A-I`: db parent=`sec-3-A-PART-A` parsed parent=`sec-3-P-A`
- `sec-3-A-II`: db parent=`sec-3-A-PART-A` parsed parent=`sec-3-P-A`
- `sec-3-A-III`: db parent=`sec-3-A-PART-A` parsed parent=`sec-3-P-A`
- `sec-3-A-IV`: db parent=`sec-3-A-PART-A` parsed parent=`sec-3-P-A`
- `sec-3-A-IV-C-5-a`: db parent=`sec-3-A-IV-C` parsed parent=`sec-3-A-IV-C-5`
- `sec-3-A-IV-C-5-b`: db parent=`sec-3-A-IV-C` parsed parent=`sec-3-A-IV-C-5`
- `sec-3-A-IV-C-5-c`: db parent=`sec-3-A-IV-C` parsed parent=`sec-3-A-IV-C-5`
- `sec-3-A-IX`: db parent=`sec-3-A-PART-A` parsed parent=`sec-3-P-A`
- `sec-3-A-V`: db parent=`sec-3-A-PART-A` parsed parent=`sec-3-P-A`
- `sec-3-A-V-D-2-a`: db parent=`sec-3-A-V-D` parsed parent=`sec-3-A-V-D-2`
- `sec-3-A-V-D-2-b`: db parent=`sec-3-A-V-D` parsed parent=`sec-3-A-V-D-2`
- `sec-3-A-V-D-2-c`: db parent=`sec-3-A-V-D` parsed parent=`sec-3-A-V-D-2`
- `sec-3-A-V-D-2-d`: db parent=`sec-3-A-V-D` parsed parent=`sec-3-A-V-D-2`
- `sec-3-A-V-D-2-e`: db parent=`sec-3-A-V-D` parsed parent=`sec-3-A-V-D-2`
- `sec-3-A-V-D-2-f`: db parent=`sec-3-A-V-D` parsed parent=`sec-3-A-V-D-2`
- `sec-3-A-V-D-2-g`: db parent=`sec-3-A-V-D` parsed parent=`sec-3-A-V-D-2`
- `sec-3-A-VI`: db parent=`sec-3-A-PART-A` parsed parent=`sec-3-P-A`
- `sec-3-A-VII`: db parent=`sec-3-A-PART-A` parsed parent=`sec-3-P-A`
- `sec-3-A-VIII`: db parent=`sec-3-A-PART-A` parsed parent=`sec-3-P-A`
- `sec-3-B-I`: db parent=`sec-3-B-PART-B` parsed parent=`sec-3-P-B`
- `sec-3-B-II`: db parent=`sec-3-B-PART-B` parsed parent=`sec-3-P-B`
- `sec-3-B-III`: db parent=`sec-3-B-PART-B` parsed parent=`sec-3-P-B`
- `sec-3-C-I`: db parent=`sec-3-C-PART-C` parsed parent=`sec-3-P-C`
- `sec-3-C-II`: db parent=`sec-3-C-PART-C` parsed parent=`sec-3-P-C`
- `sec-3-C-III`: db parent=`sec-3-C-PART-C` parsed parent=`sec-3-P-C`
- `sec-3-C-IV`: db parent=`sec-3-C-PART-C` parsed parent=`sec-3-P-C`
- `sec-3-C-IX`: db parent=`sec-3-C-PART-C` parsed parent=`sec-3-P-C`
- `sec-3-C-V`: db parent=`sec-3-C-PART-C` parsed parent=`sec-3-P-C`
- `sec-3-C-VI`: db parent=`sec-3-C-PART-C` parsed parent=`sec-3-P-C`
- `sec-3-C-VII`: db parent=`sec-3-C-PART-C` parsed parent=`sec-3-P-C`
- `sec-3-C-VIII`: db parent=`sec-3-C-PART-C` parsed parent=`sec-3-P-C`
- `sec-3-C-X`: db parent=`sec-3-C-PART-C` parsed parent=`sec-3-P-C`
- `sec-3-C-XI`: db parent=`sec-3-C-PART-C` parsed parent=`sec-3-P-C`
- `sec-3-C-XII`: db parent=`sec-3-C-PART-C` parsed parent=`sec-3-P-C`
- `sec-3-C-XIII`: db parent=`sec-3-C-PART-C` parsed parent=`sec-3-P-C`
- `sec-3-C-XIV`: db parent=`sec-3-C-PART-C` parsed parent=`sec-3-P-C`
- `sec-3-C-XIV-A-1`: db parent=`sec-3-C-XIV` parsed parent=`sec-3-C-XIV-A`
- `sec-3-D-I`: db parent=`sec-3-D-PART-D` parsed parent=`sec-3-P-D`
- `sec-3-D-II`: db parent=`sec-3-D-PART-D` parsed parent=`sec-3-P-D`
- `sec-3-D-III`: db parent=`sec-3-D-PART-D` parsed parent=`sec-3-P-D`
- `sec-3-D-IV`: db parent=`sec-3-D-PART-D` parsed parent=`sec-3-P-D`
- `sec-3-D-IX`: db parent=`sec-3-D-PART-D` parsed parent=`sec-3-P-D`
- `sec-3-D-V`: db parent=`sec-3-D-PART-D` parsed parent=`sec-3-P-D`
- `sec-3-D-VI`: db parent=`sec-3-D-PART-D` parsed parent=`sec-3-P-D`
- `sec-3-D-VII`: db parent=`sec-3-D-PART-D` parsed parent=`sec-3-P-D`
- `sec-3-D-VIII`: db parent=`sec-3-D-PART-D` parsed parent=`sec-3-P-D`
- `sec-3-D-X`: db parent=`sec-3-D-PART-D` parsed parent=`sec-3-P-D`
- `sec-3-D-XI`: db parent=`sec-3-D-PART-D` parsed parent=`sec-3-P-D`
- `sec-3-D-XII`: db parent=`sec-3-D-PART-D` parsed parent=`sec-3-P-D`
- `sec-3-D-XIII`: db parent=`sec-3-D-PART-D` parsed parent=`sec-3-P-D`
- `sec-3-D-XIV`: db parent=`sec-3-D-PART-D` parsed parent=`sec-3-P-D`
- `sec-3-D-XV`: db parent=`sec-3-D-PART-D` parsed parent=`sec-3-P-D`
- `sec-3-F-I`: db parent=`sec-3-F-PART-F` parsed parent=`sec-3-P-F`

## DB rows with page-furniture leaks (first 30)

- `sec-3-A-I-A`
- `sec-3-A-I-B-21`
- `sec-3-A-I-B-23-f`
- `sec-3-A-I-B-50-e`
- `sec-3-D-IV-A-6`
- `sec-3-F-I-A`
- `sec-3-F-I-E`
- `sec-3-F-I-F`
- `sec-3-F-I-I`
- `sec-3-F-I-N`
- `sec-3-F-I-O`
- `sec-3-F-I-P`
- `sec-3-F-I-Q`
- `sec-3-F-I-R`
- `sec-3-F-I-T`
- `sec-3-F-I-Z`
- `sec-3-F-II-D-4-a-vi-C`
- `sec-3-F-II-E-3-ee`
- `sec-3-F-XVII-B-2`
- `sec-3-F-I-B-44`
- `sec-3-F-APPENDIX-D`
- `sec-3-F-II-D-7`
- `sec-3-F-VI-A-4`
- `sec-3-F-II-D-2`
- `sec-3-F-VI-D`
- `sec-3-F-III-D-1-c`

## Truncation-confirmed rows (DB text is a suffix of parsed text) — first 30

- `sec-3-A-I`
- `sec-3-A-I-B`
- `sec-3-A-I-B-1`
- `sec-3-A-I-B-1-a`
- `sec-3-A-I-B-10-b`
- `sec-3-A-I-B-36`
- `sec-3-A-I-B-36-b`
- `sec-3-A-I-B-46-d`
- `sec-3-A-I-B-53-e`
- `sec-3-A-II`
- `sec-3-A-II-A`
- `sec-3-A-II-B`
- `sec-3-A-II-C`
- `sec-3-A-II-C-1`
- `sec-3-A-II-C-1-d`
- `sec-3-A-II-C-1-e`
- `sec-3-A-II-C-2`
- `sec-3-A-II-C-2-b`
- `sec-3-A-II-C-3`
- `sec-3-A-II-C-4`
- `sec-3-A-II-D`
- `sec-3-A-II-D-1-aaaa`
- `sec-3-A-II-D-1-d`
- `sec-3-A-II-D-1-dd`
- `sec-3-A-II-D-1-ddd`
- `sec-3-A-II-D-1-ee`
- `sec-3-A-II-D-1-eeee`
- `sec-3-A-II-D-1-f`
- `sec-3-A-II-D-1-ff`
- `sec-3-A-II-D-1-fff`
- … and 286 more

## Different (not identical, not a clean truncation) — first 40

- `sec-3-A-APPENDIX-A`
- `sec-3-A-APPENDIX-B`
- `sec-3-A-APPENDIX-C`
- `sec-3-A-IX-B-1-a`
- `sec-3-A-IX-B-2-c`
- `sec-3-A-IX-B-3-a`
- `sec-3-A-V-C-7`
- `sec-3-A-V-D-1-e`
- `sec-3-A-VI-E-6-a`
- `sec-3-B-III-D-2-d`
- `sec-3-B-III-J-2-b`
- `sec-3-B-III-J-3`
- `sec-3-B-III-J-3-a`
- `sec-3-C-II`
- `sec-3-C-II-E-3-nnn`
- `sec-3-C-XI-B`
- `sec-3-C-XI-C-3`
- `sec-3-C-XI-C-4`
- `sec-3-D-I-B-1`
- `sec-3-D-II-A-26`
- `sec-3-D-II-A-4-b`
- `sec-3-D-VII-B`
- `sec-3-D-X-A-1-b`
- `sec-3-D-X-A-2`
- `sec-3-D-XIII-D`
- `sec-3-D-XIV-C-1`
- `sec-3-D-XV-C-1`
- `sec-3-D-XV-C-1-a`
- `sec-3-F-I`
- `sec-3-F-I-A`
- `sec-3-F-I-B`
- `sec-3-F-I-C`
- `sec-3-F-I-C-2`
- `sec-3-F-I-D`
- `sec-3-F-I-F`
- `sec-3-F-I-J`
- `sec-3-F-I-K`
- `sec-3-F-I-L`
- `sec-3-F-I-O`
- `sec-3-F-I-V`
- … and 3 more

## Likely amendment-driven renumbering (DB text found on a nearby sibling id)

The current source PDF has clearly been amended since the DB was last populated (dates change, e.g. Reg 7 II.A.2's EPA Method 21 citation goes from `(August 3, 2017)` in the source PDF to no date at all in some DB rows; definitions get inserted alphabetically, shifting every subsequent sequentially-numbered definition — e.g. DB's `sec-7-B-I-B-24` is `"New"` but the current PDF's `I.B.24` is `"Natural gas transmission and storage segment"`, a term inserted earlier in the list, pushing `"New"` down to `I.B.25`). The rows below are where the DB's stored text for id X is not what's at X in the new parse, but IS found (word salad aside) on a nearby sibling id — i.e. content that moved, not content that's wrong.

(1 of the 43 'different' rows)

- `sec-3-F-I-C` (DB) → now at `sec-3-F-I-A` (parsed)

## Cross-reference linking

- `<span class="xref">` spans — parsed: **2769**, DB: **2365**
- `<a class="xref-external-reg">` anchors — parsed: **144**, DB: **0**

### Spans by target part

| target | parsed | DB |
|---|---|---|
| Part A (bare part reference) | 449 | 0 |
| Part B (bare part reference) | 181 | 0 |
| Part C (bare part reference) | 242 | 0 |
| Part D (bare part reference) | 149 | 0 |
| Part E (bare part reference) | 5 | 0 |
| Part F (bare part reference) | 43 | 0 |
| top (Regulation root) | 462 | 384 |
| under Part A | 347 | 512 |
| under Part B | 170 | 269 |
| under Part C | 301 | 390 |
| under Part D | 420 | 422 |
| under Part E | 0 | 11 |
| under Part F | 0 | 377 |

### Unresolved references, by bucket (top 15 each)

**Historical (former structure — this regulation was renumbered/reorganized; these no longer exist in the current Parts)** — 8 distinct, 25 mentions

| citation text | count |
|---|---|
| Part G | 15 |
| Part K | 2 |
| XVII.B.2. | 2 |
| XVII.I.2. | 2 |
| XVII. | 1 |
| D. | 1 |
| XVII.N.1. | 1 |
| XVI.A. | 1 |

**Other regulation not in corpus** — 18 distinct, 85 mentions

| citation text | count |
|---|---|
| Regulation Number 8 | 14 |
| Regulation Number 6 | 9 |
| Regulation Number 5 | 9 |
| Regulation Number 2 | 8 |
| Regulation Number 23 | 8 |
| Regulation Number 1 | 7 |
| Regulation Number 6, Part A | 6 |
| Regulation Number 9 | 4 |
| Regulation Number 8, Part E | 4 |
| Regulation Number 2, Part B | 3 |
| Regulation Number 8, Part E, Section IV. | 3 |
| Regulation 30 | 3 |
| Regulation Number 24 | 2 |
| Regulation Number 15 | 1 |
| Regulation Number 25, Part B, Sections I.A.12. and I.L.2.d. | 1 |

**CFR part/subpart not in corpus** — 3 distinct, 7 mentions

| citation text | count |
|---|---|
| 40 CFR Part 51 | 4 |
| 40 CFR Part 70 | 2 |
| 40 CFR Part 98, Subpart A | 1 |

**Unparseable / genuine parser gap** — 105 distinct, 133 mentions

| citation text | count |
|---|---|
| VI. | 6 |
| I.G. | 3 |
| II.E.1 | 3 |
| V.B.1.h. | 2 |
| XV.P.2. | 2 |
| II.C.1.j. | 2 |
| IV.D.2.c. | 2 |
| IV.D.2.a. | 2 |
| XV.F.1.c. | 2 |
| II.E. | 2 |
| IV.C.1.e | 2 |
| IV.C.1 | 2 |
| I.B.9.a | 2 |
| VI.G.8 | 2 |
| I.B.40.c. | 2 |

### Remaining unwrapped "Section..." text

- Total: **203**
- Excluding ones whose roman numeral doesn't exist in any current roman-numbered part at all (historical, expected to stay unlinked): **192**

### 10 random linked paragraphs from Part B

- `sec-3-B-III-F-1`: <p>If the Division determines that a source cannot comply with the provisions of <span class="xref" data-target="sec-3-P-B">Part B</span>, <span class="xref" data-target="sec-3-B-III-D">Section III.D.</span>, of this regulation, the Division shall issue its written denial of the permit application stating the reasons for such denial. Any Division denial of a permit shall become final upon mailing 
- `sec-3-B-III-J-5`: <p>Owners or operators of new or modified sources located in Disproportionately Impacted Communities that are utilizing general permits must submit a notification at the time of registration for a general permit or permits issued pursuant to <span class="xref" data-target="sec-3-B-III-I">Section III.I.</span> of this <span class="xref" data-target="sec-3-P-B">Part B</span> indicating the source wi
- `sec-3-B-II-D-10`: <p>Sources reporting greenhouse gases in accordance with <span class="xref" data-target="sec-3-P-A">Part A</span>, <span class="xref" data-target="sec-3-A-II-A-2">Section II.A.2.</span>, are not required to obtain a construction permit solely for greenhouse gas.</p>
- `sec-3-B-III-D-2-c-(i)`: <p>For the purposes of this <span class="xref" data-target="sec-3-B-III-D-2-c">Section III.D.2.c.</span>, any source subject to RACT requirements in <a class="xref-external-reg" href="/regulations/7">Regulation Number 7</a> (as reorganized) or the Colorado State Implementation Plan (SIP) shall be presumed to comply with this III.D.2.c. for any pollutants covered by those existing RACT requirements
- `sec-3-B-III-C-1`: <p>The following sources, unless exempted in <span class="xref" data-target="sec-3-B-III-C-2">Section III.C.2.</span>, are subject to public comment:</p>
- `sec-3-B-III-D-1-b`: <p>As applicable, the proposed source or activity will meet the requirements of the attainment program as outlined in <span class="xref" data-target="sec-3-A-V">Section V.</span> of <span class="xref" data-target="sec-3-P-D">Part D</span> of this regulation, if any;</p>
- `sec-3-B-II-A-6`: <p>Owners or operators of sources that have valid operating permits in accordance with <span class="xref" data-target="sec-3-P-C">Part C</span> of this regulation may construct or modify such source without obtaining a construction permit prior to construction or modification, provided the construction or modification qualifies for a minor permit modification or for operational flexibility, and th
- `sec-3-B-III-I-1`: <p>The Division may issue a general construction permit covering numerous similar sources to a source that would otherwise be required to obtain a construction permit pursuant to this <span class="xref" data-target="sec-3-P-B">Part B</span>. Any general construction permit shall comply with all applicable requirements, including notice and opportunity for public participation where warranted for s
- `sec-3-B-III-D-2-a`: <p>Minor sources in designated nonattainment or attainment/maintenance areas that are otherwise not exempt pursuant to <span class="xref" data-target="sec-3-B-II-D">Section II.D.</span> of this Part, shall apply Reasonably Available Control Technology for the pollutants for which the area is nonattainment or attainment/maintenance.</p>
- `sec-3-B-III-B-3`: <p>Applications shall be signed by a person legally authorized to act on behalf of the applicant. The applicant shall furnish all information and data required by the Division to evaluate the permit application and to make its preliminary analysis in accordance with <span class="xref" data-target="sec-3-B-III-B-7">Section III.B.7.</span> of this part.</p>

### 5 random linked paragraphs from Part C

- `sec-3-C-III-D-3`: <p>(State Only) A Division-verified environmental justice summary in accordance with <span class="xref" data-target="sec-3-C-III-B-5">Section III.B.5.</span> of <span class="xref" data-target="sec-3-P-B">Part B</span> of this <span class="xref" data-target="sec-3-top-REG-3">Regulation Number 3</span> if a summary has not been submitted for the source in accordance with <span class="xref" data-targ
- `sec-3-C-VIII-A`: <p>The Division may, after notice and opportunity for public participation provided under <span class="xref" data-target="sec-3-C-VI">Section VI.</span> of this <span class="xref" data-target="sec-3-P-C">Part C</span>, issue a general permit covering numerous similar sources that would otherwise be required to obtain an operating permit pursuant to this <span class="xref" data-target="sec-3-P-C">P
- `sec-3-C-IV-D`: <p>Requests for additional information</p><p>If, after an application is deemed complete, the Division determines that additional information is necessary to evaluate or take final action on an application, the Division shall request necessary information in writing and set a reasonable deadline for response. Additional information submitted within the deadline will be evaluated by the Division. I
- `sec-3-C-V-A-2`: <p>If the source has not demonstrated compliance under the provisions of <span class="xref" data-target="sec-3-top-REG-3">Regulation Number 3</span>, <span class="xref" data-target="sec-3-P-B">Part B</span>, <span class="xref" data-target="sec-3-B-III-G">Section III.G.</span>, and the source anticipates being in compliance at the time of the operating permit issuance with all of the terms or condi
- `sec-3-C-IX-A`: <p>The Division shall give notice of each draft-operating permit to any affected state on or before the time that the Division provides public notice under <span class="xref" data-target="sec-3-C-VI">Section VI.</span> of this <span class="xref" data-target="sec-3-P-C">Part C</span>, except where the requirements for timing of notices are different pursuant to <span class="xref" data-target="sec-3

### DB xref target vs parsed xref target, same provision & citation text

(412 such (provision, citation text) pairs found)

| provision | citation text | DB target | parsed target |
|---|---|---|---|
| `sec-3-D-XIV-D-2-d` | Section VI. | `sec-3-A-VI` | `sec-3-D-VI` |
| `sec-3-C-V-C-6-c` | Section VII. | `sec-3-A-VII` | `sec-3-C-VII` |
| `sec-3-D-XV-A-2-d` | Section I.B.53. | `sec-3-D-I-B` | `sec-3-A-I-B-53` |
| `sec-3-D-XII-A` | Part D | `sec-3-D-PART-D` | `sec-3-P-D` |
| `sec-3-D-XV-F-11` | Section I.B.53. | `sec-3-D-I-B` | `sec-3-A-I-B-53` |
| `sec-3-B-III-B-5-f` | Part C | `sec-3-C-PART-C` | `sec-3-P-C` |
| `sec-3-D-VI-B-5-e` | Section VI.B.5.a.(iii) | `sec-3-D-VI-B-5-a-iii` | `sec-3-D-VI-B-5-a-(iii)` |
| `sec-3-A-II-D-1` | Part C | `sec-3-C-PART-C` | `sec-3-P-C` |
| `sec-3-D-II-A-28` | Part D | `sec-3-D-PART-D` | `sec-3-P-D` |
| `sec-3-D-XV-H-4` | Part D | `sec-3-D-PART-D` | `sec-3-P-D` |

_(the hand-reviewed DB-vs-parsed xref-target writeup below is Reg 7-specific and only applies when diffing Reg 7 against a pre-existing DB export)_

## Lowercase-start rows in parsed output (first 30)

- `sec-3-F-I-C-4`: 'monitoring may only be required if the source is a major contributor to the expe'
- `sec-3-F-I-C-5`: 'it is economically reasonable as compared to other monitoring and analysis expen'

## 15 random side-by-side samples

### `sec-3-C-I-A-7-f`
- DB:     `<p> Every significant change in existing monitoring permit terms or conditions; and</p>`
- Parsed: `<p>Every significant change in existing monitoring permit terms or conditions; and</p>`

### `sec-3-A-V-B-1-a`
- DB:     `<p> The owners or operators of stationary sources or emissions units that intend to voluntarily reduce emissions and seek to create emission reduction credits (ERCs). Credit creation is voluntary.</p>`
- Parsed: `<p>The owners or operators of stationary sources or emissions units that intend to voluntarily reduce emissions and seek to create emission reduction credits (ERCs). Credit creation is voluntary.</p>`

### `sec-3-C-III-C-3-h`
- DB:     `<p> Calculations on which the information required in <span class="xref" data-target="sec-3-C-III-C-3-a">Sections III.C.3.a.</span> through III.C.3.g. are based.</p>`
- Parsed: `<p>Calculations on which the information required in <span class="xref" data-target="sec-3-C-III-C-3-a">Sections III.C.3.a.</span> through <span class="xref" data-target="sec-3-C-III-C-3-g">III.C.3.g.`

### `sec-3-D-X-A-4`
- DB:     `<p> Periodic Review</p>`
- Parsed: `X.A.4. Periodic Review`

### `sec-3-A-I-B-53-a`
- DB:     `<p> GHG shall not be subject to regulation except as provided in <span class="xref" data-target="sec-3-A-I-B-53-d">Sections I.B.53.d.</span> through f. of this <span class="xref" data-target="sec-3-A-`
- Parsed: `<p>GHG shall not be subject to regulation except as provided in <span class="xref" data-target="sec-3-A-I-B-53-d">Sections I.B.53.d.</span> through f. of this <span class="xref" data-target="sec-3-P-A`

### `sec-3-A-II-C-1-g`
- DB:     `<p> A revised Air Pollutant Emission Notice is not required for emergency or backup generators that are ancillary to the main units at electric utility facilities, and that have a permit under Parts C`
- Parsed: `<p>A revised Air Pollutant Emission Notice is not required for emergency or backup generators that are ancillary to the main units at electric utility facilities, and that have a permit under Parts C `

### `sec-3-D-II-A-25-a`
- DB:     `<p> For the purpose of determining whether a source in an attainment or unclassifiable area is subject to the requirements of this <span class="xref" data-target="sec-3-D-PART-D">Part D</span>, major `
- Parsed: `<p>For the purpose of determining whether a source in an attainment or unclassifiable area is subject to the requirements of this <span class="xref" data-target="sec-3-P-D">Part D</span>, major statio`

### `sec-3-A-II-D-1-hh`
- DB:     `<p> Plastic pipe welding.</p>`
- Parsed: `II.D.1.hh. Plastic pipe welding.`

### `sec-3-C-II-E-3-ss`
- DB:     `<p> Truck and car wash units.</p>`
- Parsed: `II.E.3.ss. Truck and car wash units.`

### `sec-3-D-IV-A-2-b`
- DB:     `<p> That comments are solicited on the air quality impacts of the source or modification;</p>`
- Parsed: `<p>That comments are solicited on the air quality impacts of the source or modification;</p>`

### `sec-3-A-II-A-2-b`
- DB:     `<p> For each reporting year, “CO2e” is determined by multiplying the mass amount of emissions for each greenhouse gas constituent, as defined in <span class="xref" data-target="sec-3-A-II-A-2-a">Secti`
- Parsed: `<p>For each reporting year, “CO2e” is determined by multiplying the mass amount of emissions for each greenhouse gas constituent, as defined in <span class="xref" data-target="sec-3-A-II-A-2-a">Sectio`

### `sec-3-C-XIV`
- DB:     `<p> Compliance Assurance Monitoring The regulations promulgated by the U.S. EPA listed in <span class="xref" data-target="sec-3-C-XIV-A-1">Section XIV.A.1.</span>, are hereby incorporated by reference`
- Parsed: `<p>Compliance Assurance Monitoring The regulations promulgated by the U.S. EPA listed in <span class="xref" data-target="sec-3-C-XIV-A-1">Section XIV.A.1.</span>, are hereby incorporated by reference `

### `sec-3-A-VII`
- DB:     `<p> Confidential Information or Data Contained in Air Pollutant Emission Notices, Permit Applications, or Reports Submitted Pursuant to <span class="xref" data-target="sec-3-C-PART-C">Part C</span>, <`
- Parsed: `<p>Confidential Information or Data Contained in Air Pollutant Emission Notices, Permit Applications, or Reports Submitted Pursuant to <span class="xref" data-target="sec-3-P-C">Part C</span>, <span c`

### `sec-3-A-I-B-42`
- DB:     `<p> Portable Source</p><p>A source such as, but not limited to, asphalt batch plants and aggregate crushers that commonly and by usual practice is moved from one site to another. A source will not be `
- Parsed: `<p>Portable Source</p><p>A source such as, but not limited to, asphalt batch plants and aggregate crushers that commonly and by usual practice is moved from one site to another. A source will not be c`

### `sec-3-A-II-D-1-d`
- DB:     `<p> Fireplaces used for recreational purposes, inside or outside.</p>`
- Parsed: `II.D.1.d. Fireplaces used for recreational purposes, inside or outside.`
