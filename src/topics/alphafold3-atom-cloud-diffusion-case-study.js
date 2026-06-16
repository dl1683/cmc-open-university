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
    { heading: 'What it is', paragraphs: ['AlphaFold 3 is a biomolecular structure prediction system that uses a diffusion module to predict raw atom coordinates for complexes. The important data-structure shift is that the model can represent proteins, nucleic acids, ligands, ions, and modified residues in one prediction problem.', 'This topic extends Diffusion Models beyond images. The sample is not a pixel array; it is an all-atom coordinate set conditioned by sequence, MSA, template, and pair-token representations.'] },
    { heading: 'Data structures', paragraphs: ['The core records are molecular tokens, single-token embeddings, pair embeddings, atom coordinates, diffusion timesteps, sampled structures, mmCIF outputs, and confidence metrics. Tokens can represent standard residues, nucleotides, individual ligand atoms, ions, or modified atoms depending on the molecule type.', 'The Pairformer-style pair representation is a routing table for molecular relationships. The diffusion module uses conditioning from the trunk while updating noisy atom positions into plausible coordinates.'] },
    { heading: 'How it works', paragraphs: ['Training corrupts atom coordinates with Gaussian noise and trains a denoiser to recover the correct coordinates under molecular conditioning. Sampling starts from a random atom cloud and iteratively moves atoms toward a structure that fits the input complex.', 'The supplementary material describes a point-cloud diffusion model over all heavy atoms, conditioned by trunk features. The model then returns coordinates and confidence values so the output can be inspected rather than accepted blindly.'] },
    { heading: 'Complete case study', paragraphs: ['A team submits a protein and candidate ligand. The system tokenizes the protein mostly by residues and the ligand by atoms, builds pair features, samples several diffusion trajectories, and returns multiple structures.', 'The team ranks candidates using ipTM and related interface confidence, inspects PAE for uncertain packing, checks local pLDDT around ligand atoms, and treats the result as a hypothesis for experimental validation rather than as a final experimental fact.'] },
    { heading: 'Pitfalls', paragraphs: ['The model can be accurate and still be uncertain in the exact region a scientist cares about. Local atom confidence, domain placement, and interface confidence must be read separately.', 'Another trap is treating diffusion as magic chemistry. The denoiser learns from structural data and conditioning; it does not replace physical validation, assay design, cryo-EM, crystallography, or domain expertise.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: Nature AlphaFold 3 at https://www.nature.com/articles/s41586-024-07487-w, AlphaFold 3 supplementary information at https://www.nature.com/articles/s41586-024-07487-w#Sec30, and EMBL-EBI AlphaFold 3 tutorial at https://www.ebi.ac.uk/training/online/courses/alphafold/alphafold-3-and-alphafold-server/introducing-alphafold-3/how-does-alphafold-3-work/. Study Diffusion Models, Graph Neural Networks, Attention, Multi-Head Attention, and Saliency Maps next.'] },
  ],
};
