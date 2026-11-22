# Plan

Window: about 6 hours on 22 November 2026.
Place and person stay fixed: Suresh Kumar, teacher, MS Yug, Udhampur.
Stack: TypeScript and Vite. The app runs locally. It does not upload marks. Libraries for CSV and PDF are added when that step starts.

## What we are building

Four jobs, on one local page. The page does not upload marks.

1. **Ingest a messy sheet.** `data.csv` is still enough to open the page. Dropping a `.csv` or `.xlsx` is an extra path. The header does not have to be on row 1. A Sheet3-style file (titles on rows 1–5, marks from row 6, merged subject groups) is recognised. A duplicate row, or two rows for the same student and subject that disagree, is flagged and not merged. Accepted rows are stored in SQLite in the browser (`sql.js`). There is no server. If the cluster workbook is dropped, Sheet1 and Sheet2 are not stored. Aadhaar, phone, parent names, address, date of birth, category, and roll are not written into the database.
2. **Exam clashes.** There is still no date or room sheet in `local/`. The page does not ship a timetable or a holiday calendar. The user adds a class, subject, date, and room. A blank date is the day the row is added, and it is labeled as generated, not as a date from the school. Two exams in the same room on the same date are flagged. The same class in two rooms at the same time is flagged.
3. **Exam pattern.** The preset that matches this register is F1–F6 out of 5 (max 30), co-curricular out of 20, and summative out of 50. On that preset the total is the grand total on the sheet, the grade is the grade on the sheet, and the rank is by that total. The page also offers U1 only, U1/U2/T1/T2, FA/SA, and custom weights, and it shows the sum of the weights. FA/SA and custom weights use marks already in the file. U1, U2, T1, and T2 are not columns in this file, so those presets do not invent marks or a total. No preset invents a pass mark or a new grade scale. When the preset is not the register pattern, the page says the grade on the sheet is not recomputed.
4. **Report card PDF.** One page per student, in the school layout. The father's line uses a stable placeholder from `placeholders/fathers.csv`. Those labels are not names from the school. The year stays 2023-24, the register session. The print date is the day the PDF is made, and it is labeled as generated. A layout panel shows or hides the father's name, the F1–F6 columns, and the unused-subject note. Dragging boxes is not part of this page. The default is the school card with those sections shown.

The mark check still reads `data.csv`, flags a row that breaks the maxima or the stored totals, reports the unused language subject stored as zero, and shows each student's subject totals, grand total, and the grade already written on the sheet.

Accounts, cloud sync, attendance, and a school ERP stay out.

## What is actually in `local/`

Checked 22 November 2026. Nothing in this section is copied from a student row.

| File | What it is |
| --- | --- |
| `Copy of Revised Result Register cluster HS MOUD 2024.xlsx` | Class 8 result register, session 2023-24. Three sheets. Sheet1 and Sheet2 are the whole cluster (about 9,700 rows, many schools). Sheet3 is only Govt. Middle School Yug, Zone Jib: 8 students, rows 6–13. |
| `REPORT CARD 1ST TO 8TH.docx` | Blank card for Govt. Middle School Yug (Zone Jib). The year printed on the blank is 2024-25. |
| `WhatsApp Image 2026-11-21 at 18.34.38.jpeg` | Photo of that same blank card, taken 21 November 2026 at 18:34. |

Sheet3 and the eight Yug rows on Sheet1 hold the same marks. The public file is built only from Sheet3. Sheet1 and Sheet2 stay in `local/` and are never written out. They contain Aadhaar numbers, phone numbers, parent names, addresses, and dates of birth.

There is no exam-date or room sheet in `local/`. The page does not invent a holiday calendar or a filled timetable. A missing print date, or an exam row with no date, uses the day the PDF or the row is generated, and the page says so.

## How Sheet3 is laid out

Rows 1–2 are titles. Row 3 names the subject across a merged block. Row 4 names the columns. Row 5 names F1–F6 under each subject. Student rows start at row 6. The footer has the typo "Cheched By;".

Columns A–P are identity. Columns Q onward repeat the same block six times:

| Subject on the register | Starts at | On the report card |
| --- | --- | --- |
| English | Q | ENGLISH |
| Mathematics | AA | MATHEMATICS |
| Science | AK | SCIENCE/EVS |
| Social Science | AU | SOCIAL SCIENCE |
| Urdu/Hindi | BE | HINDI/URDU |
| Kashmiri/Dogri/Punjabi | BO | DOGRI/ADDITIONAL |

Each block is F1, F2, F3, F4, F5, F6, formative total (max 30), co-curricular (max 20), summative (max 50), subject total (max 100). After the six blocks: grand total (BY), grade (BZ), remarks (CA).

Measured on the 8 Yug students:

- 48 subject rows, and every one of them has a number in each mark cell.
- Formative total equals F1+F2+F3+F4+F5+F6 on all 48.
- Subject total equals formative + co-curricular + summative on all 48.
- Grand total equals the six subject totals on all 8.
- No mark sits above its maximum.
- Grades already on the sheet: one A+, four A, three B. The remarks column is empty on all 8.
- Kashmiri/Dogri/Punjabi is 0 in every cell for all 8 students. The other five subjects have no zero cells. Formative marks that are not that subject are only 3, 4, or 5, which is expected because each F is out of 5.
- Dates of birth are Excel serial numbers, not calendar dates.

The zero language column is the gap to keep. Putting a zero into the grand total is not the same as the child sitting that paper. A percentage that divides by 600 treats a paper that was not given as a score of zero.

## How `data.csv` is produced

Marks are copied. They are not randomised, rounded, or filled in. One student becomes six rows, one per subject, so the file has 48 real entries from the eight students on Sheet3.

Steps, in order:

1. Open the xlsx from `local/` and read Sheet3 only, cached cell values.
2. Skip rows 1–5. Read a row only when the name cell (column J) is non-empty. Expect 8 rows. Stop if the count is different.
3. Give ids in sheet order: the first of those rows is `Student_01`, then `Student_02`, through `Student_08`. Same order as the register, so a row can be found again by counting down Sheet3.
4. Write `local/id-map.csv` with `student_id`, source row number, and the original roll. This file stays in `local/` and is the key for the call. It is not pushed.
5. For each student, write six CSV rows in the subject order above. Copy F1–F6, the formative total, co-curricular, summative, and the subject total as stored, including the zeros.
6. Repeat the sheet's grade and grand total on each of that student's six rows. Leave `remark` empty, because the sheet's remarks cell is empty.
7. Do not write name, father's name, mother's name, address, category, date of birth, Aadhaar, phone, admission number, registration number, or board roll.
8. Before saving, check the file: 48 data rows, headers spelled as below, no 12-digit number, no phone-shaped number, the Dogri block still all zeros, and each formative total still equal to its six F cells. If a check fails, do not write `data.csv`.

Header:

```
student_id,class,session,subject,f1,f2,f3,f4,f5,f6,fa_total,co_curricular,summative,subject_total,grand_total,grade,remark,source
```

`class` is `8`. `session` is `2023-24`, taken from the register title. `source` is `sheet3` plus the Excel row, so `sheet3:6` for Student_01. The blank card says 2024-25. The CSV keeps 2023-24 and does not rewrite the card's printed year.

`data.csv` is enough for the app to run. A dropped xlsx or csv is optional. Identity columns from that drop are not stored. The xlsx in `local/` is not required at runtime.

## How the app reads `data.csv`

1. Read the CSV. Reject the run if the header differs or the row count is not 48.
2. On each row, mark it unsafe when any of these is true: `student_id` is blank, a mark cell is blank, an F cell is outside 0–5, co-curricular is outside 0–20, summative is outside 0–50, `fa_total` is not the sum of F1–F6, or `subject_total` is not formative + co-curricular + summative.
3. Group by `student_id`. The student's grand total on the sheet must equal the sum of that student's six `subject_total` values. Flag the student when it does not.
4. A subject that is 0 on every row is reported as unused. It stays in the file and on the card as 0. It is left out of the "out of" figure when a percentage is shown, so eight unused papers are not treated as eight failed papers. The grade printed is the grade cell from the sheet. The app does not invent a new grade scale or a pass mark the sheet does not contain.
5. The first screen is this list: student, the six subject totals, grand total, grade, and any unsafe reason. That is the mark-check output.
6. The PDF step uses the same rows and the name map in the table above. It copies the blank card's layout: name line left blank, father's name filled from `placeholders/fathers.csv` (a stand-in, not a name from the sheet), class, roll line shows the student id, the six subjects, F1–F6, curricular activities, summative, total, grand total, the sheet grade, empty result line unless a remark exists. The year is the register session, 2023-24. The print date is the day the PDF is generated and is labeled that way. Incharge and Headmaster stay as labels with no signature. The layout panel can hide the father's name, the F1–F6 columns, or the unused-subject note.
7. Clash checking is not read from this file. The schedule starts empty. Dates the user leaves blank are the generation date, labeled as such.

WhatsApp images go in `evidence/` after phone numbers and student names are cropped. They support the visit. They are not the two sources in `research.md`.

## What only I can do

These stay in my words. The assistant scaffolds headings and does not fill them.

- Two sources in `research.md`, with a three-line note each.
- `fieldwork.md`: 20 minutes at the school, two timestamped photos, Suresh Kumar's role, three things he said, one surprise.
- `data.csv`: at least 20 real rows from the file in `local/`, names removed, marks unchanged. A short note of how they were collected, including gaps and odd values.
- `reflection.md`: half a page, written without AI.
- A 3-minute screen recording of the tool on the real file, linked from the README.

## Order of work

1. Confirm the single output and paste the two sources. First commit is `research.md` only, so the problem is locked before features creep.
2. Write `fieldwork.md` and add `data.csv` plus the two photos. Commit those together. Commit message in my words, about the visit, not about "scaffolding".
3. Add the Vite app that reads `data.csv` and prints the unsafe rows and the totals. Commit when the first real row shows a total.
4. Run it on the real file. Put the actual output in the README, plus place, person, date, how to run it, and one thing the tool gets wrong. Commit that.
5. Record the screen. Link it. I write `reflection.md` myself and commit it last.

Aim for at least five commits across the day. No single commit at the end that adds the whole app.

## Build shape

```
research.md
PLAN.md
AGENTS.md
fieldwork.md          # I write the visit
data.csv              # I paste real rows
placeholders/fathers.csv  # stand-in father labels, not from the school
photos/               # two timestamped photos, no student names visible
src/                  # Vite + TypeScript
README.md             # how to run, real output, what it gets wrong
reflection.md         # I write this
ai-chats/             # exports of the chats used
```

The columns are fixed from Sheet3. They are listed under "How `data.csv` is produced". The weight on this register is already a sum: six formatives out of 5, co-curricular out of 20, summative out of 50. There is no separate U1/U2 weight on this file. The U1, U1/U2/T1/T2, FA/SA, and custom controls are presets on the page. Only FA/SA and custom weights are computed from marks this file already has. They are not a second scale copied from the school.

The README must say the tool should not be trusted to invent a missing mark, to decide grace the school has not written down, or to replace his look at the printed card.

## Call rehearsal

Be ready to open one row and say where I was when I wrote it down, repeat the remark from Suresh Kumar that changed the plan, change one threshold in the code while sharing the screen, and say what the tool must not be trusted for.
