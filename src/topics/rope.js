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
        "Frame 1 shows one content vector rotated to six positions. Every arrow has the same length; only the angle changes. That is the RoPE invariant: rotation encodes position without changing the content's magnitude.",
        {type: 'callout', text: 'RoPE turns position into phase so attention scores can read relative offset without changing vector length.'},
        "Frame 2 is the payoff. Look at the dot-product column: pairs with the same positional offset (m - n) produce the same score. The highlighted cells share offset 2; the unhighlighted cell has offset 3 and a different score. This is how attention sees relative distance through rotation.",
        "Frame 3 shows two dimension pairs rotating at different speeds. The fast pair separates nearby positions clearly; the slow pair changes gradually, keeping distant positions distinguishable. Real models use many such pairs across the embedding width.",
        "Frame 4 summarizes why RoPE became the default: relative offsets, norm preservation, and compatibility with KV caching during autoregressive decoding.",
      
        {type: 'image', src: './assets/gifs/rope.gif', alt: 'Animated walkthrough of the rope visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: `Why this exists`,
      paragraphs: [
        `RoPE, short for rotary position embedding, encodes position by rotating query and key vectors instead of adding a separate position vector to token embeddings. Su et al. introduced it in the 2021 RoFormer paper, and it became common in Llama, Mistral, Qwen, and many other decoder models because it gives attention a natural notion of relative distance while preserving vector norms.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Unit_circle.svg/250px-Unit_circle.svg.png', alt: 'Unit circle with cosine and sine coordinates', caption: 'RoPE uses the same unit-circle geometry: rotate a two-dimensional pair by an angle, preserving length while changing phase. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Unit_circle.svg.'},
        `The contrast with Positional Encoding is the key. A sinusoidal input encoding adds numbers to the embedding before the model starts. Rotary encoding waits until Attention Mechanism forms Q and K, then rotates each 2D dimension pair by an angle proportional to token position. Content stays in the vector components; position enters as phase. The dot product between a rotated query and rotated key then depends on their relative offset in a mathematically clean way.`,
      ],
    },
    {
      heading: `The wall`,
      paragraphs: [
        `Absolute position tables can work inside the context length they were trained on, but they do not make relative distance natural to attention. A decoder often needs to know that one token is nearby, another is 200 tokens back, and another is thousands of tokens back.`,
        `Adding position once at the input also separates order from the query-key comparison where attention actually decides relevance. RoPE moves position into that comparison directly by rotating Q and K.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `Each row is the same content vector seen at a different position. The length should stay fixed; only the angle changes. In the dot-product table, pairs with the same offset share the same positional geometry, which is the invariant RoPE gives attention. The frequency-pair frame is the long-context warning: fast pairs preserve local order, slow pairs carry longer offsets, and scaling these pairs changes what the model can distinguish.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Each adjacent pair of dimensions is treated as a 2D plane. For position p and frequency index i, the pair rotates by p times theta_i, with theta_i usually following a geometric ladder such as base^(-2i/d). Fast frequencies distinguish local offsets; slow frequencies keep long-range offsets from wrapping too quickly. In matrix form, each pair uses the familiar rotation [x cos a - y sin a, x sin a + y cos a], the same geometry behind Eigenvalues & Eigenvectors lessons on linear transformations.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Transformer%2C_attention_block_diagram.png/250px-Transformer%2C_attention_block_diagram.png', alt: 'Scaled dot-product attention block with query key value mask softmax and output', caption: 'RoPE is applied at the query-key comparison point, before attention scores become softmax weights. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Transformer,_attention_block_diagram.png.'},
        `The useful identity is R_m(q) dot R_n(k) = q dot R_(n-m)(k), up to the sign convention. That means the position part of the query-key score is a function of relative distance, not an arbitrary absolute label. Be precise: two pairs with the same offset do not automatically have identical scores if their content vectors q and k differ. RoPE says the positional transformation depends on m - n; the learned content still matters.`,
        `In Multi-Head Attention, each head applies this rotation to its own Q and K dimensions. Values are usually not rotated. The rotated keys are what the KV Cache stores during decoding, so future queries can compare against position-aware cached keys without recomputing the old tokens.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `RoPE adds O(Ld) work to rotate queries and keys for L tokens and width d, small beside O(L^2 d) attention prefill and O(Ld) per-token cached attention. Implementations precompute sin and cos tables and use fused elementwise operations, so they do not call trigonometric functions in the inner loop. It adds no learned position parameters. The cache cost is indirect: keys must be stored after the correct rotation, and long-context scaling changes the frequency schedule that produced those rotations.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `RoPE is standard in many open decoder families: Llama, Mistral, Mixtral, Qwen, and several DeepSeek models. It is especially important in long-context adaptation. Position interpolation rescales positions so more tokens fit into the angle range the model saw during training. NTK-aware scaling changes the base frequencies. YaRN combines interpolation and extrapolation with extra tuning. These methods helped models trained at 2K, 4K, or 8K context stretch to much larger windows, although quality still depends on training data and attention implementation.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `Do not say RoPE makes a model length-infinite. Frequencies can wrap, training may never teach the model to use far-away evidence, and attention kernels still pay for long contexts. Do not say it erases absolute position either; the model can still infer absolute-ish cues through boundaries, prompts, and layer interactions. And do not describe it as simple addition. Rotary encoding is an operator applied to Q and K, so it changes attention code, cache contents, and long-context scaling knobs.`,
        `Another misconception is that all RoPE scaling recipes are interchangeable. Position interpolation, NTK-aware scaling, and YaRN move different parts of the frequency ladder and can trade local precision for long-range stability. A model can pass short benchmarks after scaling while losing retrieval accuracy at 64K tokens, so evaluation must include long-context tasks, not just perplexity near the training length. Lost in the Middle: Long-Context Failure Modes is the evaluation companion to the rotation math.`,
      ],
    },
    {
      heading: `Implementation checklist`,
      paragraphs: [
        `Apply RoPE to query and key dimensions consistently in every attention layer that expects it. Do not rotate values unless the architecture explicitly does so. Store cached keys with the correct position rotation during decoding.`,
        `Keep position offsets correct under batching, packed prompts, prefix caching, sliding windows, and resumed generation. A shape-correct KV cache can still be semantically wrong if the rotations were computed with shifted positions.`,
        `When changing context length, evaluate local tasks and long retrieval tasks separately. A scaling recipe can preserve short-range behavior while damaging evidence use far from the beginning or end of the prompt.`,
      ],
    },
    {
      heading: `Worked example`,
      paragraphs: [
        `Suppose a query at position 100 attends to a key at position 92. RoPE rotates the query by the phase for 100 and the key by the phase for 92. Their dot product carries a relative offset of eight positions, while content still decides whether the key is relevant.`,
        `During decoding, the key for position 92 may be stored in the KV cache. A later query at position 1000 can still compare against it because the cached key already contains its original positional phase. That is why cache position bookkeeping is part of correctness.`,
      ],
    },
    {
      heading: `Rule of thumb`,
      paragraphs: [
        `Use RoPE when relative position inside attention matters and the architecture is decoder-style attention with KV caching. It is a strong default for modern LLMs, but it still needs long-context evaluation.`,
        `Do not confuse accepting longer tensors with understanding longer contexts. RoPE gives the model positional geometry; training, retrieval behavior, and attention implementation decide how well that geometry is used.`,
        `When debugging long-context degradation, inspect position handling alongside retrieval, truncation, cache reuse, and prompt layout. RoPE bugs often look like vague reasoning failures rather than clean crashes.`,
        `A good implementation test compares same-offset query-key pairs across different absolute positions. If those scores drift unexpectedly, the rotation or cache position bookkeeping is probably wrong.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Primary sources: RoFormer/RoPE at https://arxiv.org/abs/2104.09864, Llama 2's use of RoPE in long-context decoder models at https://arxiv.org/abs/2307.09288, YaRN at https://arxiv.org/abs/2309.00071, and the original Transformer position baseline at https://arxiv.org/abs/1706.03762. Start with Positional Encoding for the original sinusoidal frequency ladder. Then read Attention Mechanism to see where Q and K are born, Multi-Head Attention to see how every head gets its own rotated subspace, and KV Cache to understand why rotated keys are stored during decoding. Lost in the Middle: Long-Context Failure Modes explains why long-context behavior still needs position-swept evaluation after the math works. The Transformer Block shows where the rotated attention output fits in the larger layer. If the rotation math feels abstract, Eigenvalues & Eigenvectors gives the linear-algebra foundation.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Absolute position embeddings assign each position a fixed vector, either learned (GPT-2) or computed from sine/cosine waves (original Transformer). They work well inside the training length, but attention never sees relative distance directly. A query at position 100 and a key at position 92 get unrelated position vectors; the model must learn from data that "offset 8" matters. This is fragile outside the trained range and makes extrapolation to longer contexts unreliable.',
        'Sinusoidal encodings partially address this because their structure encodes relative shifts, but they add position to the input embedding once, before any attention layer. RoPE moves position into the attention computation itself, where the decision about relevance is actually made.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'RoPE works because 2D rotation is norm-preserving and the dot product of two rotated vectors depends only on their angle difference. If a query at position m is rotated by m*theta and a key at position n is rotated by n*theta, the positional part of their dot product depends on (m-n)*theta -- the relative offset, not the absolute positions. This is a mathematical identity of rotation matrices, not a learned approximation.',
        'The invariant is: same content vectors at equal relative offset produce equal positional contribution to the attention score, regardless of where they sit in the sequence. This means the model can generalize position-dependent patterns across the context window. The multi-frequency design (fast and slow rotation pairs) gives attention a ruler with both fine and coarse resolution, so nearby tokens are sharply distinguished while distant tokens remain separable.',
      ],
    },
],
};
