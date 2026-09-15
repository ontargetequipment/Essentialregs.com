# Reg 7 import diff report

- Parsed rows: **2182**
- DB rows: **1824**
- Ids in both: **1767**
- Ids only in DB (parser gap or DB junk): **57**
- Ids only in parsed (parser found something DB doesn't have): **415**
- Text identical: **362**
- Text where DB is a suffix of parsed (truncation confirmed): **1025**
- Text different (neither identical nor a clean truncation): **380**
  - of which text also found verbatim on a nearby sibling id (amendment-driven renumbering, not a parser bug): **52**
- parent_id mismatches among shared ids: **22**
- DB rows with page-furniture leaked into full_text: **210**
- Parsed rows whose full_text starts with a lowercase letter: **1**

## Ids only in DB

(57 total)

- `sec-7-B-I-H-5-a`
- `sec-7-B-II-A-11-a`
- `sec-7-B-II-A-11-b`
- `sec-7-B-II-C-1-b-(ii)`
- `sec-7-B-II-C-1-b-(ii)-(A)`
- `sec-7-B-II-C-1-b-(ii)-(B)`
- `sec-7-B-III-B-13`
- `sec-7-B-V-B-1-i-(iii)`
- `sec-7-B-V-D-1`
- `sec-7-B-V-D-1-a`
- `sec-7-B-V-D-1-a-(i)`
- `sec-7-B-V-D-1-a-(ii)`
- `sec-7-B-V-D-1-a-(iii)`
- `sec-7-B-V-D-1-a-(iv)`
- `sec-7-B-V-D-1-b`
- `sec-7-B-V-D-1-c`
- `sec-7-B-V-D-1-d`
- `sec-7-B-V-D-1-e`
- `sec-7-B-V-D-1-f`
- `sec-7-B-V-D-2`
- `sec-7-B-V-D-3`
- `sec-7-B-VI-A-3-a`
- `sec-7-C-DI`
- `sec-7-C-I-B-2-g`
- `sec-7-C-I-D-5-g-(iii)`
- `sec-7-C-II-B-2-f`
- `sec-7-C-II-B-2-h-(ii)`
- `sec-7-C-II-C-1-d`
- `sec-7-C-II-C-1-d-(iii)`
- `sec-7-C-II-C-4`
- `sec-7-C-II-D-2`
- `sec-7-C-II-E-6`
- `sec-7-C-II-E-9-b`
- `sec-7-C-II-F`
- `sec-7-C-II-F-1`
- `sec-7-C-III-C-4`
- `sec-7-C-III-C-4-a-(ii)`
- `sec-7-C-III-C-4-d-(v)`
- `sec-7-C-III-C-4-e-(i)`
- `sec-7-C-III-C-4-e-(i)-(A)`
- `sec-7-C-III-C-5-b`
- `sec-7-C-III-C-5-b-(iv)`
- `sec-7-C-IV`
- `sec-7-C-V-A`
- `sec-7-C-V-D`
- `sec-7-C-VII-A-8`
- `sec-7-C-X-E`
- `sec-7-C-X-E-4-b`
- `sec-7-C-X-E-4-c`
- `sec-7-C-XII`
- `sec-7-C-XII-B`
- `sec-7-C-XVI`
- `sec-7-C-XVII`
- `sec-7-C-XVII-B`
- `sec-7-C-XVII-F`
- `sec-7-C-XVII-F-7`
- `sec-7-C-XVIII-F`

## Ids only in parsed

(415 total)

- `sec-7-B-I-A-6`
- `sec-7-B-I-B-34`
- `sec-7-B-I-F-2-b-(iii)-(A)`
- `sec-7-B-I-F-2-b-(iii)-(B)`
- `sec-7-B-I-F-2-b-(iii)-(C)`
- `sec-7-B-I-F-2-b-(iii)-(D)`
- `sec-7-B-I-G-1-a`
- `sec-7-B-I-H-6-a`
- `sec-7-B-I-J-1-i-(i)-(A)`
- `sec-7-B-I-J-1-i-(i)-(B)`
- `sec-7-B-I-J-1-l`
- `sec-7-B-I-J-2-f`
- `sec-7-B-I-K-6`
- `sec-7-B-I-L-1-c`
- `sec-7-B-II-A-13-a`
- `sec-7-B-II-A-13-b`
- `sec-7-B-II-A-47`
- `sec-7-B-II-A-48`
- `sec-7-B-II-A-49`
- `sec-7-B-II-B-2-h-(i)-(G)-(1)`
- `sec-7-B-II-B-2-h-(i)-(G)-(2)`
- `sec-7-B-II-B-2-h-(ii)-(B)`
- `sec-7-B-II-B-2-h-(ii)-(C)`
- `sec-7-B-II-B-2-h-(ii)-(D)`
- `sec-7-B-II-B-2-h-(ii)-(E)`
- `sec-7-B-II-B-2-k`
- `sec-7-B-II-B-6`
- `sec-7-B-II-B-7`
- `sec-7-B-II-C-1-d-(vii)-(A)`
- `sec-7-B-II-C-1-d-(vii)-(B)`
- `sec-7-B-II-C-1-d-(vii)-(C)`
- `sec-7-B-II-C-1-d-(vii)-(D)`
- `sec-7-B-II-C-2-b-(ii)-(H)`
- `sec-7-B-II-C-2-b-(ii)-(I)`
- `sec-7-B-II-C-2-b-(iii)`
- `sec-7-B-II-C-2-b-(iv)`
- `sec-7-B-II-G-1-c-(vi)-(A)`
- `sec-7-B-II-G-1-c-(vi)-(B)`
- `sec-7-B-II-G-1-c-(vi)-(C)`
- `sec-7-B-II-G-1-c-(vi)-(D)`
- `sec-7-B-II-G-1-d-(ii)-(A)`
- `sec-7-B-II-G-1-d-(ii)-(B)`
- `sec-7-B-II-G-1-d-(ii)-(C)`
- `sec-7-B-II-I-1-c`
- `sec-7-B-II-I-2`
- `sec-7-B-II-I-2-a`
- `sec-7-B-II-I-2-a-(i)`
- `sec-7-B-II-I-2-a-(ii)`
- `sec-7-B-II-I-2-a-(iii)`
- `sec-7-B-II-I-2-a-(iv)`
- `sec-7-B-II-I-2-a-(ix)`
- `sec-7-B-II-I-2-a-(v)`
- `sec-7-B-II-I-2-a-(vi)`
- `sec-7-B-II-I-2-a-(vii)`
- `sec-7-B-II-I-2-a-(viii)`
- `sec-7-B-II-I-2-a-(x)`
- `sec-7-B-II-I-2-a-(x)-(A)`
- `sec-7-B-II-I-2-a-(x)-(B)`
- `sec-7-B-II-I-2-a-(x)-(C)`
- `sec-7-B-II-I-2-b`
- `sec-7-B-II-I-2-b-(i)`
- `sec-7-B-II-I-2-b-(ii)`
- `sec-7-B-II-I-2-b-(iii)`
- `sec-7-B-II-I-2-b-(iv)`
- `sec-7-B-II-I-2-c`
- `sec-7-B-II-I-2-c-(i)`
- `sec-7-B-II-I-2-c-(i)-(A)`
- `sec-7-B-II-I-2-c-(i)-(B)`
- `sec-7-B-II-I-2-c-(i)-(B)-(1)`
- `sec-7-B-II-I-2-c-(i)-(B)-(2)`
- `sec-7-B-II-I-2-c-(i)-(B)-(3)`
- `sec-7-B-II-I-2-c-(i)-(B)-(4)`
- `sec-7-B-II-I-2-c-(i)-(C)`
- `sec-7-B-II-I-2-c-(ii)`
- `sec-7-B-II-I-2-c-(ii)-(A)`
- `sec-7-B-II-I-2-c-(ii)-(B)`
- `sec-7-B-II-I-2-c-(ii)-(C)`
- `sec-7-B-II-I-2-c-(ii)-(D)`
- `sec-7-B-II-I-2-c-(ii)-(E)`
- `sec-7-B-II-I-2-c-(ii)-(F)`
- `sec-7-B-II-I-2-c-(ii)-(G)`
- `sec-7-B-II-I-2-c-(ii)-(H)`
- `sec-7-B-II-I-2-c-(ii)-(I)`
- `sec-7-B-II-I-2-c-(ii)-(J)`
- `sec-7-B-II-I-2-c-(ii)-(K)`
- `sec-7-B-II-I-2-c-(iii)`
- `sec-7-B-II-I-2-c-(iii)-(A)`
- `sec-7-B-II-I-2-c-(iii)-(B)`
- `sec-7-B-II-I-2-c-(iv)`
- `sec-7-B-II-I-2-c-(iv)-(A)`
- `sec-7-B-II-I-2-c-(iv)-(B)`
- `sec-7-B-II-I-2-d`
- `sec-7-B-II-I-2-d-(i)`
- `sec-7-B-II-I-2-d-(i)-(A)`
- `sec-7-B-II-I-2-d-(i)-(B)`
- `sec-7-B-II-I-2-d-(i)-(C)`
- `sec-7-B-II-I-2-d-(i)-(D)`
- `sec-7-B-II-I-2-e`
- `sec-7-B-II-I-2-f`
- `sec-7-B-II-I-2-g`
- `sec-7-B-II-I-2-g-(i)`
- `sec-7-B-II-I-2-g-(i)-(A)`
- `sec-7-B-II-I-2-g-(i)-(B)`
- `sec-7-B-II-I-2-g-(i)-(B)-(1)`
- `sec-7-B-II-I-2-g-(i)-(B)-(2)`
- `sec-7-B-II-I-2-g-(i)-(B)-(3)`
- `sec-7-B-II-I-2-g-(i)-(B)-(4)`
- `sec-7-B-II-I-2-g-(i)-(C)`
- `sec-7-B-II-I-2-g-(i)-(C)-(1)`
- `sec-7-B-II-I-2-g-(i)-(C)-(2)`
- `sec-7-B-II-I-2-g-(i)-(D)`
- `sec-7-B-II-I-2-g-(i)-(D)-(1)`
- `sec-7-B-II-I-2-g-(i)-(D)-(2)`
- `sec-7-B-II-I-2-g-(i)-(E)`
- `sec-7-B-II-I-2-g-(i)-(F)`
- `sec-7-B-II-I-2-g-(i)-(G)`
- `sec-7-B-II-I-2-h`
- `sec-7-B-II-I-2-h-(i)`
- `sec-7-B-II-I-2-h-(i)-(A)`
- `sec-7-B-II-I-2-h-(i)-(B)`
- `sec-7-B-II-I-2-h-(i)-(C)`
- `sec-7-B-II-I-2-h-(i)-(D)`
- `sec-7-B-II-I-2-h-(i)-(E)`
- `sec-7-B-II-I-2-h-(ii)`
- `sec-7-B-II-I-2-h-(ii)-(A)`
- `sec-7-B-II-I-2-h-(ii)-(B)`
- `sec-7-B-II-I-2-h-(ii)-(B)-(1)`
- `sec-7-B-II-I-2-h-(ii)-(B)-(2)`
- `sec-7-B-II-I-2-h-(ii)-(B)-(3)`
- `sec-7-B-II-I-2-h-(ii)-(C)`
- `sec-7-B-II-I-2-h-(ii)-(C)-(1)`
- `sec-7-B-II-I-2-h-(ii)-(C)-(2)`
- `sec-7-B-II-I-2-h-(ii)-(D)`
- `sec-7-B-II-I-2-h-(ii)-(E)`
- `sec-7-B-II-I-2-h-(iii)`
- `sec-7-B-II-I-2-h-(iii)-(A)`
- `sec-7-B-II-I-2-h-(iii)-(A)-(1)`
- `sec-7-B-II-I-2-h-(iii)-(A)-(2)`
- `sec-7-B-II-I-2-h-(iii)-(A)-(3)`
- `sec-7-B-II-I-2-h-(iii)-(A)-(4)`
- `sec-7-B-II-I-2-h-(iii)-(B)`
- `sec-7-B-II-I-2-h-(iii)-(C)`
- `sec-7-B-II-I-2-h-(iii)-(D)`
- `sec-7-B-II-I-2-h-(iii)-(E)`
- `sec-7-B-II-I-2-h-(iii)-(F)`
- `sec-7-B-II-I-2-h-(iv)`
- `sec-7-B-II-I-2-j`
- `sec-7-B-II-I-2-j-(i)`
- `sec-7-B-II-I-2-j-(i)-(A)`
- `sec-7-B-II-I-2-j-(i)-(B)`
- `sec-7-B-II-I-2-j-(i)-(C)`
- `sec-7-B-II-I-2-j-(i)-(D)`
- `sec-7-B-II-I-2-j-(i)-(E)`
- `sec-7-B-II-I-2-j-(i)-(F)`
- `sec-7-B-II-I-2-j-(i)-(G)`
- `sec-7-B-II-I-2-j-(i)-(H)`
- `sec-7-B-II-J`
- `sec-7-B-II-J-1`
- `sec-7-B-II-J-1-a`
- `sec-7-B-II-J-1-a-(i)`
- `sec-7-B-II-J-1-a-(i)-(A)`
- `sec-7-B-II-J-1-a-(i)-(B)`
- `sec-7-B-II-J-1-b`
- `sec-7-B-II-J-1-b-(i)`
- `sec-7-B-II-J-1-b-(i)-(A)`
- `sec-7-B-II-J-1-b-(i)-(B)`
- `sec-7-B-II-J-1-c`
- `sec-7-B-II-J-1-c-(i)`
- `sec-7-B-II-J-1-c-(i)-(A)`
- `sec-7-B-II-J-1-c-(i)-(B)`
- `sec-7-B-II-J-1-c-(i)-(C)`
- `sec-7-B-II-J-1-c-(i)-(D)`
- `sec-7-B-II-J-1-c-(ii)`
- `sec-7-B-II-J-1-d`
- `sec-7-B-II-J-1-d-(i)`
- `sec-7-B-II-J-1-d-(ii)`
- `sec-7-B-II-J-1-e`
- `sec-7-B-II-J-1-e-(i)`
- `sec-7-B-II-J-1-e-(ii)`
- `sec-7-B-II-J-1-e-(iii)`
- `sec-7-B-II-J-1-e-(iv)`
- `sec-7-B-II-J-1-e-(v)`
- `sec-7-B-II-J-1-f`
- `sec-7-B-II-J-1-f-(i)`
- `sec-7-B-II-J-1-f-(i)-(A)`
- `sec-7-B-II-J-1-f-(i)-(B)`
- `sec-7-B-II-J-1-f-(i)-(C)`
- `sec-7-B-II-J-1-f-(i)-(D)`
- `sec-7-B-II-J-1-f-(i)-(E)`
- `sec-7-B-II-J-1-f-(i)-(F)`
- `sec-7-B-II-J-1-g`
- `sec-7-B-II-J-1-g-(i)`
- `sec-7-B-II-J-1-g-(ii)`
- `sec-7-B-II-J-1-g-(ii)-(A)`
- `sec-7-B-II-J-1-g-(ii)-(B)`
- `sec-7-B-II-J-1-g-(ii)-(B)-(1)`
- `sec-7-B-II-J-1-g-(ii)-(C)`
- `sec-7-B-II-J-1-g-(ii)-(D)`
- `sec-7-B-II-J-1-g-(ii)-(E)`
- `sec-7-B-II-J-1-g-(ii)-(F)`
- `sec-7-B-II-J-1-g-(ii)-(G)`
- `sec-7-B-II-J-1-g-(ii)-(H)`
- `sec-7-B-II-J-1-g-(ii)-(I)`
- `sec-7-B-II-J-1-g-(ii)-(J)`
- `sec-7-B-II-J-1-h`
- `sec-7-B-II-K`
- `sec-7-B-II-K-1`
- `sec-7-B-II-K-1-a`
- `sec-7-B-II-K-1-a-(i)`
- `sec-7-B-II-K-1-a-(i)-(A)`
- `sec-7-B-II-K-1-a-(i)-(B)`
- `sec-7-B-II-K-1-a-(ii)`
- `sec-7-B-II-K-1-a-(ii)-(A)`
- `sec-7-B-II-K-1-a-(ii)-(B)`
- `sec-7-B-II-K-1-a-(ii)-(C)`
- `sec-7-B-II-K-1-a-(ii)-(D)`
- `sec-7-B-II-K-1-b`
- `sec-7-B-II-K-1-b-(i)`
- `sec-7-B-II-K-1-b-(i)-(A)`
- `sec-7-B-II-K-1-b-(i)-(B)`
- `sec-7-B-II-K-1-b-(i)-(C)`
- `sec-7-B-II-K-1-b-(i)-(D)`
- `sec-7-B-II-K-1-b-(ii)`
- `sec-7-B-II-K-1-b-(ii)-(A)`
- `sec-7-B-II-K-1-b-(ii)-(B)`
- `sec-7-B-II-K-1-b-(ii)-(C)`
- `sec-7-B-II-K-1-b-(iii)`
- `sec-7-B-II-K-1-c`
- `sec-7-B-II-K-1-c-(i)`
- `sec-7-B-II-K-1-c-(ii)`
- `sec-7-B-II-K-1-c-(iii)`
- `sec-7-B-II-K-1-c-(iv)`
- `sec-7-B-II-K-1-c-(v)`
- `sec-7-B-II-K-1-c-(vi)`
- `sec-7-B-II-K-1-c-(vii)`
- `sec-7-B-II-K-1-d`
- `sec-7-B-II-K-1-d-(i)`
- `sec-7-B-II-K-1-d-(i)-(A)`
- `sec-7-B-II-K-1-d-(i)-(B)`
- `sec-7-B-II-K-1-d-(i)-(C)`
- `sec-7-B-II-K-1-d-(i)-(D)`
- `sec-7-B-II-K-1-d-(i)-(E)`
- `sec-7-B-II-K-1-e`
- `sec-7-B-II-K-1-e-(i)`
- `sec-7-B-II-K-1-e-(ii)`
- `sec-7-B-II-K-1-e-(ii)-(A)`
- `sec-7-B-II-K-1-e-(ii)-(B)`
- `sec-7-B-II-K-1-e-(ii)-(C)`
- `sec-7-B-II-K-1-e-(ii)-(C)-(1)`
- `sec-7-B-II-K-1-e-(ii)-(D)`
- `sec-7-B-II-K-1-e-(ii)-(E)`
- `sec-7-B-II-K-1-e-(ii)-(F)`
- `sec-7-B-II-K-1-e-(ii)-(G)`
- `sec-7-B-II-K-1-e-(ii)-(H)`
- `sec-7-B-II-K-1-f`
- `sec-7-B-III-C-1-e-(iv)-(A)`
- `sec-7-B-III-C-1-e-(iv)-(B)`
- `sec-7-B-III-C-1-e-(iv)-(C)`
- `sec-7-B-III-C-1-e-(iv)-(D)`
- `sec-7-B-III-C-1-e-(iv)-(E)`
- `sec-7-B-III-C-4-d-(i)`
- `sec-7-B-III-C-4-d-(ii)`
- `sec-7-B-III-C-4-d-(ii)-(A)`
- `sec-7-B-III-C-4-d-(ii)-(B)`
- `sec-7-B-III-C-4-d-(ii)-(C)`
- `sec-7-B-III-C-4-d-(iii)`
- `sec-7-B-III-C-4-d-(iv)`
- `sec-7-B-III-C-4-d-(vi)-(B)`
- `sec-7-B-III-C-4-d-(vi)-(C)`
- `sec-7-B-III-C-4-e-(i)`
- `sec-7-B-III-C-4-e-(i)-(A)`
- `sec-7-B-III-C-4-f-(i)-(A)`
- `sec-7-B-III-C-4-f-(i)-(B)`
- `sec-7-B-III-C-4-f-(i)-(B)-(1)`
- `sec-7-B-III-C-4-f-(i)-(B)-(2)`
- `sec-7-B-III-C-4-f-(i)-(B)-(3)`
- `sec-7-B-III-C-4-f-(i)-(B)-(4)`
- `sec-7-B-III-C-4-f-(i)-(C)`
- `sec-7-B-III-C-4-f-(i)-(C)-(1)`
- `sec-7-B-III-C-4-f-(i)-(C)-(2)`
- `sec-7-B-III-C-4-f-(i)-(C)-(3)`
- `sec-7-B-III-C-4-f-(i)-(D)`
- `sec-7-B-III-C-4-f-(iii)-(B)-(1)`
- `sec-7-B-III-C-4-f-(iii)-(B)-(2)`
- `sec-7-B-III-C-4-f-(iii)-(B)-(3)`
- `sec-7-B-III-C-5-b-(iii)-(A)-(1)`
- `sec-7-B-III-C-5-b-(iii)-(A)-(2)`
- `sec-7-B-III-C-5-b-(iii)-(A)-(3)`
- `sec-7-B-III-C-5-b-(vi)-(A)-(2)`
- `sec-7-B-III-C-5-b-(vi)-(A)-(3)`
- `sec-7-B-III-C-5-b-(vi)-(A)-(4)`
- `sec-7-B-III-C-5-c-(vi)-(A)-(5)`
- `sec-7-B-III-C-5-c-(vi)-(A)-(6)`
- `sec-7-B-III-C-5-c-(vi)-(A)-(7)`
- `sec-7-B-III-C-5-c-(vi)-(A)-(8)`
- `sec-7-B-IV-A-10`
- `sec-7-B-IV-A-11`
- `sec-7-B-IV-A-12`
- `sec-7-B-IV-A-13`
- `sec-7-B-IV-A-14`
- `sec-7-B-IV-A-15`
- `sec-7-B-IV-A-16`
- `sec-7-B-IV-A-16-a`
- `sec-7-B-IV-A-16-b`
- `sec-7-B-IV-A-16-c`
- `sec-7-B-IV-A-16-d`
- `sec-7-B-IV-A-16-e`
- `sec-7-B-IV-A-17`
- `sec-7-B-IV-B-4-a-(i)`
- `sec-7-B-IV-B-4-a-(i)-(A)`
- `sec-7-B-IV-B-4-a-(i)-(B)`
- `sec-7-B-IV-B-4-a-(i)-(C)`
- `sec-7-B-IV-B-4-a-(i)-(D)`
- `sec-7-B-IV-B-4-a-(i)-(E)`
- `sec-7-B-IV-B-4-a-(i)-(E)-(1)`
- `sec-7-B-IV-B-4-a-(i)-(E)-(2)`
- `sec-7-B-IV-B-4-a-(i)-(E)-(3)`
- `sec-7-B-IV-B-4-a-(i)-(F)`
- `sec-7-B-IV-B-4-a-(i)-(F)-(1)`
- `sec-7-B-IV-B-4-a-(i)-(F)-(2)`
- `sec-7-B-IV-B-4-a-(i)-(G)`
- `sec-7-B-IV-B-4-a-(i)-(H)`
- `sec-7-B-IV-D-3-c`
- `sec-7-B-V-B-1-j-(iii)`
- `sec-7-B-VI-E-1-a-(i)-(A)`
- `sec-7-B-VI-E-1-a-(i)-(B)`
- `sec-7-B-VI-E-1-a-(i)-(C)`
- `sec-7-B-VI-E-1-a-(i)-(D)`
- `sec-7-B-VI-E-1-a-(ii)-(A)`
- `sec-7-B-VI-E-1-a-(ii)-(B)`
- `sec-7-B-VI-E-2-e`
- `sec-7-B-VI-E-2-e-(i)`
- `sec-7-B-VI-E-2-e-(ii)`
- `sec-7-B-VI-E-2-f`
- `sec-7-B-VI-E-2-f-(i)`
- `sec-7-B-VI-E-2-f-(ii)`
- `sec-7-B-VI-E-2-g`
- `sec-7-B-VI-E-2-g-(i)`
- `sec-7-B-VI-E-2-g-(ii)`
- `sec-7-B-VI-E-2-h`
- `sec-7-B-VI-E-2-h-(i)`
- `sec-7-B-VI-E-2-h-(ii)`
- `sec-7-B-VII-F-1-a-(i)-(A)`
- `sec-7-B-VII-F-1-a-(i)-(B)`
- `sec-7-B-VII-F-1-a-(i)-(C)`
- `sec-7-B-VII-F-1-a-(i)-(C)-(1)`
- `sec-7-B-VII-F-1-a-(i)-(C)-(2)`
- `sec-7-B-VII-F-2-b-(ii)-(A)`
- `sec-7-B-VII-F-2-b-(ii)-(B)`
- `sec-7-B-VII-F-2-b-(ii)-(B)-(1)`
- `sec-7-B-VII-F-2-b-(ii)-(B)-(2)`
- `sec-7-B-VII-F-2-b-(ii)-(B)-(3)`
- `sec-7-B-VII-F-2-b-(ii)-(B)-(4)`
- `sec-7-B-VII-F-2-b-(ii)-(C)`
- `sec-7-B-VIII-A-20`
- `sec-7-B-VIII-B-2-c`
- `sec-7-B-VIII-B-3-c`
- `sec-7-B-VIII-E-3-b-(i)-(A)`
- `sec-7-B-VIII-E-3-b-(i)-(B)`
- `sec-7-B-VIII-E-3-b-(i)-(C)`
- `sec-7-B-VIII-E-3-b-(ii)-(A)`
- `sec-7-B-VIII-E-3-b-(ii)-(B)`
- `sec-7-B-VIII-E-3-b-(ii)-(C)`
- `sec-7-B-VIII-F-3-b-(i)-(A)-(1)`
- `sec-7-B-VIII-F-3-b-(ii)-(C)`
- `sec-7-B-VIII-G`
- `sec-7-C-A`
- `sec-7-C-AA`
- `sec-7-C-AA-26`
- `sec-7-C-B`
- `sec-7-C-B-1`
- `sec-7-C-B-2`
- `sec-7-C-B-3`
- `sec-7-C-B-4`
- `sec-7-C-B-5`
- `sec-7-C-BB`
- `sec-7-C-CC-7`
- `sec-7-C-D-1`
- `sec-7-C-D-2`
- `sec-7-C-E`
- `sec-7-C-E-1`
- `sec-7-C-E-2`
- `sec-7-C-E-3`
- `sec-7-C-EE`
- `sec-7-C-F`
- `sec-7-C-FF`
- `sec-7-C-G`
- `sec-7-C-GG`
- `sec-7-C-H`
- `sec-7-C-HH`
- `sec-7-C-J`
- `sec-7-C-K`
- `sec-7-C-M-1`
- `sec-7-C-M-2`
- `sec-7-C-M-3`
- `sec-7-C-M-4`
- `sec-7-C-M-5`
- `sec-7-C-M-6`
- `sec-7-C-M-7`
- `sec-7-C-M-8`
- `sec-7-C-M-9`
- `sec-7-C-N`
- `sec-7-C-O`
- `sec-7-C-P`
- `sec-7-C-Q`
- `sec-7-C-R`
- `sec-7-C-S`
- `sec-7-C-T`
- `sec-7-C-U`
- `sec-7-C-U-7`
- `sec-7-C-W`
- `sec-7-C-W-7`
- `sec-7-C-Y`
- `sec-7-C-Z`
- `sec-7-C-Z-7`

## Duplicate ids in the parsed output (two markers, one id — merged)

Every id below was produced by more than one marker during parsing. This script keeps the first occurrence's citation/parent/title and appends the later occurrence's text as trailing paragraphs so no content is silently dropped. As of this run, the only expected entry is `sec-7-B-VI-D-3-a-(iii)` — the source PDF really does print that exact label twice in a row for two different paragraphs (see "Source-text corrections and anomalies" below). The two other duplicates seen in earlier runs (`sec-7-B-II-J-1-c`, `sec-7-B-III-C-5-b-(iv)-(A)-(2)`, both citation-shaped continuation-line false positives) and the label-typo collision (`sec-7-B-VII-A-20`) are fixed — see the same section and the marker audit below. Anything else appearing here is new and should be reviewed by hand.

- `sec-7-B-VI-D-3-a-(iii)`

## Source-text corrections and anomalies

Confirmed by reading the actual printed PDF (not a pdftotext artifact). Fixes are applied to the raw lines before marker scanning, matched by (old label + enough of the following words to be unique in the document) so they can't misfire.

### Label typos corrected

| line ~ | printed (wrong) | corrected to | hits | note |
|---|---|---|---|---|
| 1520 | `I.H.5.a.` | `I.H.6.a.` | OK (1) | Printed as "I.H.5.a." directly under the "I.H.6. Monitoring and recordkeeping" heading, immediately followed by "I.H.6.a.(i)" through "(iii)" and then "I.H.6.b." — the printed "I.H.5.a." is a source-text typo for "I.H.6.a." (its real parent, I.H.5, is a separate, already-complete provision earlier on the page). |
| 13933 | `VII.A.20.` | `VIII.A.20.` | OK (1) | Printed as "VII.A.20." sitting between "VIII.A.19." and "VIII.A.21." in the Part B Section VIII definitions list — collides with the real, unrelated "VII.A.20." (“Oil and natural gas compression segment”) in Section VII’s own definitions. A source-text typo for "VIII.A.20." |

### Anomalies documented, not auto-corrected

- `VI.D.3.a.(iii)` (line ~12675): The label "VI.D.3.a.(iii)" is printed twice in a row for two different paragraphs: line ~12672 ("...permanently disconnected, if applicable.") and line ~12675 ("The date and duration of any period where the air pollution control equipment is not operating."). Both paragraphs are kept, merged into one row `sec-7-B-VI-D-3-a-(iii)`, in printed order — not renumbered.

## Marker column / continuation-line audit

Every Part A/B label candidate flagged by the continuation-line guard (its column deviates by more than 2 characters from the learned column for its depth, and/or its previous non-blank line lacks terminal punctuation), whether ultimately accepted as a real label or rejected as a continuation. See IMPORTER_SPEC.md and `_marker_column_signals` for the rule.

- Flagged candidates: **379** (column-deviating: **374**, prev-line-lacks-terminal-punctuation: **81**)
- Rejected as continuations: **101**
- Kept as real labels despite the flag: **278**

| line | citation | part | indent | learned col | col dev | lacks term. | page seam | accepted |
|---|---|---|---|---|---|---|---|---|
| 209 | `I.D.4.` | B | 12 | 7 | True | True | False | False |
| 562 | `I.C.2.b.(iii).(C).` | B | 28 | 25 | True | False | True | True |
| 571 | `I.C.2.b.(iii).(D).` | B | 28 | 25 | True | False | False | True |
| 597 | `I.D.3.a.(i).` | B | 20 | 17 | True | False | False | True |
| 621 | `IV.` | B | 25 | 0 | True | False | False | False |
| 679 | `I.D.3.b.(iii).` | B | 25 | 17 | True | True | False | False |
| 688 | `I.D.3.b.(iv).` | B | 25 | 17 | True | True | False | False |
| 695 | `I.I.` | B | 25 | 0 | True | True | False | False |
| 727 | `I.D.3.b.(x).` | B | 26 | 17 | True | True | False | False |
| 753 | `I.D.4.a.(iv).` | B | 21 | 17 | True | False | True | True |
| 756 | `I.D.4.a.(v).` | B | 21 | 17 | True | False | False | True |
| 762 | `I.D.4.b.` | B | 14 | 11 | True | False | False | True |
| 765 | `I.D.4.c.` | B | 14 | 11 | True | False | False | True |
| 776 | `I.E.1.a.` | B | 14 | 11 | True | False | False | True |
| 781 | `I.E.2.a.` | B | 14 | 11 | True | False | False | True |
| 788 | `I.E.2.b.` | B | 14 | 11 | True | False | False | True |
| 790 | `I.E.2.c.` | B | 14 | 11 | True | False | False | True |
| 864 | `I.E.3.a.(i).` | B | 21 | 17 | True | False | False | True |
| 870 | `I.E.3.a.(ii).` | B | 21 | 17 | True | False | False | True |
| 877 | `I.E.3.a.(iii).` | B | 21 | 17 | True | False | False | True |
| 889 | `I.F.1.a.` | B | 14 | 11 | True | False | False | True |
| 1014 | `I.D.3.b.(x).` | B | 20 | 17 | True | True | False | False |
| 1022 | `I.D.3.` | B | 26 | 5 | True | True | False | False |
| 1076 | `I.F.3.c.(vii).` | B | 21 | 17 | True | False | False | True |
| 1097 | `I.G.1.a.` | B | 14 | 11 | True | False | False | True |
| 1241 | `I.I.` | B | 5 | 0 | True | False | False | True |
| 1262 | `I.I.4.a.` | B | 14 | 11 | True | False | False | True |
| 1265 | `I.I.4.b.` | B | 14 | 11 | True | False | False | True |
| 1269 | `I.I.4.c.` | B | 14 | 11 | True | False | False | True |
| 1272 | `I.I.4.d.` | B | 14 | 11 | True | False | False | True |
| 1471 | `II.B.3.d.` | B | 26 | 11 | True | True | False | False |
| 1722 | `I.L.1.a.` | B | 14 | 11 | True | False | False | True |
| 1727 | `I.L.1.b.` | B | 14 | 11 | True | False | False | True |
| 2040 | `I.M.1.a.` | B | 14 | 11 | True | False | False | True |
| 2043 | `I.M.1.a.(i).` | B | 21 | 17 | True | False | False | True |
| 2047 | `I.M.1.a.(ii).` | B | 21 | 17 | True | False | False | True |
| 2092 | `I.M.1.d.` | B | 15 | 11 | True | False | False | True |
| 2095 | `I.M.1.d.(i).` | B | 22 | 17 | True | False | False | True |
| 2098 | `I.M.1.d.(ii).` | B | 22 | 17 | True | False | False | True |
| 2102 | `I.M.1.d.(iii).` | B | 22 | 17 | True | False | False | True |
| 2104 | `I.M.1.d.(iv).` | B | 22 | 17 | True | False | False | True |
| 2108 | `I.M.1.d.(v).` | B | 22 | 17 | True | False | False | True |
| 2117 | `II.A.1.` | B | 8 | 5 | True | False | False | True |
| 2123 | `II.A.2.` | B | 8 | 5 | True | False | False | True |
| 2434 | `II.A.49.` | B | 8 | 5 | True | False | True | True |
| 2443 | `II.B.1.` | B | 8 | 5 | True | False | False | True |
| 2449 | `II.B.1.a.` | B | 15 | 11 | True | False | False | True |
| 2455 | `II.B.1.b.` | B | 15 | 11 | True | False | False | True |
| 2465 | `II.B.2.` | B | 8 | 5 | True | False | False | True |
| 2662 | `V.` | B | 30 | 0 | True | True | False | False |
| 2740 | `II.B.2.h.(ii).(B).` | B | 29 | 25 | True | False | False | True |
| 2907 | `II.B.2.j.(i).` | B | 25 | 17 | True | False | False | True |
| 2920 | `II.B.2.j.(ii).` | B | 23 | 17 | True | False | False | True |
| 2926 | `II.B.2.j.(iii).` | B | 23 | 17 | True | False | False | True |
| 2932 | `II.B.2.h.(iii).(A).` | B | 32 | 25 | True | True | False | False |
| 2939 | `II.B.2.j.(iv).` | B | 23 | 17 | True | False | False | True |
| 2944 | `II.B.2.j.(v).` | B | 23 | 17 | True | False | False | True |
| 3018 | `II.B.6.` | B | 8 | 5 | True | False | True | True |
| 3020 | `II.B.7.` | B | 8 | 5 | True | False | False | True |
| 3026 | `II.C.1.` | B | 8 | 5 | True | False | False | True |
| 3028 | `II.C.1.a.` | B | 15 | 11 | True | False | False | True |
| 3036 | `II.C.1.b.` | B | 15 | 11 | True | False | False | True |
| 3046 | `II.C.1.b.(i).` | B | 22 | 17 | True | False | False | True |
| 3049 | `II.C.1.b.(i).(A).` | B | 30 | 25 | True | False | False | True |
| 3108 | `I.D.` | B | 32 | 0 | True | True | False | False |
| 3123 | `II.C.1.c.` | B | 25 | 11 | True | True | False | False |
| 3258 | `II.C.2.a.` | B | 25 | 11 | True | True | False | False |
| 3293 | `II.C.1.b.` | B | 31 | 11 | True | False | False | False |
| 3302 | `II.C.1.b.` | B | 31 | 11 | True | False | False | False |
| 3304 | `II.C.2.b.` | B | 31 | 11 | True | True | False | False |
| 3307 | `II.C.1.c.` | B | 31 | 11 | True | False | False | False |
| 3316 | `II.C.1.c.` | B | 31 | 11 | True | False | False | False |
| 3320 | `II.C.2.a.` | B | 31 | 11 | True | True | False | False |
| 3355 | `II.C.2.b.` | B | 31 | 11 | True | True | False | False |
| 3360 | `II.C.2.b.(ii).(I).` | B | 28 | 25 | True | False | True | True |
| 3382 | `II.C.2.b.(iii).` | B | 20 | 17 | True | False | False | True |
| 3385 | `II.C.1.e.` | B | 28 | 11 | True | True | False | False |
| 3387 | `II.C.2.b.(iv).` | B | 20 | 17 | True | False | False | True |
| 3495 | `II.C.4.c.` | B | 27 | 11 | True | True | False | False |
| 3619 | `II.C.5.a.(v).` | B | 21 | 17 | True | False | True | True |
| 3623 | `II.C.5.a.(v).(A).` | B | 28 | 25 | True | False | False | True |
| 3627 | `II.C.5.a.(v).(B).` | B | 28 | 25 | True | False | False | True |
| 3632 | `II.C.5.a.(v).(C).` | B | 28 | 25 | True | False | False | True |
| 3635 | `II.C.5.a.(v).(D).` | B | 28 | 25 | True | False | False | True |
| 3637 | `II.C.5.a.(v).(E).` | B | 28 | 25 | True | False | False | True |
| 3640 | `II.C.5.a.(v).(F).` | B | 28 | 25 | True | False | False | True |
| 3644 | `II.C.5.a.(vi).` | B | 21 | 17 | True | False | False | True |
| 3652 | `II.D.1.` | B | 8 | 5 | True | False | False | True |
| 3699 | `II.D.4.b.` | B | 15 | 11 | True | False | True | True |
| 3705 | `II.D.4.c.` | B | 15 | 11 | True | False | False | True |
| 3707 | `II.D.4.c.(i).` | B | 22 | 17 | True | False | False | True |
| 3713 | `II.D.4.c.(ii).` | B | 22 | 17 | True | False | False | True |
| 3729 | `II.E.1.` | B | 8 | 5 | True | False | False | True |
| 4055 | `II.E.5.` | B | 9 | 5 | True | False | False | True |
| 4059 | `II.E.5.a.` | B | 17 | 11 | True | False | False | True |
| 4124 | `II.E.7.c.` | B | 19 | 11 | True | True | False | False |
| 4318 | `II.E.9.a.` | B | 15 | 11 | True | False | True | True |
| 4321 | `II.E.9.b.` | B | 15 | 11 | True | False | False | True |
| 4325 | `II.E.9.c.` | B | 15 | 11 | True | False | False | True |
| 4330 | `II.E.9.d.` | B | 15 | 11 | True | False | False | True |
| 4334 | `II.E.9.e.` | B | 15 | 11 | True | False | False | True |
| 4342 | `II.E.9.f.` | B | 15 | 11 | True | False | False | True |
| 4346 | `II.E.9.g.` | B | 15 | 11 | True | False | False | True |
| 4354 | `II.F.1.` | B | 8 | 5 | True | False | True | True |
| 4361 | `II.F.2.` | B | 8 | 5 | True | False | False | True |
| 4368 | `II.F.3.` | B | 8 | 5 | True | False | False | True |
| 4374 | `II.G.1.` | B | 8 | 5 | True | False | False | True |
| 4381 | `II.G.1.a.` | B | 14 | 11 | True | False | False | True |
| 4558 | `II.G.1.d.(iii).` | B | 26 | 17 | True | True | False | False |
| 4584 | `II.G.3.a.(iv).` | B | 21 | 17 | True | False | True | True |
| 4586 | `II.G.1.c.(vi).` | B | 29 | 17 | True | True | False | False |
| 4588 | `II.G.3.a.(v).` | B | 21 | 17 | True | False | False | True |
| 4591 | `II.G.3.a.(vi).` | B | 21 | 17 | True | False | False | True |
| 4598 | `II.G.3.a.(vii).` | B | 21 | 17 | True | False | False | True |
| 4605 | `II.H.1.` | B | 8 | 5 | True | False | False | True |
| 4608 | `II.H.1.a.` | B | 14 | 11 | True | False | False | True |
| 4614 | `II.H.1.a.(i).` | B | 21 | 17 | True | False | False | True |
| 4618 | `II.H.1.a.(ii).` | B | 21 | 17 | True | False | False | True |
| 4742 | `II.H.1.c.(i).` | B | 24 | 17 | True | True | False | False |
| 4746 | `II.H.1.c.(iv).` | B | 26 | 17 | True | True | False | False |
| 4753 | `II.H.1.c.(ii).` | B | 26 | 17 | True | True | False | False |
| 4900 | `II.H.1.` | B | 19 | 5 | True | True | False | False |
| 5004 | `II.H.1.a.` | B | 25 | 11 | True | True | False | False |
| 5047 | `II.H.5.c.(iii).` | B | 21 | 17 | True | False | True | True |
| 5054 | `II.I.1.` | B | 8 | 5 | True | False | False | True |
| 5061 | `II.I.1.a.` | B | 14 | 11 | True | False | False | True |
| 5067 | `II.I.1.b.` | B | 14 | 11 | True | False | False | True |
| 5070 | `II.I.1.c.` | B | 14 | 11 | True | False | False | True |
| 5074 | `II.I.2.` | B | 8 | 5 | True | False | False | True |
| 5219 | `II.I.2.c.(i).(B).(1).` | B | 29 | 33 | True | False | True | True |
| 5222 | `II.I.2.c.(i).(B).(2).` | B | 29 | 33 | True | False | False | True |
| 5225 | `II.I.2.c.(i).(B).(3).` | B | 29 | 33 | True | False | False | True |
| 5272 | `II.I.2.c.(i).(B).(2).` | B | 33 | 29 | True | True | False | False |
| 5337 | `II.I.2.c.` | B | 34 | 11 | True | True | False | False |
| 5347 | `II.I.2.c.` | B | 34 | 11 | True | True | False | False |
| 5421 | `II.I.2.g.(i).(B).(1).` | B | 34 | 29 | True | False | False | True |
| 5462 | `II.I.2.g.(i).(D).(2).` | B | 33 | 30 | True | False | False | True |
| 5563 | `II.I.2.c.` | B | 38 | 11 | True | True | False | False |
| 5565 | `II.I.2.g.` | B | 38 | 11 | True | True | False | False |
| 5589 | `II.I.2.h.(iii).(A).(1).` | B | 34 | 30 | True | False | False | True |
| 5593 | `II.I.2.h.(iii).(A).(2).` | B | 34 | 30 | True | False | False | True |
| 5597 | `II.I.2.h.(iii).(A).(3).` | B | 34 | 30 | True | False | False | True |
| 5746 | `II.I.2.j.(i).(F).` | B | 29 | 25 | True | False | False | True |
| 5752 | `II.I.2.j.(i).(G).` | B | 29 | 25 | True | False | False | True |
| 5754 | `II.I.2.j.(i).(H).` | B | 29 | 25 | True | False | False | True |
| 5759 | `II.J.1.` | B | 8 | 5 | True | False | False | True |
| 5774 | `II.J.1.a.` | B | 14 | 11 | True | False | False | True |
| 5776 | `II.J.1.a.(i).` | B | 21 | 17 | True | False | False | True |
| 5792 | `II.J.1.c.` | B | 33 | 11 | True | True | False | False |
| 5842 | `II.E.` | B | 32 | 0 | True | True | False | False |
| 5856 | `II.J.1.c.(i).(D).` | B | 30 | 25 | True | False | False | True |
| 5983 | `II.J.1.a.` | B | 30 | 11 | True | True | False | False |
| 5987 | `II.J.1.b.` | B | 30 | 11 | True | True | False | False |
| 5989 | `II.J.1.g.(ii).(D).` | B | 28 | 25 | True | False | True | True |
| 5994 | `II.J.1.g.(ii).(E).` | B | 28 | 25 | True | False | False | True |
| 5996 | `II.J.1.g.(ii).(F).` | B | 28 | 25 | True | False | False | True |
| 5998 | `II.J.1.g.(ii).(G).` | B | 28 | 25 | True | False | False | True |
| 6000 | `II.J.1.g.(ii).(H).` | B | 28 | 25 | True | False | False | True |
| 6002 | `II.J.1.g.(ii).(I).` | B | 28 | 25 | True | False | False | True |
| 6005 | `II.J.1.g.(ii).(J).` | B | 28 | 25 | True | False | False | True |
| 6010 | `II.J.1.h.` | B | 14 | 11 | True | False | False | True |
| 6019 | `II.K.1.` | B | 8 | 5 | True | False | False | True |
| 6133 | `II.I.2.` | B | 34 | 5 | True | False | False | False |
| 6142 | `II.K.1.b.(ii).(A).` | B | 34 | 25 | True | False | False | False |
| 6346 | `III.C.5.` | B | 21 | 5 | True | False | False | False |
| 6470 | `III.C.1.f.` | B | 22 | 11 | True | True | False | False |
| 6553 | `III.C.1.f.(iii).` | B | 24 | 17 | True | False | True | True |
| 6559 | `III.C.1.f.(iv).` | B | 24 | 17 | True | False | False | True |
| 6570 | `III.C.2.a.` | B | 16 | 11 | True | False | False | True |
| 6573 | `III.C.2.e.` | B | 25 | 11 | True | True | False | False |
| 6575 | `III.C.2.b.` | B | 16 | 11 | True | False | False | True |
| 6581 | `III.C.2.c.` | B | 16 | 11 | True | False | False | True |
| 6584 | `III.C.2.e.` | B | 25 | 11 | True | True | False | False |
| 6586 | `III.C.2.d.` | B | 16 | 11 | True | False | False | True |
| 6625 | `III.C.3.a.` | B | 16 | 11 | True | False | False | True |
| 6629 | `III.C.3.a.(i).` | B | 24 | 17 | True | False | False | True |
| 6633 | `III.C.3.a.(ii).` | B | 24 | 17 | True | False | False | True |
| 6640 | `III.C.3.a.(iii).` | B | 24 | 17 | True | False | False | True |
| 6644 | `III.C.3.a.(iv).` | B | 24 | 17 | True | False | False | True |
| 6647 | `III.C.3.b.` | B | 16 | 11 | True | False | False | True |
| 6653 | `III.C.3.c.` | B | 16 | 11 | True | False | False | True |
| 6657 | `III.C.3.c.(i).` | B | 24 | 17 | True | False | False | True |
| 6703 | `III.C.4.a.` | B | 16 | 11 | True | False | False | True |
| 6706 | `III.C.4.a.(i).` | B | 24 | 17 | True | False | False | True |
| 6709 | `III.C.4.a.(ii).` | B | 24 | 17 | True | False | False | True |
| 6713 | `III.C.4.a.(iii).` | B | 24 | 17 | True | False | False | True |
| 6717 | `III.C.4.b.` | B | 16 | 11 | True | False | False | True |
| 6722 | `III.C.4.` | B | 25 | 5 | True | True | False | False |
| 6725 | `III.C.4.c.` | B | 16 | 11 | True | False | False | True |
| 6729 | `III.C.4.c.(i).` | B | 24 | 17 | True | False | False | True |
| 6743 | `III.C.4.c.(ii).(A).(1).` | B | 34 | 30 | True | False | False | True |
| 6751 | `III.C.4.c.(ii).(A).(2).` | B | 34 | 30 | True | False | False | True |
| 6761 | `III.C.4.c.(ii).(A).(3).` | B | 34 | 30 | True | False | False | True |
| 6762 | `III.C.4.c.(ii).(A).(1).` | B | 42 | 30 | True | False | False | False |
| 6798 | `III.C.4.e.(i).` | B | 39 | 17 | True | True | False | False |
| 6895 | `III.C.4.d.` | B | 14 | 11 | True | False | False | True |
| 6899 | `III.C.4.d.(i).` | B | 21 | 17 | True | False | False | True |
| 6921 | `III.C.4.d.(ii).(C).` | B | 17 | 25 | True | False | False | True |
| 6941 | `III.C.4.d.(iv).` | B | 24 | 17 | True | True | False | False |
| 6979 | `III.C.4.e.(i).(A).` | B | 24 | 25 | False | True | False | False |
| 7014 | `III.C.4.e.(i).(A).` | B | 42 | 25 | True | True | False | False |
| 7019 | `III.C.4.e.(i).(A).` | B | 34 | 25 | True | True | False | False |
| 7027 | `III.C.4.d.(vi).(A).` | B | 34 | 25 | True | True | False | False |
| 7071 | `III.C.4.e.(i).` | B | 21 | 17 | True | False | False | True |
| 7078 | `III.C.4.e.(i).(A).` | B | 29 | 25 | True | False | False | True |
| 7082 | `III.C.4.e.(i).(A).(1).` | B | 37 | 30 | True | False | False | True |
| 7181 | `III.C.4.a.(i).` | B | 38 | 17 | True | True | False | False |
| 7199 | `III.C.4.c.(ii).` | B | 36 | 17 | True | True | False | False |
| 7255 | `III.C.4.e.(i).(D).(5).` | B | 33 | 30 | True | False | False | True |
| 7261 | `III.C.4.e.(ii).` | B | 25 | 17 | True | False | False | True |
| 7267 | `III.C.4.e.(iii).` | B | 25 | 17 | True | False | False | True |
| 7288 | `III.C.4.f.(i).(B).(1).` | B | 34 | 30 | True | False | False | True |
| 7290 | `III.C.4.f.(i).(B).(2).` | B | 34 | 30 | True | False | False | True |
| 7292 | `III.C.4.f.(i).(B).(3).` | B | 34 | 30 | True | False | False | True |
| 7295 | `III.C.4.f.(i).(B).(4).` | B | 34 | 30 | True | False | False | True |
| 7301 | `III.C.4.f.(i).(C).(1).` | B | 34 | 30 | True | False | False | True |
| 7303 | `III.C.4.f.(i).(C).(2).` | B | 34 | 30 | True | False | False | True |
| 7308 | `III.C.4.f.(i).(C).(3).` | B | 34 | 30 | True | False | False | True |
| 7365 | `III.C.4.f.(iii).(B).(1).` | B | 34 | 30 | True | False | False | True |
| 7369 | `III.C.4.e.(i).(A).` | B | 42 | 25 | True | True | False | False |
| 7372 | `III.C.4.f.(iii).(B).(2).` | B | 34 | 30 | True | False | False | True |
| 7376 | `III.C.4.f.(iii).(B).(3).` | B | 34 | 30 | True | False | False | True |
| 7395 | `III.C.4.f.(iii).(A).` | B | 34 | 25 | True | False | False | False |
| 7405 | `III.C.4.f.(iii).(C).` | B | 34 | 25 | True | False | False | False |
| 7444 | `III.C.4.c.(iv).` | B | 25 | 17 | True | True | False | False |
| 7465 | `III.C.4.g.(viii).` | B | 24 | 17 | True | False | False | True |
| 7481 | `III.C.5.a.` | B | 16 | 11 | True | False | False | True |
| 7483 | `III.C.5.a.(i).` | B | 24 | 17 | True | False | False | True |
| 7488 | `III.C.5.a.(ii).` | B | 24 | 17 | True | False | False | True |
| 7494 | `III.C.5.a.(ii).(A).` | B | 32 | 25 | True | False | False | True |
| 7506 | `III.C.5.b.(v).` | B | 26 | 17 | True | True | False | False |
| 7537 | `III.C.5.b.(i).` | B | 35 | 17 | True | True | False | False |
| 7542 | `III.C.5.b.(iii).(A).(2).` | B | 35 | 34 | False | True | False | False |
| 7565 | `III.C.5.b.(i).` | B | 35 | 17 | True | True | False | False |
| 7570 | `III.C.5.b.(iii).(A).(2).` | B | 32 | 34 | False | True | False | False |
| 7598 | `III.C.5.b.(iii).(A).(1).` | B | 31 | 34 | True | False | False | True |
| 7603 | `III.C.5.b.(iii).(A).(2).` | B | 31 | 34 | True | False | False | True |
| 7616 | `III.C.5.b.(iii).(A).(3).` | B | 31 | 34 | True | False | False | True |
| 7635 | `III.C.5.b.(iv).(A).(1).` | B | 29 | 34 | True | False | False | True |
| 7643 | `III.C.5.b.(iv).(A).(2).` | B | 29 | 34 | True | False | False | True |
| 7646 | `III.C.5.b.(iii).(A).(2).` | B | 36 | 34 | False | True | False | False |
| 7657 | `III.C.5.b.(iv).(A).(3).` | B | 29 | 34 | True | False | False | True |
| 7675 | `III.C.5.b.(iv).(A).(4).` | B | 29 | 34 | True | False | False | True |
| 7682 | `III.C.5.b.(iv).(A).(2).` | B | 36 | 34 | False | True | False | False |
| 7701 | `III.C.5.b.(iv).(A).(2).` | B | 40 | 34 | True | True | False | False |
| 7725 | `III.C.5.b.(i).(D).` | B | 33 | 25 | True | True | False | False |
| 7739 | `III.C.5.b.(vi).(A).(1).` | B | 31 | 34 | True | False | False | True |
| 7750 | `III.C.5.b.(vi).(A).(2).` | B | 31 | 34 | True | False | False | True |
| 7759 | `III.C.5.b.(vi).(A).(3).` | B | 31 | 34 | True | False | False | True |
| 7766 | `III.C.5.b.(vi).(A).(3).` | B | 43 | 34 | True | True | False | False |
| 7794 | `III.C.5.c.` | B | 27 | 11 | True | True | False | False |
| 7817 | `III.C.5.c.(iii).(B).(1).` | B | 31 | 34 | True | False | False | True |
| 7828 | `III.C.5.c.(iii).(B).(2).` | B | 31 | 34 | True | False | False | True |
| 7833 | `III.C.5.c.(iii).(B).(3).` | B | 31 | 34 | True | False | False | True |
| 7838 | `III.C.5.c.(iii).(B).(4).` | B | 31 | 34 | True | False | False | True |
| 7902 | `III.C.5.c.(v).(A).(3).` | B | 29 | 34 | True | False | False | True |
| 7906 | `II.E.8.` | B | 36 | 5 | True | True | False | False |
| 7910 | `III.C.5.c.(v).(A).(4).` | B | 29 | 34 | True | False | False | True |
| 7917 | `III.C.5.c.(v).(A).(5).` | B | 29 | 34 | True | False | False | True |
| 7925 | `III.C.5.c.(v).(A).(6).` | B | 29 | 34 | True | False | False | True |
| 7930 | `III.C.5.c.(v).(A).(7).` | B | 29 | 34 | True | False | False | True |
| 7988 | `III.C.5.c.(vi).(A).(5).` | B | 23 | 30 | True | False | False | True |
| 7998 | `III.C.5.c.(vi).(A).(6).` | B | 23 | 30 | True | False | False | True |
| 8019 | `III.C.5.d.` | B | 15 | 11 | True | False | False | True |
| 8035 | `III.D.1.a.` | B | 15 | 11 | True | False | False | True |
| 8041 | `III.D.1.b.` | B | 16 | 11 | True | False | False | True |
| 8054 | `III.D.2.a.` | B | 16 | 11 | True | False | False | True |
| 8060 | `III.D.2.b.` | B | 16 | 11 | True | False | False | True |
| 8072 | `III.D.3.a.` | B | 17 | 11 | True | False | True | True |
| 8077 | `III.D.3.b.` | B | 17 | 11 | True | False | False | True |
| 8089 | `III.D.4.a.` | B | 17 | 11 | True | False | False | True |
| 8095 | `III.D.4.b.` | B | 17 | 11 | True | False | False | True |
| 8147 | `III.E.1.b.(ii).` | B | 20 | 17 | True | False | False | True |
| 8171 | `III.C.2.e.` | B | 21 | 11 | True | True | False | False |
| 8182 | `III.E.2.c.` | B | 16 | 11 | True | False | False | True |
| 8188 | `III.F.1.` | B | 9 | 5 | True | False | False | True |
| 8190 | `III.F.1.a.` | B | 16 | 11 | True | False | False | True |
| 8196 | `III.F.1.b.` | B | 16 | 11 | True | False | False | True |
| 8202 | `III.F.2.` | B | 9 | 5 | True | False | False | True |
| 8204 | `III.F.2.a.` | B | 16 | 11 | True | False | False | True |
| 8210 | `III.F.2.a.(i).` | B | 24 | 17 | True | False | False | True |
| 8272 | `II.E.4.e.` | B | 19 | 11 | True | True | False | False |
| 8699 | `II.E.8.` | B | 26 | 5 | True | True | False | False |
| 8732 | `III.G.6.a.` | B | 19 | 11 | True | False | False | True |
| 8737 | `III.G.6.a.(i).` | B | 23 | 17 | True | False | False | True |
| 8743 | `III.G.6.a.(ii).` | B | 23 | 17 | True | False | False | True |
| 8750 | `III.G.6.a.(iii).` | B | 23 | 17 | True | False | False | True |
| 8751 | `III.G.2.b.(iii).` | B | 31 | 17 | True | False | False | False |
| 8753 | `III.G.6.a.(iv).` | B | 23 | 17 | True | False | False | True |
| 8758 | `III.G.6.a.(v).` | B | 23 | 17 | True | False | False | True |
| 8768 | `III.G.6.a.(vi).` | B | 28 | 17 | True | False | True | True |
| 8774 | `III.G.6.a.(vii).` | B | 28 | 17 | True | False | False | True |
| 8782 | `III.G.6.a.(viii).` | B | 28 | 17 | True | False | False | True |
| 9064 | `III.C.5.a.(ii).(A).` | B | 36 | 25 | True | True | False | False |
| 9078 | `III.C.5.d.` | B | 36 | 11 | True | True | False | False |
| 9102 | `IV.B.4.a.(i).(F).(2).` | B | 37 | 30 | True | False | True | True |
| 9104 | `III.G.7.` | B | 44 | 5 | True | True | False | False |
| 9106 | `IV.B.4.a.(i).(G).` | B | 30 | 25 | True | False | False | True |
| 9108 | `IV.B.4.a.(i).(H).` | B | 30 | 25 | True | False | False | True |
| 9110 | `IV.B.4.b.` | B | 16 | 11 | True | False | False | True |
| 9116 | `IV.D.4.` | B | 16 | 5 | True | True | False | False |
| 9165 | `IV.D.3.a.` | B | 16 | 11 | True | False | False | True |
| 9171 | `IV.D.3.b.` | B | 16 | 11 | True | False | False | True |
| 9178 | `IV.` | B | 23 | 0 | True | True | False | False |
| 9181 | `IV.D.3.c.` | B | 15 | 11 | True | False | False | True |
| 9189 | `IV.D.4.a.` | B | 15 | 11 | True | False | False | True |
| 9191 | `IV.D.4.b.` | B | 15 | 11 | True | False | False | True |
| 9195 | `IV.D.4.c.` | B | 15 | 11 | True | False | False | True |
| 9199 | `IV.D.4.d.` | B | 15 | 11 | True | False | False | True |
| 9201 | `IV.D.4.e.` | B | 15 | 11 | True | False | False | True |
| 9211 | `IV.D.5.a.` | B | 17 | 11 | True | False | True | True |
| 9214 | `IV.D.5.b.` | B | 17 | 11 | True | False | False | True |
| 9217 | `IV.D.5.c.` | B | 17 | 11 | True | False | False | True |
| 9220 | `IV.D.5.c.(i).` | B | 24 | 17 | True | False | False | True |
| 9223 | `IV.D.5.c.(ii).` | B | 24 | 17 | True | False | False | True |
| 9227 | `IV.D.5.c.(iii).` | B | 24 | 17 | True | False | False | True |
| 9230 | `IV.D.5.d.` | B | 17 | 11 | True | False | False | True |
| 9268 | `V.A.` | B | 13 | 0 | True | False | False | False |
| 9281 | `V.B.1.c.(i).` | B | 20 | 17 | True | False | False | True |
| 9353 | `V.C.2.s.` | B | 25 | 11 | True | True | False | False |
| 9355 | `I.B.36.c.` | B | 25 | 11 | True | True | False | False |
| 9394 | `V.B.1.j.(iii).` | B | 20 | 17 | True | False | False | True |
| 9584 | `VI.A.` | B | 7 | 0 | True | False | False | True |
| 9618 | `VI.A.5.a.` | B | 18 | 11 | True | False | False | True |
| 10113 | `VI.C.1.b.` | B | 19 | 11 | True | True | False | False |
| 10287 | `VI.C.2.b.` | B | 20 | 11 | True | True | False | False |
| 10381 | `VI.D.3.a.(i).` | B | 20 | 17 | True | False | False | True |
| 10384 | `VI.D.3.a.(ii).` | B | 20 | 17 | True | False | False | True |
| 10386 | `VI.D.3.a.(iii).` | B | 20 | 17 | True | False | False | True |
| 10389 | `VI.D.3.a.(iii).` | B | 20 | 17 | True | False | False | True |
| 10392 | `VI.D.3.a.(iv).` | B | 20 | 17 | True | False | False | True |
| 10398 | `VI.D.3.a.(v).` | B | 20 | 17 | True | False | False | True |
| 10412 | `VI.E.1.a.(i).` | B | 20 | 17 | True | False | False | True |
| 10687 | `VI.E.5.a.(i).` | B | 21 | 17 | True | False | False | True |
| 10692 | `VI.E.5.a.(ii).` | B | 21 | 17 | True | False | False | True |
| 10696 | `VI.E.5.a.(iii).` | B | 21 | 17 | True | False | False | True |
| 10842 | `VII.F.1.a.(i).` | B | 20 | 17 | True | False | False | True |
| 10847 | `VII.F.1.a.(i).(A).` | B | 28 | 25 | True | False | False | True |
| 10852 | `VII.F.1.a.(i).(B).` | B | 28 | 25 | True | False | False | True |
| 10861 | `VII.F.1.a.(i).(C).(1).` | B | 34 | 30 | True | False | False | True |
| 10870 | `VII.F.1.a.(i).(C).(2).` | B | 34 | 30 | True | False | False | True |
| 10953 | `VII.F.1.c.(i).` | B | 33 | 17 | True | True | False | False |
| 11003 | `VII.F.2.b.(i).` | B | 30 | 17 | True | False | False | False |
| 11045 | `VII.F.1.a.(i).` | B | 21 | 17 | True | True | False | False |
| 11170 | `VII.F.6.d.(ii).` | B | 21 | 17 | True | False | True | True |
| 11173 | `VII.F.6.d.(iii).` | B | 21 | 17 | True | False | False | True |
| 11176 | `VII.F.6.d.(iv).` | B | 21 | 17 | True | False | False | True |
| 11182 | `VII.F.6.d.(v).` | B | 21 | 17 | True | False | False | True |
| 11278 | `VII.G.2.h.` | B | 14 | 11 | True | False | True | True |
| 11281 | `VII.G.2.i.` | B | 14 | 11 | True | False | False | True |
| 11285 | `VII.G.2.j.` | B | 14 | 11 | True | False | False | True |
| 11286 | `VII.F.2.b.(i).` | B | 23 | 17 | True | False | False | False |
| 11293 | `VII.G.2.k.` | B | 14 | 11 | True | False | False | True |
| 11297 | `VII.G.2.l.` | B | 14 | 11 | True | False | False | True |
| 11303 | `VII.G.2.m.` | B | 14 | 11 | True | False | False | True |
| 11456 | `VIII.A.18.` | B | 12 | 5 | True | True | False | False |
| 11506 | `VIII.B.1.` | B | 13 | 5 | True | False | False | False |
| 11517 | `VIII.B.1.` | B | 13 | 5 | True | False | False | False |
| 11527 | `VIII.B.1.` | B | 12 | 5 | True | False | False | False |
| 11537 | `VIII.B.3.` | B | 12 | 5 | True | True | False | False |
| 11563 | `VIII.B.7.a.` | B | 14 | 11 | True | False | False | True |
| 11576 | `VIII.B.7.b.` | B | 14 | 11 | True | False | False | True |
| 11605 | `VIII.C.2.` | B | 21 | 5 | True | True | False | False |
| 11695 | `VIII.B.1.` | B | 21 | 5 | True | False | False | False |
| 11699 | `VIII.B.1.` | B | 21 | 5 | True | False | False | False |
| 11733 | `VIII.E.1.d.` | B | 30 | 11 | True | True | False | False |
| 11762 | `VIII.E.1.d.` | B | 30 | 11 | True | True | False | False |
| 11778 | `VIII.F.2.a.(i).` | B | 20 | 17 | True | False | False | True |
| 11781 | `VIII.F.2.a.(ii).` | B | 20 | 17 | True | False | False | True |
| 11820 | `VIII.F.3.b.(i).(A).(1).` | B | 33 | 30 | True | False | False | True |
| 11827 | `VIII.F.3.b.(i).(A).(2).` | B | 33 | 30 | True | False | False | True |
| 11888 | `VIII.F.3.b.(ii).(C).` | B | 19 | 25 | True | False | False | True |
| 11920 | `VIII.F.5.a.(i).` | B | 20 | 17 | True | False | False | True |
| 11925 | `VIII.F.5.a.(ii).` | B | 20 | 17 | True | False | False | True |
| 11929 | `VIII.F.5.a.(iii).` | B | 20 | 17 | True | False | False | True |
| 11937 | `VIII.F.5.b.(i).` | B | 20 | 17 | True | False | False | True |
| 11940 | `VIII.F.5.b.(ii).` | B | 20 | 17 | True | False | False | True |
| 11943 | `VIII.F.5.b.(iii).` | B | 20 | 17 | True | False | False | True |
| 12012 | `IV.E.3.` | B | 20 | 5 | True | True | False | False |

## parent_id mismatches

- `sec-7-B-I-H-6-a-(i)`: db parent=`sec-7-B-I-H-5-a` parsed parent=`sec-7-B-I-H-6-a`
- `sec-7-B-I-H-6-a-(ii)`: db parent=`sec-7-B-I-H-5-a` parsed parent=`sec-7-B-I-H-6-a`
- `sec-7-B-I-H-6-a-(iii)`: db parent=`sec-7-B-I-H-5-a` parsed parent=`sec-7-B-I-H-6-a`
- `sec-7-B-II-C-2-a-(i)-(B)`: db parent=`sec-7-P-B` parsed parent=`sec-7-B-II-C-2-a-(i)`
- `sec-7-B-II-C-2-b-(ii)`: db parent=`sec-7-B-II-C-2-a` parsed parent=`sec-7-B-II-C-2-b`
- `sec-7-B-II-C-2-b-(ii)-(A)`: db parent=`sec-7-B-II-C-2-b-(i)` parsed parent=`sec-7-B-II-C-2-b-(ii)`
- `sec-7-B-II-C-2-b-(ii)-(B)`: db parent=`sec-7-B-II-C-2-b-(i)` parsed parent=`sec-7-B-II-C-2-b-(ii)`
- `sec-7-B-II-C-2-b-(ii)-(C)`: db parent=`sec-7-B-II-C-2-b-(i)` parsed parent=`sec-7-B-II-C-2-b-(ii)`
- `sec-7-B-II-C-2-b-(ii)-(D)`: db parent=`sec-7-B-II-C-2-b-(i)` parsed parent=`sec-7-B-II-C-2-b-(ii)`
- `sec-7-B-II-C-2-b-(ii)-(E)`: db parent=`sec-7-B-II-C-2-b-(i)` parsed parent=`sec-7-B-II-C-2-b-(ii)`
- `sec-7-B-II-C-2-b-(ii)-(F)`: db parent=`sec-7-B-II-C-2-b-(i)` parsed parent=`sec-7-B-II-C-2-b-(ii)`
- `sec-7-B-II-C-2-b-(ii)-(G)`: db parent=`sec-7-B-II-C-2-b-(i)` parsed parent=`sec-7-B-II-C-2-b-(ii)`
- `sec-7-B-III-C-4-e-(i)-(A)-(1)`: db parent=`sec-7-P-B` parsed parent=`sec-7-B-III-C-4-e-(i)-(A)`
- `sec-7-B-III-C-4-e-(i)-(A)-(2)`: db parent=`sec-7-P-B` parsed parent=`sec-7-B-III-C-4-e-(i)-(A)`
- `sec-7-B-III-C-4-e-(i)-(B)`: db parent=`sec-7-P-B` parsed parent=`sec-7-B-III-C-4-e-(i)`
- `sec-7-B-III-C-4-e-(i)-(C)`: db parent=`sec-7-P-B` parsed parent=`sec-7-B-III-C-4-e-(i)`
- `sec-7-B-III-C-4-e-(i)-(D)`: db parent=`sec-7-P-B` parsed parent=`sec-7-B-III-C-4-e-(i)`
- `sec-7-B-VIII-G-1`: db parent=`sec-7-B-VIII-F` parsed parent=`sec-7-B-VIII-G`
- `sec-7-B-VIII-G-2`: db parent=`sec-7-B-VIII-F` parsed parent=`sec-7-B-VIII-G`
- `sec-7-B-VIII-G-3`: db parent=`sec-7-B-VIII-F` parsed parent=`sec-7-B-VIII-G`
- `sec-7-B-VIII-G-4`: db parent=`sec-7-B-VIII-F` parsed parent=`sec-7-B-VIII-G`
- `sec-7-B-VIII-G-5`: db parent=`sec-7-B-VIII-F` parsed parent=`sec-7-B-VIII-G`

## DB rows with page-furniture leaks (first 30)

- `sec-7-A-I`
- `sec-7-A-II`
- `sec-7-A-II-A-1-b`
- `sec-7-A-II-D-1-a`
- `sec-7-B-I-B-6`
- `sec-7-B-I-B-18`
- `sec-7-B-I-B-28`
- `sec-7-B-I-C-1-b`
- `sec-7-B-I-C-1-f-(i)`
- `sec-7-B-I-C-2-b`
- `sec-7-B-I-C-2-b-(iii)-(E)`
- `sec-7-B-I-D-3-b-(ii)`
- `sec-7-B-I-D-3-b-(xi)`
- `sec-7-B-I-E`
- `sec-7-B-I-E-2-c-(viii)`
- `sec-7-B-I-F-1-a`
- `sec-7-B-I-F-2-b-(iv)`
- `sec-7-B-I-F-3-c`
- `sec-7-B-I-F-3-c-(vi)`
- `sec-7-B-I-H-3`
- `sec-7-B-I-H-6-b`
- `sec-7-B-I-I-4-a`
- `sec-7-B-I-J-1-f`
- `sec-7-B-I-J-1-i-(i)`
- `sec-7-B-I-J-2-a-(i)-(B)`
- `sec-7-B-I-J-2-b-(iv)-(C)`
- `sec-7-B-I-K-1`
- `sec-7-B-I-K-2-h-(ii)`
- `sec-7-B-I-L-1`
- `sec-7-B-I-L-3`

## Truncation-confirmed rows (DB text is a suffix of parsed text) — first 30

- `sec-7-A-I-A-1-a`
- `sec-7-A-I-A-1-b`
- `sec-7-A-II-A-1`
- `sec-7-A-II-B`
- `sec-7-A-II-C`
- `sec-7-A-II-D-1-b`
- `sec-7-B-I-B-21`
- `sec-7-B-I-C-1-a`
- `sec-7-B-I-C-1-d`
- `sec-7-B-I-C-1-e`
- `sec-7-B-I-C-1-e-(i)`
- `sec-7-B-I-C-1-e-(ii)`
- `sec-7-B-I-C-1-e-(iii)`
- `sec-7-B-I-C-1-e-(iv)`
- `sec-7-B-I-C-1-f`
- `sec-7-B-I-C-1-f-(ii)`
- `sec-7-B-I-C-2`
- `sec-7-B-I-C-2-a-(i)`
- `sec-7-B-I-C-2-a-(ii)`
- `sec-7-B-I-C-2-a-(iii)`
- `sec-7-B-I-C-2-a-(iv)`
- `sec-7-B-I-C-2-a-(v)`
- `sec-7-B-I-C-2-b-(i)`
- `sec-7-B-I-C-2-b-(ii)`
- `sec-7-B-I-C-2-b-(iii)`
- `sec-7-B-I-C-2-b-(iii)-(A)`
- `sec-7-B-I-C-2-b-(iii)-(B)`
- `sec-7-B-I-C-2-b-(iii)-(C)`
- `sec-7-B-I-C-2-b-(iii)-(D)`
- `sec-7-B-I-D-3-a-(i)`
- … and 995 more

## Different (not identical, not a clean truncation) — first 40

- `sec-7-A-APPENDIX-A`
- `sec-7-A-I`
- `sec-7-A-II`
- `sec-7-A-II-A-1-b`
- `sec-7-A-II-A-4`
- `sec-7-A-II-D-1-a`
- `sec-7-B-I-A-3`
- `sec-7-B-I-A-5`
- `sec-7-B-I-B-10`
- `sec-7-B-I-B-18`
- `sec-7-B-I-B-23`
- `sec-7-B-I-B-24`
- `sec-7-B-I-B-25`
- `sec-7-B-I-B-26`
- `sec-7-B-I-B-27`
- `sec-7-B-I-B-28`
- `sec-7-B-I-B-29`
- `sec-7-B-I-B-3`
- `sec-7-B-I-B-30`
- `sec-7-B-I-B-31`
- `sec-7-B-I-B-32`
- `sec-7-B-I-B-33`
- `sec-7-B-I-B-6`
- `sec-7-B-I-C-1-b`
- `sec-7-B-I-C-1-c`
- `sec-7-B-I-C-1-f-(i)`
- `sec-7-B-I-C-2-b`
- `sec-7-B-I-C-2-b-(iii)-(E)`
- `sec-7-B-I-D-3-b-(ii)`
- `sec-7-B-I-D-3-b-(xi)`
- `sec-7-B-I-D-4-a-(iv)`
- `sec-7-B-I-E`
- `sec-7-B-I-E-2-c-(viii)`
- `sec-7-B-I-F-1-a`
- `sec-7-B-I-F-2-b-(iii)`
- `sec-7-B-I-F-2-b-(iv)`
- `sec-7-B-I-F-2-c-(iii)`
- `sec-7-B-I-F-3-c`
- `sec-7-B-I-F-3-c-(vi)`
- `sec-7-B-I-G-1`
- … and 340 more

## Likely amendment-driven renumbering (DB text found on a nearby sibling id)

The current source PDF has clearly been amended since the DB was last populated (dates change, e.g. Reg 7 II.A.2's EPA Method 21 citation goes from `(August 3, 2017)` in the source PDF to no date at all in some DB rows; definitions get inserted alphabetically, shifting every subsequent sequentially-numbered definition — e.g. DB's `sec-7-B-I-B-24` is `"New"` but the current PDF's `I.B.24` is `"Natural gas transmission and storage segment"`, a term inserted earlier in the list, pushing `"New"` down to `I.B.25`). The rows below are where the DB's stored text for id X is not what's at X in the new parse, but IS found (word salad aside) on a nearby sibling id — i.e. content that moved, not content that's wrong.

(52 of the 380 'different' rows)

- `sec-7-B-I-B-24` (DB) → now at `sec-7-B-I-B-25` (parsed)
- `sec-7-B-I-B-25` (DB) → now at `sec-7-B-I-B-26` (parsed)
- `sec-7-B-I-B-26` (DB) → now at `sec-7-B-I-B-27` (parsed)
- `sec-7-B-I-B-27` (DB) → now at `sec-7-B-I-B-28` (parsed)
- `sec-7-B-I-B-29` (DB) → now at `sec-7-B-I-B-30` (parsed)
- `sec-7-B-I-B-31` (DB) → now at `sec-7-B-I-B-32` (parsed)
- `sec-7-B-I-B-32` (DB) → now at `sec-7-B-I-B-33` (parsed)
- `sec-7-B-I-B-33` (DB) → now at `sec-7-B-I-B-34` (parsed)
- `sec-7-B-II-A-10` (DB) → now at `sec-7-B-II-A-11` (parsed)
- `sec-7-B-II-A-11` (DB) → now at `sec-7-B-II-A-13` (parsed)
- `sec-7-B-II-A-12` (DB) → now at `sec-7-B-II-A-14` (parsed)
- `sec-7-B-II-A-13` (DB) → now at `sec-7-B-II-A-15` (parsed)
- `sec-7-B-II-A-14` (DB) → now at `sec-7-B-II-A-16` (parsed)
- `sec-7-B-II-A-15` (DB) → now at `sec-7-B-II-A-17` (parsed)
- `sec-7-B-II-A-16` (DB) → now at `sec-7-B-II-A-18` (parsed)
- `sec-7-B-II-A-17` (DB) → now at `sec-7-B-II-A-19` (parsed)
- `sec-7-B-II-A-19` (DB) → now at `sec-7-B-II-A-21` (parsed)
- `sec-7-B-II-A-20` (DB) → now at `sec-7-B-II-A-22` (parsed)
- `sec-7-B-II-A-22` (DB) → now at `sec-7-B-II-A-24` (parsed)
- `sec-7-B-II-A-23` (DB) → now at `sec-7-B-II-A-25` (parsed)
- `sec-7-B-II-A-24` (DB) → now at `sec-7-B-II-A-26` (parsed)
- `sec-7-B-II-A-25` (DB) → now at `sec-7-B-II-A-27` (parsed)
- `sec-7-B-II-A-26` (DB) → now at `sec-7-B-II-A-28` (parsed)
- `sec-7-B-II-A-27` (DB) → now at `sec-7-B-II-A-29` (parsed)
- `sec-7-B-II-A-28` (DB) → now at `sec-7-B-II-A-30` (parsed)
- `sec-7-B-II-A-29` (DB) → now at `sec-7-B-II-A-31` (parsed)
- `sec-7-B-II-A-31` (DB) → now at `sec-7-B-II-A-33` (parsed)
- `sec-7-B-II-A-32` (DB) → now at `sec-7-B-II-A-34` (parsed)
- `sec-7-B-II-A-33` (DB) → now at `sec-7-B-II-A-35` (parsed)
- `sec-7-B-II-A-34` (DB) → now at `sec-7-B-II-A-36` (parsed)
- `sec-7-B-II-A-35` (DB) → now at `sec-7-B-II-A-37` (parsed)
- `sec-7-B-II-A-36` (DB) → now at `sec-7-B-II-A-38` (parsed)
- `sec-7-B-II-A-37` (DB) → now at `sec-7-B-II-A-39` (parsed)
- `sec-7-B-II-A-38` (DB) → now at `sec-7-B-II-A-40` (parsed)
- `sec-7-B-II-A-39` (DB) → now at `sec-7-B-II-A-41` (parsed)
- `sec-7-B-II-A-40` (DB) → now at `sec-7-B-II-A-42` (parsed)
- `sec-7-B-II-A-41` (DB) → now at `sec-7-B-II-A-43` (parsed)
- `sec-7-B-II-A-44` (DB) → now at `sec-7-B-II-A-46` (parsed)
- `sec-7-B-II-A-46` (DB) → now at `sec-7-B-II-A-48` (parsed)
- `sec-7-B-II-A-6` (DB) → now at `sec-7-B-II-A-7` (parsed)
- … and 12 more

## Cross-reference linking

- `<span class="xref">` spans — parsed: **2592**, DB: **2716**
- `<a class="xref-external-reg">` anchors — parsed: **73**, DB: **13**

### Spans by target part

| target | parsed | DB |
|---|---|---|
| Part A (bare part reference) | 48 | 51 |
| Part B (bare part reference) | 196 | 145 |
| Part C (bare part reference) | 47 | 39 |
| top (Regulation root) | 498 | 357 |
| under Part A | 18 | 16 |
| under Part B | 1776 | 1072 |
| under Part C | 9 | 1036 |

### Unresolved references, by bucket (top 15 each)

**Historical (former structure — Reg 7 was renumbered; these no longer exist in current Parts A/B/C)** — 144 distinct, 708 mentions

| citation text | count |
|---|---|
| Part D | 108 |
| Part E | 58 |
| XII. | 48 |
| XVII. | 37 |
| II. | 27 |
| XVIII. | 24 |
| XII.L. | 21 |
| XVII.F. | 20 |
| XVI. | 18 |
| I. | 16 |
| X. | 15 |
| XIX. | 13 |
| III. | 13 |
| IV. | 11 |
| V. | 11 |

**Other regulation not in corpus** — 15 distinct, 32 mentions

| citation text | count |
|---|---|
| Regulation Number 22 | 14 |
| Regulation Number 24 | 2 |
| Regulation Number 25 | 2 |
| Regulation Number 27, Part D | 2 |
| Regulation Number 22, Part B, Sections III. and IV. | 2 |
| Regulation Number 27, Part D, Section I. | 1 |
| Regulation Number 27, Part D, Sections III.C. and III.D. | 1 |
| Regulation Number 27, Part D, Sections III.E. and IV. | 1 |
| Regulation Number 27, Part A | 1 |
| Regulation Number 8 | 1 |
| Regulation Number 6, Part A | 1 |
| Regulation Number 6 | 1 |
| Regulation Number 6, Part B | 1 |
| Regulation Number 22, Section IV.A.12. | 1 |
| Regulation Number 27 | 1 |

**CFR part/subpart not in corpus** — 12 distinct, 63 mentions

| citation text | count |
|---|---|
| 40 CFR Part 60, Subpart OOOOa | 21 |
| 40 CFR Part 60, Subpart OOOO | 16 |
| 40 CFR Part 98 | 9 |
| 40 CFR Part 60 | 6 |
| 40 CFR Part 63 | 2 |
| 40 CFR Part 60, Subpart KKK | 2 |
| 40 CFR Part 59 | 2 |
| 40 CFR Part 75 | 1 |
| 40 CFR Part 63, Subpart JJ | 1 |
| 40 CFR Part 60, Subpart XX | 1 |
| 40 CFR Part 63, Subpart BBBBBB | 1 |
| 40 CFR Part 63, Subpart CCCCCC | 1 |

**Unparseable / genuine parser gap** — 59 distinct, 78 mentions

| citation text | count |
|---|---|
| II.A.11.b. | 9 |
| IV. | 3 |
| II.F. | 3 |
| III.C.5.(vi)(A)(2) | 2 |
| I.B.2.f. | 2 |
| I.B.2.g. | 2 |
| III. | 2 |
| I.D.5. | 2 |
| I.D.5.e. | 2 |
| I.D.5.b.(iii) | 2 |
| I.D.3.a.(ii)(A). | 1 |
| I.J.1.h.(i)(C) | 1 |
| I.J.1.h.(i)(D) | 1 |
| II.A.11.a. | 1 |
| II.B.2.h.(ii)(B)(2) | 1 |

### Remaining unwrapped "Section..." text

- Total: **498**
- Excluding ones whose roman numeral doesn't exist in current Part A/B at all (historical, expected to stay unlinked): **176**

### 10 random linked paragraphs from Part B

- `sec-7-B-VIII-A-11`: <p>“Greenhouse gas intensity” means the sum of preproduction emissions and production emissions in a calendar year in mtCO2e divided by the kBOE for that calendar year, calculated pursuant to <span class="xref" data-target="sec-7-B-VIII-D">Sections VIII.D.</span> and <span class="xref" data-target="sec-7-B-VIII-F">VIII.F.</span></p>
- `sec-7-B-II-D-1`: <p>Beginning May 1, 2008, still vents and vents from any flash separator or flash tank on a glycol natural gas dehydrator located at an oil and gas exploration and production operation, natural gas compressor station, or gas-processing plant subject to control requirements pursuant to <span class="xref" data-target="sec-7-B-II-D-2">Section II.D.2.</span>, shall reduce uncontrolled actual emissions
- `sec-7-B-VI-E-3-a`: <p>For drilling, hydraulic fracturing, and hydraulic refracturing operations located in a cumulatively impacted community, records demonstrating that the use practices in <span class="xref" data-target="sec-7-B-VI-E-1-a">Section VI.E.1.a.</span> were followed between May 1 and September 30.</p>
- `sec-7-B-III-C-3-a-(iv)`: <p>Utilizing self-contained pneumatic controllers satisfies <span class="xref" data-target="sec-7-B-III-C-3-a-(i)">Section III.C.3.a.(i).</span></p>
- `sec-7-B-III-G-5-a-(ii)`: <p>If applicable, records of the certification(s) by a qualified professional engineer or in-house engineer that the closed vent system is of sufficient design and capacity to route pneumatic controller emissions to a process, pursuant to <span class="xref" data-target="sec-7-B-III-G-3-a">Section III.G.3.a.</span></p>
- `sec-7-B-I-E-3-a-(ii)`: <p>Control device models tested in accordance with 40 CFR Part 60, Subpart OOOOa, Section 60.5413a(d) and demonstrating continuous compliance in accordance with 40 CFR Part 60, Subpart OOOOa, Section 60.5413a(e)(1) (June 3, 2016) are not subject to the performance test requirement in <span class="xref" data-target="sec-7-B-I-E-3-a-(i)">Section I.E.3.a.(i).</span></p>
- `sec-7-B-V-B-1`: <p>The following information must be reported in accordance with <span class="xref" data-target="sec-7-B-V-A">Section V.A.</span></p>
- `sec-7-B-II-E-6-g`: <p>Beginning February 14, 2022, for leaks identified using an approved non-quantitative instrument monitoring method or AVO at a well production facility located within a disproportionately impacted community or at a well production facility inspected pursuant to <span class="xref" data-target="sec-7-B-II-E-4-f">Section II.E.4.f.</span>, owners or operators have the option of either repairing the 
- `sec-7-B-VIII-E-2-c`: <p>By June 30, 2028, each intensity operator subject to <span class="xref" data-target="sec-7-B-VIII-B-1">Section VIII.B.1.</span> must submit to the Division a greenhouse gas intensity plan demonstrating how the intensity operator will meet the applicable greenhouse gas intensity targets in <span class="xref" data-target="sec-7-B-VIII-B-4">Section VIII.B.4.</span></p>
- `sec-7-B-II-E-8-g`: <p>Documentation of actions taken pursuant to <span class="xref" data-target="sec-7-B-II-E-7-b">Section II.E.7.b.</span> to stop a leak that was not repaired within five (5) working days after discovery or documentation that such actions would cause greater emissions;</p>

### 5 random linked paragraphs from Part C

- `sec-7-C-G`: <p>March 12, 2004 (<span class="xref" data-target="sec-7-B-I-A">Sections I.A</span>, <span class="xref" data-target="sec-7-B-I-B">I.B.</span>, XII., and XVI.) The March 2004 revisions were adopted in conjunction with the Early Action Compact Ozone Action Plan, which is a SIP revision for attainment of the 8-hour ozone standard by December 31, 2007. The Commission adopted four new control measures 
- `sec-7-C-II`: <p>May 21-22, 2026 (<span class="xref" data-target="sec-7-P-B">Part B</span>, <span class="xref" data-target="sec-7-B-V">Section V.</span>) Revisions to <span class="xref" data-target="sec-7-top-REG-7">Regulation Number 7</span>, <span class="xref" data-target="sec-7-P-B">Part B</span>, <span class="xref" data-target="sec-7-B-V">Section V.</span></p><p>This Statement of Basis, Specific Statutory A
- `sec-7-C-EE`: <p>February 19-21, 2025 (Revisions to <span class="xref" data-target="sec-7-P-B">Part B</span>) This Statement of Basis, Specific Statutory Authority, and Purpose complies with the requirements of the State Administrative Procedure Act, § 24-4-103(4), C.R.S., the Colorado Air Pollution Prevention and Control Act, §§ 25-7-110 and 25-7-110.5., C.R.S., and the Air Quality Control Commission’s (Commis
- `sec-7-C-S`: <p>December 19, 2019 (<span class="xref" data-target="sec-7-B-I">Sections I.</span> through XX. and Appendices A through F – reorganized into Parts A through F) This Statement of Basis, Specific Statutory Authority, and Purpose complies with the requirements of the Colorado Administrative Procedures Act §§ 24-4-103(4), the Colorado Air Pollution Prevention and Control Act, Colorado Revised Statute
- `sec-7-C-H`: <p>December 16, 2004 (<span class="xref" data-target="sec-7-B-I-A">Sections I.A.</span>, <span class="xref" data-target="sec-7-B-II-A">II.A.</span>, XII. and XVI.) The December 2004 revisions were adopted to respond to U.S. EPA comments on the Ozone Action Plan the Commission adopted in March 2004. EPA required the rule revision in order to make the control measures incorporated into the State Imp

### DB xref target vs parsed xref target, same provision & citation text

(33 such (provision, citation text) pairs found)

| provision | citation text | DB target | parsed target |
|---|---|---|---|
| `sec-7-C-X` | Section II.A. | `sec-7-C-II` | `sec-7-B-II-A` |
| `sec-7-B-III-C-5-b-(ii)-(B)` | Sections III.C.5.b.(iii)(A)(2) | `sec-7-B-III-C-5-b-(iii)-(A)` | `sec-7-B-III-C-5-b-(iii)-(A)-(2)` |
| `sec-7-C-DD` | Section I.A. | `sec-7-C-I` | `sec-7-A-I-A` |
| `sec-7-A-II-B` | Sections I.L. | `sec-7-A-I` | `sec-7-B-I-L` |
| `sec-7-C-CC` | I.J.1.l. | `sec-7-C-I` | `sec-7-B-I-J-1-l` |
| `sec-7-C-DD` | Sections III.C.4. | `sec-7-C-III-C-4` | `sec-7-B-III-C-4` |
| `sec-7-B-II-H-1-c-(ix)` | II.H.1.c.(iv). | `sec-7-B-II-H-1-c-(iv).` | `sec-7-B-II-H-1-c-(iv)` |
| `sec-7-C-CC` | I.L.7. | `sec-7-C-I` | `sec-7-B-I-L-7` |
| `sec-7-B-III-C-5-b-(ii)-(A)` | Sections III.C.5.b.(iii)(A)(2) | `sec-7-B-III-C-5-b-(iii)-(A)` | `sec-7-B-III-C-5-b-(iii)-(A)-(2)` |
| `sec-7-B-III-C-5-b-(iv)-(A)-(2)` | Section III.C.5.b.(iii)(A)(2) | `sec-7-B-III-C-5-b-(iii)-(A)` | `sec-7-B-III-C-5-b-(iii)-(A)-(2)` |

**Reviewed by hand against the source PDF** (Reg 7, 2026-09-14 print):

- `sec-7-C-DD`, "Sections III.C.4." and "Section I.A.": the source text is "...Revisions to **Part A**, Section I.A. and **Part B**, Sections III.C.4...." — the explicit Part A/Part B on each item makes the **parsed** targets (`sec-7-A-I-A`, `sec-7-B-III-C-4`) correct; DB's `sec-7-C-I` / `sec-7-C-III-C-4` are leftover ids from the old roman-numbered Part C scheme and don't exist under the current (relettered) Part C at all.
- `sec-7-C-CC`, "Sections I.A.1.c." and "II.C.": same pattern — "Revisions to **Part A**, Sections I.A.1.c. and II.C. and Part B..." — both items belong to the stated Part A, so **parsed**'s `sec-7-A-I-A-1-c` / `sec-7-A-II-C` are correct; DB's `sec-7-C-I` / `sec-7-C-II` are again stale old-Part-C ids.
- `sec-7-A-II-B`, "Sections I.L.": the source reads "...the hydrocarbon threshold in **Part B**, Sections I.L...." inside a Part A provision — DB ignored the explicit "Part B" and linked to this provision's own Part A Section I (`sec-7-A-I`, wrong); **parsed** correctly honors the stated Part B (`sec-7-B-I-L`).
- `sec-7-B-III-C-4-d-(vi)-(A)`, "Sections III.C.4.d.(i)": DB collapsed the citation to its parent, `sec-7-B-III-C-4-d` (dropping the "(i)"); **parsed**'s `sec-7-B-III-C-4-d-(i)` matches the printed citation exactly and is correct.
- `sec-7-C-X`, "Section II.B.": a bare topic heading ("Air Pollution Control Equipment: Section II.B.") inside a Part C statement-of-basis entry with no part stated — DB's `sec-7-C-II` is an old-scheme id that doesn't exist under the current lettered Part C; **parsed**'s `sec-7-B-II-B` (Part B tried first per rule 1c) is at least a real, existing section, though a human should still eyeball whether II.B is the exact intended target for this particular topic label.

In every case above the new parser's target is at least as correct as, and usually clearly better than, the DB's — the DB's Part-C-roman-numeral ids are artifacts of the pre-relettering id scheme (IMPORTER_SPEC.md's approved Part C lettering fix) and don't resolve to anything under the current schema.

## Lowercase-start rows in parsed output (first 30)

- `sec-7-B-VI-A-5-a`: 'a census block group that satisfies one or more of the following.'

## 15 random side-by-side samples

### `sec-7-B-II-E-7`
- DB:     `II.E.7. Repair and remonitoring`
- Parsed: `II.E.7. Repair and remonitoring`

### `sec-7-B-I-L-4`
- DB:     `<p>Leaks requiring repair: Only leaks from components exceeding the thresholds in Section
require repair under <span class="xref" data-target="sec-7-B-I-L-5">Section I.L.5.</span></p>`
- Parsed: `<p>Leaks requiring repair: Only leaks from components exceeding the thresholds in <span class="xref" data-target="sec-7-B-I-L-4">Section I.L.4.</span> require repair under <span class="xref" data-targ`

### `sec-7-B-II-H-4-d-(v)`
- DB:     `II.H.4.d.(v). Hot tapping to make new connections to pipelines.`
- Parsed: `II.H.4.d.(v). Hot tapping to make new connections to pipelines.`

### `sec-7-B-VI-C-1-b-(ii)`
- DB:     `VI.C.1.b.(ii). The planned schedule for drilling and pre-production operations.`
- Parsed: `<p>The planned schedule for drilling and pre-production operations.</p>`

### `sec-7-B-I-D-3`
- DB:     `I.D.3. Storage Tank Control Strategy`
- Parsed: `I.D.3. Storage Tank Control Strategy`

### `sec-7-B-I-E-3-a-(iii)`
- DB:     `<p><span class="xref" data-target="sec-7-B-I-E-3-a-(i)">Section I.E.3.a.(i)</span> or manufacturer demonstrations and associated inlet
                                 gas flow rate records specified `
- Parsed: `<p>Maintain records of performance tests conducted pursuant to <span class="xref" data-target="sec-7-B-I-E-3-a-(i)">Section I.E.3.a.(i)</span> or manufacturer demonstrations and associated inlet gas f`

### `sec-7-B-VIII-D-2`
- DB:     `<p>liquids in thousand barrels to the proportion of natural gas (calculated by dividing the
                 million standard cubic feet (MMscf) volume of natural gas produced by the conversion
      `
- Parsed: `<p>Intensity operators must calculate kBOE by adding the production of hydrocarbon liquids in thousand barrels to the proportion of natural gas (calculated by dividing the million standard cubic feet `

### `sec-7-B-III-F-5`
- DB:     `<p>Owners or operators of pneumatic controllers at well production facilities or natural gas                  compressor stations must submit a single annual report on or before May 31st of each
     `
- Parsed: `<p>Owners or operators of pneumatic controllers at well production facilities or natural gas compressor stations must submit a single annual report on or before May 31st of each year (beginning May 31`

### `sec-7-B-I-H-1`
- DB:     `<p>Beginning May 1, 2005, still vents and vents from any flash separator or flash tank on a                glycol natural gas dehydrator located at an oil and gas exploration and production
          `
- Parsed: `<p>Beginning May 1, 2005, still vents and vents from any flash separator or flash tank on a glycol natural gas dehydrator located at an oil and gas exploration and production operation, natural gas co`

### `sec-7-B-II-H-1-a-(ii)`
- DB:     `<p>or greater than 0.5 tpy VOC or 1 tpy methane on a rolling 12-month
                                  basis, consistent with a Division-accepted method of calculation.</p>`
- Parsed: `<p>Pigging units with annual uncontrolled actual emissions equal to or greater than 0.5 tpy VOC or 1 tpy methane on a rolling 12-month basis, consistent with a Division-accepted method of calculation.`

### `sec-7-B-IV-D-3`
- DB:     `<p>By June 30 of each year (beginning June 30, 2022), owners or operators of the natural                gas transmission and storage segment will submit company-wide reports to the third-
            `
- Parsed: `<p>By June 30 of each year (beginning June 30, 2022), owners or operators of the natural gas transmission and storage segment will submit company-wide reports to the third-party contractor.</p>`

### `sec-7-B-I-D-4`
- DB:     `<p>Alternative emissions control equipment and pollution prevention devices and processes                installed and implemented after June 1, 2004, shall qualify as air pollution control
          `
- Parsed: `<p>Alternative emissions control equipment and pollution prevention devices and processes installed and implemented after June 1, 2004, shall qualify as air pollution control equipment, and may be use`

### `sec-7-B-III-D-4-b`
- DB:     `<p>pneumatic controller with a natural gas bleed rate greater than zero on a monthly
                       basis, perform necessary maintenance (such as cleaning, tuning, and repairing
              `
- Parsed: `<p>Effective March 1, 2023, the owner or operator must inspect each pneumatic controller with a natural gas bleed rate greater than zero on a monthly basis, perform necessary maintenance (such as clea`

### `sec-7-B-II-B-2-f-(ii)`
- DB:     `II.B.2.f.(ii). Weekly visual inspections must include, at a minimum`
- Parsed: `II.B.2.f.(ii). Weekly visual inspections must include, at a minimum`

### `sec-7-B-I-C-1-f`
- DB:     `<p>organic compounds, surveillance systems must be employed and operational as
                      follows:</p>`
- Parsed: `<p>(State Only)If a combustion device is used to control emissions of volatile organic compounds, surveillance systems must be employed and operational as follows:</p>`
