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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a publication test, not as an execution-validity test. A block producer starts with original data, expands it into coded shares, commits to those shares, and then light nodes sample random positions. Active cells are sampled cells, found cells are valid responses, and missing cells are evidence of withholding.',
        'The safe inference rule is probabilistic. If enough independent random samples return valid coded shares, the data was likely available during the sampling window. That does not prove the transactions are valid, and it does not prove the data will be stored forever.',
        {type:'callout', text:'DAS makes withholding expensive by erasure-coding data before sampling, then treats availability as probabilistic confidence rather than proof that a header is honest.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Data availability means that the bytes needed to reconstruct a block or rollup batch were actually published. A rollup is a blockchain system that executes transactions off a base chain but still needs the input data to be public so others can verify or challenge the result. A commitment in a header is not enough because a malicious producer can commit to data and then refuse to serve it.',
        'Data availability sampling, or DAS, exists to let light clients check publication without downloading everything. A light client is a verifier with limited bandwidth and storage. The design goal is to keep those clients cheap while making data withholding risky for producers.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to trust the block header. If the header contains a Merkle root or polynomial commitment, a client can verify that one returned share matches the commitment. That proves the sampled share is consistent; it says nothing about the shares the client did not ask for.',
        'The other obvious approach is full download by every verifier. That gives strong availability because each verifier has the data. It also caps throughput at what ordinary nodes can download, store, and check, which defeats the point of light clients.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is a withholding attack. If the original data has one crucial missing piece, a producer can answer many direct samples while still preventing reconstruction. Sampling the original data has weak detection power when the hidden region is small.',
        'The second wall is scale. If every user must download every byte, larger blocks push ordinary verifiers out of the system. The network needs a way to make missing data large enough to sample without making every participant a full archival node.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Change the shape of the data before sampling. Erasure coding expands the original data into more shares than are needed for reconstruction. After expansion, an attacker who wants reconstruction to fail must hide many coded shares, not one tiny original fragment.',
        'A commitment binds each sampled share to the advertised data, while random sampling checks whether shares are served. The invariant is confidence, not certainty. Enough independent valid samples make large-scale withholding unlikely to go unnoticed.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The producer splits the data into shares and applies an erasure code such as Reed-Solomon coding. Reed-Solomon coding adds parity-like shares so the original data can be reconstructed from a sufficient subset. Systems may arrange shares in a two-dimensional square or a one-dimensional vector, but the encode-commit-sample pattern is the same.',
        'The producer commits to the encoded data using Merkle roots, namespaced Merkle trees, or polynomial commitments such as KZG commitments. A light node picks random coordinates or cells, requests those shares from peers, and verifies each response against the commitment. Many light nodes sampling independently create network-wide detection pressure.',
        'Full nodes, bridge nodes, repair services, and archival services do the heavier work. They reconstruct larger data pieces, serve missing shares, and keep data beyond the protocol availability window. DAS is the publication layer under execution proofs and challenge systems.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The coding argument says that once data is extended, reconstruction fails only if a large enough set of coded shares is missing. The sampling argument says that random checks are likely to hit a large hidden set. Together, they turn a small hidden original fragment into a bigger sampling target.',
        'For a simple probability model, if an attacker hides 50 percent of coded shares and a client samples 20 independent positions, the chance of missing every hidden share is about 1 in 1,048,576. If 100 clients each sample 20 positions independently, the chance that all clients miss the hidden half becomes astronomically smaller. The argument depends on honest randomness, peer diversity, valid commitments, and enough time for data repair.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Erasure coding adds expansion cost. A 2x expansion turns 1 MB of original data into 2 MB of coded shares that must be distributed, committed, sampled, and sometimes repaired. Per-light-client bandwidth falls, but total network work does not disappear.',
        'Commitment machinery also costs engineering complexity. KZG commitments give compact proofs but require polynomial-commitment code and trusted setup assumptions in some deployments. Merkle-style commitments are simpler to reason about but can produce larger proofs or more tree metadata.',
        'Retention is a separate cost. DAS can show that data was available during a window, but users may need data later for audits, re-execution, or dispute resolution. Archival nodes, indexers, rollup operators, and storage markets handle that job outside the sampling proof.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Rollups are the main use case. They can execute transactions away from the base layer while relying on a data-availability layer to publish the inputs needed for verification. Validity proofs, fraud proofs, and state reconstruction all depend on those bytes being obtainable.',
        'Celestia uses data availability as a core service and combines erasure coding with namespaced data so applications can retrieve their own ranges. Ethereum EIP-4844 introduced blobs and KZG commitments as proto-danksharding infrastructure, and PeerDAS designs add sampling and custody ideas for blob data. The common access pattern is large producer data, small verifier samples, and heavier reconstruction by specialized nodes.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'DAS fails when people overstate the claim. Sampling is not certainty, availability is not transaction validity, and erasure coding is not permanent storage. A valid sampled share proves only that this share matched the commitment and was served at that time.',
        'It also fails under weak assumptions. Predictable sampling lets an adversary serve only likely cells. Poor peer diversity can target which clients receive data. Invalid extended data, broken coding, or missing fraud-proof machinery can make reconstruction fail even when some samples pass.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with 1,024 original shares of 1 KB each, so the original block data is 1 MB. A 2x erasure code expands this to 2,048 coded shares, or 2 MB. Reconstruction may require any 1,024 valid shares, depending on the exact code and layout.',
        'An attacker who hides only 10 original shares is dangerous in a direct-download model if those shares are necessary. After 2x coding, the attacker must hide enough coded shares to prevent any honest party from collecting a reconstructable subset. If the attacker hides 1,024 of 2,048 coded shares, a light client taking 30 random samples misses the hidden half with probability about 1 in 1.07 billion.',
        'The example shows why the code comes before sampling. Direct random checks against a tiny missing region are weak. Random checks against a large unavailable region are strong enough that many cheap clients can collectively police publication.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read EIP-4844 at https://eips.ethereum.org/EIPS/eip-4844, EIP-7594 PeerDAS at https://eips.ethereum.org/EIPS/eip-7594, Celestia data availability docs at https://docs.celestia.org/learn/celestia-101/data-availability/, Celestia data structures at https://celestiaorg.github.io/celestia-app/data_structures.html, and the Ethereum research note at https://github.com/ethereum/research/wiki/A-note-on-data-availability-and-erasure-coding. Then study Reed-Solomon coding, KZG commitments, Merkle trees, namespaced Merkle proofs, Byzantine fault tolerance, and content-addressed Merkle DAGs.',
      ],
    },
  ],
};
