// Data availability sampling: erasure-coded shares, commitments, random
// samples, blob pipelines, retention windows, and rollup safety boundaries.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'data-availability-sampling-erasure-coding-case-study',
  title: 'Data Availability Sampling & Erasure Coding Case Study',
  category: 'Systems',
  summary: 'A modular blockchain data-availability case study: erasure-coded blobs, row/column commitments, random light-client sampling, KZG blob commitments, retention windows, and rollup safety boundaries.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['sampling game', 'blob pipeline'], defaultValue: 'sampling game' },
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

function dasGraph(title) {
  return graphState({
    nodes: [
      { id: 'blob', label: 'blob', x: 0.7, y: 4.0, note: 'bytes' },
      { id: 'rs', label: 'RS code', x: 2.3, y: 4.0, note: 'extend' },
      { id: 'square', label: 'square', x: 4.0, y: 4.0, note: 'shares' },
      { id: 'rows', label: 'rows', x: 5.7, y: 2.4, note: 'roots' },
      { id: 'cols', label: 'cols', x: 5.7, y: 5.6, note: 'roots' },
      { id: 'header', label: 'header', x: 7.2, y: 4.0, note: 'commit' },
      { id: 'light', label: 'light', x: 8.8, y: 2.4, note: 'sample' },
      { id: 'full', label: 'full', x: 8.8, y: 5.6, note: 'rebuild' },
    ],
    edges: [
      { id: 'e-blob-rs', from: 'blob', to: 'rs' },
      { id: 'e-rs-square', from: 'rs', to: 'square' },
      { id: 'e-square-rows', from: 'square', to: 'rows' },
      { id: 'e-square-cols', from: 'square', to: 'cols' },
      { id: 'e-rows-header', from: 'rows', to: 'header' },
      { id: 'e-cols-header', from: 'cols', to: 'header' },
      { id: 'e-header-light', from: 'header', to: 'light' },
      { id: 'e-header-full', from: 'header', to: 'full' },
      { id: 'e-square-light', from: 'square', to: 'light' },
      { id: 'e-square-full', from: 'square', to: 'full' },
    ],
  }, { title });
}

function blobPipeline(title) {
  return graphState({
    nodes: [
      { id: 'rollup', label: 'rollup', x: 0.7, y: 4.0, note: 'batch' },
      { id: 'blob', label: 'blob', x: 2.2, y: 4.0, note: 'data' },
      { id: 'kzg', label: 'KZG', x: 3.8, y: 2.4, note: 'commit' },
      { id: 'tx', label: 'tx', x: 3.8, y: 5.6, note: 'hash ref' },
      { id: 'cons', label: 'consensus', x: 5.8, y: 4.0, note: 'gossip' },
      { id: 'samples', label: 'samples', x: 7.4, y: 2.4, note: 'PeerDAS' },
      { id: 'retain', label: 'retain', x: 7.4, y: 5.6, note: 'window' },
      { id: 'verify', label: 'verify', x: 9.0, y: 4.0, note: 'rollup' },
    ],
    edges: [
      { id: 'e-rollup-blob', from: 'rollup', to: 'blob' },
      { id: 'e-blob-kzg', from: 'blob', to: 'kzg' },
      { id: 'e-kzg-tx', from: 'kzg', to: 'tx' },
      { id: 'e-tx-cons', from: 'tx', to: 'cons' },
      { id: 'e-blob-cons', from: 'blob', to: 'cons' },
      { id: 'e-cons-samples', from: 'cons', to: 'samples' },
      { id: 'e-cons-retain', from: 'cons', to: 'retain' },
      { id: 'e-samples-verify', from: 'samples', to: 'verify' },
      { id: 'e-retain-verify', from: 'retain', to: 'verify' },
      { id: 'e-kzg-verify', from: 'kzg', to: 'verify' },
    ],
  }, { title });
}

function* samplingGame() {
  yield {
    state: dasGraph('Erasure coding turns one blob into many recoverable shares'),
    highlight: { active: ['blob', 'rs', 'square', 'e-blob-rs', 'e-rs-square'], compare: ['rows', 'cols'], found: ['header'] },
    explanation: 'Data availability sampling starts by expanding data. A block producer erasure-codes the original blob into more shares than strictly needed, so hiding a little data requires hiding a large fraction of the extended data.',
    invariant: 'The code must force withholding attacks to cover many random sample positions.',
  };

  yield {
    state: labelMatrix(
      'A small extended data square',
      [
        { id: 'r1', label: 'row 1' },
        { id: 'r2', label: 'row 2' },
        { id: 'r3', label: 'row 3' },
        { id: 'r4', label: 'row 4' },
      ],
      [
        { id: 'c1', label: 'c1' },
        { id: 'c2', label: 'c2' },
        { id: 'c3', label: 'c3' },
        { id: 'c4', label: 'c4' },
      ],
      [
        ['d', 'd', 'p', 'p'],
        ['d', 'd', 'p', 'p'],
        ['p', 'p', 'p', 'p'],
        ['p', 'p', 'p', 'p'],
      ],
    ),
    highlight: { active: ['r1:c1', 'r1:c2', 'r2:c1', 'r2:c2'], found: ['r3:c3', 'r4:c4'], compare: ['r1:c3', 'r3:c1'] },
    explanation: 'This toy square shows original data shares and parity shares. Real systems use larger squares and stronger coding rules, but the data-structure shape is the same: indexed cells plus commitments to rows, columns, or blobs.',
  };

  yield {
    state: dasGraph('Row and column commitments bind the share matrix'),
    highlight: { active: ['square', 'rows', 'cols', 'header', 'e-square-rows', 'e-square-cols', 'e-rows-header', 'e-cols-header'], compare: ['light'] },
    explanation: 'The header commits to the coded data. Celestia uses namespaced Merkle-tree roots over rows and columns of an extended data square. Ethereum blobs use KZG commitments today and are designed to be compatible with sampling-based futures.',
  };

  yield {
    state: labelMatrix(
      'Random samples catch withholding',
      [
        { id: 'one', label: '1 sample' },
        { id: 'four', label: '4 samples' },
        { id: 'eight', label: '8 samples' },
        { id: 'many', label: 'many nodes' },
      ],
      [
        { id: 'download' },
        { id: 'miss risk' },
        { id: 'meaning' },
      ],
      [
        ['1 cell', 'high', 'weak check'],
        ['4 cells', 'lower', 'local proof'],
        ['8 cells', 'lower+', 'confidence'],
        ['spread out', 'tiny', 'network proof'],
      ],
    ),
    highlight: { active: ['eight:download', 'eight:meaning'], found: ['many:miss risk'], compare: ['one:miss risk'] },
    explanation: 'A light node downloads random shares plus proofs. One sample is weak; many independent samples across many nodes make a producer unlikely to hide enough data without someone hitting a missing cell.',
    invariant: 'DAS is probabilistic: confidence rises with independent samples and honest sampling diversity.',
  };

  yield {
    state: labelMatrix(
      'What DAS proves and does not prove',
      [
        { id: 'avail', label: 'available' },
        { id: 'correct', label: 'committed' },
        { id: 'valid', label: 'valid txs' },
        { id: 'forever', label: 'archival' },
      ],
      [
        { id: 'claim' },
        { id: 'needs' },
      ],
      [
        ['likely there', 'samples'],
        ['matches root', 'proofs'],
        ['not proven', 'rollup check'],
        ['not promised', 'archive nodes'],
      ],
    ),
    highlight: { active: ['avail:claim', 'correct:claim'], removed: ['valid:claim', 'forever:claim'] },
    explanation: 'Data availability is not execution validity and not permanent archival. It means enough data was published for honest parties to reconstruct and verify higher-layer claims during the relevant window.',
  };

  yield {
    state: dasGraph('Full nodes and archival providers still matter'),
    highlight: { active: ['full', 'square', 'header', 'e-square-full', 'e-header-full'], compare: ['light'], found: ['rows', 'cols'] },
    explanation: 'Light nodes sample. Full nodes reconstruct. Archival nodes retain older blobs. These roles are complementary. A DAS design that only talks about light clients but ignores repair and retention is incomplete.',
  };
}

function* blobPipelineView() {
  yield {
    state: blobPipeline('A rollup publishes batch data as blobs'),
    highlight: { active: ['rollup', 'blob', 'e-rollup-blob'], compare: ['kzg', 'tx'] },
    explanation: 'A rollup posts data so others can reconstruct its state transition. Blob space is cheaper than permanent execution calldata because the consensus layer only needs the data available for a retention window.',
  };

  yield {
    state: blobPipeline('KZG commitments bind blob bytes to on-chain references'),
    highlight: { active: ['blob', 'kzg', 'tx', 'e-blob-kzg', 'e-kzg-tx'], found: ['verify'] },
    explanation: 'EIP-4844 blob transactions include versioned hashes derived from KZG commitments. Consensus clients verify that commitments match blobs and proofs. The execution layer sees references, not the whole blob contents.',
    invariant: 'The commitment can persist after the large blob data is pruned.',
  };

  yield {
    state: blobPipeline('Consensus gossips and retains blob data temporarily'),
    highlight: { active: ['blob', 'cons', 'retain', 'e-blob-cons', 'e-cons-retain'], compare: ['verify'] },
    explanation: 'Proto-danksharding improved data posting for rollups before full DAS. Nodes still download and verify blob data today, then retain it for a bounded period while the commitment remains as a compact reference.',
  };

  yield {
    state: blobPipeline('PeerDAS-style sampling lowers per-node download'),
    highlight: { active: ['cons', 'samples', 'verify', 'e-cons-samples', 'e-samples-verify'], compare: ['retain'] },
    explanation: 'PeerDAS proposes that peers sample and custody subsets of blob data. The goal is to make the network collectively verify availability without forcing every node to download every blob in full.',
  };

  yield {
    state: labelMatrix(
      'Ethereum vs Celestia style',
      [
        { id: 'eth4844', label: 'EIP-4844' },
        { id: 'peerdas', label: 'PeerDAS' },
        { id: 'celestia', label: 'Celestia' },
        { id: 'rollup', label: 'rollup' },
      ],
      [
        { id: 'commit' },
        { id: 'data role' },
        { id: 'risk' },
      ],
      [
        ['KZG', 'blob post', 'retention'],
        ['KZG+DAS', 'sample', 'custody'],
        ['NMT roots', 'DA layer', 'namespace'],
        ['state root', 'exec proof', 'withheld data'],
      ],
    ),
    highlight: { active: ['eth4844:commit', 'peerdas:data role', 'celestia:data role'], compare: ['rollup:risk'] },
    explanation: 'Different systems choose different commitment and sampling details, but the boundary is shared: publish data, commit to it, sample or download enough of it, and let execution layers prove or dispute state transitions.',
  };

  yield {
    state: labelMatrix(
      'Implementation checklist',
      [
        { id: 'encode', label: 'encode' },
        { id: 'commit', label: 'commit' },
        { id: 'sample', label: 'sample' },
        { id: 'repair', label: 'repair' },
        { id: 'retain', label: 'retain' },
      ],
      [
        { id: 'must keep' },
        { id: 'failure' },
      ],
      [
        ['shard map', 'bad code'],
        ['root/proof', 'bad bind'],
        ['randomness', 'biased picks'],
        ['providers', 'dead cells'],
        ['window', 'early prune'],
      ],
    ),
    highlight: { active: ['sample:must keep', 'repair:must keep', 'retain:must keep'], compare: ['encode:failure', 'commit:failure'] },
    explanation: 'A serious DA system is a pipeline: encode, commit, distribute, sample, repair, retain, and archive. Each stage needs its own data structure and failure tests.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'sampling game') yield* samplingGame();
  else if (view === 'blob pipeline') yield* blobPipelineView();
  else throw new InputError('Pick a data availability sampling view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Data availability sampling is the technique that lets many lightweight nodes gain high confidence that block or blob data was actually published without each node downloading everything. It combines erasure coding, commitments, random sampling, peer retrieval, and repair. It is central to modular blockchain designs where rollups or apps execute elsewhere but must publish enough data for anyone to check them.',
        'The data-structure story is concrete. Original bytes become coded shares. Shares are arranged into indexed cells or blob vectors. Commitments bind those shares. Light clients request random cells plus proofs. Full nodes and archival providers reconstruct and retain data. Execution layers then use the available data to verify or dispute state transitions.',
      ],
    },
    {
      heading: 'Why erasure coding comes first',
      paragraphs: [
        'If a block producer could hide one critical byte and still pass sampling, random samples would be weak. Erasure coding changes the attack: the producer must hide many coded shares to prevent reconstruction. Once many shares are missing, random sampling has a much better chance of detecting the withholding.',
        'This is why Reed-Solomon Erasure Coding is a prerequisite. A DAS design needs a coding rule, share coordinates, reconstruction threshold, proofs that sampled shares belong to the committed data, and repair logic for peers that missed or lost shares. Sampling is the visible behavior; coding is the reason sampling has teeth.',
      ],
    },
    {
      heading: 'Ethereum and Celestia as case studies',
      paragraphs: [
        'Ethereum EIP-4844 introduced blob-carrying transactions and KZG commitments. The EIP specifies that commitments must match the corresponding blobs and proofs, and ethereum.org describes danksharding as moving toward distributed data sampling across blobs. EIP-4844 is proto-danksharding: a step that makes rollup data cheaper and prepares commitment plumbing for later sampling designs.',
        'Celestia is an explicit data availability layer. Its docs describe erasure-coded blobs, a two-dimensional extended data square, namespaced Merkle trees for row and column commitments, and light-node data availability sampling. Namespaced Merkle Tree Proof Case Study breaks down that completeness proof: sorted namespace leaves plus min/max range siblings let one app verify it received all of its own data. That makes Celestia a clean teaching contrast with Ethereum blobs: different commitments and network roles, same underlying boundary between availability, validity, and archival retention.',
      ],
    },
    {
      heading: 'Complete case study: a rollup batch',
      paragraphs: [
        'A rollup batches user transactions and posts the batch data as blob or DA-layer data. The chain stores a compact commitment or versioned hash. During the retention window, honest nodes can fetch the blob, verify the commitment, reconstruct the rollup inputs, and check an optimistic fraud proof or a validity proof. If the sequencer publishes a state root but withholds data, users cannot independently reconstruct the transition; DAS is designed to make that withholding detectable before the system accepts the data as available.',
        'The important distinction is that availability is not validity. DAS can say the data was likely published. It does not prove the rollup executed correctly. KZG can prove a point belongs to a committed polynomial. It does not prove the application semantics. Archival nodes can keep historical blobs. They do not change whether data was available during the consensus window. Each layer has a different proof object.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not say a commitment makes data available. A commitment can bind to data that nobody can download. Do not say sampling proves certainty; it provides high confidence under assumptions about random sampling, enough honest nodes, and network retrieval. Do not say erasure coding is archival; it helps reconstruct from enough live shares, but the system still needs retention and archival policy.',
        'Another trap is biased sampling. If a producer or network adversary can predict or steer sample positions, detection probability falls. A serious DAS design needs sampling randomness, peer diversity, custody or repair strategy, and monitoring for cells that are repeatedly unavailable. Finally, do not ignore namespacing. In modular systems, apps need proofs for their own data ranges without downloading every other app blob.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: ethereum.org Danksharding roadmap at https://ethereum.org/roadmap/danksharding/, EIP-4844 at https://eips.ethereum.org/EIPS/eip-4844, EIP-7594 PeerDAS at https://github.com/ethereum/EIPs/blob/master/EIPS/eip-7594.md, Celestia data availability docs at https://docs.celestia.org/learn/celestia-101/data-availability/, Celestia app data structures at https://celestiaorg.github.io/celestia-app/data_structures.html, and the Ethereum research note on data availability and erasure coding at https://github.com/ethereum/research/wiki/A-note-on-data-availability-and-erasure-coding.',
        'Study Namespaced Merkle Tree Proof Case Study, Reed-Solomon Erasure Coding, KZG Polynomial Commitments, Narwhal Bullshark DAG Mempool Case Study, HotStuff BFT Quorum Certificate Case Study, Merkle Tree, Content-Addressed Merkle DAG Object Store, Reservoir Sampling, Byzantine Fault Tolerance: When Nodes Lie, and Distributed Tracing next.',
      ],
    },
  ],
};
