// K-means clustering: assign each point to its nearest centroid, move each
// centroid to the middle of its points, repeat until nothing changes.
// Unsupervised learning in its purest, most watchable form.

import { scatterState, parseIntegerInRange } from '../core/state.js';

export const topic = {
  id: 'k-means',
  title: 'K-Means Clustering',
  category: 'AI & ML',
  summary: 'Group unlabeled points by repeating two moves: assign to nearest centroid, recenter the centroid.',
  controls: [
    { id: 'k', label: 'Clusters (k)', type: 'select', options: ['2', '3', '4'], defaultValue: '3' },
  ],
  run,
};

// A fixed dataset of three natural blobs (deterministic on purpose: the
// lesson is the algorithm, not the dice). Try k=2 and k=4 on the same data
// to see what choosing the "wrong" k does.
const DATA = [
  [1.0, 1.2], [1.6, 2.0], [2.2, 1.0], [1.3, 2.6], [2.6, 2.2], [2.0, 3.0],
  [7.0, 1.5], [7.8, 2.3], [8.5, 1.2], [7.3, 2.9], [8.9, 2.6], [8.1, 3.2],
  [4.2, 6.8], [5.0, 7.6], [5.8, 6.6], [4.6, 8.2], [5.5, 8.0], [6.2, 7.4],
];

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function* run(input) {
  const k = parseIntegerInRange(input.k, { min: 2, max: 4, label: 'k' });

  const points = DATA.map(([x, y], i) => ({ id: `p${i}`, x, y, clusterId: null }));
  // Deterministic spread-out initialization (real k-means++ does this with
  // weighted randomness; the idea — start far apart — is the same).
  const initIndexes = [0, 8, 14, 4].slice(0, k);
  const centroids = initIndexes.map((pi, c) => ({
    id: `c${c}`, x: DATA[pi][0], y: DATA[pi][1], label: `C${c + 1}`,
  }));
  const snapshot = () => scatterState({
    points,
    centroids,
    axes: { x: { label: 'feature 1' }, y: { label: 'feature 2' } },
  });

  yield {
    state: snapshot(),
    highlight: {},
    explanation: `${DATA.length} unlabeled points — nobody tells the algorithm what the groups are, or even that groups exist. That's UNSUPERVISED learning. We chose k=${k}, dropped ${k} centroids (✚) far apart, and now we loop two moves until nothing changes.`,
  };

  for (let round = 1; round <= 8; round += 1) {
    // Move 1: assign every point to its nearest centroid.
    let changed = 0;
    for (const p of points) {
      let best = null;
      let bestDistance = Infinity;
      for (const c of centroids) {
        const d = dist([p.x, p.y], [c.x, c.y]);
        if (d < bestDistance) { bestDistance = d; best = c.id; }
      }
      if (p.clusterId !== best) changed += 1;
      p.clusterId = best;
    }
    yield {
      state: snapshot(),
      highlight: {},
      explanation: `Round ${round}, move 1 — ASSIGN: every point joins its NEAREST centroid (plain Euclidean distance, nothing fancier). ${changed === 0 ? 'No point changed cluster.' : `${changed} point${changed === 1 ? '' : 's'} changed cluster.`}`,
      invariant: 'Every point always belongs to its nearest centroid (as of the last assignment).',
    };

    if (changed === 0) {
      yield {
        state: snapshot(),
        highlight: {},
        explanation: `CONVERGED after ${round} rounds: assignments stopped changing, so the centroids won't move either — the loop is a fixed point. K-means always converges like this${k === 3 ? ', and with k=3 it found the three natural blobs.' : `. But look critically: with k=${k} it ${k < 3 ? 'was forced to MERGE real groups' : 'had to SPLIT a real group'} — k-means always produces exactly k clusters, whether or not the data agrees. Choosing k is your job, not the algorithm's.`} The same idea compresses images (cluster colors), segments customers, and builds vector-search indexes.`,
      };
      return;
    }

    // Move 2: move each centroid to the mean of its assigned points.
    for (const c of centroids) {
      const mine = points.filter((p) => p.clusterId === c.id);
      if (mine.length === 0) continue; // an empty cluster keeps its spot
      c.x = mine.reduce((s, p) => s + p.x, 0) / mine.length;
      c.y = mine.reduce((s, p) => s + p.y, 0) / mine.length;
    }
    yield {
      state: snapshot(),
      highlight: { active: centroids.map((c) => c.id) },
      explanation: `Round ${round}, move 2 — RECENTER: each centroid jumps to the MEAN of its members; it stops being a guess and starts being a summary. New centroids may flip the nearest-centroid math for border points, so we assign again.`,
    };
  }
}
