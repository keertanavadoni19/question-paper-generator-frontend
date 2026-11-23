import { EXAMS, SUBJECT_SOURCES } from "./exams";

// Master chapter list: [chapter name, class (11 / 12), default weightage]
const CHAPTERS = {
  physics: [
    ["Units and Measurements", 11, "low"],
    ["Kinematics", 11, "high"],
    ["Laws of Motion", 11, "high"],
    ["Work, Energy and Power", 11, "medium"],
    ["Rotational Motion", 11, "high"],
    ["Gravitation", 11, "medium"],
    ["Properties of Solids and Liquids", 11, "medium"],
    ["Thermodynamics", 11, "medium"],
    ["Kinetic Theory of Gases", 11, "low"],
    ["Oscillations and Waves", 11, "medium"],
    ["Electrostatics", 12, "high"],
    ["Current Electricity", 12, "high"],
    ["Magnetic Effects of Current and Magnetism", 12, "high"],
    ["Electromagnetic Induction and AC", 12, "medium"],
    ["Electromagnetic Waves", 12, "low"],
    ["Optics", 12, "high"],
    ["Dual Nature of Matter and Radiation", 12, "medium"],
    ["Atoms and Nuclei", 12, "medium"],
    ["Semiconductor Electronics", 12, "medium"],
  ],
  chemistry: [
    ["Some Basic Concepts of Chemistry", 11, "medium"],
    ["Atomic Structure", 11, "medium"],
    ["Chemical Bonding and Molecular Structure", 11, "high"],
    ["Chemical Thermodynamics", 11, "medium"],
    ["Equilibrium", 11, "high"],
    ["Redox Reactions", 11, "low"],
    ["Organic Chemistry – Basic Principles", 11, "high"],
    ["Hydrocarbons", 11, "medium"],
    ["Solutions", 12, "medium"],
    ["Electrochemistry", 12, "high"],
    ["Chemical Kinetics", 12, "high"],
    ["p-Block Elements", 12, "medium"],
    ["d- and f-Block Elements", 12, "medium"],
    ["Coordination Compounds", 12, "high"],
    ["Haloalkanes and Haloarenes", 12, "medium"],
    ["Alcohols, Phenols and Ethers", 12, "medium"],
    ["Aldehydes, Ketones and Carboxylic Acids", 12, "high"],
    ["Amines", 12, "medium"],
    ["Biomolecules", 12, "low"],
  ],
  mathematics: [
    ["Sets, Relations and Functions", 11, "medium"],
    ["Complex Numbers", 11, "medium"],
    ["Trigonometry", 11, "medium"],
    ["Permutations and Combinations", 11, "medium"],
    ["Binomial Theorem", 11, "medium"],
    ["Sequences and Series", 11, "high"],
    ["Straight Lines and Conic Sections", 11, "high"],
    ["Limits and Derivatives", 11, "medium"],
    ["Statistics", 11, "low"],
    ["Matrices and Determinants", 12, "high"],
    ["Continuity and Differentiability", 12, "high"],
    ["Applications of Derivatives", 12, "high"],
    ["Integral Calculus", 12, "high"],
    ["Differential Equations", 12, "medium"],
    ["Vector Algebra", 12, "medium"],
    ["Three Dimensional Geometry", 12, "high"],
    ["Probability", 12, "high"],
  ],
  botany: [
    ["The Living World and Biological Classification", 11, "medium"],
    ["Plant Kingdom", 11, "medium"],
    ["Morphology of Flowering Plants", 11, "high"],
    ["Anatomy of Flowering Plants", 11, "medium"],
    ["Cell: The Unit of Life", 11, "high"],
    ["Cell Cycle and Cell Division", 11, "medium"],
    ["Photosynthesis in Higher Plants", 11, "high"],
    ["Respiration in Plants", 11, "medium"],
    ["Plant Growth and Development", 11, "medium"],
    ["Sexual Reproduction in Flowering Plants", 12, "high"],
    ["Principles of Inheritance and Variation", 12, "high"],
    ["Molecular Basis of Inheritance", 12, "high"],
    ["Microbes in Human Welfare", 12, "low"],
    ["Organisms and Populations", 12, "medium"],
    ["Ecosystem", 12, "medium"],
    ["Biodiversity and Conservation", 12, "low"],
  ],
  zoology: [
    ["Animal Kingdom", 11, "high"],
    ["Structural Organisation in Animals", 11, "medium"],
    ["Biomolecules", 11, "high"],
    ["Breathing and Exchange of Gases", 11, "medium"],
    ["Body Fluids and Circulation", 11, "high"],
    ["Excretory Products and their Elimination", 11, "medium"],
    ["Locomotion and Movement", 11, "medium"],
    ["Neural Control and Coordination", 11, "medium"],
    ["Chemical Coordination and Integration", 11, "high"],
    ["Digestion and Absorption", 11, "low"],
    ["Human Reproduction", 12, "high"],
    ["Reproductive Health", 12, "medium"],
    ["Evolution", 12, "medium"],
    ["Human Health and Disease", 12, "high"],
    ["Biotechnology: Principles and Processes", 12, "high"],
    ["Biotechnology and its Applications", 12, "medium"],
  ],
};

const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export function chaptersFor(subjectId) {
  const sources = SUBJECT_SOURCES[subjectId] ?? [subjectId];
  return sources.flatMap((source) =>
    (CHAPTERS[source] ?? []).map(([name, classLevel, weightage]) => ({
      id: `${source}-${slug(name)}`,
      name,
      classLevel,
      weightage,
      source,
      active: true,
    }))
  );
}

// { [examId]: { [subjectId]: Chapter[] } }
export function buildDefaultSyllabus() {
  return Object.fromEntries(
    EXAMS.map((exam) => [
      exam.id,
      Object.fromEntries(exam.subjects.map(({ subjectId }) => [subjectId, chaptersFor(subjectId)])),
    ])
  );
}
