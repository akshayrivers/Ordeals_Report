# Plan

Window: about 6 hours on 22 November 2026.
Place and person stay fixed: Suresh Kumar, teacher, MS Yug, Udhampur.
Stack: TypeScript and Vite. The app runs locally. It does not upload marks. Libraries for CSV and PDF are added when that step starts.

## What we are building

You chose all three jobs. They ship in this order, each one running before the next starts.

1. **Mark check.** Read `data.csv` from Sheet3. Flag a row that breaks the maxima or the stored totals. Report the unused language subject that is stored as zero. Show each student's subject totals, grand total, and the grade already written on the sheet.
2. **Exam clashes.** No date or room sheet is in `local/` yet. This starts when that sheet is added. Dates are not invented.
3. **Report card PDF.** Match the blank card in `local/`. Same fields, same subject order as that card. Dragging and resizing boxes waits until a PDF of that layout already opens.

Accounts, cloud sync, attendance, and a school ERP stay out. SQLite is added only if the mark check needs it to finish. The page runs on the machine in front of us and does not upload marks.

## What is actually in `local/`

Checked 22 November 2026. Nothing in this section is copied from a student row.

| File | What it is |
| --- | --- |
| `Copy of Revised Result Register cluster HS MOUD 2024.xlsx` | Class 8 result register, session 2023-24. Three sheets. Sheet1 and Sheet2 are the whole cluster (about 9,700 rows, many schools). Sheet3 is only Govt. Middle School Yug, Zone Jib: 8 students, rows 6–13. |
| `REPORT CARD 1ST TO 8TH.docx` | Blank card for Govt. Middle School Yug (Zone Jib). The year printed on the blank is 2024-25. |
| `WhatsApp Image 2026-11-21 at 18.34.38.jpeg` | Photo of that same blank card, taken 21 November 2026 at 18:34. |

Sheet3 and the eight Yug rows on Sheet1 hold the same marks. The public file is built only from Sheet3. Sheet1 and Sheet2 stay in `local/` and are never written out. They contain Aadhaar numbers, phone numbers, parent names, addresses, and dates of birth.

There is no exam-date or room sheet in `local/`. The clash check waits until that sheet exists. Dates are not invented.

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

`data.csv` is the file the app reads. The xlsx is not an input at runtime.

## How the app reads `data.csv`

1. Read the CSV. Reject the run if the header differs or the row count is not 48.
2. On each row, mark it unsafe when any of these is true: `student_id` is blank, a mark cell is blank, an F cell is outside 0–5, co-curricular is outside 0–20, summative is outside 0–50, `fa_total` is not the sum of F1–F6, or `subject_total` is not formative + co-curricular + summative.
3. Group by `student_id`. The student's grand total on the sheet must equal the sum of that student's six `subject_total` values. Flag the student when it does not.
4. A subject that is 0 on every row is reported as unused. It stays in the file and on the card as 0. It is left out of the "out of" figure when a percentage is shown, so eight unused papers are not treated as eight failed papers. The grade printed is the grade cell from the sheet. The app does not invent a new grade scale or a pass mark the sheet does not contain.
5. The first screen is this list: student, the six subject totals, grand total, grade, and any unsafe reason. That is the mark-check output.
6. The PDF step uses the same rows and the name map in the table above. It copies the blank card's layout: name line, father's name left blank (we do not have it in `data.csv`), class, roll line shows the student id, the six subjects, F1–F6, curricular activities, summative, total, grand total, the sheet grade, empty result line unless a remark exists. Incharge and Headmaster stay as labels with no signature.
7. Clash checking is not part of this file. It starts only after a real date and room sheet is in `local/`.

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
photos/               # two timestamped photos, no student names visible
src/                  # Vite + TypeScript
README.md             # how to run, real output, what it gets wrong
reflection.md         # I write this
ai-chats/             # exports of the chats used
```

The columns are fixed from Sheet3. They are listed under "How `data.csv` is produced". The weight on this register is already a sum: six formatives out of 5, co-curricular out of 20, summative out of 50. There is no separate U1/U2 weight on this file.

The README must say the tool should not be trusted to invent a missing mark, to decide grace the school has not written down, or to replace his look at the printed card.

## Call rehearsal

Be ready to open one row and say where I was when I wrote it down, repeat the remark from Suresh Kumar that changed the plan, change one threshold in the code while sharing the screen, and say what the tool must not be trusted for.
