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
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the pose view as geometry, not as a flat vector. Translation moves the ligand in 3D space, rotation changes its orientation, and torsion changes rotatable bonds inside the molecule. The ranked-samples view shows that the model outputs candidate poses with confidence and chemistry checks, not one guaranteed answer.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Molecular docking asks where a ligand, or small molecule, might bind inside a protein pocket. A pose is the ligand position, orientation, and torsion angles that place its atoms near protein residues. The problem matters because a plausible pose guides medicinal chemists toward compounds worth simulation, synthesis, or assay.',
        {type:'callout', text:'DiffDock samples ranked hypotheses on the pose manifold, not forcing a non-Euclidean, multimodal binding problem into one coordinate regression.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/97/Docking_representation_2.png', alt:'Schematic of a small molecule ligand docking into a protein target.', caption:'Molecular docking representation. Source: Wikimedia Commons, Scigenis, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is direct regression. Feed the protein and ligand to a model, then ask it to output one coordinate set for the ligand atoms. That is attractive because the output looks like ordinary supervised learning: one input, one target pose.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that docking is multimodal and geometric. Several poses can be plausible, rotations do not live in ordinary Euclidean space, and torsion angles wrap around a circle. A single coordinate regression can average incompatible poses into a chemically useless answer.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat docking as generative sampling over the pose manifold. A manifold is a space with its own geometry, such as 3D translation, 3D rotation, and torsion circles combined. Diffusion starts from noisy pose variables and learns to denoise them toward plausible ligand-pocket arrangements.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The model conditions on the protein pocket and ligand graph, then samples many noisy initial poses. Denoising steps update translation, rotation, and torsion while keeping the ligand graph chemically connected. A confidence head ranks the sampled poses so downstream tools can inspect a small candidate set.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is weaker than an exact algorithm proof because docking is predictive science. The method is sound as a sampler if each denoising step moves within the legal pose variables and the ranking stage preserves uncertainty instead of pretending one pose is certain. The candidate set remains a hypothesis list until chemistry checks, simulations, or assays validate it.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cost scales with ligands times samples times denoising steps. If a screen has 100,000 molecules, 10 samples per molecule, and 20 denoising steps, the run performs 20 million denoising evaluations before ranking. More samples improve coverage of possible poses, but they also increase GPU time and the review burden.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'DiffDock-style sampling fits virtual screening, hit triage, lead optimization, and pose generation before molecular dynamics. It is useful when a team wants diverse candidate poses with confidence rather than a single rigid docking score. It also helps when pocket geometry and ligand flexibility make hand-tuned search brittle.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the protein structure is wrong, the pocket is flexible in a way the model does not represent, or the ligand chemistry sits outside training coverage. A high confidence pose can still be physically wrong if solvation, protonation, induced fit, or metal coordination is missing. The model ranks hypotheses; it does not replace experimental binding evidence.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose one ligand has 7 rotatable bonds. The sampler draws 20 initial poses around the pocket and runs 30 denoising steps, producing 20 final candidates. If the confidence scores are 0.82, 0.79, 0.43, and lower for the rest, the workflow keeps the top two plus one diverse lower-score pose for inspection.',
        'Now add geometry. If candidate A has 1 steric clash and 5 pocket contacts, while candidate B has 0 clashes and 3 contacts, the ranker should not rely on model confidence alone. The review object stores confidence, clashes, contacts, torsions, seed, and protein context so later assay results can be traced back to the sampled hypothesis.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read the DiffDock paper, the original project materials, and basic molecular docking references on RMSD, binding pockets, torsion angles, and confidence scoring. Then study diffusion models on manifolds, equivariant graph neural networks, protein-ligand interaction features, and molecular dynamics. The next engineering topic is candidate-set management: ranking, diversity, provenance, and experimental feedback.',
      ],
    },
  ],
};
