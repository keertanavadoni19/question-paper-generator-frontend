# QP Generator — Frontend

AI-powered question paper generator for **JEE Main**, **NEET UG** and **KCET**.
Built with React 19, Vite, Tailwind CSS v4, React Router and Lucide icons.

It works without a backend: everything runs on mock data stored in your browser (localStorage).
When your backend is ready, set `VITE_USE_MOCK=false` in `.env` and the same screens call your API.

---

## 1. Run it

Requirements: **Node.js 20.19+ or 22.12+** (check with `node -v`).

```bash
npm install
npm run dev
```

Open http://localhost:5173 and log in with a demo account. The login page has buttons that fill these in for you:

| Role    | Email               | Password      |
|---------|---------------------|---------------|
| Admin   | admin@qpgen.com     | Admin@123     |
| Teacher | teacher@qpgen.com   | Teacher@123   |

Other scripts:

```bash
npm run build     # production build in dist/
npm run preview   # serve the production build locally
npm run lint      # ESLint
```

Optional: `cp .env.example .env` to change the API URL or turn mock mode off.

---

## 2. Features

| Area | What you can do |
|------|-----------------|
| **Login / Signup** | Email, password and role (Admin/Teacher), validation, password strength meter, "remember me", protected routes |
| **Roles** | Admin: everything plus Syllabus and Users. Teacher: their own papers, question bank and analytics |
| **Dashboard** | Stats, quick actions, recent papers, papers-per-week chart, exam shortcuts |
| **Exams** | JEE Main / NEET UG / KCET cards and a pattern comparison table (2026 patterns) |
| **Syllabus** *(Admin)* | Turn chapters on/off, rename, add or delete them, set the class (11/12) and weightage per exam and subject, reset to the default list |
| **Question bank** | Search and filter; add, edit or delete questions (MCQ or numerical, with a solution); preview AI-generated questions before saving them |
| **Generate paper** | 7-step wizard: subjects & details → chapters (All / None / Class 11 / Class 12, search) → concepts (automatic or manual) → questions per chapter → questions per type + difficulty → **1–8 sets** → summary, preview & generate. Selections are kept when moving between steps |
| **Concept selection** | Every Physics, Chemistry and Maths chapter has a **Select Concepts** button. Pick concepts **manually** (checkboxes, select all / clear) or let **Automatic** mode spread picks across the chapter based on its expected question count. Choices are kept per chapter and survive All / None / Class 11 / Class 12 |
| **Preview & edit** | Live document preview with real pages, page numbers, zoom and full screen; set tabs A–H; show/hide answers and solutions; select, edit on the page, duplicate, move up/down, drag to reorder, regenerate, delete and add questions; undo/redo and find & replace (all auto-saved); answer key panel |
| **Document formatting** | Toolbar tabs: **Numbering** (start at any number, continuous or per section, `1.` / `Q1.` / `Question 1.`), **Font** and **Paragraph** per document part (title, college, subject, exam details, instructions, section headings, questions, options, marks), **Page layout** (A4/A3/Letter/Legal, portrait/landscape, Word margin presets or custom, page border), **Header & footer** (college, university, department, exam, year, semester, subject code/name, date, faculty, logo, running header, footer, page numbers), **Insert** (page break, line, table, text/lists, image, instructions, watermark) |
| **Sections** | Rename headings, reorder sections, heading size, section instructions, marks per question, start on a new page |
| **Multiple sets** | Set A keeps the master order. Sets B–H shuffle question order and/or MCQ options, each with its own answer key |
| **Export** | PDF (print dialog → "Save as PDF"), editable **Word (.docx)**, or Print. Uses the same layout as the preview (fonts, numbering, margins, header/footer, page numbers, watermark). Choose sets, the paper or the answer key only, and optionally the key and solutions |
| **Analytics** | Weekly trend, papers by exam, difficulty and source donuts, subject and chapter usage, teacher activity (Admin) |
| **Users** *(Admin)* | Change role, activate/deactivate, remove |
| **Settings** | Edit your profile, see the backend mode, reset demo data |

Fully responsive: the sidebar becomes a drawer on mobile, tables scroll sideways, and dialogs open as bottom sheets.

---

## 3. Folder structure

```
qp-generator-frontend/
├── public/favicon.svg
├── src/
│   ├── components/
│   │   ├── auth/        AuthLayout, RoleSelector, PasswordStrength
│   │   ├── charts/      BarChart, DonutChart, HBarList (no chart library needed)
│   │   ├── layout/      Sidebar, Topbar
│   │   ├── paper/       ExamCard, QuestionForm, QuestionView, ExportDialog
│   │   └── ui/          Button, Input, Select, Textarea, Card, Badge, Modal, ConfirmDialog,
│   │                    Tabs, Toggle, StatCard, PageHeader, SearchInput, EmptyState, Loader, Alert
│   ├── context/         AuthContext (logged-in user), ToastContext (notifications)
│   ├── data/            exams.js (patterns), syllabus.js (chapters), questions.js (seed bank)
│   ├── hooks/           useAuthForm
│   ├── layouts/         DashboardLayout (sidebar + topbar + page)
│   ├── pages/           one file per screen
│   ├── routes/          AppRoutes, ProtectedRoute (login + role guard)
│   ├── services/        api.js + one service per feature (mock or real API)
│   ├── utils/           helpers.js, validation.js
│   ├── App.jsx, main.jsx, index.css
├── .env.example
├── index.html, vite.config.js, eslint.config.js, package.json
```

---

## 4. Backend: Supabase question bank (`backend/`)

The `backend/` folder is a small Node/Express API that connects the app to the **8 Supabase projects**
(the `Supabase_All_Databases/*.dump` backups). Secret keys stay on the server.

| Project | Holds |
|---|---|
| DB1 / DB2 | Chemistry class 11 / 12 questions |
| DB3 / DB4 | Mathematics class 11 / 12 questions |
| DB5 / DB6 | Biology class 12 / 11 questions (split into Botany / Zoology for NEET) |
| DB7 | Physics class 11 questions **+ app data**: `users`, `papers`, `settings`, `question_usage` |
| DB8 | Physics class 12 questions |

**Set up**

```bash
npm run server:install                 # installs backend/node_modules
cp backend/.env.example backend/.env   # then fill in the 8 project URLs + service_role keys and JWT_SECRET
npm run server:check                   # verifies every project (question counts, users table)
npm run server                         # API on http://localhost:5000/api
```

Then in the project root create `.env` with `VITE_USE_MOCK=false` (and `VITE_API_URL` if the API is not on
port 5000) and restart `npm run dev`. Log in with an account from the `users` table (bcrypt `password_hash`).

**What it does**

- On start it indexes every question (subject, class, chapter, topic, exam tags, type) from all 8 projects and
  refreshes every `INDEX_REFRESH_MINUTES`. Chapters/concepts that differ only in case or apostrophes are merged;
  "(Legacy / Removed Syllabus)" and "General" chapters are hidden (`INCLUDE_LEGACY_CHAPTERS`).
- Exam filters: JEE uses questions tagged JEE / JEE Main / NEET/JEE, NEET uses NEET-tagged, KCET may use any.
- **Generation** follows the wizard exactly: questions per chapter, per type (MCQ, assertion–reason, numerical)
  and the chosen concepts; concepts are rotated so they are covered evenly; recently used questions
  (`question_usage`) are avoided; duplicates and unusable rows (e.g. a non-numeric numerical answer) are skipped.
- Papers are saved in `papers` with `metadata.source = "qp-generator"`. Rows from other apps are never listed,
  changed or deleted. Syllabus changes (Syllabus page) are stored in `settings` (`qpg_syllabus_overrides`).
- Question bank: teachers may add questions (saved as *pending review*); only admins edit or delete.
- Sign-up is off unless `ALLOW_SIGNUP=true`; admins manage accounts on the Users page.
- The bank has no difficulty field, so the difficulty mix is saved with the paper but not used for picking.
- Question text may contain LaTeX (`$…$`) and images (`{{IMG::url}}`): the preview, PDF and Print render them
  (KaTeX); Word exports embed the images and write formulas as readable text (e.g. `(q²)/(2ε₀A²)`).

| Method | Endpoint | Used by |
|--------|----------|---------|
| GET | `/health` | Status of each project and the index (no login) |
| POST | `/auth/login` `{ email, password, role }` → `{ user, token }`, `/auth/signup` | Login, Signup |
| GET/PATCH/DELETE | `/users`, `/users/:id` | Users, Settings |
| GET | `/syllabus/:examId` → `{ [subjectId]: Chapter[] }` (with `concepts`, `counts`, `conceptCounts`) | Generate wizard, Syllabus |
| GET | `/chapters/:subjectId` | Question forms and filters |
| PUT / POST | `/syllabus/:examId/:subjectId`, `/syllabus/:examId/reset` | Syllabus (admin) |
| GET | `/questions?subjectId=&examId=&chapter=&type=&search=&limit=&offset=` → `{ items, total }`, `/questions/stats` | Question bank, editor |
| POST / PUT / DELETE | `/questions`, `/questions/:id` | Question bank |
| POST | `/papers/generate` (wizard config) → Paper | Generate |
| GET/POST/PUT/DELETE | `/papers`, `/papers/:id` | Papers, Preview |
| POST | `/papers/:id/questions/:qid/regenerate` | Preview |
| GET | `/analytics` | Dashboard, Analytics |

**Generation config** (from the wizard): `sections[] = { subjectId, chapters[], chapterCounts: { chapter: n },
typeCounts: { mcq, assertion_reason, numerical }, concepts: { chapter: { mode, selected[] } }, mcq, numerical }`.

**Paper layout.** Formatting is stored on the paper as `paper.layout` (numbering, fonts, page setup,
header/footer, watermark, section settings and inserted blocks; see `src/services/paperLayout.js`).
Your backend only has to save and return this field with the paper (`PUT /papers/:id`). Question
numbers, marks (`question.marks` / `question.negative`) and set orders live in the existing fields.

**Concepts.** Each chapter returned by `GET /syllabus/:examId` has `concepts: string[]`, and each
question may have a `concept` (one of its chapter's concepts). In the `POST /papers/generate` config,
every section carries the chosen concepts per chapter:

```json
{ "subjectId": "physics", "chapters": ["Laws of Motion", "Kinematics"], "mcq": 20, "numerical": 5,
  "concepts": { "Laws of Motion": { "mode": "manual", "selected": ["Newton's Second Law", "Impulse"] },
                "Kinematics":     { "mode": "auto",   "selected": ["Projectile Motion", "Graphs of Motion"] } } }
```

Chapters missing from `concepts` use all their concepts. For `auto`, `selected` is what the frontend
picked (see `src/utils/concepts.js`); the backend may use it as-is or apply its own selection.

The shape of a **Paper**, **Question** and the generation **config** is documented by the mock
implementation in `src/services/paperService.js` (`buildPaper`). Your backend should return the same fields.

---

## 5. Notes about mock mode

- Data is saved in your browser's localStorage. **Settings → Reset demo data** clears it.
- The offline "AI" writes numeric-variant questions for many Physics, Chemistry and Maths chapters.
  If the bank and templates can't fill a section (e.g. a full 180-question NEET paper), it adds
  **"Needs review" draft** questions and says so on the paper. Edit them, or connect the real AI backend.
- Exam patterns live in `src/data/exams.js`. Update them there if NTA or KEA change the pattern.
