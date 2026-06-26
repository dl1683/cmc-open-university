// Early-exit transformers: attach confidence gates to intermediate layers,
// skip later layers for easy tokens, and verify when exact output matters.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'early-exit-transformer-layer-skipping-case-study',
  title: 'Early-Exit Transformer Layer Skipping',
  category: 'AI & ML',
  summary: 'Confidence-gated transformer inference: easy tokens exit at shallow layers, hard tokens continue, and LayerSkip-style serving verifies drafts with the same model.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['exit gates', 'self verify'], defaultValue: 'exit gates' },
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

function gateGraph(title) {
  return graphState({
    nodes: [
      { id: 'tok', label: 'token', x: 0.7, y: 3.7, note: 'next' },
      { id: 'l4', label: 'L4', x: 2.1, y: 2.0, note: 'cheap' },
      { id: 'l8', label: 'L8', x: 3.5, y: 3.0, note: 'mid' },
      { id: 'l16', label: 'L16', x: 4.9, y: 4.0, note: 'deep' },
      { id: 'full', label: 'full', x: 6.2, y: 5.0, note: 'last' },
      { id: 'gate', label: 'gate', x: 6.3, y: 2.2, note: 'conf' },
      { id: 'emit', label: 'emit', x: 8.3, y: 2.2, note: 'commit' },
      { id: 'log', label: 'ledger', x: 8.3, y: 4.6, note: 'stats' },
    ],
    edges: [
      { id: 'e-t-l4', from: 'tok', to: 'l4', weight: 'layers' },
      { id: 'e-l4-l8', from: 'l4', to: 'l8', weight: 'if unsure' },
      { id: 'e-l8-l16', from: 'l8', to: 'l16', weight: 'if unsure' },
      { id: 'e-l16-full', from: 'l16', to: 'full', weight: 'hard' },
      { id: 'e-l4-gate', from: 'l4', to: 'gate', weight: 'logits' },
      { id: 'e-l8-gate', from: 'l8', to: 'gate', weight: 'logits' },
      { id: 'e-l16-gate', from: 'l16', to: 'gate', weight: 'logits' },
      { id: 'e-gate-emit', from: 'gate', to: 'emit', weight: 'exit' },
      { id: 'e-full-log', from: 'full', to: 'log', weight: 'audit' },
      { id: 'e-gate-log', from: 'gate', to: 'log', weight: 'sample' },
    ],
  }, { title });
}

function verifyGraph(title) {
  return graphState({
    nodes: [
      { id: 'ctx', label: 'prefix', x: 0.6, y: 3.8, note: 'KV' },
      { id: 'early', label: 'early L', x: 2.2, y: 2.4, note: 'draft' },
      { id: 'head', label: 'LM head', x: 4.0, y: 2.4, note: 'logits' },
      { id: 'draft', label: 'draft', x: 5.7, y: 2.4, note: 'tokens' },
      { id: 'late', label: 'late L', x: 4.0, y: 5.1, note: 'verify' },
      { id: 'accept', label: 'accept', x: 7.4, y: 3.0, note: 'prefix' },
      { id: 'repair', label: 'repair', x: 7.4, y: 5.0, note: 'reject' },
      { id: 'emit', label: 'emit', x: 9.0, y: 4.0, note: 'stream' },
    ],
    edges: [
      { id: 'e-ctx-early', from: 'ctx', to: 'early', weight: 'shared KV' },
      { id: 'e-early-head', from: 'early', to: 'head', weight: 'hidden' },
      { id: 'e-head-draft', from: 'head', to: 'draft', weight: 'tokens' },
      { id: 'e-draft-late', from: 'draft', to: 'late', weight: 'check' },
      { id: 'e-late-accept', from: 'late', to: 'accept', weight: 'match' },
      { id: 'e-late-repair', from: 'late', to: 'repair', weight: 'mismatch' },
      { id: 'e-accept-emit', from: 'accept', to: 'emit', weight: 'advance' },
      { id: 'e-repair-emit', from: 'repair', to: 'emit', weight: 'fallback' },
    ],
  }, { title });
}

function* exitGates() {
  yield {
    state: labelMatrix(
      'Different tokens deserve different depth',
      [
        { id: 'comma', label: 'comma' },
        { id: 'stock', label: 'stock phrase' },
        { id: 'fact', label: 'fact' },
        { id: 'code', label: 'code' },
        { id: 'ambig', label: 'ambiguous' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'action', label: 'action' },
      ],
      [
        ['high margin', 'exit L4'],
        ['stable reps', 'exit L8'],
        ['medium', 'continue'],
        ['low margin', 'full pass'],
        ['uncertain', 'full pass'],
      ],
    ),
    highlight: { active: ['comma:action', 'stock:action'], compare: ['code:action', 'ambig:action'] },
    explanation: 'Early-exit inference starts with a simple observation: autoregressive models spend the same layer depth on punctuation, formulaic text, facts, code, and genuinely ambiguous continuations. A gate tries to skip later layers only when the intermediate prediction is confident enough.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'layer', min: 0, max: 24 }, y: { label: 'confidence', min: 0, max: 1 } },
      series: [
        { id: 'easy', label: 'easy token', points: [
          { x: 2, y: 0.55 }, { x: 4, y: 0.86 }, { x: 8, y: 0.91 }, { x: 16, y: 0.93 }, { x: 24, y: 0.94 },
        ] },
        { id: 'hard', label: 'hard token', points: [
          { x: 2, y: 0.24 }, { x: 4, y: 0.38 }, { x: 8, y: 0.51 }, { x: 16, y: 0.72 }, { x: 24, y: 0.88 },
        ] },
        { id: 'threshold', label: 'gate', points: [
          { x: 0, y: 0.82 }, { x: 24, y: 0.82 },
        ] },
      ],
      markers: [
        { id: 'exit4', x: 4, y: 0.86, label: 'exit' },
        { id: 'full24', x: 24, y: 0.88, label: 'full' },
      ],
    }),
    highlight: { active: ['easy', 'exit4'], compare: ['hard', 'full24'], found: ['threshold'] },
    explanation: 'A confidence gate can exit an easy token around layer 4 while forcing a hard token through the full model. The hidden data structure is a small threshold schedule keyed by layer, token position, route, and risk class.',
    invariant: 'A token exits only if its calibrated confidence crosses the policy threshold.',
  };

  yield {
    state: gateGraph('The runtime checks logits at intermediate layers'),
    highlight: { active: ['l4', 'l8', 'gate', 'e-l4-gate', 'e-l8-gate'], found: ['emit'], compare: ['full'] },
    explanation: 'At selected layers the model projects hidden states through an exit head or shared LM head, computes a confidence score, and asks the gate whether to commit. If the gate refuses, the same token continues deeper.',
  };

  yield {
    state: labelMatrix(
      'Runtime data structures',
      [
        { id: 'table', label: 'exit table' },
        { id: 'buffer', label: 'conf buf' },
        { id: 'kv', label: 'KV slice' },
        { id: 'stats', label: 'stats' },
        { id: 'policy', label: 'policy' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'used', label: 'used for' },
      ],
      [
        ['layer gates', 'routing'],
        ['logits+margin', 'decision'],
        ['past states', 'resume'],
        ['exit rates', 'drift watch'],
        ['risk class', 'fallback'],
      ],
    ),
    highlight: { active: ['table:stores', 'buffer:stores', 'kv:used'], found: ['stats:used', 'policy:used'] },
    explanation: 'The implementation is not just a model trick. It needs an exit table, a confidence buffer, reusable KV state, per-route counters, and a policy object that can force full-depth inference for risky traffic.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'gate threshold', min: 0.5, max: 0.98 }, y: { label: 'relative score', min: 0, max: 100 } },
      series: [
        { id: 'speed', label: 'speed', points: [
          { x: 0.55, y: 92 }, { x: 0.65, y: 84 }, { x: 0.75, y: 72 }, { x: 0.85, y: 55 }, { x: 0.95, y: 22 },
        ] },
        { id: 'quality', label: 'quality', points: [
          { x: 0.55, y: 71 }, { x: 0.65, y: 81 }, { x: 0.75, y: 90 }, { x: 0.85, y: 96 }, { x: 0.95, y: 99 },
        ] },
        { id: 'p99', label: 'p99 health', points: [
          { x: 0.55, y: 74 }, { x: 0.65, y: 83 }, { x: 0.75, y: 91 }, { x: 0.85, y: 92 }, { x: 0.95, y: 76 },
        ] },
      ],
      markers: [
        { id: 'knee', x: 0.78, y: 90, label: 'knee' },
      ],
    }),
    highlight: { active: ['quality', 'p99', 'knee'], compare: ['speed'] },
    explanation: 'The threshold is a product knob. Too loose and quality drops. Too strict and almost every token pays full depth. The best operating point is usually a calibrated knee, not the maximum possible early-exit rate.',
  };

  yield {
    state: labelMatrix(
      'Research lineage',
      [
        { id: 'deebert', label: 'DeeBERT' },
        { id: 'fastbert', label: 'FastBERT' },
        { id: 'calm', label: 'CALM' },
        { id: 'layerskip', label: 'LayerSkip' },
      ],
      [
        { id: 'idea', label: 'idea' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['entropy exit', 'classification'],
        ['self-distill', 'tunable speed'],
        ['seq guarantee', 'calibration'],
        ['self draft', 'verify path'],
      ],
    ),
    highlight: { active: ['calm:idea', 'layerskip:idea'], found: ['deebert:lesson', 'fastbert:lesson'] },
    explanation: 'The modern LLM version inherits ideas from older early-exit classifiers, adds sequence-level calibration from CALM, and then uses LayerSkip-style self-speculation when exact verification is required.',
  };
}

function* selfVerify() {
  yield {
    state: verifyGraph('LayerSkip-style self-speculation uses one model twice'),
    highlight: { active: ['early', 'head', 'draft', 'late'], found: ['accept', 'repair'] },
    explanation: 'Self-speculative decoding drafts with the early layers of the same model, then verifies with the remaining layers. This avoids carrying a separate draft model and lets the runtime share weights, activations, and cache state.',
    invariant: 'Accepted tokens must match the verification path, so speed does not require changing the final model output.',
  };

  yield {
    state: labelMatrix(
      'What gets reused',
      [
        { id: 'weights', label: 'weights' },
        { id: 'kv', label: 'KV cache' },
        { id: 'query', label: 'query' },
        { id: 'logits', label: 'logits' },
        { id: 'accept', label: 'accept map' },
      ],
      [
        { id: 'reuse', label: 'reuse' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['same model', 'needs training'],
        ['early layers', 'layout'],
        ['exit layer', 'bookkeeping'],
        ['draft score', 'miscalib'],
        ['prefix ok', 'low match'],
      ],
    ),
    highlight: { active: ['weights:reuse', 'kv:reuse', 'query:reuse'], compare: ['logits:risk', 'accept:risk'] },
    explanation: 'The serving data structure often becomes a KVQ-style cache: ordinary KV for early layers plus enough exit-layer query state to let later layers continue verification without recomputing the prefix from scratch.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'exit layer', min: 1, max: 32 }, y: { label: 'tokens/pass', min: 0, max: 5 } },
      series: [
        { id: 'accept', label: 'accepted', points: [
          { x: 2, y: 0.8 }, { x: 4, y: 1.7 }, { x: 8, y: 3.4 }, { x: 12, y: 3.7 }, { x: 18, y: 2.8 }, { x: 24, y: 1.8 }, { x: 32, y: 1.0 },
        ] },
        { id: 'cost', label: 'cost saved', points: [
          { x: 2, y: 4.5 }, { x: 4, y: 4.2 }, { x: 8, y: 3.5 }, { x: 12, y: 2.9 }, { x: 18, y: 2.0 }, { x: 24, y: 1.1 }, { x: 32, y: 0.0 },
        ] },
      ],
      markers: [
        { id: 'sweet', x: 10, y: 3.6, label: 'sweet spot' },
      ],
    }),
    highlight: { active: ['accept', 'sweet'], compare: ['cost'] },
    explanation: 'Very early exits are cheap but inaccurate. Very late exits are accurate but save little compute. Production tuning searches for the exit layer and draft length that maximize accepted tokens per expensive verification pass at the p99 target.',
  };

  yield {
    state: labelMatrix(
      'Scheduler interactions',
      [
        { id: 'batch', label: 'batching' },
        { id: 'paged', label: 'paged KV' },
        { id: 'prefix', label: 'prefix hit' },
        { id: 'fallback', label: 'fallback' },
        { id: 'telemetry', label: 'telemetry' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'hazard', label: 'hazard' },
      ],
      [
        ['same lane', 'shape split'],
        ['less waste', 'block churn'],
        ['reuse ctx', 'stale route'],
        ['safe full', 'p99 spike'],
        ['exit stats', 'label drift'],
      ],
    ),
    highlight: { active: ['batch:hazard', 'paged:benefit', 'fallback:benefit'], found: ['telemetry:benefit'] },
    explanation: 'Early exit has to compose with continuous batching, PagedAttention, prefix caching, and fallback routing. A faster average can still lose if draft/verify shapes fragment the batch or fallback spikes p99.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'eval', label: 'eval set', x: 0.7, y: 3.8, note: 'slices' },
        { id: 'calib', label: 'calib', x: 2.4, y: 3.8, note: 'LTT' },
        { id: 'gate', label: 'gate', x: 4.0, y: 2.5, note: 'policy' },
        { id: 'canary', label: 'canary', x: 4.0, y: 5.1, note: 'small' },
        { id: 'live', label: 'live', x: 6.0, y: 3.8, note: 'traffic' },
        { id: 'watch', label: 'watch', x: 7.8, y: 3.8, note: 'drift' },
        { id: 'full', label: 'full path', x: 9.3, y: 3.8, note: 'escape' },
      ],
      edges: [
        { id: 'e-eval-calib', from: 'eval', to: 'calib', weight: 'thresholds' },
        { id: 'e-calib-gate', from: 'calib', to: 'gate', weight: 'risk' },
        { id: 'e-gate-canary', from: 'gate', to: 'canary', weight: 'rollout' },
        { id: 'e-canary-live', from: 'canary', to: 'live', weight: 'promote' },
        { id: 'e-live-watch', from: 'live', to: 'watch', weight: 'metrics' },
        { id: 'e-watch-full', from: 'watch', to: 'full', weight: 'fallback' },
      ],
    }, { title: 'Calibration turns a shortcut into a controlled system' }),
    highlight: { active: ['eval', 'calib', 'gate'], found: ['watch', 'full'] },
    explanation: 'CALM is important because it treats thresholds as calibrated policies, not vibes. The production loop needs slices, sequence-level constraints, canaries, live drift checks, and an always-available full-depth escape hatch.',
  };

  yield {
    state: labelMatrix(
      'Production runbook',
      [
        { id: 'train', label: 'train' },
        { id: 'calib', label: 'calibrate' },
        { id: 'canary', label: 'canary' },
        { id: 'monitor', label: 'monitor' },
        { id: 'rollback', label: 'rollback' },
        { id: 'retrain', label: 'retrain' },
      ],
      [
        { id: 'log', label: 'log' },
        { id: 'stop', label: 'stop if' },
      ],
      [
        ['exit loss', 'quality loss'],
        ['thresholds', 'slice fails'],
        ['route id', 'p99 worse'],
        ['accept rate', 'drift'],
        ['full path', 'risk up'],
        ['new data', 'stale gates'],
      ],
    ),
    highlight: { active: ['calib:log', 'monitor:log', 'rollback:log'], compare: ['train:stop'] },
    explanation: 'A mature rollout logs why each request exited, which layer was used, whether verification accepted the draft, and which fallback would have run. Without that ledger, the team cannot tell whether savings came from easy traffic or from silent quality loss.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'exit gates') yield* exitGates();
  else if (view === 'self verify') yield* selfVerify();
  else throw new InputError('Pick an early-exit transformer view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read each transformer layer as a possible compute checkpoint. Active means the token is being evaluated at the current layer, visited means a shallower layer has already produced a score, and found means the gate or verifier accepted an output for that token.',
        'The safe inference rule depends on the mode. In confidence-gated early exit, the score must meet a calibrated risk threshold. In self-speculative decoding, shallow layers may draft, but deeper layers must verify the accepted prefix.',
        {type:'callout', text:'Early-exit serving treats transformer depth as a conditional resource: easy tokens can stop early only when a gate or verifier keeps the output contract intact.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/3/34/Transformer%2C_full_architecture.png', alt:'Full transformer architecture diagram with encoder and decoder stacks, attention blocks, feed-forward layers, normalization, and output head.', caption:'Transformer full architecture diagram by dvgodoy, CC BY 4.0, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A transformer is a neural network made from repeated attention and feed-forward layers. During decoding, every generated token usually passes through every layer. That is simple, but it spends the same depth on punctuation, boilerplate, code, facts, and uncertain reasoning.',
        'Early exit asks whether some tokens can stop at a shallower layer. The goal is not to make the model smaller for every token. The goal is to spend full depth only when the token needs it.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to deploy a smaller model or cut the model after a fixed number of layers. That saves compute on every token. It also changes behavior on every token, including the hard ones.',
        'Another approach is a separate draft model. The small model proposes tokens and the large model verifies them. That can work, but it adds another model, another cache path, and another scheduling problem.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is uneven token difficulty. A comma after a common phrase may be obvious by layer 8, while a rare code identifier may still be unstable at layer 28. A fixed cutoff wastes quality on hard tokens and wastes compute on easy tokens.',
        'The second wall is trust. A shallow layer can be confident for the wrong reason, especially outside its calibration slice. A production system needs a gate that is measured or a verifier that can reject shallow guesses.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat depth as a conditional resource. Intermediate layers expose logits, hidden states, margins, entropy, or exit-head predictions. A policy reads those signals and decides whether the token can stop or must continue.',
        'The invariant is route-specific safety. Low-risk traffic may allow a small measured quality loss for speed. High-risk traffic should require deeper verification or full-depth decoding. The shortcut policy belongs to the product contract, not only to the model.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Training often encourages intermediate layers to become predictive. Systems such as DeeBERT add classifier exits, FastBERT uses distillation for intermediate classifiers, and LayerSkip trains decoder-only models so earlier layers can draft with a shared exit head. The details differ, but the serving question is the same: stop, draft, or continue.',
        'At runtime, the engine keeps an exit table with allowed layers and thresholds. It stores confidence scores, token positions, route labels, and cache state. If a token exits, the stream advances; if it does not, deeper layers continue from the same prefix state.',
        'In self-speculative decoding, early layers draft several tokens and later layers verify them. The verifier accepts the longest supported prefix and repairs the first mismatch. That keeps the shallow path from silently changing the output contract.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Gated early exit works when intermediate predictions are informative and calibration holds for the current slice. Calibration means a confidence score behaves like measured probability or measured risk. Without calibration, the threshold is only a number.',
        'Self-speculation works by amortizing a deeper pass over multiple shallow proposals. It does not require the shallow layers to be always correct. It requires that accepted tokens are checked by the deeper path before commitment.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Suppose a 32-layer model costs one unit per layer for a token. If 50 of 100 tokens exit at layer 16 and the rest run to layer 32, total layer work is 50 * 16 + 50 * 32 = 2,400 units instead of 3,200. That is a 25 percent layer-work reduction before gate and scheduling overhead.',
        'When traffic doubles, mixed-depth scheduling becomes the main systems cost. Some requests finish early, others continue, and batches can fragment. The dominant cost may move from math to cache layout, fallback bursts, and p99 latency.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Early exit fits high-volume generation with many easy local decisions. Autocomplete, summarization boilerplate, templated responses, and low-risk drafts can benefit when calibration is measured. It also fits products with an explicit fast mode and a full-quality mode.',
        'Self-speculation fits deployments that cannot afford a separate draft model. One model can share weights and cache state while using early layers as the draft path. That reduces operational complexity compared with loading a second model.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails under calibration drift. Code, math, rare languages, long contexts, adversarial prompts, and safety-sensitive routes can make shallow confidence unreliable. A threshold from a clean benchmark is not a universal safety rule.',
        'It also fails when the serving stack cannot handle mixed depths. Continuous batching, paged key-value cache blocks, prefix reuse, and fallback scheduling can all be disrupted. A shortcut that lowers average work can still hurt tail latency.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A 32-layer model emits a status-summary sentence with 20 tokens. Twelve tokens are punctuation or common words and exit at layer 12, while eight tokens run to layer 32. The layer work is 12 * 12 + 8 * 32 = 400 layer-token units instead of 640.',
        'Now change the request to a security explanation with rare identifiers. Only three of 20 tokens exit at layer 12, and two shallow exits later require fallback. The work becomes close to full-depth plus gate overhead, so the route should raise thresholds or disable early exit.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: LayerSkip ACL 2024 at https://aclanthology.org/2024.acl-long.681/, LayerSkip repository at https://github.com/facebookresearch/LayerSkip, CALM at https://arxiv.org/abs/2207.07061, DeeBERT at https://arxiv.org/abs/2004.12993, and FastBERT at https://aclanthology.org/2020.acl-main.537/. Use the papers for training objectives and the repository for serving behavior.',
        'Study Transformer Inference Roofline, KV Cache, Speculative Decoding, Calibration Curves, Threshold Optimization, Knowledge Distillation, LLM Continuous Batching, and PagedAttention for the serving and model pieces behind early exit. Read the serving topics before trusting an average speedup number.',
      ],
    },
  ],
};
