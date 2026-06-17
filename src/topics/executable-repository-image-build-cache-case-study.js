// Executable repository images: snapshot repo state, dependency locks, build
// layers, and CI evidence so agent rollouts can be reproduced later.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'executable-repository-image-build-cache-case-study',
  title: 'Executable Repository Image Build Cache Case Study',
  category: 'Systems',
  summary: 'A CWM-style trajectory-factory case study: turn raw repositories into reproducible runnable images with cache keys, lockfiles, CI evidence, and proof ledgers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['image cache graph', 'runner evidence ledger'], defaultValue: 'image cache graph' },
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

function imageGraph(title) {
  return graphState({
    nodes: [
      { id: 'issue', label: 'issue', x: 0.6, y: 3.4, note: 'task' },
      { id: 'repo', label: 'repo', x: 2.0, y: 2.0, note: 'commit' },
      { id: 'lock', label: 'lock', x: 2.0, y: 4.8, note: 'deps' },
      { id: 'base', label: 'base', x: 3.6, y: 1.4, note: 'OS' },
      { id: 'deps', label: 'deps', x: 3.6, y: 3.4, note: 'pkg' },
      { id: 'src', label: 'src', x: 3.6, y: 5.4, note: 'copy' },
      { id: 'cache', label: 'cache', x: 5.4, y: 3.4, note: 'keys' },
      { id: 'img', label: 'img', x: 7.0, y: 3.4, note: 'digest' },
      { id: 'ci', label: 'CI', x: 8.5, y: 2.3, note: 'run' },
      { id: 'proof', label: 'proof', x: 8.5, y: 4.6, note: 'log' },
    ],
    edges: [
      { id: 'e-issue-repo', from: 'issue', to: 'repo' },
      { id: 'e-issue-lock', from: 'issue', to: 'lock' },
      { id: 'e-repo-base', from: 'repo', to: 'base' },
      { id: 'e-lock-deps', from: 'lock', to: 'deps' },
      { id: 'e-repo-src', from: 'repo', to: 'src' },
      { id: 'e-base-cache', from: 'base', to: 'cache' },
      { id: 'e-deps-cache', from: 'deps', to: 'cache' },
      { id: 'e-src-cache', from: 'src', to: 'cache' },
      { id: 'e-cache-img', from: 'cache', to: 'img' },
      { id: 'e-img-ci', from: 'img', to: 'ci' },
      { id: 'e-ci-proof', from: 'ci', to: 'proof' },
    ],
  }, { title });
}

function* imageCacheGraph() {
  yield {
    state: imageGraph('Repository image build cache'),
    highlight: { active: ['issue', 'repo', 'lock', 'base', 'deps', 'src', 'cache', 'e-issue-repo', 'e-issue-lock', 'e-repo-base', 'e-lock-deps', 'e-repo-src'], found: ['img'] },
    explanation: 'A coding-agent rollout is only useful training data if the repository can run again. The image builder turns an issue, commit, lockfiles, base image, dependency layers, and source copy into a digest-addressed executable image.',
    invariant: 'No reproducible image, no durable trajectory.',
  };

  yield {
    state: labelMatrix(
      'Cache key inputs',
      [
        { id: 'base', label: 'base' },
        { id: 'apt', label: 'apt' },
        { id: 'pip', label: 'pip' },
        { id: 'src', label: 'src' },
        { id: 'test', label: 'test' },
      ],
      [
        { id: 'key', label: 'key' },
        { id: 'hit', label: 'hit' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['hash', 'hit', 'drift'],
        ['lock', 'hit', 'net'],
        ['lock', 'miss', 'abi'],
        ['tree', 'miss', 'copy'],
        ['cmd', 'keep', 'env'],
      ],
    ),
    highlight: { active: ['base:key', 'apt:key', 'pip:key', 'src:key'], compare: ['pip:hit', 'src:hit'], found: ['test:risk'] },
    explanation: 'Each highlighted row is part of the real cache key. Dockerfile text is not enough: base image digest, lockfiles, runtime, source tree hash, test command, and sometimes runner hardware decide whether a reused image is still the same executable environment.',
  };

  yield {
    state: imageGraph('Build cache hit path'),
    highlight: { active: ['base', 'deps', 'cache', 'img', 'ci', 'proof', 'e-base-cache', 'e-deps-cache', 'e-cache-img', 'e-img-ci', 'e-ci-proof'], compare: ['src'] },
    explanation: 'When the base and dependency layers hit, the builder spends most of its time on source copy and tests. That makes repeated agent rollouts cheap enough to collect at scale.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'cache hit rate', min: 0, max: 100 }, y: { label: 'build minutes per task', min: 0, max: 80 } },
      series: [
        { id: 'cold', label: 'cold images', points: [{ x: 5, y: 72 }, { x: 25, y: 68 }, { x: 50, y: 63 }, { x: 75, y: 58 }, { x: 95, y: 54 }] },
        { id: 'warm', label: 'layer cache', points: [{ x: 5, y: 70 }, { x: 25, y: 46 }, { x: 50, y: 25 }, { x: 75, y: 12 }, { x: 95, y: 6 }] },
      ],
      markers: [
        { id: 'break', x: 62, y: 19, label: 'scale band' },
      ],
    }),
    highlight: { active: ['warm', 'break'], compare: ['cold'] },
    explanation: 'Build caching changes the economics of execution data. A cold build farm may be too expensive; a warm cache turns the same task stream into a repeatable factory.',
  };
}

function* runnerEvidenceLedger() {
  yield {
    state: imageGraph('Runner evidence ledger'),
    highlight: { active: ['img', 'ci', 'proof', 'e-img-ci', 'e-ci-proof'], compare: ['issue', 'repo', 'lock'] },
    explanation: 'A proof ledger records which image digest ran which command, on which runner, with which exit status, logs, artifacts, and timestamps. The image alone is not the proof; the run evidence closes the loop.',
  };

  yield {
    state: labelMatrix(
      'Evidence fields',
      [
        { id: 'img', label: 'img' },
        { id: 'cmd', label: 'cmd' },
        { id: 'env', label: 'env' },
        { id: 'log', label: 'log' },
        { id: 'art', label: 'art' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'check', label: 'check' },
        { id: 'keep', label: 'keep' },
      ],
      [
        ['sha', 'pin', 'yes'],
        ['test', 'hash', 'yes'],
        ['vars', 'mask', 'some'],
        ['text', 'redact', 'yes'],
        ['blob', 'hash', 'some'],
      ],
    ),
    highlight: { active: ['img:check', 'cmd:check', 'log:check'], found: ['img:keep', 'cmd:keep'], compare: ['env:keep', 'art:keep'] },
    explanation: 'The ledger keeps the fields needed to rerun and audit the example, but the compare cells show the tax: environment variables and artifacts may contain secrets, licenses, or private data, so reproducibility has to include redaction rules.',
    invariant: 'Reproducibility and privacy are both first-class ledger fields.',
  };

  yield {
    state: labelMatrix(
      'Complete case: stale dependency repair',
      [
        { id: 't0', label: 'issue' },
        { id: 't1', label: 'build' },
        { id: 't2', label: 'agent' },
        { id: 't3', label: 'test' },
        { id: 't4', label: 'ship' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'proof', label: 'proof' },
      ],
      [
        ['open', 'id'],
        ['fail', 'log'],
        ['patch', 'diff'],
        ['pass', 'junit'],
        ['keep', 'ledger'],
      ],
    ),
    highlight: { active: ['t1:proof', 't2:proof', 't3:proof', 't4:proof'], found: ['t3:state', 't4:state'], removed: ['t1:state'] },
    explanation: 'A repository fails after a dependency release. The factory builds the old image, captures the failing test, lets the agent update a pin, reruns tests, and stores the failing-to-passing evidence as one canonical task.',
  };

  yield {
    state: imageGraph('Image evidence feeds trajectory dedupe'),
    highlight: { active: ['repo', 'lock', 'img', 'ci', 'proof', 'e-cache-img', 'e-img-ci', 'e-ci-proof'], found: ['cache'], compare: ['issue'] },
    explanation: 'Executable image evidence becomes a dedupe key. Two transcripts may look different, but if they share base commit, image digest, failing command, patch hunk, and passing proof, the split ledger should treat them as one family.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'image cache graph') yield* imageCacheGraph();
  else if (view === 'runner evidence ledger') yield* runnerEvidenceLedger();
  else throw new InputError('Pick an executable-repository-image view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'An executable repository image exists because a coding-agent task is only as good as its replay environment. A prompt that says "fix this bug" is weak evidence. A runnable repository image with a failing command, logs, patch, passing command, and digest is a task that can be audited.',
        'Without an executable snapshot, every rerun is exposed to dependency drift, base-image changes, package-index changes, local machine differences, environment variables, and test-command drift. A benchmark can look like it measures coding skill while actually measuring who happened to have the right environment.',
        'The build cache exists because execution evidence is expensive. Building a clean image for every task is too slow and costly at benchmark-factory scale. A content-addressed cache lets the factory reuse safe layers while still pinning the exact image that produced the proof.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to run the issue on whatever machine is available and save the transcript. That is convenient, but it loses the conditions that made the result true. A passing test on one laptop may fail in CI because the interpreter, OS package, or dependency version changed.',
        'Another shortcut is to store only the final Docker image. That proves what could run, not what did run. The evidence ledger still needs command, exit status, logs, artifacts, timestamps, runner metadata, and redaction status.',
        'A third mistake is to chase cache hits without correctness. A fast cache that silently reuses the wrong dependency layer is worse than a slow rebuild because it contaminates the dataset with false labels.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that a benchmark task is a proof chain. Repository snapshot, dependency lockfiles, base image digest, build commands, test commands, runner identity, failing output, repair patch, passing output, and artifact hashes all belong to one record.',
        'The image digest acts like a content-addressed key for the runnable environment. The proof ledger says what happened inside that environment. The cache key says which layers can be reused without changing the meaning of the run.',
        'This separates reproducibility from convenience. Cache hits lower cost, but the canonical evidence is still the failing-to-passing run tied to an image digest and command hash.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The builder starts from a task and commit. It resolves lockfiles, pins the base image, installs system and language dependencies, copies source, runs setup commands, records the image digest, and then launches tests or agent rollouts against that digest.',
        'A good cache key is layered. Base image digest, package manager lockfile, runtime version, source tree hash, test command, runner architecture, and selected environment variables all participate. That prevents accidental reuse of a stale environment while still letting expensive dependency layers be shared.',
        'Each run writes exit status, logs, artifacts, timing, command hash, and redaction metadata into the evidence ledger. If a task is later reused for training or evaluation, the ledger can prove which environment produced the label.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The build graph proves that the issue, repository, lockfiles, base image, dependencies, source copy, and cache key must all be fixed before the image digest is meaningful. The digest is not decoration; it is the identity of the runnable task environment.',
        'The evidence-ledger view proves the correctness boundary. An image digest says what could run. The ledger says what did run, with which command, exit status, logs, artifacts, and timestamps.',
        'The cache curve proves the factory economics. A cold build farm may be too expensive for large-scale agent evaluation. A warm, correct cache turns the same task stream into a repeatable factory.',
        'The stale-dependency case proves why both sides are needed. The image and failing command establish the original bug. The rebuilt image and passing command establish the repair. Without both, the dataset cannot distinguish a real fix from an environment accident.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because content addressing makes hidden drift visible. If the base image, lockfile, source tree, or command changes, the cache key and evidence record should change. That is what prevents two different environments from masquerading as one task.',
        'It also works because proof is stored near execution. A patch is not enough. A passing result needs the command, output, artifact hashes, and image digest that made it pass. A failing starting point needs the same treatment.',
        'Deduplication works better with image evidence. Two transcripts may look different, but if they share base commit, image digest, failing command, patch hunk, and passing proof, the split ledger should treat them as one family.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The cost is storage, build time, cache invalidation, and privacy review. Logs and artifacts may contain secrets, licenses, customer data, or private paths. Reproducibility has to include redaction policy, not just more retention.',
        'The cache key has to balance reuse and correctness. Too broad and stale layers poison tasks. Too narrow and every task rebuilds from scratch. High-volume factories need cache-hit metrics, drift alerts, and controlled rebuild policies.',
        'There is also a portability tradeoff. A container captures a lot, but not everything: CPU architecture, kernel behavior, filesystem semantics, network access, and external services can still affect the run.',
        'Security is part of the cost. Building arbitrary repositories can execute setup scripts, download packages, or touch network resources. The runner needs isolation, network policy, secret handling, and artifact redaction before the evidence is safe to keep.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Executable repository images win in coding-agent benchmarks, repair-data factories, regression corpora, CI replay systems, and verified trajectory stores. They turn a natural-language issue into a runnable object with an oracle.',
        'A concrete case is a stale dependency repair. The factory snapshots the failing commit, builds from a pinned base, installs from lockfiles, runs the failing test, lets an agent update the dependency constraint, rebuilds affected layers, reruns the same test, and stores the passing evidence.',
        'The resulting record is richer than a patch: issue id, base commit, image digest, lockfile fingerprint, failing command, failing log, patch fingerprint, passing command, passing log, artifact hashes, timing, and redaction status.',
        'It also wins for curriculum design. Tasks can be grouped by language, dependency manager, failing command type, test duration, image family, and repair pattern, letting a course move from small deterministic fixes to larger multi-service repairs.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The most common failure is hidden nondeterminism: unpinned package indexes, floating base images, network-dependent setup scripts, local timezone assumptions, and tests that depend on execution order. The next failure is evidence loss: a passing result without the exact image digest and command is weak training data.',
        'A production factory should also separate cacheability from correctness. A fast cache that silently reuses the wrong layer is worse than a slow rebuild, because it contaminates the trajectory store with false labels.',
        'A third failure is split leakage. If the same repository state, image digest, failing command, and patch family appear in both training and evaluation splits, the benchmark can reward memorization rather than repair ability.',
        'A fourth failure is over-normalizing tasks. If the factory patches every repository into the same clean shape before agents see it, the benchmark stops measuring real repair and starts measuring a curated exercise format.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: CWM at https://arxiv.org/abs/2510.02387 and https://ai.meta.com/research/publications/cwm-an-open-weights-llm-for-research-on-code-generation-with-world-models/, Docker build cache at https://docs.docker.com/build/cache/ and https://docs.docker.com/build/cache/optimize/, GitHub Actions workflow syntax at https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions, SWE-bench at https://arxiv.org/abs/2310.06770, and SWE-agent at https://arxiv.org/abs/2405.15793.',
        'Study next: Verified Agent Trajectory Store, Agent Trajectory Dedupe & Provenance Hash, Content-Addressed Merkle DAG Object Store, Bootstrap CI, Software Supply Chain Provenance Graph, and the Synthetic Bug Mutation Oracle Case Study.',
      ],
    },
  ],
};
