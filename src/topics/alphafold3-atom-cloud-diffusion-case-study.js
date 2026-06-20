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
  references: [
    { title: 'Nature: Accurate structure prediction of biomolecular interactions with AlphaFold 3', url: 'https://www.nature.com/articles/s41586-024-07487-w' },
    { title: 'AlphaFold 3 supplementary information', url: 'https://www.nature.com/articles/s41586-024-07487-w#Sec30' },
    { title: 'EMBL-EBI: How does AlphaFold 3 work?', url: 'https://www.ebi.ac.uk/training/online/courses/alphafold/alphafold-3-and-alphafold-server/introducing-alphafold-3/how-does-alphafold-3-work/' },
  ],
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'AlphaFold 3 is a useful case study because it moves diffusion models out of the usual image-grid setting and into biomolecular structure prediction. The object being generated is not a picture. It is a 3D arrangement of atoms for proteins, nucleic acids, ligands, ions, and modified residues in one complex.',
        'The data-structure lesson is that the model needs several linked representations at once: molecular tokens, pair relationships, atom coordinates, diffusion timesteps, sampled structures, mmCIF outputs, and confidence metrics. The output is a structured scientific hypothesis, not just a coordinate file.',
      ],
    },
    {
      heading: 'Baseline and wall',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/60/Myoglobin.png', alt:'Protein 3D structure', caption:'Protein structure prediction requires modeling thousands of atom coordinates simultaneously. AlphaFold 3 extends this to full biomolecular complexes. Source: Wikimedia Commons, AzaToth, Public domain'},
        'A naive baseline would handle each molecule type with separate rules: predict a protein backbone, dock a ligand afterward, model nucleic acids separately, and patch confidence together late. That loses the joint interaction problem. Interfaces, ligand poses, ions, and modified residues can all depend on each other.',
        'Another baseline is deterministic coordinate regression: feed the sequence and directly predict one final structure. The wall is uncertainty. Biomolecular complexes can have multiple plausible arrangements, weak evidence in some regions, and interfaces where the local atom geometry looks plausible but the global placement is uncertain.',
        'AlphaFold 3 uses conditional diffusion to make sampling part of the representation. It starts from noisy atom coordinates and repeatedly denoises under molecular context, then reports confidence so users can separate a high-confidence hypothesis from a weak one.',
      ],
    },
    {
      heading: 'Core invariant',
      paragraphs: [
        {type:'callout', text:'AlphaFold 3\\u2019s central invariant: every coordinate update stays tied to molecular conditioning. The diffusion module denoises atom positions while sequence, MSA, and pairwise features continuously guide the process. Coordinates without confidence scores are not predictions — they are guesses.'},
        'The central invariant is that every coordinate update stays tied to molecular conditioning. Sequence, MSA, template, and pair features are not discarded when diffusion starts. They keep informing how the noisy atom cloud should move toward a plausible complex.',
        'Tokenization is the first important design choice. Standard residues and nucleotides can be represented at token level, while ligands, ions, and chemically detailed pieces may need atom-level treatment. The model has to preserve chemical detail without turning every large biomolecule into an unaffordable flat atom sequence.',
        'The second invariant is that coordinates and confidence travel together. A predicted structure without pLDDT, PAE, pTM, ipTM, or related confidence signals is not enough for scientific use, because the risky region is often exactly the region the user cares about.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the atom-cloud view, read the scattered C, N, O, and P nodes as atom coordinates under refinement. The pair node is not a visible bond list; it represents learned pairwise context that biases how atoms should move relative to the rest of the complex.',
        'The denoising frame shows a point cloud becoming more coherent. That does not mean the model is simulating physical time. It means each sampling step updates coordinates so they better match the learned distribution conditioned on the input molecules.',
        'In the confidence-ledger view, the best-looking sample is not automatically the selected sample. The plot and table separate local atom confidence, domain placement uncertainty, and interface confidence. The right reading is: coordinates plus confidence form the prediction bundle.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'The input is converted into molecular records: chains, residues, nucleotides, ligands, ions, atom names, and connectivity-related context. The trunk builds single-token and pair representations from sequence, MSA, templates, and molecular context.',
        'During training, true atom coordinates are corrupted with noise, and the denoising module learns to recover cleaner coordinates under the trunk conditioning. During sampling, the model starts with a noisy all-atom coordinate cloud and iteratively updates positions over denoising steps.',
        'The final output is a bundle. It includes coordinates, usually exported in a structure format such as mmCIF, plus confidence metrics. Multiple diffusion samples can be generated, ranked, and inspected before a scientist decides which hypotheses are worth downstream validation.',
      ],
    },
    {
      heading: 'Correctness and evidence',
      paragraphs: [
        'This topic does not have the same kind of correctness proof as a tree rotation or shortest-path invariant. The model is statistical. The right question is whether the representation preserves the needed evidence, whether the training objective matches coordinate recovery, and whether confidence metrics expose likely failure regions.',
        'Local confidence and interface confidence answer different questions. pLDDT-style local confidence can say whether atom neighborhoods look reliable. PAE-style pair error can reveal uncertain relative placement of domains. ipTM-style interface confidence is especially important for complexes because the interface is often the biological point of the prediction.',
        'A responsible workflow treats the prediction as a ranked hypothesis. Strong confidence can prioritize an experiment. Weak confidence should trigger inspection, alternative samples, additional evidence, or a different experimental plan.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a drug-discovery team submits a protein and a candidate ligand. The protein is represented largely through residue-level tokens, while the ligand needs atom-level detail because small changes in ligand pose can determine whether the hypothesis is useful.',
        'The model builds pair features for the combined molecular context, samples several noisy atom clouds, and denoises each one into a possible complex. The team does not simply choose the prettiest 3D shape. It ranks samples using interface confidence, inspects PAE around the binding region, checks local confidence around ligand atoms, and looks for clashes or unsupported geometry.',
        'The output that survives that triage becomes an experimental hypothesis. It may guide assay design, mutagenesis, docking follow-up, or structural experiments, but it does not replace those checks.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'All-atom diffusion is more expressive than backbone-only thinking, but it is computationally heavier. More atoms, more molecular types, and multiple samples increase memory and runtime. The system spends that cost to model interactions directly instead of stitching separate predictions together afterward.',
        'The model also trades deterministic output for sampling. Sampling can reveal alternative plausible structures and improve ranking, but it creates an ensemble-selection problem. The confidence ledger is therefore part of the method, not an optional report.',
        'There is also a data tradeoff. Learned structure priors are powerful where training data and conditioning are informative, but unusual chemistry, flexible regions, weak interfaces, and out-of-distribution complexes can still be unreliable.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'The approach is strongest when the question is joint biomolecular structure: proteins with ligands, nucleic acids, ions, modified residues, or interfaces where separate modeling would miss dependencies. It is also valuable when multiple sampled hypotheses can be ranked and triaged quickly.',
        'As a curriculum topic, it is a clean bridge between diffusion models, graph-like molecular representations, attention over pairs, point clouds, and scientific confidence reporting. It shows that a generated artifact can be a structured object plus an uncertainty ledger.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The model can be impressive and still be uncertain in the exact region that matters. A ligand pose, a flexible loop, or a protein-protein interface can be the biological question and also the lowest-confidence part of the prediction.',
        'It also fails as a workflow when users treat diffusion as magic chemistry. The denoiser learns from structural data and conditioning; it does not replace physical validation, assay design, cryo-EM, crystallography, medicinal chemistry, or domain expertise.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Nature AlphaFold 3 at https://www.nature.com/articles/s41586-024-07487-w, AlphaFold 3 supplementary information at https://www.nature.com/articles/s41586-024-07487-w#Sec30, and EMBL-EBI AlphaFold 3 tutorial at https://www.ebi.ac.uk/training/online/courses/alphafold/alphafold-3-and-alphafold-server/introducing-alphafold-3/how-does-alphafold-3-work/.',
        'Study Diffusion Models, Graph Neural Networks, Attention, Multi-Head Attention, Point Cloud Networks, Protein Folding, and Saliency Maps next. A useful follow-up exercise is to map each output confidence metric to the scientific decision it should and should not support.',
      ],
    },
  ],
};
