// RoPE — Rotary Position Embedding: don't ADD position to a vector, ROTATE
// the vector by an angle proportional to its position. Relative offsets
// then fall out of the dot product automatically. The position scheme
// inside Llama, Mistral, and most modern LLMs.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'rope',
  title: 'RoPE (Rotary Embeddings)',
  category: 'AI & ML',
  summary: 'Encode position as rotation — and relative distance falls out of every attention dot product for free.',
  controls: [
    { id: 'theta', label: 'Rotation per position', type: 'select', options: ['30°', '15°'], defaultValue: '30°' },
  ],
  run,
};

const rot = (v, angle) => [
  v[0] * Math.cos(angle) - v[1] * Math.sin(angle),
  v[0] * Math.sin(angle) + v[1] * Math.cos(angle),
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const Q = [1, 0];
const K = [0.8, 0.6];

export function* run(input) {
  const theta = String(input.theta) === '30°' ? Math.PI / 6 : String(input.theta) === '15°' ? Math.PI / 12 : null;
  if (theta === null) throw new InputError('Pick a rotation angle.');
  const deg = String(input.theta);
  const thetaDeg = parseFloat(deg);
  const r4 = (v) => Math.round(v * 10000) / 10000;

  const positions = [0, 1, 2, 3, 4, 5];
  const normQ = r4(Math.sqrt(dot(Q, Q)));
  const normK = r4(Math.sqrt(dot(K, K)));

  // --- Step 1: Show base content vectors Q and K with their norms ---
  yield {
    state: matrixState({
      title: 'Base content vectors (before any rotation)',
      rows: [{ id: 'q', label: 'Q (query)' }, { id: 'k', label: 'K (key)' }],
      columns: [{ id: 'x', label: 'x' }, { id: 'y', label: 'y' }, { id: 'norm', label: '‖v‖' }],
      values: [[Q[0], Q[1], normQ], [K[0], K[1], normK]],
    }),
    highlight: { active: ['q:norm', 'k:norm'] },
    explanation: `Before RoPE touches anything, we have two raw content vectors. Q = [${Q[0]}, ${Q[1]}] with norm ${normQ}, and K = [${K[0]}, ${K[1]}] with norm ${normK}. These come from the linear projections in attention. RoPE will rotate them by an angle proportional to their token position, but their lengths will never change.`,
    invariant: `‖Q‖ = ${normQ} and ‖K‖ = ${normK} — rotation preserves these norms at every position.`,
  };

  // --- Step 2: Rotate Q to position 0 (identity) ---
  const q0 = rot(Q, 0 * theta);
  yield {
    state: matrixState({
      title: 'Q rotated to position 0 (identity rotation)',
      rows: [{ id: 'orig', label: 'Q original' }, { id: 'rot0', label: 'Q at pos 0' }],
      columns: [{ id: 'x', label: 'x' }, { id: 'y', label: 'y' }, { id: 'angle', label: 'angle (°)' }],
      values: [[Q[0], Q[1], 0], [r4(q0[0]), r4(q0[1]), 0]],
    }),
    highlight: { found: ['rot0:x', 'rot0:y'] },
    explanation: `At position 0 the rotation angle is 0 × ${thetaDeg}° = 0°. The vector is unchanged: [${r4(q0[0])}, ${r4(q0[1])}]. This is the identity rotation — the first token gets no positional phase at all.`,
  };

  // --- Step 3: Rotate Q to position 1 — show angle change, same length ---
  const q1 = rot(Q, 1 * theta);
  const normQ1 = r4(Math.sqrt(dot(q1, q1)));
  yield {
    state: matrixState({
      title: `Q rotated to position 1 (${thetaDeg}° rotation)`,
      rows: [{ id: 'orig', label: 'Q original' }, { id: 'rot1', label: 'Q at pos 1' }],
      columns: [{ id: 'x', label: 'x' }, { id: 'y', label: 'y' }, { id: 'norm', label: '‖v‖' }, { id: 'angle', label: 'angle (°)' }],
      values: [
        [Q[0], Q[1], normQ, 0],
        [r4(q1[0]), r4(q1[1]), normQ1, thetaDeg],
      ],
    }),
    highlight: { active: ['rot1:x', 'rot1:y'], found: ['rot1:norm'] },
    explanation: `At position 1 the rotation is 1 × ${thetaDeg}° = ${thetaDeg}°. Q becomes [${r4(q1[0])}, ${r4(q1[1])}]. The norm is still ${normQ1} — identical to the original ${normQ}. Content magnitude is untouched; only direction encodes position.`,
    invariant: `‖Q_rot‖ = ${normQ1} = ‖Q‖ = ${normQ}. Rotation never changes length.`,
  };

  // --- Step 4: Q rotated to all 6 positions (build the table) ---
  const rotatedQ = positions.map((p) => rot(Q, p * theta));
  const posRows = positions.map((p) => ({ id: `p${p}`, label: `pos ${p}` }));
  yield {
    state: matrixState({
      title: 'Q rotated to all 6 positions',
      rows: posRows,
      columns: [
        { id: 'x', label: 'x' },
        { id: 'y', label: 'y' },
        { id: 'angle', label: 'angle (°)' },
        { id: 'norm', label: '‖v‖' },
      ],
      values: positions.map((p) => {
        const v = rotatedQ[p];
        return [r4(v[0]), r4(v[1]), r4(p * thetaDeg), r4(Math.sqrt(dot(v, v)))];
      }),
    }),
    highlight: { active: positions.map((p) => `p${p}:angle`) },
    explanation: `Every row is the same content vector Q = [${Q[0]}, ${Q[1]}], rotated by p × ${thetaDeg}°. The angle column climbs ${thetaDeg}° per position: ${positions.map((p) => r4(p * thetaDeg) + '°').join(', ')}. Every norm stays at ${normQ}. The content is identical everywhere; only the phase differs.`,
    invariant: `All norms equal ${normQ}. Position is purely directional.`,
  };

  // --- Step 5: Rotate K to all 6 positions ---
  const rotatedK = positions.map((p) => rot(K, p * theta));
  yield {
    state: matrixState({
      title: 'K rotated to all 6 positions',
      rows: posRows,
      columns: [
        { id: 'x', label: 'x' },
        { id: 'y', label: 'y' },
        { id: 'angle', label: 'angle (°)' },
        { id: 'norm', label: '‖v‖' },
      ],
      values: positions.map((p) => {
        const v = rotatedK[p];
        return [r4(v[0]), r4(v[1]), r4(p * thetaDeg), r4(Math.sqrt(dot(v, v)))];
      }),
    }),
    highlight: { active: positions.map((p) => `p${p}:angle`) },
    explanation: `Now the key vector K = [${K[0]}, ${K[1]}] gets the same treatment. Each position rotates K by p × ${thetaDeg}°. Norm stays at ${normK} everywhere. Both Q and K carry position as phase — the dot product between a rotated Q and a rotated K will encode their relative offset.`,
    invariant: `All norms equal ${normK}. Same rotation, different content vector.`,
  };

  // --- Step 6: First dot product step by step (m=2, n=0, offset=2) ---
  const m1 = 2, n1 = 0, offset1 = m1 - n1;
  const qm1 = rot(Q, m1 * theta);
  const kn1 = rot(K, n1 * theta);
  const dp1 = r4(dot(qm1, kn1));
  yield {
    state: matrixState({
      title: `Dot product: Q@pos${m1} · K@pos${n1} (offset ${offset1})`,
      rows: [
        { id: 'qrot', label: `Q@pos${m1}` },
        { id: 'krot', label: `K@pos${n1}` },
        { id: 'prod', label: 'element products' },
        { id: 'sum', label: 'dot product' },
      ],
      columns: [{ id: 'x', label: 'x component' }, { id: 'y', label: 'y component' }],
      values: [
        [r4(qm1[0]), r4(qm1[1])],
        [r4(kn1[0]), r4(kn1[1])],
        [r4(qm1[0] * kn1[0]), r4(qm1[1] * kn1[1])],
        [dp1, dp1],
      ],
    }),
    highlight: { active: ['prod:x', 'prod:y'], found: ['sum:x'] },
    explanation: `Query at position ${m1} is rotated by ${m1} × ${thetaDeg}° = ${r4(m1 * thetaDeg)}°. Key at position ${n1} is rotated by ${n1} × ${thetaDeg}° = ${r4(n1 * thetaDeg)}°. The relative offset is ${m1} - ${n1} = ${offset1}. Dot product: ${r4(qm1[0])} × ${r4(kn1[0])} + ${r4(qm1[1])} × ${r4(kn1[1])} = ${dp1}. This score encodes both content similarity and positional offset ${offset1}.`,
  };

  // --- Step 7: Second dot product with SAME offset (m=5, n=3, offset=2) ---
  const m2 = 5, n2 = 3, offset2 = m2 - n2;
  const qm2 = rot(Q, m2 * theta);
  const kn2 = rot(K, n2 * theta);
  const dp2 = r4(dot(qm2, kn2));
  yield {
    state: matrixState({
      title: `Dot product: Q@pos${m2} · K@pos${n2} (offset ${offset2})`,
      rows: [
        { id: 'qrot', label: `Q@pos${m2}` },
        { id: 'krot', label: `K@pos${n2}` },
        { id: 'prod', label: 'element products' },
        { id: 'sum', label: 'dot product' },
      ],
      columns: [{ id: 'x', label: 'x component' }, { id: 'y', label: 'y component' }],
      values: [
        [r4(qm2[0]), r4(qm2[1])],
        [r4(kn2[0]), r4(kn2[1])],
        [r4(qm2[0] * kn2[0]), r4(qm2[1] * kn2[1])],
        [dp2, dp2],
      ],
    }),
    highlight: { active: ['prod:x', 'prod:y'], found: ['sum:x'] },
    explanation: `Different absolute positions — query at ${m2}, key at ${n2} — but the same offset ${offset2}. The rotated vectors are completely different: Q@${m2} = [${r4(qm2[0])}, ${r4(qm2[1])}], K@${n2} = [${r4(kn2[0])}, ${r4(kn2[1])}]. Yet the dot product is ${dp2}. Compare with the previous step's ${dp1}.`,
  };

  // --- Step 8: Show these match — the RoPE property! ---
  yield {
    state: matrixState({
      title: 'The RoPE identity: same offset → same score',
      rows: [
        { id: 'pair1', label: `m=${m1}, n=${n1}` },
        { id: 'pair2', label: `m=${m2}, n=${n2}` },
      ],
      columns: [
        { id: 'offset', label: 'offset (m−n)' },
        { id: 'qAngle', label: 'Q angle (°)' },
        { id: 'kAngle', label: 'K angle (°)' },
        { id: 'score', label: 'dot product' },
      ],
      values: [
        [offset1, r4(m1 * thetaDeg), r4(n1 * thetaDeg), dp1],
        [offset2, r4(m2 * thetaDeg), r4(n2 * thetaDeg), dp2],
      ],
    }),
    highlight: { found: ['pair1:score', 'pair2:score'], compare: ['pair1:offset', 'pair2:offset'] },
    explanation: `Both pairs have offset ${offset1}. The Q angles differ (${r4(m1 * thetaDeg)}° vs ${r4(m2 * thetaDeg)}°), the K angles differ (${r4(n1 * thetaDeg)}° vs ${r4(n2 * thetaDeg)}°), but the angle difference is ${r4(offset1 * thetaDeg)}° in both cases. The dot products are both ${dp1}. This is the core RoPE identity: R_m(q) · R_n(k) depends on m−n, not on m and n separately.`,
    invariant: `For fixed content vectors, same offset → same dot product. Attention reads relative distance, not absolute position.`,
  };

  // --- Step 9: Different offset (m=3, n=0, offset=3) — different score ---
  const m3 = 3, n3 = 0, offset3 = m3 - n3;
  const qm3 = rot(Q, m3 * theta);
  const kn3 = rot(K, n3 * theta);
  const dp3 = r4(dot(qm3, kn3));
  yield {
    state: matrixState({
      title: `Different offset: Q@pos${m3} · K@pos${n3} (offset ${offset3})`,
      rows: [
        { id: 'off2a', label: `offset ${offset1} (m=${m1},n=${n1})` },
        { id: 'off2b', label: `offset ${offset2} (m=${m2},n=${n2})` },
        { id: 'off3', label: `offset ${offset3} (m=${m3},n=${n3})` },
      ],
      columns: [{ id: 'offset', label: 'offset' }, { id: 'score', label: 'dot product' }],
      values: [
        [offset1, dp1],
        [offset2, dp2],
        [offset3, dp3],
      ],
    }),
    highlight: { active: ['off2a:score', 'off2b:score'], compare: ['off3:score'] },
    explanation: `Now offset ${offset3}: Q at position ${m3} (angle ${r4(m3 * thetaDeg)}°) dotted with K at position ${n3} (angle ${r4(n3 * thetaDeg)}°). The score is ${dp3}, different from the offset-${offset1} score of ${dp1}. The offset-2 cells match each other; offset-3 stands apart. Attention can distinguish relative distances through these score differences.`,
  };

  // --- Step 10: Summary table of offset → score mapping ---
  const allPairs = [[1, 0], [2, 0], [2, 1], [3, 0], [3, 1], [4, 0], [4, 2], [5, 3], [5, 0]];
  const pairData = allPairs.map(([m, n]) => {
    const s = r4(dot(rot(Q, m * theta), rot(K, n * theta)));
    return { m, n, offset: m - n, score: s };
  });
  yield {
    state: matrixState({
      title: 'Offset → score map (same offset = same score)',
      rows: pairData.map((d, i) => ({ id: `r${i}`, label: `m=${d.m}, n=${d.n}` })),
      columns: [
        { id: 'offset', label: 'offset (m−n)' },
        { id: 'score', label: 'dot product' },
      ],
      values: pairData.map((d) => [d.offset, d.score]),
    }),
    highlight: {
      active: pairData.map((d, i) => d.offset === 2 ? `r${i}:score` : null).filter(Boolean),
      compare: pairData.map((d, i) => d.offset === 3 ? `r${i}:score` : null).filter(Boolean),
      visited: pairData.map((d, i) => d.offset === 1 ? `r${i}:score` : null).filter(Boolean),
    },
    explanation: `Nine query-key pairs across different absolute positions. Sort by offset column and the pattern is clear: every pair with offset 1 scores ${r4(pairData.find((d) => d.offset === 1).score)}, every pair with offset 2 scores ${r4(pairData.find((d) => d.offset === 2).score)}, offset 3 scores ${r4(pairData.find((d) => d.offset === 3).score)}. Absolute positions vary wildly; the score is a pure function of m−n.`,
    invariant: `score(m, n) = f(m − n) for fixed content vectors Q and K.`,
  };

  // --- Step 11: Multi-frequency: fast vs slow dimension pairs ---
  const slowFactor = 0.1;
  yield {
    state: matrixState({
      title: 'Multiple frequency pairs: fast vs slow rotation',
      rows: posRows,
      columns: [
        { id: 'fast_sin', label: `fast sin(p×${thetaDeg}°)` },
        { id: 'fast_cos', label: `fast cos(p×${thetaDeg}°)` },
        { id: 'slow_sin', label: `slow sin(p×${r4(thetaDeg * slowFactor)}°)` },
        { id: 'slow_cos', label: `slow cos(p×${r4(thetaDeg * slowFactor)}°)` },
      ],
      values: positions.map((p) => [
        r4(Math.sin(p * theta)),
        r4(Math.cos(p * theta)),
        r4(Math.sin(p * theta * slowFactor)),
        r4(Math.cos(p * theta * slowFactor)),
      ]),
    }),
    highlight: {
      active: positions.map((p) => `p${p}:fast_sin`),
      visited: positions.map((p) => `p${p}:slow_sin`),
    },
    explanation: `A real model uses many dimension pairs, each rotating at a different speed. The fast pair (theta = ${thetaDeg}°) changes rapidly — sin goes from ${r4(Math.sin(0))} to ${r4(Math.sin(5 * theta))} across 6 positions. The slow pair (theta = ${r4(thetaDeg * slowFactor)}°) barely moves: sin goes from ${r4(Math.sin(0))} to ${r4(Math.sin(5 * theta * slowFactor))}. Fast pairs give sharp local resolution; slow pairs keep far-apart tokens distinguishable. Together they form a multi-scale ruler across the context window.`,
  };

  // --- Step 12: Cache compatibility ---
  const cachePos = 2;
  const cachedK = rot(K, cachePos * theta);
  const newQueryPositions = [3, 4, 5];
  const cacheRows = newQueryPositions.map((p) => ({ id: `nq${p}`, label: `new Q@pos${p}` }));
  const cacheDots = newQueryPositions.map((p) => {
    const qNew = rot(Q, p * theta);
    return [p, p - cachePos, r4(dot(qNew, cachedK))];
  });
  yield {
    state: matrixState({
      title: `KV cache: K cached at pos ${cachePos}, new queries arrive`,
      rows: cacheRows,
      columns: [
        { id: 'qpos', label: 'query position' },
        { id: 'offset', label: 'offset from cached key' },
        { id: 'score', label: 'dot product' },
      ],
      values: cacheDots,
    }),
    highlight: { active: cacheRows.map((r) => `${r.id}:score`) },
    explanation: `During autoregressive decoding, K at position ${cachePos} was rotated by ${r4(cachePos * thetaDeg)}° and stored in the KV cache as [${r4(cachedK[0])}, ${r4(cachedK[1])}]. New queries at positions ${newQueryPositions.join(', ')} each rotate Q by their own angle, then dot against the cached key. The scores are ${cacheDots.map((d) => d[2]).join(', ')} — each encoding the correct relative offset (${cacheDots.map((d) => d[1]).join(', ')}) without recomputing the old key. This is why RoPE is cache-friendly: the rotated key is self-contained.`,
    invariant: `Cached keys carry their positional phase. No recomputation needed when new queries arrive.`,
  };

  // --- Step 13: Summary — why RoPE won ---
  const unrotatedDot = r4(dot(Q, K));
  yield {
    state: matrixState({
      title: 'Why RoPE won: three properties at once',
      rows: [
        { id: 'rel', label: 'Relative position' },
        { id: 'norm', label: 'Norm preservation' },
        { id: 'cache', label: 'Cache compatibility' },
      ],
      columns: [
        { id: 'property', label: 'What it means' },
        { id: 'evidence', label: 'Evidence from this demo' },
      ],
      values: [
        [1, 1],
        [1, 1],
        [1, 1],
      ],
    }),
    highlight: { found: ['rel:property', 'norm:property', 'cache:property'] },
    explanation: `RoPE became the default position scheme because it delivers three things simultaneously. (1) Relative position: offset-${offset1} pairs always score ${dp1} regardless of absolute position — attention sees distance, not address. (2) Norm preservation: ‖Q‖ stays at ${normQ} and ‖K‖ at ${normK} after rotation — content magnitude is never distorted. (3) Cache compatibility: keys rotated once and cached at their original position remain valid for all future queries. The unrotated Q·K is ${unrotatedDot}; RoPE modulates that base similarity by relative offset, giving attention a natural distance sense without learned position tables or additive embeddings.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation rotates a content vector to represent different token positions. RoPE means rotary position embedding, and its invariant is that rotation changes angle while preserving vector length.',
        {type: 'callout', text: 'RoPE turns position into phase so attention scores can read relative offset without changing vector length.'},
        'The dot-product frame is the key. Query and key vectors at positions m and n carry rotations whose angle difference depends on m - n, so attention can sense relative offset.',
        'Different dimension pairs rotate at different frequencies. Fast pairs separate nearby positions, while slow pairs change more gradually and help represent longer offsets.',
        {type: 'image', src: './assets/gifs/rope.gif', alt: 'Animated walkthrough of the rope visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A transformer attention layer compares queries and keys to decide which tokens should influence each other. Without position information, the layer sees a bag of token vectors and cannot tell first from tenth.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Unit_circle.svg/250px-Unit_circle.svg.png', alt: 'Unit circle with cosine and sine coordinates', caption: 'RoPE uses the same unit-circle geometry: rotate a two-dimensional pair by an angle, preserving length while changing phase. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Unit_circle.svg.'},
        'RoPE exists because decoder language models need position information inside the query-key comparison itself. It gives attention a relative-distance signal while staying compatible with cached keys during generation.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is an absolute position embedding. Add a learned or sinusoidal vector for position 0, position 1, and so on to each token embedding before the transformer layers.',
        'This works inside the trained range, but it asks later attention layers to recover relative distance from vectors that were added earlier. A query at position 100 and a key at position 92 do not automatically expose the offset 8 at the dot-product site.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is extrapolation and relative distance. A model trained up to one context length may see absolute positions beyond its training range, and attention still needs to know whether evidence is nearby or far away.',
        'Adding a position vector once at the input separates order from the place where relevance is computed. The query-key dot product is where attention decides, so position should affect that comparison directly.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat adjacent dimensions as two-dimensional planes and rotate each pair by an angle determined by token position. The vector length stays the same, so content magnitude is preserved while phase carries position.',
        'For a query at position m and a key at position n, the positional part of their comparison depends on the angle difference. That angle difference is proportional to m - n, the relative offset.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For each dimension pair, RoPE applies the rotation [x cos a - y sin a, x sin a + y cos a]. The angle a equals position times a frequency, and frequencies form a ladder across the embedding width.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Transformer%2C_attention_block_diagram.png/250px-Transformer%2C_attention_block_diagram.png', alt: 'Scaled dot-product attention block with query key value mask softmax and output', caption: 'RoPE is applied at the query-key comparison point, before attention scores become softmax weights. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Transformer,_attention_block_diagram.png.'},
        'The model applies this rotation to queries and keys, usually not to values. During decoding, the KV cache stores keys that already include the correct rotation for their original positions.',
        'Long-context scaling changes the frequency schedule or the position values. That can extend usable context, but it also changes the ruler the model learned during training.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Two-dimensional rotation preserves dot-product structure. Rotating q by m theta and k by n theta makes their relative angle depend on (m - n) theta.',
        'The invariant is that the same content vectors at the same relative offset get the same positional contribution, regardless of absolute location. Content still matters, so equal offset does not mean equal attention score for different tokens.',
        'Correctness for implementation means consistent positions. If cached keys are rotated with shifted positions, attention scores become wrong even though tensor shapes still match.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'RoPE adds O(Ld) elementwise work for sequence length L and hidden width d. In prefill, this is usually smaller than O(L^2 d) attention, and in decoding it is small beside reading the KV cache.',
        'It adds no learned position table. Implementations precompute sine and cosine values or fuse the rotation, so the inner loop does not call trigonometric functions for every token.',
        'The behavioral cost is context scaling risk. Changing frequencies can preserve short-range performance while hurting retrieval at long distances, so longer accepted tensors do not prove longer usable context.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'RoPE is common in decoder-only language models such as Llama-family, Mistral-family, Qwen-family, and related open models. It fits autoregressive generation because keys can be rotated once and reused from the KV cache.',
        'It is also central to long-context adaptation methods. Position interpolation, NTK-aware scaling, and YaRN-style methods adjust the rotation schedule to stretch context while trying to preserve local behavior.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'RoPE does not make a model length-infinite. Frequencies can wrap, training may not teach far-distance retrieval, and attention kernels still pay memory and compute costs for long contexts.',
        'It also does not guarantee calibrated use of distant evidence. A model can encode positions correctly and still ignore information in the middle of a long prompt.',
        'Position bookkeeping bugs are subtle. Packed prompts, prefix caches, resumed generation, and sliding windows can all shift positions while leaving tensors shape-correct.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take one dimension pair q = [1, 0] and k = [1, 0] with theta = 0.1 radians per position. At positions m = 10 and n = 7, the relative angle is (10 - 7) * 0.1 = 0.3 radians.',
        'The dot product after rotation is cos(0.3), about 0.955, because the vectors remain nearly aligned. If the offset is 20 positions, the relative angle is 2.0 radians and the dot product is cos(2.0), about -0.416.',
        'This single pair shows the ruler. Nearby offsets can keep high similarity, distant offsets can change the score sharply, and many frequency pairs give the model multiple rulers at once.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Su et al., RoFormer: Enhanced Transformer with Rotary Position Embedding, 2021; Vaswani et al., Attention Is All You Need, 2017; Peng et al., YaRN: Efficient Context Window Extension, 2023.',
        'Study next by mechanism. Read Positional Encoding for the additive baseline, Attention Mechanism for query-key dot products, Multi-Head Attention for per-head subspaces, KV Cache for decoding state, and Long-Context Evaluation for failure modes beyond tensor length.',
      ],
    },
  ],
};
