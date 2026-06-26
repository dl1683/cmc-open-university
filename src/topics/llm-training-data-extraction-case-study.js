// LLM training-data extraction: generate many samples, rank suspicious
// memorized strings, and verify whether outputs match training data.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'llm-training-data-extraction-case-study',
  title: 'LLM Training Data Extraction Case Study',
  category: 'AI & ML',
  summary: 'How memorized text escapes through generation: prompt sweeps, likelihood ranking, duplicate search, canaries, and release gates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['extraction loop', 'memorization controls'], defaultValue: 'extraction loop' },
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

function extractionGraph(title) {
  return graphState({
    nodes: [
      { id: 'prompts', label: 'prompts', x: 0.7, y: 3.5, note: 'many' },
      { id: 'model', label: 'LM', x: 2.4, y: 3.5, note: 'sample' },
      { id: 'samples', label: 'samples', x: 4.0, y: 2.0, note: 'raw' },
      { id: 'ranker', label: 'ranker', x: 4.0, y: 5.0, note: 'score' },
      { id: 'dedupe', label: 'dedupe', x: 5.9, y: 3.5, note: 'match' },
      { id: 'review', label: 'review', x: 7.6, y: 3.5, note: 'verify' },
      { id: 'gate', label: 'gate', x: 9.0, y: 3.5, note: 'release' },
    ],
    edges: [
      { id: 'e-prompts-model', from: 'prompts', to: 'model' },
      { id: 'e-model-samples', from: 'model', to: 'samples' },
      { id: 'e-samples-ranker', from: 'samples', to: 'ranker' },
      { id: 'e-ranker-dedupe', from: 'ranker', to: 'dedupe' },
      { id: 'e-dedupe-review', from: 'dedupe', to: 'review' },
      { id: 'e-review-gate', from: 'review', to: 'gate' },
    ],
  }, { title });
}

function* extractionLoop() {
  yield {
    state: extractionGraph('Extraction is generate, rank, verify'),
    highlight: { active: ['prompts', 'model', 'samples', 'e-prompts-model', 'e-model-samples'], compare: ['gate'] },
    explanation: 'Read the graph as an extraction pipeline, not a single prompt trick. The attacker generates many continuations, ranks suspicious strings, checks near matches, verifies provenance, and only then calls something extracted.',
  };

  yield {
    state: labelMatrix(
      'Why some strings memorize',
      [
        { id: 'dup', label: 'duplicate' },
        { id: 'rare', label: 'rare token' },
        { id: 'format', label: 'fixed format' },
        { id: 'secret', label: 'secret-like' },
      ],
      [
        { id: 'reason', label: 'reason' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['many copies', 'high'],
        ['stands out', 'medium'],
        ['easy prefix', 'medium'],
        ['unique value', 'high'],
      ],
    ),
    highlight: { active: ['dup:risk', 'secret:risk'], compare: ['rare:reason', 'format:reason'] },
    explanation: 'Memorization risk rises when strings are duplicated, rare, structured, or secret-like. The model may learn a sequence as a fact to continue, not just a distributional pattern.',
    invariant: 'Never put real secrets in a canary or demo. Use synthetic markers for measurement.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'duplicate count', min: 0, max: 20 }, y: { label: 'extraction risk', min: 0, max: 100 } },
      series: [
        { id: 'small', label: 'small LM', points: [{ x: 1, y: 4 }, { x: 3, y: 7 }, { x: 6, y: 12 }, { x: 12, y: 23 }, { x: 20, y: 35 }] },
        { id: 'large', label: 'large LM', points: [{ x: 1, y: 9 }, { x: 3, y: 18 }, { x: 6, y: 34 }, { x: 12, y: 61 }, { x: 20, y: 79 }] },
      ],
      markers: [{ id: 'dedupe', x: 3, y: 18, label: 'dedupe' }],
    }),
    highlight: { active: ['small', 'large'], found: ['dedupe'] },
    explanation: 'The plot shows why duplicates matter. As repeated strings accumulate, extraction risk rises, especially for larger models. Deduplication is a privacy control, not just a storage cleanup.',
  };

  yield {
    state: labelMatrix(
      'Ranking suspicious samples',
      [
        { id: 'perp', label: 'low perplex' },
        { id: 'ratio', label: 'ratio test' },
        { id: 'near', label: 'near match' },
        { id: 'pii', label: 'PII shape' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'review', label: 'review' },
      ],
      [
        ['model too sure', 'inspect'],
        ['beats ref', 'inspect'],
        ['matches crawl', 'verify'],
        ['PII shape', 'block'],
      ],
    ),
    highlight: { active: ['perp:signal', 'ratio:signal', 'near:signal'], found: ['pii:review'] },
    explanation: 'Extraction papers use ranking to turn millions of generations into a review set. Low perplexity, high likelihood-ratio scores, near-duplicate matches, and PII-shaped strings move a sample to manual or automated review.',
  };

  yield {
    state: labelMatrix(
      'Verification states',
      [
        { id: 'sample', label: 'sample' },
        { id: 'match', label: 'match' },
        { id: 'context', label: 'context' },
        { id: 'incident', label: 'incident' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'state', label: 'state' },
      ],
      [
        ['emitted?', 'candidate'],
        ['source found?', 'maybe extract'],
        ['is it unique?', 'confirmed risk'],
        ['sensitive?', 'response path'],
      ],
    ),
    highlight: { active: ['sample:state', 'match:state'], compare: ['context:state'], found: ['incident:state'] },
    explanation: 'A sample becomes a confirmed risk only after verification. The release process needs provenance: prompt, sample, rank score, match evidence, sensitivity classification, and remediation.',
  };
}

function* memorizationControls() {
  yield {
    state: graphState({
      nodes: [
        { id: 'crawl', label: 'crawl', x: 0.7, y: 3.5, note: 'raw' },
        { id: 'license', label: 'license', x: 2.2, y: 1.7, note: 'rights' },
        { id: 'pii', label: 'PII scan', x: 2.2, y: 5.3, note: 'spans' },
        { id: 'dedupe', label: 'dedupe', x: 4.0, y: 3.5, note: 'near' },
        { id: 'train', label: 'train', x: 5.7, y: 3.5, note: 'model' },
        { id: 'extract', label: 'extract', x: 7.3, y: 1.8, note: 'red team' },
        { id: 'canary', label: 'canary', x: 7.3, y: 5.2, note: 'synthetic' },
        { id: 'gate', label: 'gate', x: 9.0, y: 3.5, note: 'ship' },
      ],
      edges: [
        { id: 'e-crawl-license', from: 'crawl', to: 'license' },
        { id: 'e-crawl-pii', from: 'crawl', to: 'pii' },
        { id: 'e-license-dedupe', from: 'license', to: 'dedupe' },
        { id: 'e-pii-dedupe', from: 'pii', to: 'dedupe' },
        { id: 'e-dedupe-train', from: 'dedupe', to: 'train' },
        { id: 'e-train-extract', from: 'train', to: 'extract' },
        { id: 'e-train-canary', from: 'train', to: 'canary' },
        { id: 'e-extract-gate', from: 'extract', to: 'gate' },
        { id: 'e-canary-gate', from: 'canary', to: 'gate' },
      ],
    }, { title: 'Privacy work starts before training' }),
    highlight: { active: ['license', 'pii', 'dedupe', 'extract', 'canary'], found: ['gate'] },
    explanation: 'Memorization control is an end-to-end pipeline. Data rights, PII scanning, dedupe, synthetic canaries, extraction red-team runs, and a release gate all happen before public deployment.',
  };

  yield {
    state: labelMatrix(
      'Controls by stage',
      [
        { id: 'ingest', label: 'ingest' },
        { id: 'prep', label: 'prep' },
        { id: 'train', label: 'train' },
        { id: 'serve', label: 'serve' },
        { id: 'audit', label: 'audit' },
      ],
      [
        { id: 'control', label: 'control' },
        { id: 'evidence', label: 'evidence' },
      ],
      [
        ['rights + min', 'source ledger'],
        ['PII + dedupe', 'span log'],
        ['DP or reg', 'budget report'],
        ['output filter', 'block log'],
        ['extract eval', 'risk report'],
      ],
    ),
    highlight: { active: ['prep:control', 'audit:control'], found: ['audit:evidence'] },
    explanation: 'No single filter solves extraction. The strongest release story combines data minimization, near-deduplication, PII redaction, training regularization, output filtering, and explicit extraction tests.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'redaction + dedupe effort', min: 0, max: 5 }, y: { label: 'retained utility / risk', min: 0, max: 100 } },
      series: [
        { id: 'utility', label: 'utility', points: [{ x: 0, y: 96 }, { x: 1, y: 94 }, { x: 2, y: 91 }, { x: 3, y: 86 }, { x: 4, y: 75 }, { x: 5, y: 58 }] },
        { id: 'risk', label: 'risk', points: [{ x: 0, y: 88 }, { x: 1, y: 62 }, { x: 2, y: 39 }, { x: 3, y: 24 }, { x: 4, y: 17 }, { x: 5, y: 14 }] },
      ],
      markers: [{ id: 'knee', x: 3, y: 86, label: 'knee' }],
    }),
    highlight: { active: ['utility', 'risk'], found: ['knee'] },
    explanation: 'Data cleaning has a frontier. The early wins are usually cheap: exact dedupe, near-dedupe, secret patterns, emails, phone numbers, keys, and low-value boilerplate. Past the knee, utility can fall faster than risk.',
  };

  yield {
    state: labelMatrix(
      'Synthetic canary ledger',
      [
        { id: 'insert', label: 'insert' },
        { id: 'train', label: 'train' },
        { id: 'prompt', label: 'prompt' },
        { id: 'expose', label: 'exposure' },
      ],
      [
        { id: 'record', label: 'record' },
        { id: 'rule', label: 'rule' },
      ],
      [
        ['fake marker', 'no real secret'],
        ['known count', 'track dupes'],
        ['prefix test', 'measure rank'],
        ['low is good', 'gate threshold'],
      ],
    ),
    highlight: { active: ['insert:rule', 'train:rule', 'expose:rule'], compare: ['prompt:record'] },
    explanation: 'Canaries measure memorization without planting real secrets. The ledger records the synthetic string, insertion count, prompt prefixes, extraction rank, and release threshold.',
  };

  yield {
    state: labelMatrix(
      'Release outcomes',
      [
        { id: 'pass', label: 'pass' },
        { id: 'warn', label: 'warn' },
        { id: 'hold', label: 'hold' },
        { id: 'recall', label: 'recall' },
      ],
      [
        { id: 'trigger', label: 'trigger' },
        { id: 'action', label: 'action' },
      ],
      [
        ['low exposure', 'ship'],
        ['one weak hit', 'monitor'],
        ['PII extract', 'retrain/scrub'],
        ['post-ship hit', 'incident'],
      ],
    ),
    highlight: { found: ['pass:action', 'warn:action'], removed: ['hold:action', 'recall:action'] },
    explanation: 'The gate needs predeclared outcomes. If extraction finds confirmed sensitive text, release pauses. If a deployed system emits sensitive memorized text, that is an incident, not an interesting demo.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'extraction loop') yield* extractionLoop();
  else if (view === 'memorization controls') yield* memorizationControls();
  else throw new InputError('Pick an LLM-extraction view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      'Read this as an extraction pipeline, not one prompt. Active nodes show generation, ranking, matching, review, and release gating; found nodes are candidates whose provenance has been confirmed.',
      {type: 'callout', text: 'Extraction risk is measured by generate, rank, verify, and gate, not by a scary prompt demo.'},
    ] },
    { heading: 'Why this exists', paragraphs: [
      'Training-data extraction is the risk that a generative model emits records from its training data. It matters for tickets, emails, logs, medical notes, source code, copyrighted text, API keys, and rare personal data.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious check is to ask for secrets and see whether the model refuses. That proves little because extraction is a search problem across prompts, temperatures, seeds, formats, prefixes, and sample volume.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is base rate and provenance. One memorized record per million samples is invisible to a demo, and without source ledgers the team cannot tell private training data from public text or coincidence.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Extraction is generate, rank, match, verify, and gate. A defender needs the same machinery in reverse: source tracking, PII spans, dedupe indexes, synthetic canaries, sample ledgers, and release decisions.',
    ] },
    { heading: 'How it works', paragraphs: [
      'The attack samples continuations from prompt families such as email headers, code comments, logs, URLs, tables, and chat transcripts. A ranker scores candidates by unusual confidence, likelihood ratio, rare tokens, secret-like formats, long exact spans, or near matches to a corpus.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The correctness argument is narrowing. If generation has nonzero probability of emitting memorized text, ranking raises the chance that the human review queue contains those rare outputs.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'The attacker pays for generation, ranking, search, and review. The defender pays earlier for data rights checks, PII detection, exact and near dedupe, canaries, extraction evaluations, evidence storage, and incident response.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'This applies to pretraining corpora, domain fine-tunes, support-ticket models, code models, medical assistants, legal assistants, and internal knowledge models. The common feature is useful data mixed with sensitive or protected records.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'Extraction tests fail when the searchable reference corpus is incomplete. Refusal-only defenses also fail because a model can refuse direct secret requests and still emit memorized text under continuation attacks.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'A team trains on 8 million support tickets and inserts 200 synthetic canaries, each repeated 5 times. After training, it samples 2 million ticket-like continuations and reviews the top 500 by likelihood ratio and secret-pattern score.',
      'The review finds 3 canaries and 1 near match to a real ticket with a customer email and order history. The release gate blocks shipment, the team tightens near-dedupe and PII spans, retrains, and repeats until exposure falls below threshold.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Study Carlini et al., Extracting Training Data from Large Language Models, at https://arxiv.org/abs/2012.07805 and https://www.usenix.org/system/files/sec21-carlini-extracting.pdf. Then study membership inference, model inversion, canary exposure, differential privacy, dedupe, and data provenance.',
      'Next, study PII Redaction Token Span Pipeline, Membership Inference Shadow Model, Differential Privacy SGD, MinHash LSH, Content-Defined Chunking, RAG Dedup MinHash Canonicalization, Claim Graph and Source Ledger, and LLM Guardrail Policy Engine.',
    ] },
  ],
};