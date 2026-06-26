// AlphaFold 3 reframes structure prediction as all-atom conditional diffusion:
// start from a noisy atom cloud, then denoise coordinates under sequence and
// pair-token constraints.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'alphafold3-atom-cloud-diffusion-case-study',
  title: 'AlphaFold 3 Atom Cloud Diffusion Case Study',
  category: 'AI & ML',
  summary: 'AlphaFold 3 as a diffusion data-structure case study: molecular tokens, pair representations, all-atom coordinate clouds, denoising samples, and confidence ledgers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['atom cloud', 'confidence ledger'], defaultValue: 'atom cloud' },
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

function atomGraph(title, spread = 1.0) {
  const c = (base, delta) => base + delta * spread;
  return graphState({
    nodes: [
      { id: 'seq', label: 'seq', x: 0.8, y: 2.3, note: 'input' },
      { id: 'msa', label: 'MSA', x: 0.8, y: 4.6, note: 'signal' },
      { id: 'pair', label: 'pair', x: 2.7, y: 3.4, note: 'bias' },
      { id: 'atomA', label: 'C', x: c(4.3, -1.4), y: c(2.4, -0.8), note: 'atom' },
      { id: 'atomB', label: 'N', x: c(5.0, 1.2), y: c(3.0, 1.0), note: 'atom' },
      { id: 'atomC', label: 'O', x: c(5.5, -0.8), y: c(4.5, 1.3), note: 'atom' },
      { id: 'atomD', label: 'P', x: c(6.4, 1.5), y: c(3.8, -1.1), note: 'atom' },
      { id: 'denoise', label: 'denoise', x: 7.5, y: 3.4, note: 'steps' },
      { id: 'mmcif', label: 'mmCIF', x: 9.1, y: 3.4, note: 'output' },
    ],
    edges: [
      { id: 'e-seq-pair', from: 'seq', to: 'pair' },
      { id: 'e-msa-pair', from: 'msa', to: 'pair' },
      { id: 'e-pair-a', from: 'pair', to: 'atomA' },
      { id: 'e-pair-b', from: 'pair', to: 'atomB' },
      { id: 'e-a-b', from: 'atomA', to: 'atomB', weight: 'bond' },
      { id: 'e-b-c', from: 'atomB', to: 'atomC', weight: 'geom' },
      { id: 'e-c-d', from: 'atomC', to: 'atomD', weight: 'geom' },
      { id: 'e-atoms-denoise', from: 'atomB', to: 'denoise' },
      { id: 'e-denoise-out', from: 'denoise', to: 'mmcif' },
    ],
  }, { title });
}

function* atomCloud() {
  yield {
    state: labelMatrix(
      'Token map',
      [
        { id: 'aa', label: 'amino' },
        { id: 'rna', label: 'nuc' },
        { id: 'lig', label: 'ligand' },
        { id: 'ion', label: 'ion' },
      ],
      [
        { id: 'token', label: 'token' },
        { id: 'coords', label: 'xyz' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['res', 'later', 'protein'],
        ['base', 'later', 'DNA/RNA'],
        ['atom', 'direct', 'small'],
        ['atom', 'direct', 'chem'],
      ],
    ),
    highlight: { active: ['lig:token', 'ion:token'], compare: ['aa:token', 'rna:token'] },
    explanation: 'AlphaFold 3 has to handle proteins, nucleic acids, ligands, ions, and modified residues in one model. The first useful data structure is a token table that can mix residue-level tokens with atom-level tokens where chemistry needs more detail.',
    invariant: 'The tokenization has to preserve enough chemical detail without turning every large biomolecule into an unaffordable all-atom sequence.',
  };

  yield {
    state: atomGraph('Noisy atom cloud conditioned by pair features', 1.0),
    highlight: { active: ['seq', 'msa', 'pair', 'e-seq-pair', 'e-msa-pair'], compare: ['atomA', 'atomB', 'atomC', 'atomD'] },
    explanation: 'The trunk builds single and pair representations from sequence, MSA, templates, and molecular context. The diffusion module receives a noisy all-atom coordinate cloud plus those conditioning features.',
  };

  yield {
    state: atomGraph('Denoising pulls atoms into a plausible complex', 0.35),
    highlight: { active: ['atomA', 'atomB', 'atomC', 'atomD', 'e-a-b', 'e-b-c', 'e-c-d', 'denoise'], found: ['pair'] },
    explanation: 'Sampling repeatedly updates atom coordinates. This is not a 2D image grid: the state is a set of 3D atom positions whose final geometry must satisfy molecular relationships, interfaces, and chain packing.',
  };

  yield {
    state: labelMatrix(
      'Output bundle',
      [
        { id: 'coord', label: 'coords' },
        { id: 'local', label: 'local' },
        { id: 'pairerr', label: 'pair err' },
        { id: 'global', label: 'global' },
      ],
      [
        { id: 'stored', label: 'stored' },
        { id: 'use', label: 'use' },
      ],
      [
        ['mmCIF', 'structure'],
        ['pLDDT', 'atom trust'],
        ['PAE', 'packing'],
        ['pTM/ipTM', 'rank'],
      ],
    ),
    highlight: { active: ['coord:stored', 'local:stored', 'pairerr:stored', 'global:stored'], found: ['pairerr:use', 'global:use'] },
    explanation: 'The deployable artifact is not only coordinates. A complete prediction carries structure files plus confidence metrics that tell scientists where the model thinks local atoms, domains, and interfaces are reliable.',
  };
}

function* confidenceLedger() {
  yield {
    state: plotState({
      axes: { x: { label: 'diffusion sample', min: 1, max: 5 }, y: { label: 'confidence', min: 0, max: 100 } },
      series: [
        { id: 'iptm', label: 'ipTM', points: [{ x: 1, y: 71 }, { x: 2, y: 82 }, { x: 3, y: 64 }, { x: 4, y: 79 }, { x: 5, y: 69 }] },
        { id: 'plddt', label: 'pLDDT', points: [{ x: 1, y: 83 }, { x: 2, y: 88 }, { x: 3, y: 81 }, { x: 4, y: 86 }, { x: 5, y: 84 }] },
      ],
      markers: [
        { id: 'best', x: 2, y: 82, label: 'rank' },
      ],
    }),
    highlight: { active: ['iptm', 'plddt', 'best'] },
    explanation: 'AlphaFold 3 can sample the diffusion process multiple times. The ranking problem is therefore a small ensemble problem: compare sampled structures by interface and local confidence, not by visual appeal.',
  };

  yield {
    state: labelMatrix(
      'Confidence table',
      [
        { id: 'loop', label: 'loop' },
        { id: 'domain', label: 'domain' },
        { id: 'ligand', label: 'ligand' },
        { id: 'iface', label: 'iface' },
      ],
      [
        { id: 'metric', label: 'metric' },
        { id: 'action', label: 'action' },
      ],
      [
        ['pLDDT low', 'caution'],
        ['PAE high', 'uncertain'],
        ['atom pLDDT', 'inspect'],
        ['ipTM', 'rank'],
      ],
    ),
    highlight: { active: ['loop:action', 'domain:action', 'ligand:action', 'iface:action'], compare: ['iface:metric'] },
    explanation: 'The confidence ledger gives different warnings at different scales. A ligand can have plausible local atoms while the interface placement is weak; a domain can be locally folded but poorly positioned against another chain.',
  };

  yield {
    state: atomGraph('Scientists keep the model output tied to evidence', 0.25),
    highlight: { active: ['mmcif', 'denoise', 'e-denoise-out'], compare: ['pair', 'msa'], found: ['atomA', 'atomB', 'atomC', 'atomD'] },
    explanation: 'The prediction should be read as a model-generated hypothesis. The useful workflow links coordinates, confidence metrics, sequence/MSA evidence, and downstream experimental checks in one inspection bundle.',
  };

  yield {
    state: labelMatrix(
      'Protein plus ligand',
      [
        { id: 'input', label: 'in' },
        { id: 'sample', label: 'run' },
        { id: 'filter', label: 'filter' },
        { id: 'lab', label: 'lab' },
      ],
      [
        { id: 'object', label: 'object' },
        { id: 'decision', label: 'move' },
      ],
      [
        ['seq+lig', 'tok'],
        ['5x', 'rank'],
        ['conf', 'triage'],
        ['assay', 'verify'],
      ],
    ),
    highlight: { active: ['input:decision', 'sample:decision', 'filter:decision', 'lab:decision'] },
    explanation: 'A drug-discovery team does not stop at the prettiest structure. It submits the complex, samples several atom-cloud denoising runs, ranks by confidence, inspects interface uncertainty, and sends only credible hypotheses to lab validation.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'atom cloud') yield* atomCloud();
  else if (view === 'confidence ledger') yield* confidenceLedger();
  else throw new InputError('Pick an AlphaFold 3 view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation treats AlphaFold 3 as a conditional diffusion system. Diffusion means the model starts from noisy coordinates and repeatedly updates them toward a plausible structure. Active nodes show conditioning evidence or coordinate updates; found nodes show the output bundle that scientists inspect.',
        'Read the atom cloud as 3D coordinates, not as a graph drawing of a molecule. The confidence ledger is part of the prediction, because a coordinate without uncertainty can mislead the user in the exact binding site or interface that matters.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/60/Myoglobin.png', alt:'Protein 3D structure', caption:'Protein structure prediction requires modeling thousands of atom coordinates simultaneously. AlphaFold 3 extends this to full biomolecular complexes. Source: Wikimedia Commons, AzaToth, Public domain'},
        'AlphaFold 3 exists because biology does not stop at isolated protein backbones. A useful prediction may need proteins, DNA, RNA, ligands, ions, modified residues, and interfaces in one complex. Modeling these pieces separately and docking them later can miss the dependency that makes the structure work.',
        'A zero-background reader should read molecule as a collection of atoms connected by chemical rules. Structure prediction means assigning 3D coordinates to those atoms. AlphaFold 3 frames that assignment as sampled denoising under sequence and molecular context.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is deterministic coordinate regression: feed the input molecules to a model and ask for one final structure. That is simple to explain and useful when the evidence points to one clear fold. It is weaker when multiple arrangements are plausible or when the interface evidence is thin.',
        'Another obvious approach is modular. Predict the protein, dock the ligand, handle nucleic acids separately, and patch confidence at the end. That loses joint reasoning because ligand pose, ion placement, and chain packing can change each other.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is uncertainty over many coupled coordinates. A complex with 5,000 atoms has 15,000 coordinate values before confidence is counted. A small error at an interface can make the biological conclusion wrong even if most of the protein looks reasonable.',
        'The second wall is mixed resolution. Residue-level tokens are efficient for long chains, but ligands and ions may need atom-level detail. A single representation has to preserve chemistry without making every large molecule unaffordable.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        {type:'callout', text:'AlphaFold 3\u2019s central invariant: every coordinate update stays tied to molecular conditioning. The diffusion module denoises atom positions while sequence, MSA, and pairwise features continuously guide the process. Coordinates without confidence scores are not predictions — they are guesses.'},
        'The core insight is conditional all-atom diffusion. The model begins with noisy atom positions, then denoises them while sequence, multiple-sequence alignment, templates, pair features, and molecular context keep influencing each update. The state is a structured atom cloud, not an image grid.',
        'The invariant is evidence attachment. Coordinates are useful only when they remain tied to the molecular conditioning and to confidence outputs such as local confidence, pair error, and interface confidence. A pretty coordinate file without those signals is not enough for scientific use.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Inputs are tokenized into molecular records: chains, residues, nucleotides, ligands, ions, atom names, and connectivity context. The trunk builds single-token and pair representations, meaning vectors for individual tokens and vectors for token pairs. Those representations condition the diffusion module.',
        'During training, true coordinates are corrupted with noise and the model learns to denoise them. During inference, the model samples noisy atom coordinates and repeatedly updates them. The final output includes coordinates, usually in a structure file, plus confidence metrics that rank and warn about the sample.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'This is not correctness in the algorithmic sense of a sorted array or shortest path. It is statistical evidence. The method works when the learned distribution, input conditioning, and denoising objective make high-probability coordinate sets correspond to real molecular structures.',
        'The confidence ledger is the practical correctness argument. Local confidence asks whether nearby atoms look reliable. Pair error asks whether domains or chains are placed reliably relative to each other. Interface confidence matters when the biological claim depends on contact between molecules.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cost grows with atom count, token count, pair features, and sample count. If one sample of a 2,000-token complex is already expensive, five diffusion samples spend roughly 5x the denoising compute before ranking. More samples can help triage uncertainty, but they are not free.',
        'The behavioral cost is that the output is a hypothesis bundle, not a fact. Flexible loops, unusual chemistry, weak alignments, and rare complexes can look plausible while remaining low confidence. A scientist pays inspection time after compute time.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'AlphaFold 3 is useful for protein-ligand hypotheses, protein-nucleic-acid complexes, antibody interfaces, enzyme active sites, and prioritizing wet-lab experiments. It helps when generating and ranking structural hypotheses is cheaper than testing every candidate directly.',
        'It also teaches a data-structure lesson for machine learning. Scientific outputs often need coordinates, metadata, confidence, provenance, and downstream checks in one package. The prediction is the bundle, not only the geometry.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when users treat a generated structure as experimental truth. A ligand pose can be the lowest-confidence part of the structure and still be the part a drug team cares about. Weak interface confidence should change the decision, not be hidden behind a good-looking rendering.',
        'It also fails outside its evidence base. Unusual chemistry, conformational flexibility, disorder, missing cofactors, or biological states not represented in the input can produce confident-looking but unsupported hypotheses. Lab validation remains the authority.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a team submits a 420-residue protein and a ligand with 34 atoms. The model emits 5 diffusion samples. Sample 1 has pLDDT 88 but interface score 0.42, sample 2 has pLDDT 84 and interface score 0.76, and sample 3 has pLDDT 90 but clashes near the ligand.',
        'The team should not choose the highest local confidence blindly. If the task is ligand binding, sample 2 is the better hypothesis because the interface score is higher and the local ligand region can be inspected. The numbers change behavior: they decide what goes to docking follow-up or lab assay, not just which picture looks clean.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the Nature AlphaFold 3 paper, the AlphaFold 3 supplementary information, and the EMBL-EBI AlphaFold 3 training material. Study diffusion models, attention, graph neural networks, point clouds, protein folding, molecular docking, and uncertainty calibration next.',
        'A useful exercise is to inspect one predicted complex with two scores in hand: local confidence around each atom and pair error across the interface. Mark which scientific claims each score supports and which claims still need experiment.',
      ],
    },
  ],
};