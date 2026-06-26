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
    explanation: 'A rollout can be near-duplicate even when the transcript differs. Normalize the task, environment, operation sequence, patch, and oracle result before computing fingerprints, or the deduper will confuse formatting noise with new evidence.',
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
    explanation: 'Operation shingles turn a trajectory into a set: read-file, inspect-error, edit-hunk, run-test, repair-hunk. MinHash and LSH find likely-near traces before expensive exact comparison, so the pipeline spends human review on the ambiguous band rather than every pair.',
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
    explanation: 'If one record says a family belongs in train and another says eval, the right answer is not to average them. Quarantine the whole family, inspect provenance, then write one split decision into the ledger before the benchmark claim is trusted.',
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
      heading: 'How to read the animation',
      paragraphs: [
        {type:'callout', text:'The core problem: surface-level transcript diversity hides behavioral duplication. Three agents that use different shell commands to find the same bug and apply the same patch have produced one lesson, not three. Without dedupe, training overweights the ritual and evaluation inflates the score.'},
        'Read the trajectory-fingerprints view as a data-cleaning pipeline. A trajectory is one recorded agent run: task, environment, tool events, patch, verifier result, and final outcome. Active nodes show raw evidence being normalized into fingerprints.',
        'Read the split-leakage view as benchmark protection. A split is the assignment of examples to training or evaluation. The safe inference is that near-duplicate families must not straddle train and eval unless that transfer is the explicit thing being measured.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Coding-agent data factories produce many successful rollouts. Different agents can use different shell commands, explanations, or edit formatting while solving the same underlying bug with the same patch idea. Those records look diverse at the transcript level but teach one lesson.',
        'Dedupe exists to prevent two failures. Training can overweight repeated repair rituals, and evaluation can leak answer patterns from training into held-out tasks. A provenance hash gives each family of related trajectories a durable identity.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is exact matching. Hash the issue text, final diff, and test output. If two hashes match, merge the records. This is fast, deterministic, and catches accidental re-ingestion.',
        'Exact matching is necessary but shallow. It catches identical reruns and copied files, but it misses same-behavior traces with different tool syntax, line numbers, variable names, or whitespace. It also cannot explain conceptual similarity that should be tagged but not merged.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is surface variation. One agent uses grep, another uses rg, and a third opens the file directly. One patch writes if not tokens, another writes if len(tokens) == 0. Exact diff hashes differ, but the behavior may be the same guard on the same failing case.',
        'The opposite wall is false merge. Two tasks can both mention off-by-one and both run tests, while editing different functions for different reasons. A fuzzy text matcher can collapse distinct repairs and remove useful training diversity.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Compare trajectories through several lenses. Normalize the operation sequence, fingerprint the patch, fingerprint the oracle, and preserve task provenance. A lens is one independent view of similarity; no single lens is trusted alone.',
        'Provenance means recorded origin: repository id, issue family, base commit, synthetic mutation id, environment digest, patch fingerprint, oracle fingerprint, and normalized operation signature. A canonical family record stores aliases to all related rollouts plus the split assignment and sampler weight.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'First normalize events. Tool calls become abstract operations such as read-file, search-text, edit-hunk, run-test, and inspect-error. Paths lose machine-specific prefixes. Test output becomes oracle identity: command, failing test, error class, and pass or fail.',
        'Second, build near-duplicate candidates. Operation streams are broken into shingles, which are short overlapping subsequences. MinHash compresses the shingle set into a signature, and locality-sensitive hashing groups likely-near trajectories for exact review.',
        'Third, link provenance. If two records share a synthetic mutation id or issue family, they stay in one family even if their surface behavior differs. The final policy can merge exact duplicates, downsample near duplicates, keep conceptual neighbors tagged, or quarantine ambiguous records.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness target is controlled split integrity, not perfect semantic judgment. The system enforces that exact duplicates count once, near-duplicate families do not inflate diversity metrics, and one family does not appear on both sides of a train/eval split.',
        'The family root prevents contradictory decisions. Without it, one pipeline can put trace A in train while another puts trace B from the same mutation in eval. With it, the split decision belongs to the family, and every member inherits that assignment.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Let n be trajectory count and s be average steps per trajectory. Normalization costs O(n * s). Exact hashing costs O(n). MinHash and locality-sensitive hashing are roughly linear in the number of shingles and hash functions, while candidate verification costs depend on how many pairs fall into the same buckets.',
        'For 100,000 trajectories with 20 steps each, normalization touches about 2,000,000 events. With 128 MinHash functions, the signature store is 12,800,000 small hash values. The expensive part is patch-level comparison on candidate pairs, so the pipeline uses LSH to avoid all-pairs comparison.',
        'Cost is behavior because thresholds change the dataset. A low similarity threshold catches more duplicates but risks false merges. A high threshold preserves diversity but lets leakage survive. A review band around the cutoff is usually better than one magic number.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Coding-agent benchmarks use this to protect train/eval splits. If a benchmark can show family-aware dedupe, its held-out claims are more credible than a dataset that only hashes raw text. Training pipelines use it to weight families rather than raw trajectory count.',
        'Synthetic data systems need it because mutation generators can produce siblings with different names and paths but the same repair idea. Curriculum systems can intentionally keep siblings for interface-robustness training, but the label must say same family, different surface.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when normalization removes the thing that mattered. If an AST patch fingerprint reduces two different fixes to edited same function, over-merging destroys useful training variation. If command normalization strips a flag that changed behavior, two strategies become falsely identical.',
        'It also fails when provenance was never recorded. If upstream generators omit seed, template, issue family, or base commit, later dedupe has to infer relationships from behavior alone. Inference is weaker and slower than preserving provenance at creation time.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A factory records four traces. A uses grep and adds if not tokens: return [] in parser.py, passing test_empty_input. B uses rg and adds if tokens is None or len(tokens) == 0: return [] in the same function, passing the same test. C comes from a mirror repo with synthetic mutation m7 and the same fix. D edits tokenizer.py for a different empty-stream test.',
        'Exact diff hashing finds no matches because formatting, paths, and repos differ. Operation shingles put A and B at 0.92 similarity, patch fingerprints say same function and same guard meaning, and oracle fingerprints match. C joins through mutation id m7. D shares the broad idea empty input guard but differs on patch, oracle, and provenance.',
        'The split ledger creates family F42 with members A, B, and C, assigns the family to train, and gives it weight 0.33 per member or one canonical sample. D is tagged as a conceptual neighbor but remains independent. The eval set no longer contains the same bug under a mirror transcript.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Andrei Broder, On the Resemblance and Containment of Documents, 1997; Indyk and Motwani, Approximate Nearest Neighbors, 1998; and SWE-bench at https://arxiv.org/abs/2310.06770. Then study MinHash and Locality-Sensitive Hashing, Verified Agent Trajectory Store, Agent Checkpoint Replay Ledger, RAG Chunk Dedupe, and Data Leakage and Contamination.',
      ],
    },
  ],
};
