# MS Yug mark check

For Suresh Kumar, teacher, Govt. Middle School Yug, Zone Jib, Udhampur.
Register: class 8, session 2023-24, Sheet3 of the school result register.
Built 22 November 2026. The page runs on this computer and does not upload marks.

`data.csv` has 48 rows: eight students, six subjects each. Names, parent names, address, category, date of birth, Aadhaar, phone, and roll number are not in the file. `Student_01` is the first student on Sheet3. Marks are the ones on that sheet, including Dogri/Additional stored as 0 for every student. The link back to the sheet row is `local/id-map.csv`, which is not pushed.

## Run

```bash
npm install
npm run dev
```

Open the local address Vite prints. The first screen is the mark check.

To rebuild `data.csv` after the workbook in `local/` changes:

```bash
python3 scripts/build_data_csv.py
```

The script stops without writing if the formative totals do not match, or if an identity number would land in the file.

## Output on this file

Dogri/Additional is 0 for all eight students, so the counted total is out of 500. No row failed the arithmetic. The sheet total matches the counted total because the unused subject adds nothing.

| Student | English | Hindi/Urdu | Mathematics | Science/EVS | Social Science | Dogri/Additional | Total | Grade |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Student_01 | 80 | 97 | 81 | 87 | 89 | 0 | 434 | A+ |
| Student_02 | 70 | 65 | 70 | 75 | 77 | 0 | 357 | A |
| Student_03 | 67 | 71 | 73 | 73 | 67 | 0 | 351 | A |
| Student_04 | 76 | 77 | 78 | 76 | 81 | 0 | 388 | A |
| Student_05 | 74 | 76 | 77 | 79 | 78 | 0 | 384 | A |
| Student_06 | 63 | 74 | 66 | 73 | 65 | 0 | 341 | B |
| Student_07 | 64 | 71 | 72 | 69 | 66 | 0 | 342 | B |
| Student_08 | 70 | 60 | 68 | 72 | 74 | 0 | 344 | B |

`Student_01` is Sheet3 row 6. The line under that row on the page is the F1–F6, activities, and summative split.

## What it gets wrong

It will not invent a missing mark, a grace mark, or a pass/fail the register does not already show. The grade is copied from the sheet. It is not a new scale.

A real zero on one paper, inside a subject other students sat, is kept as zero. Only a subject that is zero for every student is left out of the "out of" figure. If the school did teach Dogri and every child scored zero, this page would still call it unused.

The blank report card says 2024-25. These rows are 2023-24. The page does not rewrite that year, and it does not print father's name, because `data.csv` does not have it.

There is no exam-date sheet here, so this page does not check clashes.

## Feed it a bad row

Use "Feed another CSV" and change one mark, or edit `data.csv` and refresh. A formative mark above 5, a total that does not match its parts, or a row count other than 48 is reported instead of being quietly fixed. The limit for one F cell is `LIMITS.formative` in `src/check.ts`.
