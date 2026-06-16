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
    explanation: 'The useful cache key is not only the Dockerfile text. It includes base image digest, package lockfiles, language runtime, source tree hash, test command, and sometimes runner hardware.',
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
    explanation: 'The ledger keeps enough to rerun and audit the example, but it also redacts secrets and drops artifacts that carry license or privacy risk.',
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
      heading: 'What it is',
      paragraphs: [
        'An executable repository image is the runnable snapshot behind a coding-agent task. It bundles the repository commit, base image, system packages, language dependencies, test command, environment metadata, and evidence needed to rerun the issue later.',
        'Code World Models Case Study explains why execution traces matter. Verified Agent Trajectory Store explains how to keep task, action, oracle, and proof together. This module fills in the missing factory layer: how the repository becomes an executable object before the agent ever starts editing.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The core structures are a repository tree hash, dependency lock index, Docker layer cache, image digest table, runner evidence ledger, artifact hash table, and split-safe provenance record. The image digest acts like a content-addressed key for execution.',
        'A good cache key is layered. Base image digest, package manager lockfile, runtime version, source tree hash, test command, runner architecture, and selected environment variables all participate. That prevents accidental reuse of a stale environment while still letting expensive dependency layers be shared.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The builder starts from a task and commit. It resolves lockfiles, builds or retrieves base and dependency layers, copies source, runs setup commands, records the image digest, and then launches tests or agent rollouts against that digest. Each run writes exit status, logs, artifacts, and timing into the evidence ledger.',
        'For high-volume factories, the build cache is not an optimization afterthought. It is the difference between a toy benchmark and a reusable trajectory factory. Cache misses become operating metrics, because every miss increases cost and may indicate dependency drift.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A Python project has a real GitHub issue caused by a stale dependency pin. The factory snapshots the failing commit, builds the image from a pinned base, installs from lockfiles, runs the failing test, and stores that failure as the starting oracle. The agent edits the dependency constraint, the factory rebuilds only the affected layers, reruns the same test, and stores the passing evidence.',
        'The resulting record is richer than a patch: it contains issue id, base commit, image digest, lockfile fingerprint, failing command, failing log, patch fingerprint, passing command, passing log, artifact hashes, timing, and redaction status. That record can be deduped, audited, and replayed.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The most common failure is hidden nondeterminism: unpinned package indexes, floating base images, network-dependent setup scripts, local timezone assumptions, and tests that depend on execution order. The next failure is evidence loss: a passing result without the exact image digest and command is weak training data.',
        'A production factory should also separate cacheability from correctness. A fast cache that silently reuses the wrong layer is worse than a slow rebuild, because it contaminates the trajectory store with false labels.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: CWM at https://arxiv.org/abs/2510.02387 and https://ai.meta.com/research/publications/cwm-an-open-weights-llm-for-research-on-code-generation-with-world-models/, Docker build cache at https://docs.docker.com/build/cache/ and https://docs.docker.com/build/cache/optimize/, GitHub Actions workflow syntax at https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions, SWE-bench at https://arxiv.org/abs/2310.06770, and SWE-agent at https://arxiv.org/abs/2405.15793.',
        'Study next: Verified Agent Trajectory Store, Agent Trajectory Dedupe & Provenance Hash, Content-Addressed Merkle DAG Object Store, Bootstrap CI, Software Supply Chain Provenance Graph, and the Synthetic Bug Mutation Oracle Case Study.',
      ],
    },
  ],
};
