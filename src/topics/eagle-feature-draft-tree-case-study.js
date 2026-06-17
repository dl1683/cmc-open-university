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
        'EAGLE is a speculative decoding method for large language model serving. It tries to reduce the number of expensive target-model decoding iterations by proposing several future tokens at once, then asking the target model to verify those proposals. The final output still depends on target verification. The draft is a way to save time, not a permission to let a weaker model change the answer contract.',
        'The distinctive idea in EAGLE is to draft at the feature level. Instead of using only a small token-level draft model, EAGLE predicts hidden features near the top of the target model and then converts those features into token candidates. Later versions use dynamic draft trees, where branch width and depth depend on confidence for the current prefix. The case study is valuable because it connects model internals, tree data structures, calibration, and serving economics in one mechanism.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious way to speed up decoding is to train a small draft model that predicts future tokens and let the target model verify them. This works when the small model is cheap and its proposals agree with the target often enough. The wall is acceptance decay. The first proposed token may be accepted frequently, the second less often, and deeper proposals may be mostly wasted. A wide draft tree can become expensive noise if most branches fail verification.',
        'A pure token draft also has a modeling problem. Tokens are discrete and uncertain, especially several positions ahead. Once a draft makes an early wrong token choice, later token predictions live in the wrong future. A serving system then pays to verify branches that were unlikely to match the target in the first place. Better hardware kernels cannot fix a bad proposal distribution. The useful question becomes: what representation gives the draft model enough structure to predict several future steps without losing the target contract?',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'EAGLE treats hidden features as a more informative drafting space than raw future tokens alone. A near-top hidden state already contains a compressed representation of the target model computation for the prefix. If a lightweight draft module can extrapolate future features from that state and the shifted token sequence, it may preserve more of the target model structure than a separate token-only model. The proposal is still approximate, but it is approximate in a space shaped by the target.',
        'The second insight is that draft trees should be budgeted by confidence. A fixed tree assumes every prefix deserves the same speculative effort. Real traffic is not like that. Boilerplate code, repeated phrasing, and low-temperature completions may support deeper drafts. Ambiguous reasoning, tool-call boundaries, or high-temperature chat may not. EAGLE-2 turns confidence into a runtime control signal so the system spends verification work where acceptance is plausible.',
      ],
    },
    {
      heading: 'Core data structures',
      paragraphs: [
        'An EAGLE runtime needs several linked records. The feature payload stores the target model hidden state, the shifted token inputs used for conditioning, and the draft model outputs for future positions. The token projection record turns predicted features into candidate tokens. The draft tree stores candidate nodes, parent links, depth, probability or confidence, and pruning status. The verifier record stores which nodes the target accepted, where rejection happened, and which accepted tokens may be appended to the target state.',
        'The dynamic tree is the central data structure. It is not just a visual tree. It is a budget allocation table. Each branch has expected benefit, expected verification cost, and calibration history. High-confidence cheap branches stay. Low-confidence expensive branches are pruned. A serving implementation also needs a KV state ledger so accepted tokens advance the target cache correctly while rejected branches leave no trace in the committed sequence.',
      ],
    },
    {
      heading: 'Mechanism step by step',
      paragraphs: [
        'At a decoding step, the target model has already processed the prefix and produced internal features. EAGLE uses a feature from near the top of the target model, along with token information shifted forward, as input to a draft module. The draft module predicts future features. Those predicted features are projected through token heads to form candidate continuations. The continuations are arranged into a tree rather than a single chain because several futures may be plausible.',
        'The target model then verifies the candidate tree. In greedy decoding, verification checks whether the candidate tokens match what the target would choose. In sampling settings, the acceptance logic must preserve the target distribution. Accepted tokens are committed, target KV state advances, and rejected branches are discarded. The runtime logs depth, branch width, confidence, accepted length, verifier time, and fallback behavior. The speedup comes only from accepted tokens per expensive target pass after subtracting draft and tree overhead.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'EAGLE works when feature-level extrapolation creates better proposals than a cheap token-only draft at similar cost. Hidden features carry contextual structure learned by the target model, so a draft module operating in that space can sometimes keep deeper positions useful. The target verification step protects correctness: a bad draft wastes work, but it should not silently change the output when the acceptance contract is implemented correctly.',
        'Dynamic trees work because acceptance is not uniform. If confidence is calibrated, the runtime can search a smaller but more valuable proposal set. That matters for serving because target verification is not free. A branch that will almost certainly fail is worse than no branch: it consumes memory bandwidth, attention work, scheduling space, and latency budget. Confidence-aware pruning turns speculative decoding from a fixed algorithm into a controller.',
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        'EAGLE-style drafting is useful in workloads where the target model is expensive, decode length is significant, and future text has enough predictability for proposals to be accepted. Code completion, boilerplate-heavy generation, template-like business writing, low-temperature assistants, and repeated reasoning phrases are natural candidates. It is also useful as a curriculum example because it exposes the interaction between model representation and systems throughput.',
        'It is less attractive when prompts are short and prefill dominates latency, when output is very stochastic, when batch scheduling already saturates the hardware, or when the draft module creates deployment complexity larger than the expected gain. A team should not evaluate it only with tokens per second on a friendly benchmark. It must be measured under real batching, cache layout, model variants, temperature settings, and tail-latency goals.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Feature drafting can fail through calibration drift. A branch that looked high confidence during training may be weak on a new domain, new temperature, new prompt format, or new target checkpoint. It can also fail through tree overhead: building, sorting, masking, and verifying a dynamic tree can erase the savings if the implementation is not tight. The method may look good in accepted tokens per pass while p95 latency gets worse.',
        'It also carries coupling risk. The draft module depends on feature shapes and target-model internals. Changing the target checkpoint, quantization mode, tensor-parallel layout, or serving engine may require retesting the draft path. KV handoff is correctness-critical. If accepted tokens do not update the target state exactly as ordinary decoding would, the system can produce subtle divergence. The verifier is the guardrail, but the state transition still has to be engineered correctly.',
      ],
    },
    {
      heading: 'Operational and evaluation signals',
      paragraphs: [
        'Track accepted tokens per verification pass, acceptance by depth, branch survival rate, confidence calibration error, draft overhead, verifier overhead, target iterations saved, p50 and p95 latency, throughput under batch load, memory overhead, fallback rate, and domain slices. Separate greedy, low-temperature, high-temperature, code, chat, and tool-call traffic. A single average can hide the fact that one slice speeds up while another burns latency.',
        'The best evaluation includes an acceptance ledger. For each request, log tree shape, confidence, accepted prefix length, rejected branch, committed KV range, and reason for fallback. Then compare ordinary decoding and EAGLE decoding under the same target model and sampling contract. If the method claims lossless serving, test output equivalence or distribution preservation directly rather than assuming verification makes every implementation correct.',
      ],
    },
    {
      heading: 'What to study next',
      paragraphs: [
        'Study speculative decoding, Medusa, lookahead decoding, multi-token decoding, transformer KV caches, tree attention, calibration curves, threshold optimization, and transformer inference roofline models. The EAGLE papers are the primary source for feature-level drafting and dynamic draft trees. Serving documentation from engines such as vLLM and Triton is useful for seeing how speculative paths interact with production batching and cache management.',
        'For data structures, focus on trees, masks, append-only ledgers, matrices, priority queues, and controller state. EAGLE is not only a model trick. It is a lesson in how an approximate proposal structure can be made useful by a verifier, a confidence model, and careful operational accounting.',
      ],
    },
  ],
};
