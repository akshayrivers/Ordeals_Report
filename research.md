# Research

Person: Suresh Kumar, teacher.
Place: MS Yug, Udhampur, Jammu and Kashmir. This is my dad's school, within walking distance.
Seen: 21–22 November 2026, on the school's own computer, from how exam schedules, subject mark sheets, exam patterns, and student report cards are prepared there.
Status: this file locks the problem I saw. The tool covers three jobs on that same desk: check the mark sheet, check exam clashes, and print a report card in the school's layout. Order of build is in `PLAN.md`. `data.csv` is a name-stripped copy of rows I collected. The marks themselves are the real ones.

## Problem

Suresh Kumar prepares exam dates, mark sheets, and printed result cards on the school computer, mostly in Excel. Those workbooks come in with the header row in the wrong place, inconsistent column names, blank or unmerged cells, and student names or roll numbers that do not match across sheets. A score can sit above the maximum for that component, a cell can be left empty, and the same student can appear twice and be merged by mistake. The school does not use one assessment scheme: a cycle may be only U1, or a mix such as U1, U2, T1, T2, or FA and SA, each with its own weight, pass rule, grade, and rank. Totals, ranks, and the printable card are then fixed by hand, so one bad cell becomes a wrong result on paper.

## Existing solutions that do not fit him

### 1. The Excel workbooks already on the school computer

This is the workflow he uses now. Formulas do not survive a shifted header or a second row for the same roll number. A different weightage means rewriting those formulas. The report card is cell formatting, so showing a different breakdown means rebuilding the sheet. That is the breakdown I saw. Staying in those sheets does not give him a check he can trust before he prints.

### 2. A hosted school portal that stores marks online and prints cards

School ERPs and online report-card sites assume a clean template, an account, and marks leaving the building. His constraint is the opposite: the sheets stay on the school machine, and they are already messy. A full portal does not check tomorrow's sheet, and it is more software than one teacher will switch to for this job. I have not yet named a specific product I opened and read. If I looked at one, its name goes here before submission.

## Sources I actually read

Not written yet. Two sources I opened myself go under this heading, each with a three-line note in my own words. This section stays empty until I paste them. An assistant must not invent citations here.

1. Title, link, and the date I opened it.
   - What it argued, in my words.
   - What I could use for Suresh Kumar.
   - Why it still does not fit this school.

2. Title, link, and the date I opened it.
   - What it argued, in my words.
   - What I could use for Suresh Kumar.
   - Why it still does not fit this school.

## What is known, and what is still a visit

Known from the discussion on 21–22 November 2026: the person is Suresh Kumar, a teacher at MS Yug; the pain is messy Excel, schedules checked by eye, weightage that changes by exam cycle, and report cards formatted by hand. Student marks, schedules, and generated files stay on that computer. Nothing in this repo calls out to a server.

The real result file and the report-card layout stay in `local/` and are not pushed. The committed `data.csv` is those rows with names replaced by `Student_01`, `Student_02`, and so on. Every mark, blank, and odd value stays as it was on the sheet. Invented or randomised marks do not go in `data.csv`.

Not in this file yet: three things he said, the thing that surprised me, and the photos. WhatsApp shots of the sheets go in `evidence/` once names and phone numbers are cropped. They show the visit. They are not the two sources under the heading above. Those sources are still for me to write, from two things I actually opened.
