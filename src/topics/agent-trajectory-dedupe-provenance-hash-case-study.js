// Coding-agent trajectory dedupe: normalize operations, fingerprint behavior,
// and keep provenance hashes so train/eval splits cannot silently leak.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'agent-trajectory-dedupe-provenance-hash-case-study',
  title: 'Agent Trajectory Dedupe & Provenance Hash',
  category: 'AI & ML',
  summary: 'A training-data hygiene case study for coding agents: fingerprint near-duplicate rollouts, preserve provenance, and block train/eval leakage.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['trajectory fingerprints', 'split leakage guard'], defaultValue: 'trajectory fingerprints' },
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

function fingerprintGraph(title) {
  return graphState({
    nodes: [
      { id: 'task', label: 'task', x: 0.7, y: 3.4, note: 'issue' },
      { id: 'env', label: 'env', x: 2.0, y: 1.6, note: 'image' },
      { id: 'events', label: 'events', x: 2.0, y: 5.2, note: 'ops' },
      { id: 'norm', label: 'normalize', x: 3.6, y: 3.4, note: 'schema' },
      { id: 'patch', label: 'patch', x: 5.0, y: 1.6, note: 'diff' },
      { id: 'oracle', label: 'oracle', x: 5.0, y: 5.2, note: 'tests' },
      { id: 'shingle', label: 'shingles', x: 6.5, y: 2.4, note: 'ops' },
      { id: 'minhash', label: 'MinHash', x: 6.5, y: 4.5, note: 'sig' },
      { id: 'prov', label: 'prov', x: 7.8, y: 3.4, note: 'hash' },
      { id: 'canon', label: 'canon', x: 9.4, y: 3.4, note: 'record' },
    ],
    edges: [
      { id: 'e-task-env', from: 'task', to: 'env' },
      { id: 'e-task-events', from: 'task', to: 'events' },
      { id: 'e-env-norm', from: 'env', to: 'norm' },
      { id: 'e-events-norm', from: 'events', to: 'norm' },
      { id: 'e-norm-patch', from: 'norm', to: 'patch' },
      { id: 'e-norm-oracle', from: 'norm', to: 'oracle' },
      { id: 'e-norm-shingle', from: 'norm', to: 'shingle' },
      { id: 'e-shingle-minhash', from: 'shingle', to: 'minhash' },
      { id: 'e-patch-prov', from: 'patch', to: 'prov' },
      { id: 'e-oracle-prov', from: 'oracle', to: 'prov' },
      { id: 'e-minhash-prov', from: 'minhash', to: 'prov' },
      { id: 'e-prov-canon', from: 'prov', to: 'canon' },
    ],
  }, { title });
}

function splitGraph(title) {
  return graphState({
    nodes: [
      { id: 'raw', label: 'raw pool', x: 0.7, y: 3.4, note: 'rollouts' },
      { id: 'bucket', label: 'LSH bucket', x: 2.3, y: 3.4, note: 'similar' },
      { id: 'root', label: 'family root', x: 3.9, y: 3.4, note: 'canon' },
      { id: 'train', label: 'train', x: 5.6, y: 1.6, note: 'allowed' },
      { id: 'eval', label: 'eval', x: 5.6, y: 5.2, note: 'held out' },
      { id: 'quar', label: 'quarantine', x: 7.4, y: 3.4, note: 'review' },
      { id: 'ledger', label: 'split ledger', x: 9.0, y: 3.4, note: 'audit' },
    ],
    edges: [
      { id: 'e-raw-bucket', from: 'raw', to: 'bucket' },
      { id: 'e-bucket-root', from: 'bucket', to: 'root' },
      { id: 'e-root-train', from: 'root', to: 'train' },
      { id: 'e-root-eval', from: 'root', to: 'eval' },
      { id: 'e-train-quar', from: 'train', to: 'quar' },
      { id: 'e-eval-quar', from: 'eval', to: 'quar' },
      { id: 'e-quar-ledger', from: 'quar', to: 'ledger' },
      { id: 'e-root-ledger', from: 'root', to: 'ledger' },
    ],
  }, { title });
}

function* trajectoryFingerprints() {
  yield {
    state: fingerprintGraph('A trajectory fingerprint combines behavior and evidence'),
    highlight: { active: ['task', 'env', 'events', 'norm', 'patch', 'oracle', 'e-task-env', 'e-task-events', 'e-env-norm', 'e-events-norm', 'e-norm-patch', 'e-norm-oracle'], found: ['prov'] },
    explanation: 'A rollout can be near-duplicate even when the transcript differs. Normalize the task, environment, operation sequence, patch, and oracle result before computing fingerprints.',
  };

  yield {
    state: labelMatrix(
      'Normalize noisy agent events',
      [
        { id: 'prompt', label: 'prompt' },
        { id: 'tool', label: 'tool call' },
        { id: 'cmd', label: 'command' },
        { id: 'diff', label: 'diff' },
        { id: 'test', label: 'test' },
      ],
      [
        { id: 'raw', label: 'raw' },
        { id: 'key', label: 'key' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['long text', 'task id', 'stable'],
        ['JSON noise', 'op name', 'compare'],
        ['shell path', 'cmd kind', 'portable'],
        ['line nums', 'hunk fp', 'dedupe'],
        ['stdout', 'pass/fail', 'oracle'],
      ],
    ),
    highlight: { active: ['tool:key', 'cmd:key', 'diff:key', 'test:key'], compare: ['prompt:raw'] },
    explanation: 'The fingerprint should ignore accidental formatting but keep semantic differences. Two agents can use different shell syntax and still perform the same abstract operation sequence.',
    invariant: 'Dedupe the behavior, not the prettiness of the transcript.',
  };

  yield {
    state: fingerprintGraph('MinHash catches near-duplicate operation paths'),
    highlight: { active: ['norm', 'shingle', 'minhash', 'prov', 'e-norm-shingle', 'e-shingle-minhash', 'e-minhash-prov'], compare: ['patch', 'oracle'] },
    explanation: 'Operation shingles turn a trajectory into a set: read-file, inspect-error, edit-hunk, run-test, repair-hunk. MinHash and LSH find likely-near traces before expensive exact comparison.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'similarity threshold', min: 0.5, max: 1.0 }, y: { label: 'pair decisions', min: 0, max: 100 } },
      series: [
        { id: 'caught', label: 'duplicates caught', points: [{ x: 0.55, y: 96 }, { x: 0.65, y: 91 }, { x: 0.75, y: 80 }, { x: 0.85, y: 62 }, { x: 0.95, y: 28 }] },
        { id: 'false', label: 'false merges', points: [{ x: 0.55, y: 32 }, { x: 0.65, y: 20 }, { x: 0.75, y: 11 }, { x: 0.85, y: 5 }, { x: 0.95, y: 1 }] },
      ],
      markers: [
        { id: 'audit', x: 0.82, y: 8, label: 'review band' },
      ],
    }),
    highlight: { active: ['caught', 'false', 'audit'] },
    explanation: 'The threshold is a data-product decision. Low thresholds catch more duplicate families but risk merging distinct fixes. A review band around the cutoff is usually better than a single magic number.',
  };

  yield {
    state: labelMatrix(
      'Canonicalization decisions',
      [
        { id: 'exact', label: 'exact dup' },
        { id: 'near', label: 'near dup' },
        { id: 'family', label: 'issue fam' },
        { id: 'repo', label: 'same repo' },
        { id: 'new', label: 'new case' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'action', label: 'action' },
      ],
      [
        ['none', 'merge'],
        ['low', 'downsample'],
        ['leak risk', 'same split'],
        ['context', 'tag'],
        ['novel', 'promote'],
      ],
    ),
    highlight: { found: ['new:action'], compare: ['near:action', 'repo:action'], removed: ['exact:action'] },
    explanation: 'The canonical record keeps aliases to every duplicate, but the training sampler should not overweight the same fix ritual. Dedupe protects both training diversity and benchmark truth.',
  };
}

function* splitLeakageGuard() {
  yield {
    state: splitGraph('Near-duplicate families must stay on one side of a split'),
    highlight: { active: ['raw', 'bucket', 'root', 'train', 'eval', 'e-raw-bucket', 'e-bucket-root', 'e-root-train', 'e-root-eval'], removed: ['quar'] },
    explanation: 'Train/eval leakage is not only exact text overlap. The same bug family, patch hunk, test oracle, or generated synthetic mutation can leak through different transcripts unless the family root owns the split assignment.',
  };

  yield {
    state: labelMatrix(
      'Split keys and leakage risk',
      [
        { id: 'repo', label: 'repo' },
        { id: 'issue', label: 'issue' },
        { id: 'patch', label: 'patch' },
        { id: 'oracle', label: 'oracle' },
        { id: 'text', label: 'text' },
      ],
      [
        { id: 'key', label: 'key' },
        { id: 'risk', label: 'risk' },
        { id: 'rule', label: 'rule' },
      ],
      [
        ['repo id', 'style leak', 'group'],
        ['issue id', 'answer leak', 'holdout'],
        ['hunk fp', 'fix leak', 'same split'],
        ['test fp', 'oracle leak', 'audit'],
        ['simhash', 'copy leak', 'block'],
      ],
    ),
    highlight: { active: ['issue:rule', 'patch:rule', 'oracle:rule', 'text:rule'], compare: ['repo:risk'] },
    explanation: 'A provenance hash should mix several identities: repository, issue family, base commit, environment digest, patch fingerprint, oracle fingerprint, and normalized trajectory signature.',
    invariant: 'A holdout set is only meaningful if duplicate families cannot straddle it.',
  };

  yield {
    state: splitGraph('Conflicting split evidence goes to quarantine'),
    highlight: { active: ['root', 'train', 'eval', 'quar', 'ledger', 'e-train-quar', 'e-eval-quar', 'e-quar-ledger'], compare: ['e-root-train', 'e-root-eval'] },
    explanation: 'If one record says a family belongs in train and another says eval, the right answer is not to average them. Quarantine the family, inspect provenance, then write the final split decision into the ledger.',
  };

  yield {
    state: labelMatrix(
      'Complete case: duplicated bug-fix rollouts',
      [
        { id: 'a', label: 'trace A' },
        { id: 'b', label: 'trace B' },
        { id: 'c', label: 'trace C' },
        { id: 'd', label: 'trace D' },
      ],
      [
        { id: 'origin', label: 'origin' },
        { id: 'match', label: 'match' },
        { id: 'result', label: 'result' },
      ],
      [
        ['same issue', 'same hunk', 'merge'],
        ['mirror repo', 'same test', 'same split'],
        ['new issue', 'same idea', 'tag'],
        ['new repo', 'new hunk', 'keep'],
      ],
    ),
    highlight: { removed: ['a:result'], active: ['b:result', 'c:result'], found: ['d:result'] },
    explanation: 'A data team should distinguish exact duplicate, mirror duplicate, conceptual family, and genuinely new sample. Those cases deserve different sampler and split policies.',
  };

  yield {
    state: splitGraph('The split ledger is a provenance structure'),
    highlight: { active: ['root', 'ledger', 'e-root-ledger'], found: ['train', 'eval'], removed: ['quar'] },
    explanation: 'The final artifact is not just a list of ids. It is a split ledger that says why each trajectory family was promoted, held out, downsampled, or quarantined. That makes later benchmark claims auditable.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'trajectory fingerprints') yield* trajectoryFingerprints();
  else if (view === 'split leakage guard') yield* splitLeakageGuard();
  else throw new InputError('Pick a trajectory-dedupe view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Agent trajectory dedupe is the training-data hygiene layer that detects when two coding-agent rollouts are the same example in disguise. The data structure combines normalized operation shingles, MinHash or SimHash style fingerprints, patch fingerprints, oracle fingerprints, and a provenance hash over the task and environment.',
        'Verified Agent Trajectory Store explains why task, environment, tool, patch, oracle, and proof records must stay together. This module adds the missing hygiene layer: without dedupe, a model can see the same fix ritual many times, and without provenance hashes, train/eval splits can leak near-identical tasks.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'First normalize the rollout. Prompts become task ids and abstract operation names. Tool calls become operation schemas. Shell commands become command kinds. Diffs become hunk fingerprints. Test outputs become oracle ids and pass/fail state. The normalized operation stream can then be shingled and indexed with MinHash or another locality-sensitive hash. Broder on resemblance and containment is the classic source for this family of ideas: https://www.cs.princeton.edu/courses/archive/spr05/cos598E/bib/broder97resemblance.pdf.',
        'Second, compute a provenance hash. A good root includes repository id, issue id or synthetic mutation id, base commit, environment digest, normalized operation signature, patch fingerprint, oracle fingerprint, and split policy version. The hash is not only for storage. It is the control point that decides whether examples merge, downsample, quarantine, or remain eligible for training.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A coding-agent factory generates four successful rollouts for a failing Python test. Trace A and Trace B use different shell commands but inspect the same file, apply the same patch hunk, and pass the same test. Trace C fixes a mirror repository with the same generated bug. Trace D fixes a different repository with a similar pattern. String equality would keep all four. A provenance-aware deduper merges A and B, puts C in the same split family, tags D as a conceptual neighbor, and prevents the benchmark from counting one idea as four independent wins.',
        'This matters because CWM-style data is expensive. The local source notes emphasize that verified trajectories are the scarce asset. Dedupe makes that asset cleaner: fewer repeated rituals, better train/eval separation, more honest benchmark curves, and easier audits when a public claim depends on a held-out set.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cheap failure mode is over-deduplication: two genuinely different repairs share a few operations and get collapsed. The expensive failure mode is under-deduplication: duplicates flood training and leak into evaluation. Production systems usually need thresholds, review bands, quarantine buckets, and sampled manual audits instead of a single global cutoff.',
        'Storage should preserve aliases rather than deleting evidence. The canonical record keeps every duplicate source id, every original transcript, the normalized signature, the similarity score, and the split decision. That mirrors RAG Dedup, MinHash, and Chunk Canonicalization, but the unit is a behavior trace rather than a document chunk.',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'Do not dedupe only on final diff text. Two rollouts can teach the same agent behavior with different final formatting. Do not dedupe only on natural-language prompt similarity. Two issue descriptions can differ while the generated mutation and oracle are identical. Do not let canonical families straddle train and eval. Do not hide dedupe decisions inside a one-off script; make them replayable data.',
        'Primary sources: CWM at https://arxiv.org/abs/2510.02387, Broder on resemblance and containment at https://www.cs.princeton.edu/courses/archive/spr05/cos598E/bib/broder97resemblance.pdf, and Stanford MMDS Chapter 3 on MinHash/LSH at https://infolab.stanford.edu/~ullman/mmds/ch3n.pdf. Study Verified Agent Trajectory Store, Code World Models Case Study, RAG Dedup MinHash Chunk Canonicalization, MinHash & Locality-Sensitive Hashing, Content-Addressed Merkle DAG Object Store, Software Supply Chain Provenance Graph, Data Leakage, and Benchmark Variance & Model Selection next.',
      ],
    },
  ],
};
