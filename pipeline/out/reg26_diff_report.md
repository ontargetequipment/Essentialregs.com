# Reg 26 import diff report

- Parsed rows: **644**
- DB rows: **531**
- Ids in both: **303**
- Ids only in DB (parser gap or DB junk): **228**
- Ids only in parsed (parser found something DB doesn't have): **341**
- Text identical: **202**
- Text where DB is a suffix of parsed (truncation confirmed): **66**
- Text different (neither identical nor a clean truncation): **35**
  - of which text also found verbatim on a nearby sibling id (amendment-driven renumbering, not a parser bug): **0**
- parent_id mismatches among shared ids: **19**
- DB rows with page-furniture leaked into full_text: **4**
- Parsed rows whose full_text starts with a lowercase letter: **1**

## Ids only in DB

(228 total)

- `sec-26-A-II`
- `sec-26-A-PART-A`
- `sec-26-B-I-D-4-a-i`
- `sec-26-B-I-D-4-a-i-A`
- `sec-26-B-I-D-4-a-i-B`
- `sec-26-B-I-D-4-a-i-C`
- `sec-26-B-I-D-4-a-ii`
- `sec-26-B-I-D-4-b-i`
- `sec-26-B-I-D-4-b-ii`
- `sec-26-B-I-D-4-c-i`
- `sec-26-B-I-D-4-c-ii`
- `sec-26-B-I-D-4-c-ii-A`
- `sec-26-B-I-D-4-c-ii-B`
- `sec-26-B-I-D-4-c-ii-C`
- `sec-26-B-I-D-5-a-i`
- `sec-26-B-I-D-5-a-i-A`
- `sec-26-B-I-D-5-a-i-B`
- `sec-26-B-I-D-5-a-i-C`
- `sec-26-B-I-D-5-a-ii`
- `sec-26-B-I-D-5-a-ii-A`
- `sec-26-B-I-D-5-a-ii-B`
- `sec-26-B-I-D-5-a-ii-C`
- `sec-26-B-I-D-5-a-ii-D`
- `sec-26-B-I-D-5-b-i`
- `sec-26-B-I-D-5-b-ii`
- `sec-26-B-I-D-5-b-iii-A`
- `sec-26-B-I-D-5-b-iii-B`
- `sec-26-B-I-D-5-b-iii-C`
- `sec-26-B-I-D-5-b-iii-D`
- `sec-26-B-I-D-5-b-iii-E`
- `sec-26-B-I-D-5-b-iv`
- `sec-26-B-I-D-5-b-iv-A`
- `sec-26-B-I-D-5-b-iv-B`
- `sec-26-B-I-D-5-b-v`
- `sec-26-B-I-D-5-b-v-A`
- `sec-26-B-I-D-5-b-vi-A`
- `sec-26-B-I-D-5-b-vi-B`
- `sec-26-B-I-D-5-c-i`
- `sec-26-B-I-D-5-c-i-A`
- `sec-26-B-I-D-5-c-i-B`
- `sec-26-B-I-D-5-c-i-C`
- `sec-26-B-I-D-5-c-ii`
- `sec-26-B-I-D-5-c-ii-A`
- `sec-26-B-I-D-5-c-ii-B`
- `sec-26-B-I-D-5-c-ii-C`
- `sec-26-B-I-D-5-c-ii-D`
- `sec-26-B-I-D-5-c-ii-E`
- `sec-26-B-I-D-5-c-ii-F`
- `sec-26-B-I-D-5-c-ii-G`
- `sec-26-B-I-D-5-c-ii-H`
- `sec-26-B-I-D-5-c-ii-I`
- `sec-26-B-I-D-5-c-iii`
- `sec-26-B-I-D-5-c-iv`
- `sec-26-B-I-D-5-c-v`
- `sec-26-B-I-D-5-c-v-A`
- `sec-26-B-I-D-5-c-v-B`
- `sec-26-B-I-D-5-c-v-C`
- `sec-26-B-I-D-5-c-v-D`
- `sec-26-B-I-D-5-c-v-E`
- `sec-26-B-I-D-5-c-vi`
- `sec-26-B-I-D-5-d-i`
- `sec-26-B-I-D-5-d-i-A`
- `sec-26-B-I-D-5-d-i-B`
- `sec-26-B-I-D-5-d-i-C`
- `sec-26-B-I-D-5-d-i-D`
- `sec-26-B-I-D-5-d-ii`
- `sec-26-B-I-D-5-d-iii`
- `sec-26-B-I-D-5-e-i`
- `sec-26-B-I-D-5-e-i-A`
- `sec-26-B-I-D-5-e-i-B`
- `sec-26-B-I-D-5-e-i-C`
- `sec-26-B-I-D-5-e-i-D`
- `sec-26-B-I-D-5-e-i-E`
- `sec-26-B-I-D-5-e-ii`
- `sec-26-B-I-D-5-e-ii-A`
- `sec-26-B-I-D-5-e-ii-B`
- `sec-26-B-I-D-5-e-ii-C`
- `sec-26-B-I-D-5-e-iii`
- `sec-26-B-I-D-5-e-iv`
- `sec-26-B-I-D-5-e-iv-A`
- `sec-26-B-I-D-5-e-iv-B`
- `sec-26-B-I-D-5-e-iv-C`
- `sec-26-B-I-D-5-e-iv-D`
- `sec-26-B-I-D-5-f-i`
- `sec-26-B-I-D-5-f-ii`
- `sec-26-B-I-D-5-f-iii`
- `sec-26-B-I-D-5-f-iv`
- `sec-26-B-I-D-5-f-v`
- `sec-26-B-I-D-5-f-vi`
- `sec-26-B-I-D-5-f-vi-A`
- `sec-26-B-I-D-5-f-vi-B`
- `sec-26-B-I-D-5-f-vi-C`
- `sec-26-B-I-D-5-f-vi-D`
- `sec-26-B-I-D-5-g-i`
- `sec-26-B-I-D-5-g-iii`
- `sec-26-B-I-D-5-g-iv`
- `sec-26-B-I-D-6-a-i`
- `sec-26-B-I-D-6-a-ii`
- `sec-26-B-I-D-6-a-iii`
- `sec-26-B-I-D-6-a-iv`
- `sec-26-B-I-D-6-a-v`
- `sec-26-B-I-D-6-a-vi`
- `sec-26-B-I-D-6-a-vi-A`
- `sec-26-B-I-D-6-a-vi-B`
- `sec-26-B-I-D-6-a-vi-C`
- `sec-26-B-I-D-6-a-vi-D`
- `sec-26-B-I-D-6-a-vi-E`
- `sec-26-B-I-D-6-b-i`
- `sec-26-B-I-D-6-b-ii`
- `sec-26-B-I-D-6-b-iii`
- `sec-26-B-I-D-6-b-iv`
- `sec-26-B-I-D-6-b-v`
- `sec-26-B-I-D-6-b-v-A`
- `sec-26-B-I-D-6-b-v-B`
- `sec-26-B-I-D-6-b-v-C`
- `sec-26-B-I-D-6-b-v-D`
- `sec-26-B-I-D-6-b-v-E`
- `sec-26-B-I-D-6-b-vi`
- `sec-26-B-I-D-6-b-vi-A`
- `sec-26-B-I-D-6-b-vi-B`
- `sec-26-B-I-D-6-b-vii`
- `sec-26-B-I-D-6-b-vii-A`
- `sec-26-B-I-D-6-b-vii-B`
- `sec-26-B-I-D-6-c-i`
- `sec-26-B-I-D-6-c-i-A`
- `sec-26-B-I-D-6-c-i-B`
- `sec-26-B-I-D-6-c-i-C`
- `sec-26-B-I-D-6-c-i-D`
- `sec-26-B-I-D-6-c-ii`
- `sec-26-B-I-D-6-c-iii`
- `sec-26-B-I-D-6-c-iv`
- `sec-26-B-I-D-6-d-i`
- `sec-26-B-I-D-6-d-i-A`
- `sec-26-B-I-D-6-d-i-B`
- `sec-26-B-I-D-6-d-i-C`
- `sec-26-B-I-D-6-d-i-D`
- `sec-26-B-I-D-6-d-i-E`
- `sec-26-B-I-D-6-d-ii`
- `sec-26-B-I-D-6-d-ii-A`
- `sec-26-B-I-D-6-d-ii-B`
- `sec-26-B-I-D-6-d-ii-C`
- `sec-26-B-I-D-6-d-iii`
- `sec-26-B-I-D-6-d-iii-A`
- `sec-26-B-I-D-6-d-iii-B`
- `sec-26-B-I-D-6-d-iii-C`
- `sec-26-B-I-D-6-d-iii-D`
- `sec-26-B-I-D-6-e-i`
- `sec-26-B-I-D-6-e-ii`
- `sec-26-B-I-D-6-e-iii`
- `sec-26-B-I-D-6-e-iv`
- `sec-26-B-I-D-6-e-v`
- `sec-26-B-I-D-6-e-vi`
- `sec-26-B-I-D-6-e-vi-A`
- `sec-26-B-I-D-6-e-vi-B`
- `sec-26-B-I-D-6-e-vi-C`
- `sec-26-B-I-D-6-e-vi-D`
- `sec-26-B-I-D-6-f-i`
- `sec-26-B-I-D-6-f-i-A`
- `sec-26-B-II-A-2-a-i`
- `sec-26-B-II-A-2-a-ii`
- `sec-26-B-II-A-4-a-i`
- `sec-26-B-II-A-4-a-ii`
- `sec-26-B-II-A-4-a-iii`
- `sec-26-B-II-A-4-a-iv`
- `sec-26-B-II-A-4-a-v`
- `sec-26-B-II-A-4-a-vi`
- `sec-26-B-II-A-4-a-vii`
- `sec-26-B-II-A-4-b-i`
- `sec-26-B-II-A-4-b-i-C`
- `sec-26-B-II-A-4-b-i-D`
- `sec-26-B-II-A-4-b-ii`
- `sec-26-B-II-A-4-b-iii`
- `sec-26-B-II-A-4-b-iv`
- `sec-26-B-II-A-4-c-i`
- `sec-26-B-II-A-4-d-i`
- `sec-26-B-II-A-4-d-ii`
- `sec-26-B-II-A-4-d-ii-A`
- `sec-26-B-II-A-4-d-ii-B`
- `sec-26-B-II-A-4-d-iii`
- `sec-26-B-II-A-4-e-i`
- `sec-26-B-II-A-4-e-ii`
- `sec-26-B-II-A-4-e-iii`
- `sec-26-B-II-A-4-f-i`
- `sec-26-B-II-A-4-g-i`
- `sec-26-B-II-A-4-g-ii`
- `sec-26-B-II-A-4-g-iii`
- `sec-26-B-II-A-4-g-iv`
- `sec-26-B-II-A-4-g-v`
- `sec-26-B-II-A-5-b-i-A`
- `sec-26-B-II-A-5-b-i-B`
- `sec-26-B-II-A-5-b-ii-A`
- `sec-26-B-II-A-5-b-ii-B`
- `sec-26-B-II-A-5-b-ii-C`
- `sec-26-B-II-A-5-b-ii-D`
- `sec-26-B-II-A-5-b-ii-E`
- `sec-26-B-II-A-5-b-ii-F`
- `sec-26-B-II-A-6-b-i-A`
- `sec-26-B-II-A-6-b-i-B`
- `sec-26-B-II-A-6-b-i-C`
- `sec-26-B-II-A-6-b-i-D`
- `sec-26-B-II-A-6-b-iii-A`
- `sec-26-B-II-A-6-b-iii-B`
- `sec-26-B-II-A-6-b-iii-C`
- `sec-26-B-II-A-6-b-iv-A`
- `sec-26-B-II-A-6-b-iv-B`
- `sec-26-B-II-A-6-b-iv-C`
- `sec-26-B-II-A-6-b-viii-A`
- `sec-26-B-II-A-6-b-viii-B`
- `sec-26-B-II-A-6-b-viii-C`
- `sec-26-B-II-A-6-b-viii-D`
- `sec-26-B-II-A-6-b-viii-E`
- `sec-26-B-II-A-6-b-viii-F`
- `sec-26-B-II-A-6-b-viii-G`
- `sec-26-B-II-A-6-b-viii-H`
- `sec-26-B-II-A-7-f-i-A`
- `sec-26-B-II-A-7-f-i-B`
- `sec-26-B-II-A-7-f-i-C`
- `sec-26-B-II-A-7-f-i-D`
- `sec-26-B-II-A-7-f-i-E`
- `sec-26-B-II-A-7-f-i-F`
- `sec-26-B-II-D-5-g-ii`
- `sec-26-B-IV-A-5-b-iii-A`
- `sec-26-B-IV-A-5-b-iii-B`
- `sec-26-B-PART-B`
- `sec-26-C-I-D-6-b`
- `sec-26-C-I-D-6-b-vii`
- `sec-26-C-PART-C`
- `sec-26-C-XI-A-3`

## Ids only in parsed

(341 total)

- `sec-26-B-I-A`
- `sec-26-B-I-D-4-a-(i)`
- `sec-26-B-I-D-4-a-(i)-(A)`
- `sec-26-B-I-D-4-a-(i)-(B)`
- `sec-26-B-I-D-4-a-(i)-(C)`
- `sec-26-B-I-D-4-a-(ii)`
- `sec-26-B-I-D-4-b-(i)`
- `sec-26-B-I-D-4-b-(ii)`
- `sec-26-B-I-D-4-c-(i)`
- `sec-26-B-I-D-4-c-(ii)`
- `sec-26-B-I-D-4-c-(ii)-(A)`
- `sec-26-B-I-D-4-c-(ii)-(B)`
- `sec-26-B-I-D-4-c-(ii)-(C)`
- `sec-26-B-I-D-4-c-(iii)`
- `sec-26-B-I-D-4-c-(iv)`
- `sec-26-B-I-D-4-c-(iv)-(A)`
- `sec-26-B-I-D-5-a-(i)`
- `sec-26-B-I-D-5-a-(i)-(A)`
- `sec-26-B-I-D-5-a-(i)-(B)`
- `sec-26-B-I-D-5-a-(i)-(C)`
- `sec-26-B-I-D-5-a-(ii)`
- `sec-26-B-I-D-5-a-(ii)-(A)`
- `sec-26-B-I-D-5-a-(ii)-(B)`
- `sec-26-B-I-D-5-a-(ii)-(C)`
- `sec-26-B-I-D-5-a-(ii)-(D)`
- `sec-26-B-I-D-5-b-(i)`
- `sec-26-B-I-D-5-b-(ii)`
- `sec-26-B-I-D-5-b-(iii)`
- `sec-26-B-I-D-5-b-(iii)-(A)`
- `sec-26-B-I-D-5-b-(iii)-(B)`
- `sec-26-B-I-D-5-b-(iii)-(C)`
- `sec-26-B-I-D-5-b-(iii)-(D)`
- `sec-26-B-I-D-5-b-(iii)-(E)`
- `sec-26-B-I-D-5-b-(iv)`
- `sec-26-B-I-D-5-b-(iv)-(A)`
- `sec-26-B-I-D-5-b-(iv)-(B)`
- `sec-26-B-I-D-5-b-(v)`
- `sec-26-B-I-D-5-b-(v)-(A)`
- `sec-26-B-I-D-5-b-(v)-(B)`
- `sec-26-B-I-D-5-b-(vi)`
- `sec-26-B-I-D-5-b-(vi)-(A)`
- `sec-26-B-I-D-5-c-(i)`
- `sec-26-B-I-D-5-c-(i)-(A)`
- `sec-26-B-I-D-5-c-(i)-(B)`
- `sec-26-B-I-D-5-c-(i)-(C)`
- `sec-26-B-I-D-5-c-(ii)`
- `sec-26-B-I-D-5-c-(ii)-(A)`
- `sec-26-B-I-D-5-c-(ii)-(B)`
- `sec-26-B-I-D-5-c-(ii)-(B)-(1)`
- `sec-26-B-I-D-5-c-(ii)-(B)-(2)`
- `sec-26-B-I-D-5-c-(ii)-(B)-(3)`
- `sec-26-B-I-D-5-c-(ii)-(B)-(4)`
- `sec-26-B-I-D-5-c-(ii)-(B)-(5)`
- `sec-26-B-I-D-5-c-(ii)-(B)-(6)`
- `sec-26-B-I-D-5-c-(ii)-(B)-(7)`
- `sec-26-B-I-D-5-c-(ii)-(B)-(8)`
- `sec-26-B-I-D-5-c-(ii)-(C)`
- `sec-26-B-I-D-5-c-(ii)-(D)`
- `sec-26-B-I-D-5-c-(ii)-(E)`
- `sec-26-B-I-D-5-c-(ii)-(F)`
- `sec-26-B-I-D-5-c-(ii)-(G)`
- `sec-26-B-I-D-5-c-(ii)-(G)-(1)`
- `sec-26-B-I-D-5-c-(ii)-(G)-(2)`
- `sec-26-B-I-D-5-c-(ii)-(G)-(3)`
- `sec-26-B-I-D-5-c-(ii)-(H)`
- `sec-26-B-I-D-5-c-(ii)-(H)-(1)`
- `sec-26-B-I-D-5-c-(ii)-(H)-(2)`
- `sec-26-B-I-D-5-c-(ii)-(I)`
- `sec-26-B-I-D-5-c-(iii)`
- `sec-26-B-I-D-5-c-(iv)`
- `sec-26-B-I-D-5-c-(v)`
- `sec-26-B-I-D-5-c-(v)-(A)`
- `sec-26-B-I-D-5-c-(v)-(B)`
- `sec-26-B-I-D-5-c-(v)-(C)`
- `sec-26-B-I-D-5-c-(v)-(D)`
- `sec-26-B-I-D-5-c-(v)-(E)`
- `sec-26-B-I-D-5-c-(vi)`
- `sec-26-B-I-D-5-d`
- `sec-26-B-I-D-5-d-(i)`
- `sec-26-B-I-D-5-d-(i)-(A)`
- `sec-26-B-I-D-5-d-(i)-(B)`
- `sec-26-B-I-D-5-d-(i)-(C)`
- `sec-26-B-I-D-5-d-(i)-(C)-(1)`
- `sec-26-B-I-D-5-d-(i)-(C)-(2)`
- `sec-26-B-I-D-5-d-(i)-(D)`
- `sec-26-B-I-D-5-d-(ii)`
- `sec-26-B-I-D-5-d-(iii)`
- `sec-26-B-I-D-5-e-(i)`
- `sec-26-B-I-D-5-e-(i)-(A)`
- `sec-26-B-I-D-5-e-(i)-(B)`
- `sec-26-B-I-D-5-e-(i)-(C)`
- `sec-26-B-I-D-5-e-(i)-(D)`
- `sec-26-B-I-D-5-e-(i)-(E)`
- `sec-26-B-I-D-5-e-(ii)`
- `sec-26-B-I-D-5-e-(ii)-(A)`
- `sec-26-B-I-D-5-e-(ii)-(B)`
- `sec-26-B-I-D-5-e-(ii)-(C)`
- `sec-26-B-I-D-5-e-(iii)`
- `sec-26-B-I-D-5-e-(iv)`
- `sec-26-B-I-D-5-e-(iv)-(A)`
- `sec-26-B-I-D-5-e-(iv)-(B)`
- `sec-26-B-I-D-5-e-(iv)-(C)`
- `sec-26-B-I-D-5-e-(iv)-(D)`
- `sec-26-B-I-D-5-f-(i)`
- `sec-26-B-I-D-5-f-(ii)`
- `sec-26-B-I-D-5-f-(iii)`
- `sec-26-B-I-D-5-f-(iv)`
- `sec-26-B-I-D-5-f-(v)`
- `sec-26-B-I-D-5-f-(vi)`
- `sec-26-B-I-D-5-f-(vi)-(A)`
- `sec-26-B-I-D-5-f-(vi)-(B)`
- `sec-26-B-I-D-5-f-(vi)-(C)`
- `sec-26-B-I-D-5-f-(vi)-(D)`
- `sec-26-B-I-D-5-g-(i)`
- `sec-26-B-I-D-5-g-(iii)`
- `sec-26-B-I-D-5-g-(iv)`
- `sec-26-B-I-D-6-a-(i)`
- `sec-26-B-I-D-6-a-(ii)`
- `sec-26-B-I-D-6-a-(iii)`
- `sec-26-B-I-D-6-a-(iv)`
- `sec-26-B-I-D-6-a-(v)`
- `sec-26-B-I-D-6-a-(vi)`
- `sec-26-B-I-D-6-a-(vi)-(A)`
- `sec-26-B-I-D-6-a-(vi)-(B)`
- `sec-26-B-I-D-6-a-(vi)-(C)`
- `sec-26-B-I-D-6-a-(vi)-(D)`
- `sec-26-B-I-D-6-a-(vi)-(E)`
- `sec-26-B-I-D-6-b-(i)`
- `sec-26-B-I-D-6-b-(ii)`
- `sec-26-B-I-D-6-b-(iii)`
- `sec-26-B-I-D-6-b-(iv)`
- `sec-26-B-I-D-6-b-(v)`
- `sec-26-B-I-D-6-b-(v)-(A)`
- `sec-26-B-I-D-6-b-(v)-(B)`
- `sec-26-B-I-D-6-b-(v)-(C)`
- `sec-26-B-I-D-6-b-(v)-(D)`
- `sec-26-B-I-D-6-b-(v)-(E)`
- `sec-26-B-I-D-6-b-(vi)`
- `sec-26-B-I-D-6-b-(vi)-(A)`
- `sec-26-B-I-D-6-b-(vi)-(A)-(1)`
- `sec-26-B-I-D-6-b-(vi)-(A)-(2)`
- `sec-26-B-I-D-6-b-(vi)-(B)`
- `sec-26-B-I-D-6-b-(vi)-(B)-(1)`
- `sec-26-B-I-D-6-b-(vi)-(B)-(2)`
- `sec-26-B-I-D-6-b-(vii)`
- `sec-26-B-I-D-6-b-(vii)-(A)`
- `sec-26-B-I-D-6-b-(vii)-(B)`
- `sec-26-B-I-D-6-b-(viii)`
- `sec-26-B-I-D-6-c-(i)`
- `sec-26-B-I-D-6-c-(i)-(A)`
- `sec-26-B-I-D-6-c-(i)-(B)`
- `sec-26-B-I-D-6-c-(i)-(C)`
- `sec-26-B-I-D-6-c-(i)-(C)-(1)`
- `sec-26-B-I-D-6-c-(i)-(C)-(2)`
- `sec-26-B-I-D-6-c-(i)-(D)`
- `sec-26-B-I-D-6-c-(ii)`
- `sec-26-B-I-D-6-c-(iii)`
- `sec-26-B-I-D-6-c-(iv)`
- `sec-26-B-I-D-6-d-(i)`
- `sec-26-B-I-D-6-d-(i)-(A)`
- `sec-26-B-I-D-6-d-(i)-(B)`
- `sec-26-B-I-D-6-d-(i)-(C)`
- `sec-26-B-I-D-6-d-(i)-(D)`
- `sec-26-B-I-D-6-d-(i)-(E)`
- `sec-26-B-I-D-6-d-(ii)`
- `sec-26-B-I-D-6-d-(ii)-(A)`
- `sec-26-B-I-D-6-d-(ii)-(B)`
- `sec-26-B-I-D-6-d-(ii)-(C)`
- `sec-26-B-I-D-6-d-(iii)`
- `sec-26-B-I-D-6-d-(iii)-(A)`
- `sec-26-B-I-D-6-d-(iii)-(B)`
- `sec-26-B-I-D-6-d-(iii)-(C)`
- `sec-26-B-I-D-6-d-(iii)-(D)`
- `sec-26-B-I-D-6-e-(i)`
- `sec-26-B-I-D-6-e-(ii)`
- `sec-26-B-I-D-6-e-(iii)`
- `sec-26-B-I-D-6-e-(iv)`
- `sec-26-B-I-D-6-e-(v)`
- `sec-26-B-I-D-6-e-(vi)`
- `sec-26-B-I-D-6-e-(vi)-(A)`
- `sec-26-B-I-D-6-e-(vi)-(B)`
- `sec-26-B-I-D-6-e-(vi)-(C)`
- `sec-26-B-I-D-6-e-(vi)-(D)`
- `sec-26-B-I-D-6-f-(i)`
- `sec-26-B-I-D-6-f-(i)-(A)`
- `sec-26-B-I-D-6-f-(i)-(C)`
- `sec-26-B-I-D-6-f-(i)-(D)`
- `sec-26-B-II-A-1-a`
- `sec-26-B-II-A-1-b`
- `sec-26-B-II-A-2-a-(i)`
- `sec-26-B-II-A-2-a-(ii)`
- `sec-26-B-II-A-4-a-(i)`
- `sec-26-B-II-A-4-a-(ii)`
- `sec-26-B-II-A-4-a-(iii)`
- `sec-26-B-II-A-4-a-(iv)`
- `sec-26-B-II-A-4-a-(v)`
- `sec-26-B-II-A-4-a-(vi)`
- `sec-26-B-II-A-4-a-(vii)`
- `sec-26-B-II-A-4-b-(i)`
- `sec-26-B-II-A-4-b-(i)-(A)`
- `sec-26-B-II-A-4-b-(i)-(B)`
- `sec-26-B-II-A-4-b-(i)-(C)`
- `sec-26-B-II-A-4-b-(i)-(D)`
- `sec-26-B-II-A-4-b-(ii)`
- `sec-26-B-II-A-4-b-(iii)`
- `sec-26-B-II-A-4-b-(iv)`
- `sec-26-B-II-A-4-c-(i)`
- `sec-26-B-II-A-4-d-(i)`
- `sec-26-B-II-A-4-d-(ii)`
- `sec-26-B-II-A-4-d-(ii)-(A)`
- `sec-26-B-II-A-4-d-(ii)-(B)`
- `sec-26-B-II-A-4-d-(iii)`
- `sec-26-B-II-A-4-e-(i)`
- `sec-26-B-II-A-4-e-(ii)`
- `sec-26-B-II-A-4-e-(iii)`
- `sec-26-B-II-A-4-f-(i)`
- `sec-26-B-II-A-4-g-(i)`
- `sec-26-B-II-A-4-g-(ii)`
- `sec-26-B-II-A-4-g-(iii)`
- `sec-26-B-II-A-4-g-(iv)`
- `sec-26-B-II-A-4-g-(v)`
- `sec-26-B-II-A-5-a-(i)`
- `sec-26-B-II-A-5-a-(ii)`
- `sec-26-B-II-A-5-a-(iii)`
- `sec-26-B-II-A-5-a-(iv)`
- `sec-26-B-II-A-5-a-(v)`
- `sec-26-B-II-A-5-a-(vi)`
- `sec-26-B-II-A-5-b-(i)`
- `sec-26-B-II-A-5-b-(i)-(A)`
- `sec-26-B-II-A-5-b-(i)-(A)-(1)`
- `sec-26-B-II-A-5-b-(i)-(A)-(2)`
- `sec-26-B-II-A-5-b-(i)-(A)-(3)`
- `sec-26-B-II-A-5-b-(i)-(A)-(4)`
- `sec-26-B-II-A-5-b-(i)-(B)`
- `sec-26-B-II-A-5-b-(i)-(B)-(1)`
- `sec-26-B-II-A-5-b-(i)-(B)-(2)`
- `sec-26-B-II-A-5-b-(ii)`
- `sec-26-B-II-A-5-b-(ii)-(A)`
- `sec-26-B-II-A-5-b-(ii)-(B)`
- `sec-26-B-II-A-5-b-(ii)-(B)-(1)`
- `sec-26-B-II-A-5-b-(ii)-(B)-(2)`
- `sec-26-B-II-A-5-b-(ii)-(B)-(3)`
- `sec-26-B-II-A-5-b-(ii)-(B)-(4)`
- `sec-26-B-II-A-5-b-(ii)-(B)-(5)`
- `sec-26-B-II-A-5-b-(ii)-(B)-(6)`
- `sec-26-B-II-A-5-b-(ii)-(B)-(7)`
- `sec-26-B-II-A-5-b-(ii)-(C)`
- `sec-26-B-II-A-5-b-(ii)-(D)`
- `sec-26-B-II-A-5-b-(ii)-(D)-(1)`
- `sec-26-B-II-A-5-b-(ii)-(D)-(2)`
- `sec-26-B-II-A-5-b-(ii)-(D)-(3)`
- `sec-26-B-II-A-5-b-(ii)-(D)-(4)`
- `sec-26-B-II-A-5-b-(ii)-(E)`
- `sec-26-B-II-A-5-b-(ii)-(F)`
- `sec-26-B-II-A-5-b-(iii)`
- `sec-26-B-II-A-5-b-(iv)`
- `sec-26-B-II-A-6-a-(i)`
- `sec-26-B-II-A-6-a-(ii)`
- `sec-26-B-II-A-6-a-(iii)`
- `sec-26-B-II-A-6-a-(iv)`
- `sec-26-B-II-A-6-a-(v)`
- `sec-26-B-II-A-6-a-(vi)`
- `sec-26-B-II-A-6-b-(i)`
- `sec-26-B-II-A-6-b-(i)-(A)`
- `sec-26-B-II-A-6-b-(i)-(B)`
- `sec-26-B-II-A-6-b-(i)-(C)`
- `sec-26-B-II-A-6-b-(i)-(D)`
- `sec-26-B-II-A-6-b-(ii)`
- `sec-26-B-II-A-6-b-(iii)`
- `sec-26-B-II-A-6-b-(iii)-(A)`
- `sec-26-B-II-A-6-b-(iii)-(B)`
- `sec-26-B-II-A-6-b-(iii)-(C)`
- `sec-26-B-II-A-6-b-(iv)`
- `sec-26-B-II-A-6-b-(iv)-(A)`
- `sec-26-B-II-A-6-b-(iv)-(B)`
- `sec-26-B-II-A-6-b-(iv)-(C)`
- `sec-26-B-II-A-6-b-(v)`
- `sec-26-B-II-A-6-b-(vi)`
- `sec-26-B-II-A-6-b-(vii)`
- `sec-26-B-II-A-6-b-(viii)`
- `sec-26-B-II-A-6-b-(viii)-(A)`
- `sec-26-B-II-A-6-b-(viii)-(B)`
- `sec-26-B-II-A-6-b-(viii)-(C)`
- `sec-26-B-II-A-6-b-(viii)-(D)`
- `sec-26-B-II-A-6-b-(viii)-(E)`
- `sec-26-B-II-A-6-b-(viii)-(F)`
- `sec-26-B-II-A-6-b-(viii)-(G)`
- `sec-26-B-II-A-6-b-(viii)-(H)`
- `sec-26-B-II-A-6-c-(i)`
- `sec-26-B-II-A-6-c-(ii)`
- `sec-26-B-II-A-7-f-(i)`
- `sec-26-B-II-A-7-f-(i)-(A)`
- `sec-26-B-II-A-7-f-(i)-(B)`
- `sec-26-B-II-A-7-f-(i)-(C)`
- `sec-26-B-II-A-7-f-(i)-(D)`
- `sec-26-B-II-A-7-f-(i)-(E)`
- `sec-26-B-II-A-7-f-(i)-(F)`
- `sec-26-B-II-A-7-f-(ii)`
- `sec-26-B-II-A-7-f-(iii)`
- `sec-26-B-II-A-8-a-(i)`
- `sec-26-B-II-A-8-b-(i)`
- `sec-26-B-III-C-1-a-(i)`
- `sec-26-B-III-C-1-a-(ii)`
- `sec-26-B-III-C-1-a-(iii)`
- `sec-26-B-III-C-1-b-(i)`
- `sec-26-B-III-C-1-b-(ii)`
- `sec-26-B-III-C-1-d-(i)`
- `sec-26-B-III-C-1-d-(ii)`
- `sec-26-B-III-C-1-e-(i)`
- `sec-26-B-III-C-1-e-(ii)`
- `sec-26-B-III-C-1-e-(iii)`
- `sec-26-B-III-C-4-a-(i)`
- `sec-26-B-III-C-4-a-(ii)`
- `sec-26-B-III-C-4-d-(i)`
- `sec-26-B-III-C-4-d-(ii)`
- `sec-26-B-IV-A-5-b-(i)`
- `sec-26-B-IV-A-5-b-(ii)`
- `sec-26-B-IV-A-5-b-(iii)`
- `sec-26-B-IV-A-5-b-(iii)-(A)`
- `sec-26-B-IV-A-5-b-(iii)-(B)`
- `sec-26-B-IV-A-5-c-(i)`
- `sec-26-B-IV-A-5-c-(ii)`
- `sec-26-B-IV-A-5-c-(iv)`
- `sec-26-B-IV-A-5-d-(i)`
- `sec-26-B-IV-A-5-d-(ii)`
- `sec-26-B-IV-A-5-d-(iii)`
- `sec-26-B-IX-A-5`
- `sec-26-B-V-A-4-a-(i)`
- `sec-26-B-V-A-4-a-(ii)`
- `sec-26-B-V-A-7-g-(i)`
- `sec-26-B-V-A-7-g-(ii)`
- `sec-26-B-V-A-7-g-(iii)`
- `sec-26-B-V-A-8`
- `sec-26-B-V-A-8-a`
- `sec-26-B-V-A-8-b`
- `sec-26-C-I-26`
- `sec-26-C-II-7`
- `sec-26-C-III-7`
- `sec-26-P-A`
- `sec-26-P-B`
- `sec-26-P-C`

## Duplicate ids in the parsed output (two markers, one id — merged)

Every id below was produced by more than one marker during parsing. This script keeps the first occurrence's citation/parent/title and appends the later occurrence's text as trailing paragraphs so no content is silently dropped. As of this run, the only expected entry is `sec-7-B-VI-D-3-a-(iii)` — the source PDF really does print that exact label twice in a row for two different paragraphs (see "Source-text corrections and anomalies" below). The two other duplicates seen in earlier runs (`sec-7-B-II-J-1-c`, `sec-7-B-III-C-5-b-(iv)-(A)-(2)`, both citation-shaped continuation-line false positives) and the label-typo collision (`sec-7-B-VII-A-20`) are fixed — see the same section and the marker audit below. Anything else appearing here is new and should be reviewed by hand.

- `sec-26-B-IV-A-5-c-(ii)`

## Source-text corrections and anomalies

Confirmed by reading the actual printed PDF (not a pdftotext artifact). Fixes are applied to the raw lines before marker scanning, matched by (old label + enough of the following words to be unique in the document) so they can't misfire.

## Marker column / continuation-line audit

Every Part A/B label candidate flagged by the continuation-line guard (its column deviates by more than 2 characters from the learned column for its depth, and/or its previous non-blank line lacks terminal punctuation), whether ultimately accepted as a real label or rejected as a continuation. See IMPORTER_SPEC.md and `_marker_column_signals` for the rule.

- Flagged candidates: **205** (column-deviating: **201**, prev-line-lacks-terminal-punctuation: **28**)
- Rejected as continuations: **38**
- Kept as real labels despite the flag: **167**

| line | citation | part | indent | learned col | col dev | lacks term. | page seam | accepted |
|---|---|---|---|---|---|---|---|---|
| 179 | `I.B.36.` | B | 14 | 7 | True | False | False | False |
| 220 | `I.D.2.a.` | B | 10 | 14 | True | False | True | True |
| 229 | `I.D.2.b.` | B | 10 | 14 | True | False | False | True |
| 236 | `I.D.2.c.` | B | 10 | 14 | True | False | False | True |
| 240 | `I.D.3.` | B | 4 | 7 | True | False | False | True |
| 278 | `I.D.4.a.` | B | 13 | 10 | True | False | False | True |
| 291 | `I.D.4.a.` | B | 33 | 10 | True | False | False | False |
| 297 | `I.D.4.a.(i).(B).` | B | 22 | 26 | True | False | True | True |
| 305 | `I.D.4.a.(i).(C).` | B | 22 | 26 | True | False | False | True |
| 310 | `I.D.4.a.(ii).` | B | 15 | 19 | True | False | False | True |
| 318 | `I.D.4.a.` | B | 22 | 10 | True | True | False | False |
| 328 | `I.D.4.b.(i).` | B | 15 | 19 | True | False | False | True |
| 498 | `I.D.4.c.(iii).` | B | 23 | 15 | True | False | False | True |
| 502 | `I.D.4.c.(iv).` | B | 23 | 15 | True | False | False | True |
| 507 | `I.D.4.c.(iv).(A).` | B | 29 | 22 | True | False | False | True |
| 521 | `I.D.5.` | B | 4 | 7 | True | False | False | True |
| 615 | `I.D.5.b.(iii).` | B | 26 | 15 | True | False | False | True |
| 620 | `I.D.5.b.(iii).(A).` | B | 19 | 24 | True | False | True | True |
| 639 | `I.D.5.b.(iii).(B).` | B | 19 | 24 | True | False | False | True |
| 646 | `I.D.5.b.(iii).(C).` | B | 19 | 24 | True | False | False | True |
| 655 | `I.D.5.b.(iii).(D).` | B | 21 | 24 | True | False | True | True |
| 659 | `I.D.5.b.(v).(B).` | B | 28 | 24 | True | True | False | False |
| 664 | `I.D.5.b.(iii).(E).` | B | 21 | 24 | True | False | False | True |
| 666 | `I.D.5.c.` | B | 28 | 10 | True | True | False | False |
| 673 | `I.D.5.b.(iv).(A).` | B | 21 | 24 | True | False | False | True |
| 680 | `I.D.5.b.(iv).(B).` | B | 21 | 24 | True | False | False | True |
| 687 | `I.D.5.b.(iii).(D).` | B | 28 | 24 | True | True | False | False |
| 692 | `I.D.5.b.(v).(A).` | B | 21 | 24 | True | False | False | True |
| 696 | `I.D.5.b.(v).(B).` | B | 33 | 24 | True | False | True | True |
| 732 | `I.D.5.b.(vi).` | B | 24 | 15 | True | False | False | True |
| 740 | `I.D.5.b.(vi).(B).` | B | 22 | 24 | False | True | False | False |
| 770 | `I.D.5.c.` | B | 27 | 10 | True | True | False | False |
| 840 | `I.D.5.c.(ii).(C).` | B | 19 | 22 | True | False | False | True |
| 844 | `I.D.5.c.(ii).(D).` | B | 19 | 22 | True | False | True | True |
| 848 | `I.D.5.c.(ii).(E).` | B | 19 | 22 | True | False | False | True |
| 854 | `I.D.5.c.(ii).(F).` | B | 19 | 22 | True | False | False | True |
| 859 | `I.D.5.c.(ii).(G).` | B | 19 | 22 | True | False | False | True |
| 861 | `I.D.5.c.(ii).(C).` | B | 33 | 22 | True | False | False | False |
| 867 | `I.D.5.c.(ii).(D).` | B | 33 | 22 | True | True | False | False |
| 876 | `I.D.5.c.(ii).(D).` | B | 33 | 22 | True | True | False | False |
| 882 | `I.D.5.c.(ii).(H).` | B | 19 | 22 | True | False | False | True |
| 908 | `I.D.5.c.(ii).(B).(3).` | B | 21 | 26 | True | True | False | False |
| 955 | `I.D.5.` | B | 21 | 7 | True | True | False | False |
| 1011 | `I.D.5.d.` | B | 15 | 10 | True | False | False | True |
| 1124 | `I.D.5.e.(iv).(C).` | B | 20 | 20 | False | True | False | True |
| 1156 | `I.D.5.e.(ii).` | B | 23 | 14 | True | False | False | False |
| 1214 | `I.D.6.` | B | 4 | 7 | True | False | False | True |
| 1283 | `I.D.6.b.(i).` | B | 17 | 14 | True | False | False | True |
| 1288 | `I.D.6.b.(ii).` | B | 17 | 14 | True | False | False | True |
| 1311 | `I.D.6.b.(iii).` | B | 17 | 14 | True | False | False | True |
| 1318 | `I.D.6.b.(iii).` | B | 21 | 14 | True | True | False | False |
| 1361 | `I.D.6.b.` | B | 28 | 10 | True | True | False | False |
| 1365 | `I.D.6.b.(vi).(A).(1).` | B | 29 | 26 | True | False | False | True |
| 1370 | `I.D.6.b.(vi).(A).(2).` | B | 29 | 26 | True | False | False | True |
| 1383 | `I.D.6.b.(vi).(B).(1).` | B | 29 | 26 | True | False | False | True |
| 1389 | `I.D.6.b.(vi).(B).(2).` | B | 29 | 26 | True | False | False | True |
| 1395 | `I.D.6.b.(ii).` | B | 21 | 14 | True | False | False | False |
| 1408 | `I.D.6.b.(vi).(A).` | B | 26 | 20 | True | False | False | False |
| 1460 | `I.D.6.b.(viii).` | B | 20 | 14 | True | False | False | True |
| 1556 | `I.D.6.d.(i).` | B | 27 | 14 | True | True | False | False |
| 1635 | `I.D.6.e.(vi).(A).` | B | 23 | 20 | True | False | False | True |
| 1637 | `I.D.6.e.(vi).(B).` | B | 23 | 20 | True | False | False | True |
| 1639 | `I.D.6.e.(vi).(C).` | B | 23 | 20 | True | False | False | True |
| 1652 | `I.D.6.e.(vi).(D).` | B | 23 | 20 | True | False | False | True |
| 1665 | `I.D.6.f.(i).(A).` | B | 23 | 20 | True | False | False | True |
| 1669 | `II.D.6.f.(i).(B).` | B | 33 | 20 | True | False | True | False |
| 1675 | `I.D.6.f.(i).(C).` | B | 33 | 20 | True | False | False | True |
| 1679 | `I.D.6.f.(i).(D).` | B | 33 | 20 | True | False | False | True |
| 1688 | `II.A.1.a.` | B | 15 | 9 | True | False | False | True |
| 1694 | `II.A.1.b.` | B | 15 | 9 | True | False | False | True |
| 1701 | `II.A.1.c.` | B | 15 | 9 | True | False | False | True |
| 1707 | `II.A.1.d.` | B | 14 | 9 | True | False | True | True |
| 1714 | `II.A.1.e.` | B | 14 | 9 | True | False | False | True |
| 1720 | `II.A.1.f.` | B | 14 | 9 | True | False | False | True |
| 1727 | `II.A.2.` | B | 4 | 7 | True | False | False | True |
| 1731 | `II.A.7.e.` | B | 14 | 9 | True | True | False | False |
| 1747 | `II.A.2.a.` | B | 14 | 9 | True | False | False | True |
| 1749 | `II.A.2.a.(i).` | B | 18 | 14 | True | False | True | True |
| 1752 | `II.A.2.a.(ii).` | B | 18 | 14 | True | False | False | True |
| 1773 | `II.A.3.` | B | 4 | 7 | True | False | False | True |
| 1876 | `II.A.4.` | B | 4 | 7 | True | False | False | True |
| 1895 | `II.A.1.c.` | B | 9 | 9 | False | True | False | False |
| 1961 | `II.A.4.a.(i).` | B | 24 | 14 | True | False | False | False |
| 2015 | `II.A.4.b.(i).(A).` | B | 29 | 20 | True | False | False | True |
| 2017 | `II.A.4.b.(i).(B).` | B | 29 | 20 | True | False | False | True |
| 2019 | `II.A.4.b.(i).(C).` | B | 23 | 20 | True | False | True | True |
| 2027 | `II.A.4.b.(i).(D).` | B | 23 | 20 | True | False | False | True |
| 2073 | `II.A.4.d.(ii).(A).` | B | 23 | 20 | True | False | False | True |
| 2084 | `II.A.4.d.(ii).(B).` | B | 23 | 20 | True | False | False | True |
| 2099 | `II.A.1.d.` | B | 24 | 9 | True | False | False | False |
| 2100 | `II.A.4.e.(i).` | B | 24 | 16 | True | True | False | False |
| 2173 | `II.A.4.g.(v).` | B | 0 | 16 | True | False | True | True |
| 2194 | `II.A.5.a.` | B | 13 | 9 | True | False | False | True |
| 2196 | `II.A.5.a.(i).` | B | 20 | 16 | True | False | False | True |
| 2205 | `II.A.5.a.(ii).` | B | 20 | 16 | True | False | False | True |
| 2211 | `II.A.5.` | B | 28 | 7 | True | True | False | False |
| 2253 | `II.A.4.g.` | B | 27 | 9 | True | True | False | False |
| 2311 | `II.A.4.` | B | 32 | 7 | True | True | False | False |
| 2324 | `II.A.5.b.(i).(A).(4).` | B | 30 | 26 | True | False | False | True |
| 2338 | `II.A.5.b.(i).(B).(1).` | B | 30 | 26 | True | False | False | True |
| 2344 | `II.A.5.b.(i).(B).(2).` | B | 30 | 26 | True | False | False | True |
| 2383 | `II.A.5.b.(ii).(E).` | B | 34 | 20 | True | True | False | False |
| 2410 | `II.A.1.e.` | B | 32 | 9 | True | True | False | False |
| 2424 | `II.A.5.b.(ii).(B).(1).` | B | 32 | 26 | True | True | False | False |
| 2439 | `II.A.5.b.(ii).(E).` | B | 27 | 20 | True | True | False | False |
| 2539 | `II.A.6.` | B | 4 | 7 | True | False | False | True |
| 2568 | `II.A.6.a.(i).` | B | 24 | 15 | True | True | False | False |
| 2791 | `II.A.6.b.(viii).(G).` | B | 24 | 20 | True | False | True | True |
| 2797 | `II.A.6.b.(viii).(H).` | B | 24 | 20 | True | False | False | True |
| 2805 | `II.A.6.b.(i).` | B | 18 | 14 | True | False | False | False |
| 2807 | `II.A.6.c.(i).` | B | 17 | 14 | True | False | False | True |
| 2811 | `II.A.6.c.(ii).` | B | 17 | 14 | True | False | False | True |
| 2821 | `II.A.7.` | B | 4 | 7 | True | False | False | True |
| 2875 | `II.A.7.f.(iii).` | B | 17 | 14 | True | False | True | True |
| 2891 | `II.A.8.` | B | 4 | 7 | True | False | False | True |
| 2893 | `II.A.4.` | B | 18 | 7 | True | False | False | False |
| 2897 | `II.A.8.a.(i).` | B | 17 | 14 | True | False | False | True |
| 2909 | `II.A.8.b.(i).` | B | 17 | 14 | True | False | False | True |
| 2914 | `II.A.8.c.` | B | 13 | 9 | True | False | True | True |
| 2921 | `II.A.8.d.` | B | 13 | 9 | True | False | False | True |
| 2924 | `II.A.4.a.(i).` | B | 21 | 14 | True | True | False | False |
| 2943 | `III.A.1.a.` | B | 13 | 9 | True | False | False | True |
| 2946 | `III.A.1.b.` | B | 13 | 9 | True | False | False | True |
| 2949 | `III.A.1.c.` | B | 13 | 9 | True | False | False | True |
| 2951 | `III.A.1.d.` | B | 13 | 9 | True | False | False | True |
| 2954 | `III.A.1.e.` | B | 13 | 9 | True | False | False | True |
| 2956 | `III.A.1.f.` | B | 13 | 9 | True | False | False | True |
| 2957 | `III.A.1.g.` | B | 13 | 9 | True | False | False | True |
| 2958 | `III.A.1.h.` | B | 13 | 9 | True | False | True | True |
| 2960 | `III.A.1.i.` | B | 13 | 9 | True | False | False | True |
| 2962 | `III.A.1.j.` | B | 13 | 9 | True | False | False | True |
| 2964 | `III.A.1.k.` | B | 13 | 9 | True | False | False | True |
| 2965 | `III.A.1.l.` | B | 13 | 9 | True | False | False | True |
| 2987 | `III.B.1.a.` | B | 13 | 9 | True | False | False | True |
| 2990 | `III.B.1.b.` | B | 13 | 9 | True | False | False | True |
| 2996 | `III.B.2.a.` | B | 13 | 9 | True | False | False | True |
| 3010 | `III.C.1.a.` | B | 13 | 9 | True | False | False | True |
| 3013 | `III.C.1.a.(i).` | B | 20 | 14 | True | False | False | True |
| 3016 | `III.C.1.a.(ii).` | B | 20 | 14 | True | False | False | True |
| 3020 | `III.C.1.a.(iii).` | B | 20 | 14 | True | False | False | True |
| 3025 | `III.C.1.b.` | B | 13 | 9 | True | False | False | True |
| 3027 | `III.C.1.b.(i).` | B | 20 | 14 | True | False | False | True |
| 3029 | `III.C.1.b.(ii).` | B | 20 | 14 | True | False | False | True |
| 3033 | `III.C.1.c.` | B | 13 | 9 | True | False | False | True |
| 3036 | `III.C.1.d.` | B | 13 | 9 | True | False | False | True |
| 3038 | `III.C.1.d.(i).` | B | 20 | 14 | True | False | False | True |
| 3041 | `III.C.1.d.(ii).` | B | 20 | 14 | True | False | False | True |
| 3048 | `III.C.1.e.(i).` | B | 17 | 14 | True | False | False | True |
| 3050 | `III.C.1.e.(ii).` | B | 17 | 14 | True | False | False | True |
| 3054 | `III.C.1.e.(iii).` | B | 17 | 14 | True | False | False | True |
| 3057 | `III.C.2.` | B | 4 | 7 | True | False | False | True |
| 3062 | `III.C.3.` | B | 4 | 7 | True | False | False | True |
| 3067 | `III.C.4.` | B | 4 | 7 | True | False | False | True |
| 3075 | `III.C.4.a.(i).` | B | 17 | 14 | True | False | False | True |
| 3077 | `III.C.4.a.(ii).` | B | 17 | 14 | True | False | False | True |
| 3087 | `III.C.4.d.(i).` | B | 17 | 14 | True | False | False | True |
| 3091 | `III.C.4.d.(ii).` | B | 21 | 14 | True | False | True | True |
| 3106 | `IV.A.7.` | B | 13 | 7 | True | True | False | False |
| 3118 | `IV.A.2.a.` | B | 13 | 9 | True | False | False | True |
| 3122 | `IV.A.2.b.` | B | 13 | 9 | True | False | False | True |
| 3125 | `IV.A.2.c.` | B | 13 | 9 | True | False | False | True |
| 3128 | `IV.A.2.d.` | B | 13 | 9 | True | False | False | True |
| 3149 | `IV.A.4.` | B | 4 | 7 | True | False | False | True |
| 3154 | `IV.A.5.` | B | 4 | 7 | True | False | False | True |
| 3170 | `IV.A.5.b.(i).` | B | 17 | 14 | True | False | False | True |
| 3173 | `IV.A.5.b.(ii).` | B | 17 | 14 | True | False | False | True |
| 3179 | `IV.A.5.b.(iii).(A).` | B | 23 | 20 | True | False | False | True |
| 3182 | `IV.A.5.b.(iii).(B).` | B | 23 | 20 | True | False | False | True |
| 3199 | `IV.A.5.c.(iv).` | B | 15 | 14 | False | True | False | True |
| 3214 | `IV.A.5.d.(iii).` | B | 21 | 15 | True | False | True | True |
| 3220 | `IV.A.6.` | B | 7 | 4 | True | False | False | True |
| 3230 | `IV.A.7.a.` | B | 14 | 9 | True | False | False | True |
| 3232 | `IV.A.7.b.` | B | 14 | 9 | True | False | False | True |
| 3236 | `IV.A.7.c.` | B | 14 | 9 | True | False | False | True |
| 3246 | `V.A.1.a.` | B | 14 | 9 | True | False | False | True |
| 3257 | `V.A.2.` | B | 4 | 7 | True | False | False | True |
| 3262 | `V.A.3.` | B | 4 | 7 | True | False | False | True |
| 3306 | `V.A.4.` | B | 4 | 7 | True | False | False | True |
| 3309 | `V.A.1.a.` | B | 17 | 9 | True | False | False | False |
| 3380 | `V.A.8.` | B | 12 | 4 | True | False | False | True |
| 3382 | `V.A.8.a.` | B | 18 | 10 | True | False | False | True |
| 3388 | `V.A.8.b.` | B | 18 | 10 | True | False | False | True |
| 3465 | `VI.A.5.` | B | 7 | 4 | True | False | True | True |
| 3470 | `VI.A.5.a.` | B | 14 | 10 | True | False | False | True |
| 3474 | `VI.A.5.b.` | B | 14 | 10 | True | False | False | True |
| 3476 | `VI.A.5.c.` | B | 14 | 10 | True | False | False | True |
| 3479 | `VI.A.5.d.` | B | 14 | 10 | True | False | False | True |
| 3482 | `VI.A.5.e.` | B | 14 | 10 | True | False | False | True |
| 3485 | `VI.A.5.f.` | B | 14 | 10 | True | False | False | True |
| 3490 | `VI.A.5.g.` | B | 14 | 10 | True | False | False | True |
| 3492 | `VI.A.5.h.` | B | 14 | 10 | True | False | False | True |
| 3498 | `VI.A.5.i.` | B | 14 | 10 | True | False | False | True |
| 3553 | `VIII.A.3.c.` | B | 13 | 10 | True | False | True | True |
| 3562 | `VIII.A.4.a.` | B | 13 | 10 | True | False | False | True |
| 3565 | `VIII.A.4.b.` | B | 13 | 10 | True | False | False | True |
| 3583 | `IX.A.2.a.` | B | 13 | 10 | True | False | False | True |
| 3586 | `IX.A.2.b.` | B | 13 | 10 | True | False | False | True |
| 3591 | `IX.A.3.a.` | B | 13 | 10 | True | False | False | True |
| 3596 | `IX.A.3.b.` | B | 13 | 10 | True | False | False | True |
| 3599 | `IX.A.3.c.` | B | 14 | 10 | True | False | True | True |
| 3603 | `IX.A.3.d.` | B | 14 | 10 | True | False | False | True |
| 3608 | `IX.A.4.` | B | 8 | 4 | True | False | False | True |
| 3611 | `IX.A.4.a.` | B | 14 | 10 | True | False | False | True |
| 3615 | `IX.A.4.b.` | B | 14 | 10 | True | False | False | True |
| 3618 | `IX.A.5.` | B | 14 | 4 | True | False | False | True |

## parent_id mismatches

- `sec-26-A-I`: db parent=`sec-26-A-PART-A` parsed parent=`sec-26-P-A`
- `sec-26-B-I`: db parent=`sec-26-B-PART-B` parsed parent=`sec-26-P-B`
- `sec-26-B-I-A-1`: db parent=`sec-26-B-I` parsed parent=`sec-26-B-I-A`
- `sec-26-B-I-A-2`: db parent=`sec-26-B-I` parsed parent=`sec-26-B-I-A`
- `sec-26-B-I-A-3`: db parent=`sec-26-B-I` parsed parent=`sec-26-B-I-A`
- `sec-26-B-I-A-4`: db parent=`sec-26-B-I` parsed parent=`sec-26-B-I-A`
- `sec-26-B-II`: db parent=`sec-26-B-PART-B` parsed parent=`sec-26-P-B`
- `sec-26-B-III`: db parent=`sec-26-B-PART-B` parsed parent=`sec-26-P-B`
- `sec-26-B-IV`: db parent=`sec-26-B-PART-B` parsed parent=`sec-26-P-B`
- `sec-26-B-IX`: db parent=`sec-26-B-PART-B` parsed parent=`sec-26-P-B`
- `sec-26-B-V`: db parent=`sec-26-B-PART-B` parsed parent=`sec-26-P-B`
- `sec-26-B-VI`: db parent=`sec-26-B-PART-B` parsed parent=`sec-26-P-B`
- `sec-26-B-VII`: db parent=`sec-26-B-PART-B` parsed parent=`sec-26-P-B`
- `sec-26-B-VIII`: db parent=`sec-26-B-PART-B` parsed parent=`sec-26-P-B`
- `sec-26-C-FEDJJJJ`: db parent=`sec-26-C-PART-C` parsed parent=`sec-26-P-C`
- `sec-26-C-I`: db parent=`sec-26-C-PART-C` parsed parent=`sec-26-P-C`
- `sec-26-C-II`: db parent=`sec-26-C-PART-C` parsed parent=`sec-26-P-C`
- `sec-26-C-III`: db parent=`sec-26-C-PART-C` parsed parent=`sec-26-P-C`
- `sec-26-C-IV`: db parent=`sec-26-C-PART-C` parsed parent=`sec-26-P-C`

## DB rows with page-furniture leaks (first 30)

- `sec-26-C-I`
- `sec-26-C-II`
- `sec-26-C-III`
- `sec-26-C-IV`

## Truncation-confirmed rows (DB text is a suffix of parsed text) — first 30

- `sec-26-A-I`
- `sec-26-A-I-A`
- `sec-26-A-I-D`
- `sec-26-B-I-B`
- `sec-26-B-I-D-1`
- `sec-26-B-I-D-2`
- `sec-26-B-I-D-4`
- `sec-26-B-I-D-5-a`
- `sec-26-B-I-D-5-b`
- `sec-26-B-I-D-5-c`
- `sec-26-B-I-D-6`
- `sec-26-B-I-D-6-a`
- `sec-26-B-I-D-6-b`
- `sec-26-B-I-D-6-f`
- `sec-26-B-II-A`
- `sec-26-B-II-A-2-b`
- `sec-26-B-II-A-3`
- `sec-26-B-II-A-4-a`
- `sec-26-B-II-A-4-b`
- `sec-26-B-II-A-4-c`
- `sec-26-B-II-A-4-d`
- `sec-26-B-II-A-4-e`
- `sec-26-B-II-A-4-f`
- `sec-26-B-II-A-4-g`
- `sec-26-B-II-A-5`
- `sec-26-B-II-A-6`
- `sec-26-B-II-A-7-c`
- `sec-26-B-II-A-8`
- `sec-26-B-III-A-1-c`
- `sec-26-B-III-A-1-e`
- … and 36 more

## Different (not identical, not a clean truncation) — first 40

- `sec-26-A-APPENDIX-A`
- `sec-26-B-I-D-3-b`
- `sec-26-B-I-D-6-c`
- `sec-26-B-II-A-1`
- `sec-26-B-II-A-1-c`
- `sec-26-B-II-A-2`
- `sec-26-B-II-A-4`
- `sec-26-B-II-A-5-a`
- `sec-26-B-II-A-5-b`
- `sec-26-B-II-A-6-a`
- `sec-26-B-II-A-6-b`
- `sec-26-B-II-A-6-c`
- `sec-26-B-II-A-7-d`
- `sec-26-B-II-A-7-e`
- `sec-26-B-II-A-7-f`
- `sec-26-B-II-A-8-a`
- `sec-26-B-II-A-8-b`
- `sec-26-B-III-C-1-a`
- `sec-26-B-III-C-1-b`
- `sec-26-B-III-C-1-d`
- `sec-26-B-III-C-1-e`
- `sec-26-B-III-C-4-a`
- `sec-26-B-III-C-4-d`
- `sec-26-B-IV-A-5-b`
- `sec-26-B-IV-A-5-c`
- `sec-26-B-IV-A-5-d`
- `sec-26-B-IX-A-4-b`
- `sec-26-B-V-A-4-a`
- `sec-26-B-V-A-7-g`
- `sec-26-B-V-A-7-h`
- `sec-26-C-I`
- `sec-26-C-II`
- `sec-26-C-III`
- `sec-26-C-IV`
- `sec-26-top-REG-26`

## Likely amendment-driven renumbering (DB text found on a nearby sibling id)

The current source PDF has clearly been amended since the DB was last populated (dates change, e.g. Reg 7 II.A.2's EPA Method 21 citation goes from `(August 3, 2017)` in the source PDF to no date at all in some DB rows; definitions get inserted alphabetically, shifting every subsequent sequentially-numbered definition — e.g. DB's `sec-7-B-I-B-24` is `"New"` but the current PDF's `I.B.24` is `"Natural gas transmission and storage segment"`, a term inserted earlier in the list, pushing `"New"` down to `I.B.25`). The rows below are where the DB's stored text for id X is not what's at X in the new parse, but IS found (word salad aside) on a nearby sibling id — i.e. content that moved, not content that's wrong.

_none detected_

## Cross-reference linking

- `<span class="xref">` spans — parsed: **677**, DB: **673**
- `<a class="xref-external-reg">` anchors — parsed: **23**, DB: **0**

### Spans by target part

| target | parsed | DB |
|---|---|---|
| Part A (bare part reference) | 34 | 0 |
| Part B (bare part reference) | 54 | 0 |
| Part C (bare part reference) | 15 | 0 |
| other | 0 | 26 |
| top (Regulation root) | 40 | 38 |
| under Part A | 2 | 31 |
| under Part B | 532 | 410 |
| under Part C | 0 | 168 |

### Unresolved references, by bucket (top 15 each)

**Historical (former structure — this regulation was renumbered/reorganized; these no longer exist in the current Parts)** — 8 distinct, 55 mentions

| citation text | count |
|---|---|
| Part D | 26 |
| Part E | 20 |
| III. | 3 |
| Part F | 2 |
| I. | 1 |
| II. | 1 |
| IV. | 1 |
| X. | 1 |

**Other regulation not in corpus** — 4 distinct, 9 mentions

| citation text | count |
|---|---|
| Regulation Number 25 | 4 |
| Regulation Number 24 | 2 |
| Regulation 23 | 2 |
| Regulation Number 27 | 1 |

**CFR part/subpart not in corpus** — 12 distinct, 57 mentions

| citation text | count |
|---|---|
| 40 CFR Part 60 | 27 |
| 40 CFR Part 63 | 14 |
| 40 CFR Part 75 | 3 |
| 40 CFR Part 60, Subpart KKKK | 2 |
| 40 CFR Part 60, Subpart IIII | 2 |
| 40 CFR Part 60, Subpart JJJJ | 2 |
| 40 CFR Part 63, Subpart ZZZZ | 2 |
| 40 CFR Part 60, Subpart GG | 1 |
| 40 CFR Part 63, Subpart LLL | 1 |
| 40 CFR Part 60, Subpart WWW | 1 |
| 40 CFR Part 60, Subpart VV | 1 |
| 40 CFR Part 63, Subpart HHH | 1 |

**Unparseable / genuine parser gap** — 13 distinct, 19 mentions

| citation text | count |
|---|---|
| II.C. | 4 |
| II.B. | 3 |
| III.D. | 2 |
| II.D. | 1 |
| I.D.6.(vii) | 1 |
| I.D.6.d.(iv)(D) | 1 |
| II.A.4.b.(ii)(B)(2) | 1 |
| II.A.5.b(i)(A)(1) | 1 |
| II.A.6.c.(1). | 1 |
| II.C.1.a.(iii). | 1 |
| I.D.4.b. | 1 |
| II.A. | 1 |
| VIII.A. | 1 |

### Remaining unwrapped "Section..." text

- Total: **32**
- Excluding ones whose roman numeral doesn't exist in any current roman-numbered part at all (historical, expected to stay unlinked): **31**

### 10 random linked paragraphs from Part B

- `sec-26-B-II-A-5-b-(i)-(A)-(1)`: <p>The owner or operator of an affected unit that is subject to or becomes subject to the monitoring requirements of 40 CFR part 75 and 40 CFR part 75, Appendices A to I (July 19, 2018), must use those monitoring methods and specifications for monitoring NOx emissions for purposes of this <span class="xref" data-target="sec-26-B-II-A-5">Section II.A.5.</span> and for demonstrating compliance with 
- `sec-26-B-V-A-8-b`: <p>Beginning in 2025, the owner or operator must submit with the semi-annual report required by the facility’s operating permit documentation of compliance with the VOC emission limits in <span class="xref" data-target="sec-26-B-V-A-4-a">Section V.A.4.a.</span>, if applicable.</p>
- `sec-26-B-I-D-5-c-(ii)-(F)`: <p>The total allowable NOx emissions (in tons/year) calculated for all engines included in the Alternate Company-Wide Compliance Plan, as specified in <span class="xref" data-target="sec-26-B-I-D-5-c-(ii)-(B)-(8)">Section I.D.5.c.(ii)(B)(8).</span></p>
- `sec-26-B-II-A-4-g-(i)`: <p>Except as specified in <span class="xref" data-target="sec-26-B-II-A-4-g-(ii)">Section II.A.4.g.(ii)</span>, by May 1, 2022, natural gas-fired process heaters must comply with the following NOx emission limits in Table 2.</p><div class="doc-table-wrap"><div class="doc-table-caption">Table 2 – NOx limits for process heaters</div><table class="doc-table"><thead><tr><th>Heat input rate (MMBtu/hr)<
- `sec-26-B-I-D-6-b-(v)`: <p>The owner or operator of any engine that meets all of the criteria described in <span class="xref" data-target="sec-26-B-I-D-6-b-(v)-(A)">Sections I.D.6.b.(v)(A)</span> through (E) may submit a request to the Division for an alternative emission standard for a specific engine based on technical or economic infeasibility. To qualify for an alternative emission standard, an owner or operator must
- `sec-26-B-I-D-6-f-(i)-(D)`: <p>Beginning May 1, 2026, the date that all required annual portable analyzer testing was performed under <span class="xref" data-target="sec-26-B-I-D-6-d-(i)">Section I.D.6.d.(i)</span>, and the results of that testing (i.e., pass or fail).</p>
- `sec-26-B-I-D-4-a-(i)-(B)`: <p>Internal combustion engines that are subject to an emissions control requirement in a federal maximum achievable control technology (“MACT”) standard under 40 CFR Part 63 (July 1, 2022), a Best Available Control Technology (“BACT”) limit, or a New Source Performance Standard under 40 CFR Part 60 (July 1, 2022) are not subject to this <span class="xref" data-target="sec-26-B-I-D-4-a">Section I.D
- `sec-26-B-II-A-6-a-(v)`: <p>As of February 14, 2023, this <span class="xref" data-target="sec-26-B-II-A-6">Section II.A.6.</span> applies to boilers, duct burners, stationary combustion turbines, stationary reciprocating internal combustion engines, dryers, furnaces, ceramic kilns, and process heaters with uncontrolled actual emissions of NOx equal to or greater than five (5) tons per year that existed at major sources of
- `sec-26-B-II-A-2-f`: <p>Any stationary combustion equipment subject to a federally enforceable work practice or emission control requirement contained in this <span class="xref" data-target="sec-26-top-REG-26">Regulation Number 26</span>, <span class="xref" data-target="sec-26-P-B">Part B</span>, <span class="xref" data-target="sec-26-B-III-A">Sections III.A.</span> through <span class="xref" data-target="sec-26-B-III
- `sec-26-B-I-D-5-c-(ii)-(H)-(2)`: <p>The reductions from emissions achieved by the Alternative Company-Wide Compliance Plan are greater than or equal to the reductions from actual emissions achieved by Table 2 (i.e. that the figure calculated in <span class="xref" data-target="sec-26-B-I-D-5-c-(ii)-(G)-(3)">Section I.D.5.c.(ii)(G)(3)</span> is greater than or equal to the figure calculated in <span class="xref" data-target="sec-26

### 5 random linked paragraphs from Part C

- `sec-26-C-I-26`: <p>The upstream oil and gas intensity and midstream combustion program provisions currently in <a class="xref-external-reg" href="/regulations/22">Regulation Number 22</a> moved to <a class="xref-external-reg" href="/regulations/7">Regulation Number 7</a>. The manufacturing sector greenhouse gas provisions in <a class="xref-external-reg" href="/regulations/22">Regulation Number 22</a> became a new
- `sec-26-C-III-7`: <p>The Act broadly defines air pollutant to include essentially any gas emitted into the atmosphere (and, as such, includes VOC, NOx, methane and other hydrocarbons) and provides the Commission broad authority to regulate air pollutants. Section 105(1)(a)(I) directs the Commission to adopt a state implementation plan (SIP) to attain the NAAQS. § 25-7-106 provides the Commission maximum flexibility
- `sec-26-C-III`: <p>December 18-20, 2024 (Revisions to <span class="xref" data-target="sec-26-P-B">Part B</span>, <span class="xref" data-target="sec-26-B-I-D-4-c">Sections I.D.4.c.</span>, <span class="xref" data-target="sec-26-B-I-D-6-a">I.D.6.a.</span>, <span class="xref" data-target="sec-26-B-II-A-4-g">II.A.4.g.</span>, <span class="xref" data-target="sec-26-B-II-A-5-b">II.A.5.b.</span>, <span class="xref" dat
- `sec-26-C-II`: <p>December 15, 2023 (Revisions to <span class="xref" data-target="sec-26-P-A">Part A</span>, <span class="xref" data-target="sec-26-A-I-C">Section I.C.</span>; and <span class="xref" data-target="sec-26-P-B">Part B</span>, <span class="xref" data-target="sec-26-B-I-D-5">Sections I.D.5.</span>, <span class="xref" data-target="sec-26-B-I-D-6">I.D.6.</span>, <span class="xref" data-target="sec-26-B-
- `sec-26-C-I`: <p>April 20, 2023 This Statement of Basis, Specific Statutory Authority, and Purpose complies with the requirements of the State Administrative Procedure Act, § 24-4-101, C.R.S., et seq., the Colorado Air Pollution Prevention and Control Act, § 25-7-101, C.R.S., et seq., and the Air Quality Control Commission’s (Commission) Procedural Rules, 5 C.C.R. §1001-1. Basis</p><p>To improve the readability

### DB xref target vs parsed xref target, same provision & citation text

(32 such (provision, citation text) pairs found)

| provision | citation text | DB target | parsed target |
|---|---|---|---|
| `sec-26-C-IV` | Part A | `sec-26-A-PART-A` | `sec-26-P-A` |
| `sec-26-C-IV` | Part C | `sec-26-C-PART-C` | `sec-26-P-C` |
| `sec-26-C-II` | Part B | `sec-26-B-PART-B` | `sec-26-P-B` |
| `sec-26-C-II` | Section I.C. | `sec-26-C-I` | `sec-26-A-I-C` |
| `sec-26-C-IV` | Section I.A. | `sec-26-C-I` | `sec-26-A-I-A` |
| `sec-26-C-III` | Sections I.D.4.c. | `sec-26-C-I` | `sec-26-B-I-D-4-c` |
| `sec-26-B-II-A-2-f` | Part B | `sec-26-B-PART-B` | `sec-26-P-B` |
| `sec-26-C-IV` | Sections II. | `sec-26-C-II` | `sec-26-B-II` |
| `sec-26-B-I-D-6-d` | Section I.D.6.a.(vi) | `sec-26-B-I-D-6-a-vi` | `sec-26-B-I-D-6-a-(vi)` |
| `sec-26-C-I` | Part B | `sec-26-B-PART-B` | `sec-26-P-B` |

_(the hand-reviewed DB-vs-parsed xref-target writeup below is Reg 7-specific and only applies when diffing Reg 7 against a pre-existing DB export)_

## Lowercase-start rows in parsed output (first 30)

- `sec-26-B-I-D-5-b-(vi)-(A)`: 'if being placed under an alternative operating scenario pursuant to an existing '

## 15 random side-by-side samples

### `sec-26-B-IV-A-2-a`
- DB:     `<p> An emissions unit subject to a work practice or emission control requirement in another federally enforceable section of Regulation Number 7, Number 24, Number 25, and Number 26.</p>`
- Parsed: `<p>An emissions unit subject to a work practice or emission control requirement in another federally enforceable section of <a class="xref-external-reg" href="/regulations/7">Regulation Number 7</a>, `

### `sec-26-B-II-A-3-c`
- DB:     `<p> "Capacity factor" means the ratio of the amount of fuel burned by an emissions unit in a calendar year to the amount of fuel it could have burned if it had operated at the designed heat input rati`
- Parsed: `<p>“Capacity factor” means the ratio of the amount of fuel burned by an emissions unit in a calendar year to the amount of fuel it could have burned if it had operated at the designed heat input ratin`

### `sec-26-B-V-A-1-a`
- DB:     `<p> Except as provided in <span class="xref" data-target="sec-26-B-V-A-2">Section V.A.2.</span>, the requirements of <span class="xref" data-target="sec-26-B-V">Section V.</span> apply to owners or op`
- Parsed: `<p>Except as provided in <span class="xref" data-target="sec-26-B-V-A-2">Section V.A.2.</span>, the requirements of <span class="xref" data-target="sec-26-B-V">Section V.</span> apply to owners or ope`

### `sec-26-B-I-B-2`
- DB:     `<p> For lean burn reciprocating internal combustion engines, an oxidation catalyst shall be required. A lean burn reciprocating internal combustion engine is one with a normal exhaust oxygen concentra`
- Parsed: `<p>For lean burn reciprocating internal combustion engines, an oxidation catalyst shall be required. A lean burn reciprocating internal combustion engine is one with a normal exhaust oxygen concentrat`

### `sec-26-B-I-D-2-b`
- DB:     `<p> All engines and their associated equipment must be operated and maintained pursuant to the manufacturing specifications or equivalent to the extent practicable, and consistent with technological l`
- Parsed: `<p>All engines and their associated equipment must be operated and maintained pursuant to the manufacturing specifications or equivalent to the extent practicable, and consistent with technological li`

### `sec-26-B-VIII-A-4`
- DB:     `<p> Recordkeeping</p><p>The following records must be kept for a period of five (5) years and made available to the Division upon request.</p>`
- Parsed: `<p>Recordkeeping</p><p>The following records must be kept for a period of five (5) years and made available to the Division upon request.</p>`

### `sec-26-B-I-D-5-b`
- DB:     `<p> Emission Standards for Engines Subject to <span class="xref" data-target="sec-26-B-I-D-5-a">Section I.D.5.a.</span></p>`
- Parsed: `I.D.5.b. Emission Standards for Engines Subject to <span class="xref" data-target="sec-26-B-I-D-5-a">Section I.D.5.a.</span>`

### `sec-26-B-IX-A-1`
- DB:     `<p> Applicability Beginning May 1, 2025, the requirements of <span class="xref" data-target="sec-26-B-IX">Section IX.</span> apply to owners or operators of cold rolling mills at aluminum sheet manufa`
- Parsed: `<p>Applicability Beginning May 1, 2025, the requirements of <span class="xref" data-target="sec-26-B-IX">Section IX.</span> apply to owners or operators of cold rolling mills at aluminum sheet manufac`

### `sec-26-C-I`
- DB:     `<p> April 20, 2023 This Statement of Basis, Specific Statutory Authority, and Purpose complies with the requirements of the State Administrative Procedure Act, § 24-4-101, C.R.S., et seq., the Colorad`
- Parsed: `<p>April 20, 2023 This Statement of Basis, Specific Statutory Authority, and Purpose complies with the requirements of the State Administrative Procedure Act, § 24-4-101, C.R.S., et seq., the Colorado`

### `sec-26-B-I-C-3`
- DB:     `<p> Any emergency power generator exempt from APEN requirements pursuant to <span class="xref" data-target="sec-3-top-REG-3">Regulation Number 3</span>, <span class="xref" data-target="sec-3-A-PART-A"`
- Parsed: `<p>Any emergency power generator exempt from APEN requirements pursuant to <a class="xref-external-reg" href="/regulations/3">Regulation Number 3</a>, Part A.</p>`

### `sec-26-B-VI-A-5-g`
- DB:     `<p> Records of the oxidizer operating temperature.</p>`
- Parsed: `VI.A.5.g. Records of the oxidizer operating temperature.`

### `sec-26-B-II-A-7`
- DB:     `<p> Recordkeeping. The following records must be kept for a period of five years and made available to the Division upon request:</p>`
- Parsed: `<p>Recordkeeping. The following records must be kept for a period of five years and made available to the Division upon request:</p>`

### `sec-26-B-I-A-2`
- DB:     `<p> Any existing natural gas-fired stationary or portable reciprocating internal combustion engine with a manufacturer's design rate greater than 500 horsepower, which existing engine was operating in`
- Parsed: `<p>Any existing natural gas-fired stationary or portable reciprocating internal combustion engine with a manufacturer's design rate greater than 500 horsepower, which existing engine was operating in `

### `sec-26-B-I-D-4-b`
- DB:     `<p> (State Only) Lean Burn Reciprocating Internal Combustion Engines</p>`
- Parsed: `<p>(State Only) Lean Burn Reciprocating Internal Combustion Engines</p>`

### `sec-26-B-V-A-7`
- DB:     `<p> Recordkeeping</p><p>The following records must be kept for a period of five (5) years and made available to the Division upon request</p>`
- Parsed: `<p>Recordkeeping</p><p>The following records must be kept for a period of five (5) years and made available to the Division upon request</p>`
