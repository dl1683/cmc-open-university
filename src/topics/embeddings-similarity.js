// Embeddings: meaning as geometry. Words become points; similar meanings
// sit close together; "find similar" becomes "find nearest" — the idea
// behind vector databases, semantic search, and RAG.

import { scatterState, InputError } from '../core/state.js';

export const topic = {
  id: 'embeddings-similarity',
  title: 'Embeddings & Similarity',
  category: 'AI & ML',
  summary: 'Meaning as geometry: similar words sit close together, and search becomes "find my neighbors".',
  controls: [
    { id: 'query', label: 'Find words similar to', type: 'select', options: ['cat', 'pizza', 'truck'], defaultValue: 'cat' },
  ],
  run,
};

// A hand-made 2D embedding space. Real embeddings have hundreds or
// thousands of dimensions and are LEARNED — but distance works the same.
const WORDS = [
  { label: 'cat', x: 2.0, y: 7.5 }, { label: 'dog', x: 2.8, y: 8.1 },
  { label: 'kitten', x: 1.4, y: 7.0 }, { label: 'horse', x: 3.6, y: 7.0 },
  { label: 'pizza', x: 7.6, y: 7.8 }, { label: 'burger', x: 8.4, y: 7.2 },
  { label: 'sushi', x: 7.0, y: 8.4 }, { label: 'taco', x: 8.2, y: 8.3 },
  { label: 'truck', x: 5.0, y: 1.6 }, { label: 'car', x: 4.2, y: 2.2 },
  { label: 'bicycle', x: 5.8, y: 2.4 }, { label: 'bus', x: 4.6, y: 1.0 },
];

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function* run(input) {
  const queryWord = String(input.query);
  const queryPoint = WORDS.find((w) => w.label === queryWord);
  if (!queryPoint) throw new InputError('Pick one of the listed words.');

  const points = WORDS.map((w, i) => ({ id: `e${i}`, ...w }));
  const queryId = points.find((p) => p.label === queryWord).id;
  const snapshot = () => scatterState({
    points,
    axes: { x: { label: 'dimension 1 (of 2 here; thousands in real models)' }, y: { label: 'dimension 2' } },
  });

  yield {
    state: snapshot(),
    highlight: {},
    explanation: 'An EMBEDDING turns a word (or sentence, or image) into a list of numbers — a point in space. The magic is in how the points are arranged: models learn to place similar meanings close together. Look: animals cluster top-left, foods top-right, vehicles at the bottom. Nobody labeled these groups — they emerge from how words are used.',
  };

  yield {
    state: snapshot(),
    highlight: { active: [queryId] },
    explanation: `Query: "find things similar to ${queryWord}". With embeddings this stops being a language problem and becomes GEOMETRY: just measure the distance from "${queryWord}" to every other point. (Real systems use cosine similarity — the angle between vectors — but the idea is identical: closer = more similar.)`,
  };

  const ranked = points
    .filter((p) => p.id !== queryId)
    .map((p) => ({ ...p, d: dist(p, queryPoint) }))
    .sort((a, b) => a.d - b.d);

  for (let i = 0; i < 3; i += 1) {
    const hit = ranked[i];
    yield {
      state: snapshot(),
      highlight: { active: [queryId], compare: [hit.id], found: ranked.slice(0, i).map((r) => r.id) },
      explanation: `Nearest neighbor #${i + 1}: "${hit.label}" at distance ${hit.d.toFixed(2)}. ${i === 0 ? 'No dictionary, no synonym list — proximity in the learned space IS similarity.' : ''}`,
      invariant: 'Distance in embedding space ≈ difference in meaning.',
    };
  }

  const farthest = ranked[ranked.length - 1];
  yield {
    state: snapshot(),
    highlight: { active: [queryId], found: ranked.slice(0, 3).map((r) => r.id), visited: [farthest.id] },
    explanation: `Top 3 for "${queryWord}": ${ranked.slice(0, 3).map((r) => `"${r.label}"`).join(', ')} — while "${farthest.label}" sits far away (${farthest.d.toFixed(2)}). This exact loop, scaled to millions of points and thousands of dimensions, is a VECTOR DATABASE. It's how semantic search finds documents "about" your question, and the R in RAG: embed the question, fetch the nearest chunks, hand them to the LLM. Meaning became geometry, so search became math.`,
  };
}
