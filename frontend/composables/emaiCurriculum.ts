// The EmAI Academy curriculum as the landing page presents it. The real skill tree
// (courses, XP, unlocks) comes from skills-ms; this is the public, static overview.
export type EmaiTrack = "decider" | "builder";

export interface EmaiSkill {
  id: number;
  /** i18n key prefix, e.g. Emai.Skills.S1 */
  key: string;
  /** prerequisite skill ids */
  requires: number[];
  /** "all" = every prerequisite, "any" = one of them is enough */
  mode: "all" | "any";
  tracks: EmaiTrack[];
}

export const emaiSkills: EmaiSkill[] = [
  { id: 1, key: "Emai.Skills.S1", requires: [], mode: "all", tracks: ["decider", "builder"] },
  { id: 2, key: "Emai.Skills.S2", requires: [1], mode: "all", tracks: ["builder"] },
  { id: 3, key: "Emai.Skills.S3", requires: [1], mode: "all", tracks: ["builder"] },
  { id: 4, key: "Emai.Skills.S4", requires: [2, 3], mode: "all", tracks: ["builder"] },
  { id: 5, key: "Emai.Skills.S5", requires: [4], mode: "all", tracks: ["builder"] },
  { id: 6, key: "Emai.Skills.S6", requires: [3], mode: "all", tracks: ["builder"] },
  { id: 7, key: "Emai.Skills.S7", requires: [5, 6], mode: "any", tracks: ["builder"] },
  { id: 8, key: "Emai.Skills.S8", requires: [1], mode: "all", tracks: ["decider"] },
  { id: 9, key: "Emai.Skills.S9", requires: [1, 8], mode: "all", tracks: ["decider"] },
];

/** The two tracks as ordered stages; a stage with several ids means "one or more of these". */
export const emaiTrackStages: Record<EmaiTrack, number[][]> = {
  decider: [[1], [8], [9]],
  builder: [[1], [2, 3], [4], [5, 6], [7]],
};
