# MS Yug mark check

For Suresh Kumar, teacher, Govt. Middle School Yug, Zone Jib, Udhampur.
Register: class 8, session 2023-24, Sheet3 of the school result register.
Built 22 November 2026. The page runs on this computer and does not upload marks.

`data.csv` has 48 rows: eight students, six subjects each. Names, parent names, address, category, date of birth, Aadhaar, phone, and roll number are not in the file. `Student_01` is the first student on Sheet3. Marks are the ones on that sheet, including Dogri/Additional stored as 0 for every student. The link back to the sheet row is `local/id-map.csv`, which is not pushed.

`placeholders/fathers.csv` is not from the school. `Placeholder Father 01` through `Placeholder Father 08` are fixed stand-ins, the same on every run. Replace that file when Suresh Kumar gives the real names. Until then the card must not be read as if those names were collected.

## Run

```bash
npm install
npm run dev
```

Open the local address Vite prints. The first screen is the mark check for `data.csv`. That screen does not need a dropped file or the browser database.

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

**Make report cards** builds one PDF page per student in the school's layout. The student's own name stays blank. Father's name is the placeholder. Roll is the student id. Class is 8. The sheet grade is printed. The year is 2023-24. Dogri/Additional stays 0. The blank card's printed year is 2024-25; these pages keep the register session. The print date is the day the PDF is made, with the words "not copied from the school".

## Controls

**Drop a CSV or xlsx** reads the file in the browser and stores the mark rows in SQLite on this computer (`sql.js`). Nothing is uploaded. `data.csv` still works if you never drop a file. A header that is not on row 1 is reported. A Sheet3-style sheet (titles on rows 1–5, F1 labels on row 5, marks from row 6, merged subject groups) is turned into the same kind of rows as `data.csv`, with `Student_01` in sheet order. Duplicate rows are not merged. If the cluster workbook is dropped, Sheet1 and Sheet2 are skipped, and Aadhaar, phone, parent names, address, date of birth, category, and roll are not stored. **Back to data.csv** shows the committed file again and clears stored marks from the browser database.

**Exam pattern.** Register is F1–F6 (max 30) + co-curricular (max 20) + summative (max 50). The total and the grade are the ones on the sheet, and the rank is by that total. FA/SA uses the formative total and the summative already in the file, with weights 40 and 60 that belong to this control, not to the register. Custom weights do the same for formative, co-curricular, and summative, and the page shows what they sum to. U1 only, and U1/U2/T1/T2, are listed because those cycles were described. This file has no such columns, so those presets do not invent a total. Any preset other than the register says the grade on the sheet is not recomputed. There is no pass mark on this page.

**Exam schedule.** The list starts empty. There is no school timetable in the folder. Add a class, subject, date, and room. Leave the date blank and the row uses today's date, marked assumed. Two exams in one room on one date are flagged. The same class in two rooms on one date is flagged.

**Card layout.** Show or hide the father's placeholder, the F1–F6 columns, and the unused-subject note. All three start on, which is this page's school card. Hiding a section does not change the marks.

## What it gets wrong

It will not invent a missing mark, a grace mark, or a pass/fail the register does not already show. The grade is copied from the sheet. It is not a new scale.

A real zero on one paper, inside a subject other students sat, is kept as zero. Only a subject that is zero for every student is left out of the "out of" figure. If the school did teach Dogri and every child scored zero, this page would still call it unused.

The blank report card says 2024-25. These rows are 2023-24. The page does not rewrite that year. The father's name it prints is a placeholder, not a name from the register.

There is no exam-date sheet here. A clash is only between rows typed on this page. A blank date is not a date from the school.

## Feed it a bad row

Use "Feed another CSV" and change one mark, or edit `data.csv` and refresh. A formative mark above 5, a total that does not match its parts, or a row count other than 48 is reported instead of being quietly fixed. The limit for one F cell is `LIMITS.formative` in `src/check.ts`.
