import { UserState } from '../types';

export interface Problem {
  a: number;
  b: number;
  answer: number;
  options: number[]; // For Battle
  gates?: number[];  // For Runner
}

export function generateAdaptiveProblem(
  user: UserState,
  type: 'BATTLE' | 'RUNNER' | 'MATH_HERO',
  tableConstraint?: number,
  /** Nivel del mapa (1–100): tablas mezcladas y dificultad creciente para RUNNER/MATH_HERO sin tabla fija. */
  mapDifficultyLevel?: number
): Problem {
  const operations: { a: number, b: number, key: string, weight: number }[] = [];

  let startA = 2;
  let endA = 10;
  if (type === 'RUNNER' && tableConstraint) {
    startA = tableConstraint;
    endA = tableConstraint;
  }
  // MATH_HERO: siempre tablas 2–10 mezcladas (ignora tableConstraint).

  const diffLvl = Math.max(1, Math.min(100, mapDifficultyLevel ?? 1));
  const preferHarder =
    type === 'MATH_HERO' || (type === 'RUNNER' && !tableConstraint)
      ? 1 + (diffLvl / 220) * 1.15
      : type === 'RUNNER' && tableConstraint
        ? 1 + (diffLvl / 300) * 0.35
        : 1;

  for (let a = startA; a <= endA; a++) {
    for (let b = 1; b <= 10; b++) {
      const key = `${a}x${b}`;
      const history = user.problemHistory?.[key] || { correct: 0, incorrect: 0 };
      const correct = Number(history.correct) || 0;
      const incorrect = Number(history.incorrect) || 0;

      let weight = 1 + incorrect - correct * 0.5;
      if (weight < 0.1 || isNaN(weight)) weight = 0.1;
      if (weight > 10) weight = 10;
      weight *= preferHarder * (1 + ((a * b) / 130) * ((diffLvl - 1) / 99) * (type === 'MATH_HERO' || (type === 'RUNNER' && !tableConstraint) ? 0.45 : 0.12));
      if (weight > 10) weight = 10;
      if (weight < 0.1 || isNaN(weight)) weight = 0.1;

      operations.push({ a, b, key, weight });
    }
  }

  const totalWeight = operations.reduce((sum, op) => sum + op.weight, 0);
  let randomVal = Math.random() * totalWeight;
  
  let selectedOp = operations[Math.floor(Math.random() * operations.length)];
  for (const op of operations) {
    if (randomVal <= op.weight) {
      selectedOp = op;
      break;
    }
    randomVal -= op.weight;
  }

  const { a, b } = selectedOp;
  const answer = a * b;

  if (type === 'BATTLE') {
    // Generate 3 wrong options
    const options = new Set<number>();
    options.add(answer);
    while (options.size < 4) {
      // Pick random a, b within 1-10
      const wA = Math.floor(Math.random() * 10) + 1;
      const wB = Math.floor(Math.random() * 10) + 1;
      options.add(wA * wB);
    }
    const shuffledOptions = Array.from(options).sort(() => Math.random() - 0.5);
    return { a, b, answer, options: shuffledOptions };
  } else if (type === 'RUNNER') {
    const gatesSet = new Set<number>([answer]);
    const maxOff = tableConstraint
      ? 5
      : Math.max(2, Math.min(8, 9 - Math.floor(diffLvl / 16)));
    let guard = 0;
    while (gatesSet.size < 3 && guard < 80) {
      guard++;
      const offset = Math.floor(Math.random() * maxOff) + 1;
      const wrong = Math.random() > 0.5 ? answer + offset : answer - offset;
      if (wrong > 0 && wrong !== answer) gatesSet.add(wrong);
    }
    while (gatesSet.size < 3) {
      const w = Math.floor(Math.random() * 98) + 2;
      if (w !== answer) gatesSet.add(w);
    }
    return { a, b, answer, options: [], gates: Array.from(gatesSet).sort(() => Math.random() - 0.5) };
  } else {
    const spread = Math.max(2, Math.round(15 - diffLvl * 0.13));
    const gatesSet = new Set<number>([answer]);
    let guard = 0;
    while (gatesSet.size < 4 && guard < 120) {
      guard++;
      const delta = Math.floor(Math.random() * spread) + 1;
      const wrong = Math.random() > 0.5 ? answer + delta : Math.max(1, answer - delta);
      if (wrong > 0 && wrong !== answer) gatesSet.add(wrong);
    }
    while (gatesSet.size < 4) {
      const w = Math.floor(Math.random() * 98) + 2;
      if (w !== answer) gatesSet.add(w);
    }
    return { a, b, answer, options: [], gates: Array.from(gatesSet).sort(() => Math.random() - 0.5) };
  }
}
