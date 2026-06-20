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
      heading: 'Why This Exists',
      paragraphs: [
        'Data availability sampling exists because modular blockchain systems want many parties to check that data was published without forcing every participant to download every byte. Rollups and other execution layers can compute state transitions elsewhere, but they still need the underlying data to be public long enough for honest parties to reconstruct inputs, verify proofs, or challenge fraud. A block header or commitment alone is not enough. A malicious producer can commit to data and then withhold the actual bytes. Full download by every node solves availability, but it caps throughput at what ordinary nodes can fetch, store, and verify. Data availability sampling, or DAS, tries to keep light nodes light while making withholding attacks likely to be caught.',
        {type:'callout', text:'DAS makes withholding expensive by erasure-coding data before sampling, then treats availability as probabilistic confidence rather than proof that a header is honest.'},
      ],
    },
    {
      heading: 'The Naive Approaches',
      paragraphs: [
        'The first naive approach is to trust the header. If a block contains a Merkle root or a KZG commitment, a light client can verify that a sample matches the commitment. That proves inclusion or consistency for bytes it actually receives. It does not prove the rest of the data can be downloaded. The second naive approach is to require every node to download everything. That is simple and strong, but it makes data throughput scale with the weakest acceptable node profile. The third naive approach is to sample the original data directly. That fails because a producer could hide a small but decisive part of the original data. If one missing share blocks reconstruction, random sampling has too little detection power unless clients sample a large fraction of the block.',
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        'The core insight is to change the shape of the attack before sampling. Erasure coding expands the original data into more shares than are needed for reconstruction. Once the data is extended, hiding a tiny original fragment is no longer enough. To prevent honest nodes from reconstructing the data, the producer has to hide many coded shares. Random sampling then has teeth because the unavailable region is large enough to hit with a small number of independent challenges. Commitments bind sampled shares to the advertised data so the producer cannot answer samples with different bytes. The invariant is probabilistic: if enough independent samplers receive valid random shares, then with high confidence the data was available during the sampling window. It is not certainty, execution validity, or permanent storage.',
      ],
    },
    {
      heading: 'How the Pipeline Works',
      paragraphs: [
        'A DAS pipeline starts with bytes: transactions, rollup batch data, or application blobs. The producer splits those bytes into shares, applies an erasure code such as Reed-Solomon, and arranges the expanded shares into an indexed structure. Celestia describes a two-dimensional extended data square: original shares arranged in a k by k matrix, extended with parity into a larger matrix, and committed through row and column roots. Ethereum EIP-4844 introduced blob-carrying transactions where the execution layer can access a commitment reference while the large blob data is handled outside EVM execution. PeerDAS, specified in EIP-7594, extends EIP-4844 blobs with one-dimensional erasure coding and cells that can be authenticated against KZG commitments. Different systems choose different shapes, but the pipeline is the same: encode, commit, distribute, sample, repair, retain, and archive.',
        'A light node does not reconstruct the whole block. It chooses random coordinates or cells, asks peers for the shares at those positions, and verifies proofs against the committed header or blob commitment. Many light nodes doing this independently create network-wide coverage. Full nodes, bridge nodes, or repair services reconstruct larger pieces and serve missing data. Archival services keep older data after the protocol availability window. Execution layers then use the available data for their own proof systems. A rollup can derive its state from blob data, verify a validity proof, or give challengers the inputs needed for a fraud proof. DAS is the publication check under those higher-layer arguments.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'The correctness argument has two parts. The coding part says that the original data can be reconstructed from enough valid shares, so a producer that wants reconstruction to fail must hide more than a small local mistake. The sampling part says that once many shares are hidden, independent random samples have a rising chance of hitting a missing position. If one light client samples eight cells, that client alone has limited confidence. If many light clients sample independently, the probability that all of them miss a large withheld region falls quickly. Commitments add binding: a valid proof ties the returned share to the data root or polynomial commitment. The argument depends on honest sampling randomness, peer diversity, enough live data, and a repair path. Break those assumptions and confidence falls.',
      ],
    },
    {
      heading: 'What the Visual Proves',
      paragraphs: [
        'The sampling-game view shows why the erasure code comes before the random challenge. The original blob becomes a larger square or vector of shares, and the header binds commitments to that extended data. The toy matrix marks data shares and parity shares so the learner can see redundancy as stored cells, not as a vague safety claim. The random-sample matrix shows the confidence curve: one sample is weak, several samples are better, and many independent nodes are better still. The final matrix separates claims that are often confused. DAS can support a high-confidence availability claim and commitment consistency. It does not prove transaction validity, and it does not promise that the data will be stored forever.',
      ],
    },
    {
      heading: 'Costs and Tradeoffs',
      paragraphs: [
        'The cost starts with expansion. Erasure coding increases the number of shares that must be distributed, committed, and sometimes repaired. Two-dimensional schemes can make fraud proofs and light-client checks practical, but they also add row and column commitments. KZG-based blob designs have compact proofs and commitments, but they require polynomial-commitment machinery and careful implementation. Sampling lowers per-node bandwidth, yet the network still has to move enough data collectively. Repair and custody are not optional; if sampled cells vanish quickly or peers do not serve them, light-client confidence does not help users reconstruct anything. Retention policy matters because availability is time-bounded. Long-term historical access needs archival nodes, indexers, rollup teams, or other storage providers.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'DAS fits systems where many light participants need confidence that data was published but cannot download all data. Rollups are the main motivating case: transaction execution can move off the base layer, while the base layer or DA layer provides a publication guarantee for the inputs. Celestia uses DAS as a core data availability layer, combining erasure coding, extended data squares, row and column roots, and namespaced Merkle trees so applications can fetch their own data ranges. Ethereum EIP-4844 uses blobs and KZG commitments as proto-danksharding infrastructure, while PeerDAS designs move toward sampling and custody. The access pattern is asymmetric verification: producers publish large data, many light nodes check small random pieces, and full or bridge nodes reconstruct.',
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        'DAS fails when people overstate what it proves. A commitment is not availability. Sampling is not certainty. Availability is not validity. Erasure coding is not archival storage. Biased or predictable sampling weakens detection. Weak peer diversity lets an adversary target who receives which cells. Bad coding or invalid extended data can make reconstruction fail even if samples appear to pass, which is why designs need fraud proofs, validity checks, or commitment schemes that match the coding model. Namespacing can also be mishandled. Applications need completeness proofs for their own data ranges, not just random access to unrelated shares. Finally, DAS is the wrong tool for small systems where every verifier can cheaply download the data. The machinery pays off when full download becomes the bottleneck.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Primary references are EIP-4844 at https://eips.ethereum.org/EIPS/eip-4844, EIP-7594 PeerDAS at https://eips.ethereum.org/EIPS/eip-7594, Celestia data availability docs at https://docs.celestia.org/learn/celestia-101/data-availability/, Celestia app data structures at https://celestiaorg.github.io/celestia-app/data_structures.html, and the Ethereum research note on data availability and erasure coding at https://github.com/ethereum/research/wiki/A-note-on-data-availability-and-erasure-coding. Study Reed-Solomon erasure coding, KZG polynomial commitments, Merkle trees, namespaced Merkle tree proofs, reservoir sampling, Byzantine fault tolerance, HotStuff quorum certificates, Narwhal and Bullshark DAG mempools, content-addressed Merkle DAGs, and distributed tracing next. Keep the layers separate: DAS checks publication, proof systems check execution claims, and archival systems handle long-term access.',
      ],
    },
  ],
};
