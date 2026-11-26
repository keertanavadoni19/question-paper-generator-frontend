// In-memory index of every question in all Supabase projects (no question text, just
// subject / class / chapter / topic / exams / type). It powers the syllabus, concept lists,
// availability counts and question picking without scanning the databases on every request.
import { DB_SUBJECT, KIND_OF, KINDS, biologyPart, chapterKey, examAllows, examKinds, isLegacyChapter, normaliseTags, slug } from "./normalize.js";
import { getExam } from "../../src/data/exams.js";

const INDEX_COLUMNS = "id,subject,klass,chapter,topic,exams,q_type";

export class QuestionIndex {
  constructor({ clients, config, log = console }) {
    this.clients = clients; // Map<dbId, SupabaseClient>
    this.config = config;
    this.log = log;
    this.entries = [];
    this.byId = new Map();
    this.byKey = new Map();
    this.chapters = new Map(); // key "Subject|chapter key" → chapter info
    this.status = { state: "idle", databases: {}, loadedAt: null, error: null };
    this.loading = null;
  }

  // Loads (or reloads) every project. Resolves when the index is ready.
  load() {
    if (this.loading) return this.loading;
    this.status = { ...this.status, state: this.entries.length ? "refreshing" : "loading", error: null };
    this.loading = (async () => {
      const started = Date.now();
      const results = await Promise.allSettled([...this.clients.entries()].map(([db, client]) => this.loadDb(db, client)));
      const entries = [];
      const databases = {};
      results.forEach((r, i) => {
        const db = [...this.clients.keys()][i];
        if (r.status === "fulfilled") {
          entries.push(...r.value);
          databases[db] = { ok: true, questions: r.value.length };
        } else {
          databases[db] = { ok: false, error: r.reason?.message ?? String(r.reason) };
          this.log.error?.(`[index] DB${db} failed: ${databases[db].error}`);
          // keep the previous data for this project if we had it
          entries.push(...this.entries.filter((e) => e.db === db));
        }
      });
      this.setEntries(entries);
      const failed = Object.values(databases).filter((d) => !d.ok).length;
      this.status = {
        state: failed === this.clients.size ? "error" : "ready",
        databases,
        loadedAt: new Date().toISOString(),
        seconds: Math.round((Date.now() - started) / 100) / 10,
        error: failed ? `${failed} of ${this.clients.size} databases could not be read` : null,
      };
      this.log.info?.(`[index] ${entries.length} questions from ${this.clients.size - failed}/${this.clients.size} databases in ${this.status.seconds}s`);
      return this;
    })().finally(() => { this.loading = null; });
    return this.loading;
  }

  async ready() {
    if (this.status.state === "idle") await this.load();
    else if (this.status.state === "loading") await this.loading;
    if (this.status.state === "error" && !this.entries.length) throw new Error(`Question bank unavailable: ${this.status.error}`);
    return this;
  }

  async loadDb(db, client) {
    const rows = [];
    for (let from = 0; ; ) {
      const { data, error } = await client.from("questions").select(INDEX_COLUMNS).order("id").range(from, from + this.config.pageSize - 1);
      if (error) throw new Error(error.message);
      if (!data?.length) break;
      rows.push(...data);
      from += data.length;
    }
    return rows.map((row) => this.toEntry(row, db)).filter(Boolean);
  }

  toEntry(row, db) {
    const kind = KIND_OF[row.q_type];
    if (!kind || !row.subject || !row.chapter) return null;
    return {
      id: row.id,
      db,
      subject: row.subject,
      klass: String(row.klass ?? ""),
      chapterName: String(row.chapter).trim(),
      key: `${row.subject}|${chapterKey(row.chapter)}`,
      topic: String(row.topic || "General").trim(),
      tags: normaliseTags(row.exams),
      kind,
      qType: row.q_type,
    };
  }

  setEntries(entries) {
    this.entries = entries;
    this.byId = new Map(entries.map((e) => [e.id, e]));
    this.byKey = new Map();
    for (const e of entries) {
      const list = this.byKey.get(e.key);
      if (list) list.push(e);
      else this.byKey.set(e.key, [e]);
    }
    // Concepts (topics) also differ in case/apostrophes between projects: merge them and
    // show the most common spelling.
    const topicVariants = new Map();
    for (const e of entries) {
      e.topicRaw ??= e.topic;
      const k = `${e.key}|${chapterKey(e.topicRaw)}`;
      const m = topicVariants.get(k) ?? new Map();
      m.set(e.topicRaw, (m.get(e.topicRaw) ?? 0) + 1);
      topicVariants.set(k, m);
    }
    const topicName = new Map([...topicVariants].map(([k, m]) => [k, [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]]));
    for (const e of entries) e.topic = topicName.get(`${e.key}|${chapterKey(e.topicRaw)}`);

    const chapters = new Map();
    for (const e of entries) {
      let c = chapters.get(e.key);
      if (!c) {
        c = { key: e.key, subject: e.subject, names: new Map(), klass: new Map(), dbs: new Map(), total: 0 };
        chapters.set(e.key, c);
      }
      c.total += 1;
      c.names.set(e.chapterName, (c.names.get(e.chapterName) ?? 0) + 1);
      c.klass.set(e.klass, (c.klass.get(e.klass) ?? 0) + 1);
      c.dbs.set(`${e.subject}|${e.klass}`, e.db);
    }
    for (const c of chapters.values()) {
      const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      c.name = top(c.names); // most common spelling
      c.dbNames = [...c.names.keys()];
      c.classLevel = Number(top(c.klass)) || 11;
      c.legacy = isLegacyChapter(c.name);
    }
    this.chapters = chapters;
    // subject+class → project (for adding new questions)
    this.shards = new Map();
    for (const e of entries) {
      const k = `${e.subject}|${e.klass}`;
      const counts = this.shards.get(k) ?? new Map();
      counts.set(e.db, (counts.get(e.db) ?? 0) + 1);
      this.shards.set(k, counts);
    }
  }

  shardFor(subject, klass) {
    const counts = this.shards.get(`${subject}|${klass}`);
    return counts ? [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;
  }

  add(row, db) {
    const e = this.toEntry(row, db);
    if (!e) return;
    this.setEntries([...this.entries.filter((x) => x.id !== e.id), e]);
  }

  remove(id) {
    if (this.byId.has(id)) this.setEntries(this.entries.filter((e) => e.id !== id));
  }

  // ── Syllabus ──────────────────────────────────────────────────
  // Chapters for one exam subject, with concepts and availability counts.
  // `overrides` (from the Syllabus page): { [chapterId]: { active, weightage, classLevel, name } } + { _custom: Chapter[] }
  chaptersFor(examId, subjectId, overrides = {}) {
    const exam = examId === "any" ? { id: "any" } : getExam(examId); // "any" = every exam (question bank forms)
    const kinds = examId === "any" ? KINDS : examKinds(examId);
    const dbSubject = DB_SUBJECT[subjectId];
    if (!exam || !dbSubject) return [];
    const list = [];
    for (const c of this.chapters.values()) {
      if (c.subject !== dbSubject) continue;
      if (c.legacy && !this.config.includeLegacyChapters) continue;
      const part = dbSubject === "Biology" ? biologyPart(c.name) : subjectId;
      if ((subjectId === "botany" || subjectId === "zoology") && part !== subjectId) continue;
      list.push({ c, part });
    }
    const withCounts = list
      .map(({ c, part }) => {
        const counts = { mcq: 0, assertion_reason: 0, numerical: 0, total: 0 };
        const conceptCounts = {};
        for (const e of this.byKey.get(c.key) ?? []) {
          if (!kinds.includes(e.kind) || !examAllows(examId, e.tags)) continue;
          counts[e.kind] += 1;
          counts.total += 1;
          const cc = (conceptCounts[e.topic] ??= { mcq: 0, assertion_reason: 0, numerical: 0, total: 0 });
          cc[e.kind] += 1;
          cc.total += 1;
        }
        return { c, part, counts, conceptCounts };
      })
      .filter((x) => x.counts.total >= this.config.minChapterQuestions);

    // Weightage from how many questions the bank has (top third = high)
    const sorted = withCounts.map((x) => x.counts.total).sort((a, b) => b - a);
    const cut = (q) => sorted[Math.floor((sorted.length - 1) * q)] ?? 0;
    const hi = cut(1 / 3);
    const lo = cut(2 / 3);

    const chapters = withCounts.map(({ c, part, counts, conceptCounts }) => {
      const id = `${subjectId}-${slug(c.name)}`;
      const o = overrides[id] ?? {};
      return {
        id,
        name: o.name?.trim() || c.name,
        bankName: c.name,
        classLevel: Number(o.classLevel) || c.classLevel,
        weightage: o.weightage ?? (counts.total >= hi ? "high" : counts.total > lo ? "medium" : "low"),
        active: o.active ?? true,
        source: subjectId === "biology" ? part : subjectId,
        concepts: Object.entries(conceptCounts).sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0])).map(([t]) => t),
        counts,
        conceptCounts,
      };
    });
    const custom = (overrides._custom ?? []).map((ch) => ({ ...ch, source: "custom", concepts: [], counts: { mcq: 0, assertion_reason: 0, numerical: 0, total: 0 }, conceptCounts: {} }));
    return [...chapters, ...custom].sort((a, b) => a.classLevel - b.classLevel || a.name.localeCompare(b.name));
  }

  syllabusFor(examId, overrides = {}) {
    const exam = getExam(examId);
    if (!exam) return {};
    return Object.fromEntries(exam.subjects.map(({ subjectId }) => [subjectId, this.chaptersFor(examId, subjectId, overrides[subjectId] ?? {})]));
  }

  // Index entries usable for one chapter of an exam (optionally one kind / some topics).
  candidates({ examId, subjectId, chapter, kind, topics }) {
    const key = `${DB_SUBJECT[subjectId]}|${chapterKey(chapter.bankName ?? chapter.name)}`;
    const topicSet = topics?.length ? new Set(topics) : null;
    return (this.byKey.get(key) ?? []).filter(
      (e) => (!kind || e.kind === kind) && examAllows(examId, e.tags) && examKinds(examId).includes(e.kind) && (!topicSet || topicSet.has(e.topic))
    );
  }
}
