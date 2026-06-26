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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each tree node as a proposed future token sequence. Active means the draft system is expanding or scoring a branch, visited means the verifier has checked that branch against the target model, and found means a prefix was accepted and can be committed to the output.',
        'The safe inference rule is target verification. A draft branch can save time only when the expensive target model accepts the same prefix that ordinary decoding would have produced under the serving contract. Rejected branches are work already spent.',
        {type:'callout', text:'EAGLE turns speculative decoding into a verified proposal economy: hidden features make better draft branches, and target verification decides what can be committed.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Autoregressive decoding generates text one token at a time. A token is a model vocabulary item, and each new token normally needs another full target-model pass. Long answers are slow because the expensive model repeats this loop many times.',
        'Speculative decoding tries to propose several future tokens cheaply, then verify them with the target model. EAGLE exists because token-only draft models often lose accuracy as they predict farther ahead. It drafts from hidden features, which are internal vector representations produced by the target model.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a small draft model that predicts the next few tokens. The target model checks those tokens and accepts the longest prefix that matches. This can reduce the number of target passes when the draft is often right.',
        'A fixed draft length is also tempting. Ask for four future tokens, verify four, and hope the target accepts most of them. The implementation is simple because every request gets the same amount of speculation.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is acceptance decay. The first proposed token may match often, the second less often, and the fourth may be mostly wrong. A wrong early token poisons all later tokens on that branch because they were predicted in the wrong future.',
        'The systems wall is wasted verification. A wide tree consumes memory bandwidth, attention work, scheduling space, and cache bookkeeping. If most branches fail, speculative decoding can make p95 latency worse while still looking impressive on accepted tokens per target pass.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'EAGLE drafts in feature space before projecting to tokens. A hidden feature near the top of the target model already carries information about the prefix. A small draft module can extrapolate future features, then a token head turns those features into candidate tokens.',
        'The second insight is dynamic tree budgeting. Easy prefixes can support deeper or wider drafts, while ambiguous prefixes should receive less speculation. Confidence is a control signal for how much tree to build, not a decorative score.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At a decode step, the target model has processed the current prefix and produced hidden features. EAGLE feeds a near-top feature and shifted token information into a draft module. The module predicts future features, projects them to candidate tokens, and arranges candidates in a tree.',
        'The verifier runs the target model over the candidate structure and finds the accepted prefix. Accepted tokens advance the output and the target key-value cache, which stores attention state for earlier tokens. Rejected branches are discarded without changing the committed sequence.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Feature drafting can work because hidden features contain more target-model structure than raw token guesses alone. The draft is still approximate, but it is approximate in a representation shaped by the target. That can keep deeper proposals useful for predictable text.',
        'Correctness comes from verification. In greedy decoding, accepted tokens must match the target choices. In sampling modes, the acceptance rule must preserve the target distribution. The draft model proposes; the target model decides what becomes output.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Let one target pass cost 10 ms and one draft expansion cost 1 ms. If the tree costs 2 ms and the verifier accepts three tokens, the system spends about 12 ms for three tokens instead of 30 ms. If it accepts only one token, it spends 12 ms for work that ordinary decoding might have done in 10 ms.',
        'The important behavior is accepted tokens per expensive target pass after overhead. Larger trees raise the chance of finding a longer accepted prefix, but they also raise memory traffic and branch management cost. When traffic doubles, the extra draft model and tree state compete with batching and cache memory.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'EAGLE-style drafting fits long decode workloads where the target model is expensive and text has predictable stretches. Code completion, templated business writing, low-temperature assistants, and repeated boilerplate are natural candidates. The method is less useful when prefill dominates total latency.',
        'It also teaches a general systems pattern. An approximate generator becomes safe only when paired with a verifier and an accounting loop. The tree is a budgeted proposal structure, not a replacement for the target model.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when confidence is miscalibrated. A branch that looked strong on training traffic may be weak on a new domain, prompt format, target checkpoint, or temperature. Dynamic trees then allocate compute to bad futures.',
        'It also fails through coupling. The draft module depends on target-model internals, feature shapes, quantization choices, and serving-engine cache behavior. A target upgrade can silently change the value of the draft path unless equivalence and latency are retested.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Assume normal decoding takes one 12 ms target pass per token. A prompt begins with "def add_numbers", and the draft tree proposes "(", "a", ",", "b" on one branch. The verifier accepts four tokens, so the request gets 48 ms of ordinary token work for one 12 ms verification pass plus 3 ms of draft overhead.',
        'Now use the prompt "The legal answer depends on". The draft proposes common phrasing, but the verifier accepts only the first token. The request spends 15 ms to advance one token, so the controller should shrink the tree or disable EAGLE for that traffic slice.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: EAGLE at https://arxiv.org/abs/2401.15077 and EAGLE-2 at https://arxiv.org/abs/2406.16858. Study them for feature-level drafting, tree verification, confidence thresholds, and measured acceptance behavior.',
        'Study Speculative Decoding, Medusa Tree Attention Candidate Mask, Lookahead Decoding, Transformer KV Cache, Calibration Curves, Threshold Optimization, and Transformer Inference Roofline to understand the model and serving constraints around EAGLE. Start with verifier mechanics before comparing tree shapes.',
      ],
    },
  ],
};
