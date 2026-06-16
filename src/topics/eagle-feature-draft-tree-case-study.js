// EAGLE decoding: draft at the feature level, convert features to token trees,
// and verify with the target model under a lossless acceptance contract.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'eagle-feature-draft-tree-case-study',
  title: 'EAGLE Feature Draft Tree Case Study',
  category: 'AI & ML',
  summary: 'A speculative decoding case study for EAGLE: second-to-top-layer feature drafting, token-shift conditioning, dynamic draft trees, calibration, and target verification.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['feature drafting', 'dynamic draft tree'], defaultValue: 'feature drafting' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function eagleGraph(title) {
  return graphState({
    nodes: [
      { id: 'pref', label: 'pre', x: 0.7, y: 3.4, note: 'prefix' },
      { id: 'feat', label: 'feat', x: 2.2, y: 2.0, note: 'layer' },
      { id: 'tok', label: 'tok', x: 2.2, y: 4.8, note: 'shift' },
      { id: 'draft', label: 'dft', x: 3.9, y: 3.4, note: 'model' },
      { id: 'tree', label: 'tree', x: 5.5, y: 3.4, note: 'draft' },
      { id: 'cal', label: 'cal', x: 7.0, y: 2.0, note: 'conf' },
      { id: 'ver', label: 'ver', x: 7.0, y: 4.8, note: 'target' },
      { id: 'out', label: 'out', x: 8.7, y: 3.4, note: 'emit' },
      { id: 'log', label: 'log', x: 9.8, y: 3.4, note: 'acc' },
    ],
    edges: [
      { id: 'e-pre-feat', from: 'pref', to: 'feat' },
      { id: 'e-pre-tok', from: 'pref', to: 'tok' },
      { id: 'e-feat-draft', from: 'feat', to: 'draft' },
      { id: 'e-tok-draft', from: 'tok', to: 'draft' },
      { id: 'e-draft-tree', from: 'draft', to: 'tree' },
      { id: 'e-tree-cal', from: 'tree', to: 'cal' },
      { id: 'e-tree-ver', from: 'tree', to: 'ver' },
      { id: 'e-cal-ver', from: 'cal', to: 'ver' },
      { id: 'e-ver-out', from: 'ver', to: 'out' },
      { id: 'e-out-log', from: 'out', to: 'log' },
    ],
  }, { title });
}

function* featureDrafting() {
  yield {
    state: eagleGraph('EAGLE drafts in feature space'),
    highlight: { active: ['pref', 'feat', 'tok', 'draft', 'e-pre-feat', 'e-pre-tok', 'e-feat-draft', 'e-tok-draft'], compare: ['tree'], found: ['ver'] },
    explanation: 'EAGLE predicts second-to-top-layer features rather than directly predicting only future tokens. The advanced token sequence helps reduce feature uncertainty before target verification.',
    invariant: 'Feature drafts are proposals; the target model still verifies emitted tokens.',
  };

  yield {
    state: labelMatrix(
      'Feature draft payload',
      [
        { id: 'h0', label: 'h0' },
        { id: 'x1', label: 'x+1' },
        { id: 'f1', label: 'f+1' },
        { id: 'f2', label: 'f+2' },
        { id: 'tok', label: 'tok' },
      ],
      [
        { id: 'kind', label: 'kind' },
        { id: 'use', label: 'use' },
      ],
      [
        ['feat', 'state'],
        ['token', 'shift'],
        ['feat', 'draft'],
        ['feat', 'draft'],
        ['token', 'tree'],
      ],
    ),
    highlight: { active: ['h0:use', 'x1:use', 'f1:use', 'f2:use'], found: ['tok:use'] },
    explanation: 'The bridge between features and tokens is the important data structure. EAGLE uses target-model features, shifted tokens, a draft model, and token projections to build a tree for verification.',
  };

  yield {
    state: eagleGraph('Target verification preserves the output contract'),
    highlight: { active: ['tree', 'ver', 'out', 'log', 'e-tree-ver', 'e-ver-out', 'e-out-log'], compare: ['draft'], found: ['cal'] },
    explanation: 'The target model validates the draft tree. Accepted tokens update the target KV state; rejected branches are discarded and recorded for acceptance-rate calibration.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'draft depth', min: 1, max: 8 }, y: { label: 'accept probability', min: 0, max: 1 } },
      series: [
        { id: 'token', label: 'token draft', points: [{ x: 1, y: 0.74 }, { x: 2, y: 0.52 }, { x: 4, y: 0.25 }, { x: 6, y: 0.13 }, { x: 8, y: 0.08 }] },
        { id: 'feature', label: 'feature draft', points: [{ x: 1, y: 0.82 }, { x: 2, y: 0.66 }, { x: 4, y: 0.43 }, { x: 6, y: 0.29 }, { x: 8, y: 0.20 }] },
      ],
      markers: [
        { id: 'depth', x: 4, y: 0.43, label: 'tree cut' },
      ],
    }),
    highlight: { active: ['feature', 'depth'], compare: ['token'] },
    explanation: 'Feature-level drafting can keep deeper draft positions useful longer, but acceptance still decays with depth. That decay curve decides tree depth and width.',
  };
}

function* dynamicDraftTree() {
  yield {
    state: eagleGraph('Dynamic tree uses confidence as a budget signal'),
    highlight: { active: ['draft', 'tree', 'cal', 'ver', 'e-draft-tree', 'e-tree-cal', 'e-cal-ver'], found: ['out'] },
    explanation: 'EAGLE-2 makes the draft tree context-aware. Instead of a fixed tree shape, confidence estimates decide which branches deserve verification budget for this prefix.',
  };

  yield {
    state: labelMatrix(
      'Dynamic branch table',
      [
        { id: 'b1', label: 'b1' },
        { id: 'b2', label: 'b2' },
        { id: 'b3', label: 'b3' },
        { id: 'b4', label: 'b4' },
        { id: 'b5', label: 'b5' },
      ],
      [
        { id: 'conf', label: 'conf' },
        { id: 'cost', label: 'cost' },
        { id: 'act', label: 'act' },
      ],
      [
        ['.88', 'low', 'keep'],
        ['.71', 'med', 'keep'],
        ['.42', 'med', 'hold'],
        ['.20', 'high', 'drop'],
        ['.65', 'low', 'keep'],
      ],
    ),
    highlight: { active: ['b1:act', 'b2:act', 'b5:act'], compare: ['b3:act'], removed: ['b4:act'] },
    explanation: 'A dynamic draft tree treats branch confidence as an expected-acceptance estimate. High-confidence cheap branches stay; low-confidence expensive branches are pruned before verification.',
  };

  yield {
    state: labelMatrix(
      'Complete case: math answer',
      [
        { id: 'a', label: 'pre' },
        { id: 'b', label: 'draft' },
        { id: 'c', label: 'verify' },
        { id: 'd', label: 'emit' },
      ],
      [
        { id: 'node', label: 'node' },
        { id: 'conf', label: 'conf' },
        { id: 'act', label: 'act' },
      ],
      [
        ['step', '.80', 'wide'],
        ['calc', '.62', 'keep'],
        ['unit', '.28', 'drop'],
        ['calc', 'pass', 'emit'],
      ],
    ),
    highlight: { active: ['a:act', 'b:act', 'd:act'], found: ['d:conf'], removed: ['c:act'] },
    explanation: 'A math response has one high-confidence calculation branch and one weak unit-conversion branch. The dynamic tree verifies the strong branch and drops the weak one before it burns target time.',
  };

  yield {
    state: eagleGraph('Acceptance history recalibrates the tree'),
    highlight: { active: ['cal', 'log', 'e-out-log'], found: ['tree', 'ver'], compare: ['draft'] },
    explanation: 'The runtime compares predicted confidence with observed acceptance. If calibration drifts by domain or temperature, the controller shrinks the tree or routes to a different speculative method.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'feature drafting') yield* featureDrafting();
  else if (view === 'dynamic draft tree') yield* dynamicDraftTree();
  else throw new InputError('Pick an EAGLE feature-draft view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'EAGLE is a speculative decoding method that drafts future computation at the feature level. Instead of only using a small token-level draft model, it predicts second-to-top-layer features and then verifies a token draft tree with the target model.',
        'This module complements Speculative Decoding Acceptance Ledger and Multi-Token Decoding. It explains the feature payload, token-shift conditioning, dynamic draft tree, confidence calibration, and target verification ledger.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The EAGLE runtime stores target-model features, shifted token inputs, draft-model outputs, candidate token nodes, branch confidence, dynamic tree shape, verifier results, accepted-token spans, and calibration residuals.',
        'The dynamic tree is the most operationally important structure. It maps confidence and expected cost to a branch budget. That lets the serving system spend target verification on branches likely to be accepted for this specific context.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The target model produces a hidden feature state. EAGLE uses that feature state and a token sequence advanced by one step to predict future features. Those features are projected into candidate tokens, arranged into a tree, and verified by the target model.',
        'EAGLE-2 adds context-aware dynamic draft trees. A static tree assumes acceptance depends mostly on position. A dynamic tree uses draft confidence to allocate more branches where this prefix looks predictable and fewer branches where it looks uncertain.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A math-answer workload alternates between predictable calculation phrases and uncertain unit conversions. A static tree verifies too many weak branches. A dynamic EAGLE tree gives more budget to high-confidence calculation continuations and prunes low-confidence unit branches before target verification.',
        'The ledger stores predicted confidence, actual acceptance, rejected branch depth, and latency. Over time, those records tell the controller whether the feature draft model is calibrated for math, code, chat, or tool-call traffic.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Feature drafting can lose if calibration drifts, if the draft model is weak on a domain, if dynamic tree construction is too expensive, or if the serving system reports token throughput without tail latency. It also needs careful KV handoff after accepted tokens.',
        'A dynamic tree should be auditable. If a branch was dropped because confidence was low, the ledger should say so. Otherwise teams cannot tell whether failures came from draft quality, verifier cost, or routing policy.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: EAGLE at https://arxiv.org/abs/2401.15077, EAGLE-2 at https://arxiv.org/abs/2406.16858, speculative decoding at https://arxiv.org/abs/2211.17192, vLLM speculative decoding at https://docs.vllm.ai/en/stable/features/speculative_decoding/, and NVIDIA Triton speculative decoding at https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/tutorials/Feature_Guide/Speculative_Decoding/README.html.',
        'Study next: Speculative Decoding Runtime Controller Case Study, Medusa Tree Attention Candidate Mask Case Study, Lookahead Decoding N-Gram Pool Case Study, Speculative Decoding Acceptance Ledger, Calibration Curves, Threshold Optimization, and Transformer Inference Roofline.',
      ],
    },
  ],
};
