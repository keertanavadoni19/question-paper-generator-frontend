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
| **Generate paper** | Exam → title, institute, duration, instructions → subjects and chapters → full pattern or custom counts → difficulty mix → **1–8 sets** → AI generation with progress |
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

## 4. Connecting your backend

1. Create `.env`:
   ```
   VITE_API_URL=http://localhost:5000/api
   VITE_USE_MOCK=false
   ```
2. Restart `npm run dev`.
3. Every service in `src/services/` calls these endpoints when mock mode is off.
   The token from login is sent as `Authorization: Bearer <token>`.

| Method | Endpoint | Used by |
|--------|----------|---------|
| POST | `/auth/login` `{ email, password, role }` → `{ user, token }` | Login |
| POST | `/auth/signup` `{ fullName, email, password, role }` | Signup |
| GET/PATCH/DELETE | `/users`, `/users/:id` | Users, Settings |
| GET | `/syllabus/:examId` → `{ [subjectId]: Chapter[] }` | Syllabus, Generate |
| PUT | `/syllabus/:examId/:subjectId` `{ chapters }` | Syllabus |
| POST | `/syllabus/:examId/reset` | Syllabus |
| GET/POST | `/questions?subjectId=&examId=…`, `/questions` | Question bank |
| PUT/DELETE | `/questions/:id` | Question bank |
| POST | `/papers/generate` (config) → Paper | Generate (**your AI goes here**) |
| GET/POST | `/papers`, `/papers/:id` | Papers, Preview |
| PUT/DELETE | `/papers/:id` | Preview (auto-save), Papers |
| POST | `/papers/:id/questions/:qid/regenerate` → Question | Preview |
| GET | `/analytics` | Dashboard, Analytics |

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
