// DiffDock turns molecular docking into diffusion over ligand pose variables:
// translation, rotation, and torsion are sampled and denoised against a protein
// pocket instead of regressed in one shot.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'diffdock-ligand-pose-diffusion-case-study',
  title: 'DiffDock Ligand Pose Diffusion Case Study',
  category: 'AI & ML',
  summary: 'Molecular docking as pose diffusion: ligand graphs, pocket context, translation-rotation-torsion variables, confidence heads, and candidate ranking.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['pose manifold', 'ranked samples'], defaultValue: 'pose manifold' },
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

function dockingGraph(title, offset = 1.0) {
  const shift = (base, delta) => base + delta * offset;
  return graphState({
    nodes: [
      { id: 'p1', label: 'pocket', x: 1.0, y: 2.5, note: 'protein' },
      { id: 'p2', label: 'site', x: 2.4, y: 1.7, note: 'residue' },
      { id: 'p3', label: 'site', x: 2.6, y: 4.3, note: 'residue' },
      { id: 'ligA', label: 'C', x: shift(6.6, -1.8), y: shift(2.4, -0.7), note: 'ligand' },
      { id: 'ligB', label: 'N', x: shift(7.3, 1.1), y: shift(3.1, 0.8), note: 'ligand' },
      { id: 'ligC', label: 'O', x: shift(6.7, -1.0), y: shift(4.2, 1.2), note: 'ligand' },
      { id: 'score', label: 'score', x: 8.8, y: 3.3, note: 'conf' },
      { id: 'pose', label: 'pose', x: 5.0, y: 3.3, note: 'T R tau' },
    ],
    edges: [
      { id: 'e-p1-p2', from: 'p1', to: 'p2', weight: 'edge' },
      { id: 'e-p1-p3', from: 'p1', to: 'p3', weight: 'edge' },
      { id: 'e-p2-p3', from: 'p2', to: 'p3', weight: 'pocket' },
      { id: 'e-pose-a', from: 'pose', to: 'ligA' },
      { id: 'e-a-b', from: 'ligA', to: 'ligB', weight: 'bond' },
      { id: 'e-b-c', from: 'ligB', to: 'ligC', weight: 'torsion' },
      { id: 'e-p2-ligA', from: 'p2', to: 'ligA', weight: 'contact' },
      { id: 'e-p3-ligC', from: 'p3', to: 'ligC', weight: 'contact' },
      { id: 'e-lig-score', from: 'ligB', to: 'score' },
    ],
  }, { title });
}

function* poseManifold() {
  yield {
    state: labelMatrix(
      'Pose state',
      [
        { id: 'trans', label: 'T' },
        { id: 'rot', label: 'R' },
        { id: 'tor', label: 'tau' },
        { id: 'graph', label: 'graph' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['xyz', 'where'],
        ['rot', 'face'],
        ['angles', 'shape'],
        ['atoms', 'chem'],
      ],
    ),
    highlight: { active: ['trans:stores', 'rot:stores', 'tor:stores'], found: ['graph:why'] },
    explanation: 'Docking is not just predicting one vector. A ligand pose has translation, rotation, and torsion degrees of freedom, plus the ligand graph and pocket context that make those variables chemically meaningful.',
    invariant: 'The sampler must move on the pose manifold, not treat every coordinate as an independent table cell.',
  };

  yield {
    state: dockingGraph('Random ligand pose near a protein pocket', 1.0),
    highlight: { active: ['p1', 'p2', 'p3', 'ligA', 'ligB', 'ligC'], compare: ['pose'] },
    explanation: 'DiffDock starts from noisy pose variables around a pocket. The protein pocket and ligand graph provide the conditioning context; the sample itself is a proposed 3D arrangement of the ligand.',
  };

  yield {
    state: dockingGraph('Denoising aligns contacts and torsions', 0.25),
    highlight: { active: ['e-p2-ligA', 'e-p3-ligC', 'e-a-b', 'e-b-c', 'pose'], found: ['score'] },
    explanation: 'Denoising adjusts translation, rotation, and torsion so ligand atoms land in a plausible pocket pose. The graph keeps the molecule connected while the pose variables move through space.',
  };

  yield {
    state: labelMatrix(
      'Search frame',
      [
        { id: 'old', label: 'old' },
        { id: 'reg', label: 'reg' },
        { id: 'diff', label: 'diff' },
        { id: 'rank', label: 'rank' },
      ],
      [
        { id: 'move', label: 'move' },
        { id: 'failure', label: 'risk' },
      ],
      [
        ['enum', 'slow'],
        ['1 pose', 'fragile'],
        ['K pose', 'cost'],
        ['conf', 'misrank'],
      ],
    ),
    highlight: { active: ['diff:move', 'rank:move'], compare: ['old:failure', 'reg:failure'] },
    explanation: 'The data-structure lesson is that generative sampling can replace brittle single-pose regression. But the output still needs ranking, uncertainty, and downstream chemistry checks.',
  };
}

function* rankedSamples() {
  yield {
    state: plotState({
      axes: { x: { label: 'candidate', min: 1, max: 6 }, y: { label: 'score', min: 0, max: 100 } },
      series: [
        { id: 'conf', label: 'conf', points: [{ x: 1, y: 62 }, { x: 2, y: 84 }, { x: 3, y: 77 }, { x: 4, y: 49 }, { x: 5, y: 70 }, { x: 6, y: 57 }] },
        { id: 'contact', label: 'contact', points: [{ x: 1, y: 58 }, { x: 2, y: 88 }, { x: 3, y: 69 }, { x: 4, y: 40 }, { x: 5, y: 76 }, { x: 6, y: 54 }] },
      ],
      markers: [
        { id: 'pick', x: 2, y: 84, label: 'pick' },
      ],
    }),
    highlight: { active: ['conf', 'contact', 'pick'] },
    explanation: 'A docking run is a candidate set, not a single answer. The confidence head and contact checks decide which sampled pose deserves expensive follow-up.',
  };

  yield {
    state: labelMatrix(
      'Candidate ledger',
      [
        { id: 'c1', label: 'pose1' },
        { id: 'c2', label: 'pose2' },
        { id: 'c3', label: 'pose3' },
        { id: 'c4', label: 'pose4' },
      ],
      [
        { id: 'conf', label: 'conf' },
        { id: 'rmsd', label: 'proxy' },
        { id: 'route', label: 'route' },
      ],
      [
        ['mid', 'ok', 'hold'],
        ['high', 'good', 'check'],
        ['high', 'clash', 'reject'],
        ['low', 'unknown', 'again'],
      ],
    ),
    highlight: { active: ['c2:route'], compare: ['c3:rmsd', 'c4:route'] },
    explanation: 'The ranked sample table stores more than model confidence. It should keep clashes, pocket contacts, pose diversity, seed, and whether a chemist should inspect, reject, or resample.',
  };

  yield {
    state: dockingGraph('Selected pose becomes a review object', 0.1),
    highlight: { active: ['ligA', 'ligB', 'ligC', 'p2', 'p3', 'e-p2-ligA', 'e-p3-ligC', 'score'], found: ['pose'] },
    explanation: 'The selected pose is handed to downstream review with its graph, pocket contacts, torsions, score, and sample provenance. That provenance matters when later experiments disagree.',
  };

  yield {
    state: labelMatrix(
      'Virtual screen',
      [
        { id: 'lib', label: 'lib' },
        { id: 'sample', label: 'samp' },
        { id: 'gate', label: 'gate' },
        { id: 'exp', label: 'assay' },
      ],
      [
        { id: 'data', label: 'data' },
        { id: 'decision', label: 'move' },
      ],
      [
        ['ligands', 'batch'],
        ['poses', 'top K'],
        ['conf', 'triage'],
        ['lab', 'verify'],
      ],
    ),
    highlight: { active: ['lib:decision', 'sample:decision', 'gate:decision', 'exp:decision'] },
    explanation: 'A virtual-screening team samples multiple poses for each molecule, ranks them by confidence and chemistry rules, keeps diverse candidates, and sends a small set to experimental testing.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'pose manifold') yield* poseManifold();
  else if (view === 'ranked samples') yield* rankedSamples();
  else throw new InputError('Pick a DiffDock view.');
}

export const article = {
  references: [
    { title: 'DiffDock: Diffusion Steps, Twists, and Turns for Molecular Docking', url: 'https://arxiv.org/abs/2210.01776' },
    { title: 'ICLR 2023 DiffDock entry', url: 'https://openreview.net/forum?id=kKF8_K-mBbS' },
    { title: 'DiffDock code and examples', url: 'https://github.com/gcorso/DiffDock' },
  ],
  sections: [
    { heading: 'What it is', paragraphs: ['DiffDock is a molecular docking method that frames ligand pose prediction as diffusion over pose variables. The model samples how a small molecule could sit in a protein pocket instead of returning one direct regression output.', 'This module belongs next to Diffusion Models and Graph Neural Networks: the ligand and pocket are graphs, while the generation state is translation, rotation, and torsion.'] },
    { heading: 'Data structures', paragraphs: ['A practical docking run stores the protein pocket graph, ligand atom-bond graph, translation vector, rotation state, torsion angles, timestep, denoiser score, sampled pose, confidence estimate, and candidate rank.', 'The pose is non-Euclidean because rotation and torsion are not ordinary independent scalar coordinates. DiffDock maps docking to a product space of translation, rotation, and torsion variables so the sampler can move through valid pose states.'] },
    { heading: 'How it works', paragraphs: ['The sampler starts from noisy pose variables and repeatedly denoises them under pocket and ligand conditioning. Translation moves the ligand center, rotation changes orientation, and torsion changes rotatable bonds.', 'A confidence model then ranks generated candidates. This matters because a generative model can produce several plausible poses, and the downstream workflow needs a ranked shortlist with provenance.'] },
    { heading: 'Complete case study', paragraphs: ['A virtual-screening pipeline receives a protein pocket and a library of candidate ligands. For each ligand, it builds a graph, samples multiple poses, filters clashes, ranks by confidence, and preserves sample diversity before chemist review.', 'The output table records molecule ID, seed, pose variables, score, pocket contacts, route, and validation status. That table is the bridge between diffusion sampling and scientific decision-making.'] },
    { heading: 'Pitfalls', paragraphs: ['Docking confidence is not binding truth. A plausible pose can fail because the protein conformation is wrong, water or ions matter, the chemistry is outside training distribution, or assay conditions change the system.', 'Another trap is collapsing the candidate set too early. Diversity is useful because the highest-confidence pose is not always the experimentally relevant one.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: DiffDock at https://arxiv.org/abs/2210.01776, ICLR 2023 OpenReview entry at https://openreview.net/forum?id=kKF8_K-mBbS, and DiffDock code at https://github.com/gcorso/DiffDock. Study Graph Neural Networks, Diffusion Models, Quality Diversity MAP-Elites, and Surrogate-Assisted Evolution next.'] },
  ],
};
