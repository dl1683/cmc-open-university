// Causal graphs: the treatment that wins in EVERY subgroup and loses
// overall — computed live from real clinical numbers — and the three-arrow
// grammar (chain, fork, collider) that explains when data tells the truth.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'causal-graphs',
  title: "Causal Graphs, Confounding & Simpson's Paradox",
  category: 'Concepts',
  summary: 'Treatment A beats B in both subgroups and loses in the total — live arithmetic — plus the DAG grammar that says what to adjust for and what never to touch.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ["Simpson's paradox, live", 'reading the DAG'], defaultValue: "Simpson's paradox, live" },
  ],
  run,
};

// The classic kidney-stone study (Charig et al. 1986), the four real cells.
// A = open surgery, B = percutaneous; strata = stone size.
const DATA = {
  A: { small: { ok: 81, n: 87 }, large: { ok: 192, n: 263 } },
  B: { small: { ok: 234, n: 270 }, large: { ok: 55, n: 80 } },
};
const rate = (c) => c.ok / c.n;
const pct = (x) => `${(100 * x).toFixed(0)}%`;
const total = (t) => ({ ok: t.small.ok + t.large.ok, n: t.small.n + t.large.n });
const N_ALL = total(DATA.A).n + total(DATA.B).n;
const PREV_SMALL = (DATA.A.small.n + DATA.B.small.n) / N_ALL;
// Backdoor adjustment: weight each stratum's rate by the OVERALL prevalence
// of that stratum, not by who happened to receive the treatment.
const adjusted = (t) => PREV_SMALL * rate(t.small) + (1 - PREV_SMALL) * rate(t.large);

// Collider bias, computed on a deterministic grid: talent and looks are
// independent by construction; selecting on their SUM manufactures a
// negative correlation among the selected. (Berkson's paradox.)
function colliderCorr() {
  const pts = [];
  for (let t = 0; t < 20; t++) for (let l = 0; l < 20; l++) if (t + l >= 19) pts.push([t, l]);
  const n = pts.length;
  const mt = pts.reduce((s, p) => s + p[0], 0) / n;
  const ml = pts.reduce((s, p) => s + p[1], 0) / n;
  let cov = 0;
  let vt = 0;
  let vl = 0;
  for (const [t, l] of pts) {
    cov += (t - mt) * (l - ml);
    vt += (t - mt) ** 2;
    vl += (l - ml) ** 2;
  }
  return cov / Math.sqrt(vt * vl);
}
const COLLIDER_R = colliderCorr();

function table(title, rowDefs, colDefs, cellText) {
  let k = 0;
  const flat = [''];
  const values = rowDefs.map((_, r) => colDefs.map((__, c) => { flat.push(cellText[r][c]); k++; return k; }));
  return matrixState({
    title,
    rows: rowDefs.map(([id, label]) => ({ id, label })),
    columns: colDefs.map(([id, label]) => ({ id, label })),
    values,
    format: (v) => flat[v],
  });
}

function* simpson() {
  yield {
    state: table('A real study, all four cells (kidney-stone treatments, 1986)', [
      ['small', 'small stones'],
      ['large', 'large stones'],
      ['totalRow', 'ALL patients'],
    ], [['a', 'treatment A (open surgery)'], ['b', 'treatment B (keyhole)']], [
      [`${DATA.A.small.ok}/${DATA.A.small.n} = ${pct(rate(DATA.A.small))} — A wins`, `${DATA.B.small.ok}/${DATA.B.small.n} = ${pct(rate(DATA.B.small))}`],
      [`${DATA.A.large.ok}/${DATA.A.large.n} = ${pct(rate(DATA.A.large))} — A wins`, `${DATA.B.large.ok}/${DATA.B.large.n} = ${pct(rate(DATA.B.large))}`],
      [`${total(DATA.A).ok}/${total(DATA.A).n} = ${pct(rate(total(DATA.A)))}`, `${total(DATA.B).ok}/${total(DATA.B).n} = ${pct(rate(total(DATA.B)))} — B "wins"?!`],
    ]),
    highlight: { found: ['small:a', 'large:a'], removed: ['totalRow:a'] },
    explanation: `Every number above is from a real published study, and the arithmetic is done live from the four cells. Read it twice. Treatment A beats B on small stones (${pct(rate(DATA.A.small))} vs ${pct(rate(DATA.B.small))}). A beats B on large stones (${pct(rate(DATA.A.large))} vs ${pct(rate(DATA.B.large))}). Every patient has small or large stones — there is no third kind. Yet sum the columns and B "wins" overall, ${pct(rate(total(DATA.B)))} to ${pct(rate(total(DATA.A)))}. Nothing is miscounted; you can verify each fraction by hand. This is Simpson's paradox: a conclusion that holds in every subgroup and reverses in the aggregate. The data is fine. The QUESTION the aggregate answers is not the question you asked.`,
    invariant: 'Aggregation can reverse every stratum: the totals answer "who got luckier patients," not "which treatment works."',
  };

  yield {
    state: table('The culprit: a third variable with arrows into BOTH columns', [
      ['arrow1', 'severity → treatment'],
      ['arrow2', 'severity → outcome'],
      ['dag', 'the graph'],
      ['mix', 'what aggregation did'],
    ], [['story', '']], [
      [`doctors triaged: hard (large-stone) cases got the serious operation A — ${DATA.A.large.n} of A's ${total(DATA.A).n} patients were large-stone, versus only ${DATA.B.large.n} of B's ${total(DATA.B).n}`],
      ['large stones heal less often under EITHER treatment — compare the rows: every large-stone rate is ~20 points below its small-stone rate'],
      ['treatment ← severity → outcome: a FORK. Severity is a common cause of both who-got-what and how-it-went — the definition of a CONFOUNDER'],
      ['the aggregate compared "mostly-hard cases treated with A" against "mostly-easy cases treated with B" — a tilted playing field presented as a fair race'],
    ]),
    highlight: { active: ['dag:story'] },
    explanation: 'The reversal has a cause you can draw. Severity points at treatment (doctors steered tough cases to surgery — sensible medicine, terrible statistics) and severity points at outcome (tough cases end worse regardless). Two arrows out of one node: a fork, and the fork\'s tail variables become correlated for reasons that are not causation. The aggregate table silently compares A\'s caseload (75% large stones) against B\'s (23% large stones) — B looks better mostly because B got the easy patients. No amount of additional data fixes this; collecting more tilted samples yields a more confident tilted answer. The fix is to ask the question the right way, which the next step computes.',
    invariant: 'A confounder is a common cause: treatment ← Z → outcome. The fork correlates its tails without any causal link between them.',
  };

  yield {
    state: table('The backdoor adjustment: reweight strata to the WHOLE population', [
      ['prev', 'stratum prevalence (everyone)'],
      ['adjA', 'adjusted A'],
      ['adjB', 'adjusted B'],
      ['verdict', 'the verdict, un-reversed'],
    ], [['calc', '']], [
      [`small ${pct(PREV_SMALL)} · large ${pct(1 - PREV_SMALL)} — how stones are actually distributed, ignoring who treated them`],
      [`${pct(PREV_SMALL)}·${pct(rate(DATA.A.small))} + ${pct(1 - PREV_SMALL)}·${pct(rate(DATA.A.large))} = ${pct(adjusted(DATA.A))}`],
      [`${pct(PREV_SMALL)}·${pct(rate(DATA.B.small))} + ${pct(1 - PREV_SMALL)}·${pct(rate(DATA.B.large))} = ${pct(adjusted(DATA.B))}`],
      [`A ${pct(adjusted(DATA.A))} vs B ${pct(adjusted(DATA.B))}: A wins, agreeing with BOTH subgroups — the aggregate's reversal was an artifact of unequal allocation`],
    ]),
    highlight: { found: ['verdict:calc'] },
    explanation: `The repair is one weighted average, computed live: ask "what success rate WOULD each treatment have if it faced the population's actual case mix?" Take each treatment's per-stratum rates — those were honest all along — and weight them by the overall prevalence of each stratum (${pct(PREV_SMALL)} small, ${pct(1 - PREV_SMALL)} large), not by the skewed mix each treatment happened to receive. Adjusted: A ${pct(adjusted(DATA.A))}, B ${pct(adjusted(DATA.B))} — the subgroup verdict and the (now fair) aggregate verdict agree. This is backdoor adjustment in its simplest form, the same correction that propensity weights perform in Doubly Robust Estimation. One warning before generalizing: adjustment fixed this BECAUSE severity is a confounder. The second view shows a variable with the same statistical look where adjusting CREATES the lie.`,
    invariant: 'Adjust = Σ over strata of P(stratum) · P(success | stratum, treatment): every treatment faces the same population, by arithmetic.',
  };
}

function* dag() {
  yield {
    state: table('The whole grammar is three arrows', [
      ['chain', 'CHAIN · smoking → tar → cancer'],
      ['fork', 'FORK · ice cream ← summer → drowning'],
      ['collider', 'COLLIDER · talent → fame ← looks'],
    ], [['flows', 'association flows?'], ['condition', 'and if you condition on the middle?']], [
      ['yes — through the mediator: the effect is real and travels the chain', 'BLOCKED: comparing equal-tar smokers erases the pathway you wanted to measure (overadjustment)'],
      ['yes — spuriously: the tails correlate with no causal link (the confounder, view one\'s villain)', 'BLOCKED: stratifying on the common cause removes the fake association — adjusting here is the fix'],
      ['NO — two independent causes of a shared effect are simply independent', 'OPENED: selecting on the effect manufactures correlation between its causes — adjusting here CREATES bias'],
    ]),
    highlight: { compare: ['fork:condition', 'collider:condition'] },
    explanation: 'Every causal diagram, however huge, is built from three primitive junctions, and each reacts OPPOSITELY to conditioning. A chain transmits a real effect; condition on the middle and you block the very path you\'re measuring. A fork transmits a fake association; conditioning blocks it — that\'s why view one\'s adjustment worked. A collider transmits NOTHING — until you condition on it, which opens a path that never existed. One table, and it already explains most real-world analysis errors: adjusting for too little (forks left open), adjusting for too much (chains blocked), and adjusting for exactly the wrong thing (colliders opened). The next step manufactures that last error from scratch, with numbers.',
    invariant: 'Chain and fork: open until conditioned. Collider: closed until conditioned. Adjustment is path surgery, not hygiene.',
  };

  yield {
    state: table(`Collider bias, manufactured live (correlation = ${COLLIDER_R.toFixed(2)})`, [
      ['setup', 'the world'],
      ['select', 'the selection'],
      ['result', 'among the admitted'],
      ['examples', 'the same artifact in the wild'],
    ], [['story', '']], [
      ['talent and looks: a 20×20 grid of people, every combination equally common — independent BY CONSTRUCTION, correlation exactly 0'],
      ['a casting door admits anyone with talent + looks ≥ 19 (about half) — both qualities help, reasonably'],
      [`Pearson correlation among admitted: ${COLLIDER_R.toFixed(2)} — strongly NEGATIVE, computed live from the grid. The handsome admits needed less talent; the talented needed fewer looks. "Attractive actors can't act" — an artifact of the door, not the world`],
      ['"hospital patients show X causes Y" (admission is a collider) · "good-GPA low-SAT students at elite colleges" (admission again) · Berkson\'s 1946 original: diseases spuriously linked in hospital data'],
    ]),
    highlight: { removed: ['result:story'] },
    explanation: `Watch bias get created from nothing. The grid is exactly uniform: knowing someone's looks tells you literally zero about their talent — the full-population correlation is 0 by construction. Pass everyone through one innocent door (admit if the SUM clears a bar) and compute the correlation among those inside: ${COLLIDER_R.toFixed(2)}, decisively negative, live. No measurement error, no confounder, no small sample — the selection ITSELF carved the dependency, because inside the door, low talent survives only when looks compensated. Every dataset that exists because its members passed a gate (hospital admission, hiring, publication, app-store survival) carries this artifact, and "controlling for" the gate makes it worse, not better.`,
    invariant: 'Conditioning on a collider induces dependence among its causes: selection effects are not noise — they are structure, with a sign.',
  };

  yield {
    state: table('What to adjust for: the backdoor rule, in plain words', [
      ['goal', 'the goal'],
      ['yes', 'adjust for'],
      ['no', 'do NOT adjust for'],
      ['hard', 'the honest catch'],
    ], [['rule', '']], [
      ['close every path from treatment to outcome that enters the treatment through a BACK DOOR (an incoming arrow), while leaving the front path you\'re measuring untouched'],
      ['confounders — common causes of treatment and outcome (view one\'s severity): forks must be blocked'],
      ['mediators (they carry the effect you want) · colliders (blocking opens them) · anything CAUSED BY the treatment — adjusting post-treatment variables corrupts the comparison'],
      ['the rule needs the GRAPH, and the graph comes from domain knowledge, not from the data: no algorithm can read arrows off a correlation table alone'],
    ]),
    highlight: { active: ['yes:rule'], removed: ['no:rule'] },
    explanation: 'Pearl\'s backdoor criterion compresses the grammar into one instruction: block the back doors, leave the front door open. In practice — list the common causes and adjust for them; keep your hands off everything downstream of the treatment and off every gate your sample passed through. The catch in the last row deserves respect: which variable IS a confounder versus a collider is a fact about the world\'s arrows, not about the numbers — severity and the casting door can produce identical-looking tables. That\'s why causal analysis starts by DRAWING assumptions where colleagues can attack them. The data then answers the question; it never chooses the question.',
    invariant: 'Identification precedes estimation: the graph (assumptions) decides what to adjust; the data only supplies the magnitudes.',
  };

  yield {
    state: table('Why randomization is the nuclear option', [
      ['sever', 'what a coin flip does to the graph'],
      ['simpson', 'what that means for view one'],
      ['cant', 'when you can\'t flip the coin'],
      ['ladder', 'the full toolkit, weakest to strongest'],
    ], [['story', '']], [
      ['assignment by coin has NO incoming arrows: severity can no longer point at treatment — every back door is severed at once, including the confounders nobody thought of'],
      ['a randomized trial of A vs B cannot Simpson-reverse: the strata balance by design, and the aggregate answers the causal question directly'],
      ['ethics, cost, or time: you can\'t randomize smoking, recessions, or last year\'s decisions — then it\'s the graph + adjustment + Doubly Robust Estimation\'s propensity machinery, with assumptions on the table'],
      ['raw correlation < stratified adjustment < natural experiments < A/B Testing & p-values — each rung swaps assumptions for design'],
    ]),
    highlight: { found: ['sever:story'] },
    explanation: 'Now the deepest reason A/B Testing & p-values is the gold standard, in graph language: randomization doesn\'t MEASURE the confounders — it deletes their arrows. Assignment-by-coin has no causes, so nothing can be a common cause of treatment and outcome, including confounders no one imagined. That\'s strictly stronger than adjustment, which handles only the back doors you knew to draw. The observational toolkit on this page exists for everywhere the coin is unavailable — historical data, unethical-to-randomize questions, decisions already made. Used honestly (graph stated, gates respected, colliders untouched), it turns "we can\'t experiment" from a dead end into a discipline. Used carelessly, it manufactures results like the casting-door correlation: precise, confident, and pure artifact.',
    invariant: 'Randomization severs every incoming arrow to treatment — known and unknown confounders alike; adjustment handles only the ones you drew.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === "Simpson's paradox, live") yield* simpson();
  else if (view === 'reading the DAG') yield* dag();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `A causal graph is a diagram with nodes (variables) and directed arrows (causation). An arrow from A to B means A causally influences B — not just correlation, but one causes the other in the world. The kidney-stone example shown live here uses a simple graph: severity → treatment and severity → outcome, a fork that explains why A beats B in both subgroups yet loses overall. Causal graphs are the grammar of causation; they let you name what you are asking ("What is the effect of treatment?") and what assumptions you need to answer it ("What are all the ways treatment and outcome could correlate without treatment causing the difference?").`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The kidney-stone study (Charig, 1986) is real: 263 of treatment A's 350 patients had large stones, versus only 80 of B's 350. Doctors triaged severe cases to A, so A faced a harder caseload. A wins small stones 93% vs 87%, wins large stones 73% vs 69% — every stratum favors A. Yet the totals flip: A succeeds 78% of the time, B 83%. This is Simpson's paradox: truth in every part, reversal in the whole. The culprit is severity (large stones heal worse under EITHER treatment). It flows from treatment decision (doctors chose A for hard cases) and from outcome (hard cases fail more often). Severity is a fork — a common cause — and forks create spurious correlation.`,
        `The fix is a weighted average that asks: "What would each treatment's success rate be if it faced the population's true case mix — 51% small, 49% large?" Take each treatment's per-stratum rates (honest, never aggregated) and weight by overall prevalence, not by the tilted mix each treatment received. Adjusted: A 83%, B 78% — A wins, agreeing with both subgroups. This is backdoor adjustment, the same machinery that propensity weighting in "Doubly Robust Estimation" uses to repair observational data.`,
        `The second view shows the three-junction grammar: chain (smoking → tar → cancer; real effect travels the mediator), fork (ice cream ← summer → drowning; spurious, common cause), collider (talent → fame ← looks; independent until you select on the effect). Each reacts oppositely to conditioning. Chain and fork: open until you condition; collider: closed until you condition. Condition on a fork and you block the fake correlation (adjustment fixes it). Condition on a collider and you CREATE correlation where none existed — the casting-door experiment demonstrates: talent and looks are independent by construction (20×20 grid, correlation 0), but admit anyone with talent + looks ≥ 19 and the selected population shows r = −0.50 (handsome people needed less talent). Selection bias is not noise — it is structure with a sign.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Drawing a causal graph costs: you must list every variable and every arrow from domain knowledge, not from data. No algorithm reads causation off a correlation table. If you miss an arrow, adjustment can fail. If you include a wrong arrow, adjustment can bias the answer. The graph is an assumption, and it must be stated where colleagues can challenge it. Once the graph is drawn, identifying whether a set of variables suffices to block all back doors — confounders — is algorithmic (Pearl's backdoor criterion). Adjustment then costs one weighted average per stratum. In high dimensions (many confounders), weighting can fail if some treatment-outcome combinations appear rarely — then "Importance Sampling & Off-Policy Estimation" and propensity-score stabilization become necessary. For the kidney-stone example, the arithmetic costs nothing; for a real study with dozens of variables and millions of rows, the computational burden is still modest compared to the research value of making the assumptions explicit.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Causal graphs are the standard language in epidemiology, program evaluation, and econometrics. A researcher studying smoking and lung cancer draws: smoking → lung tissue damage → cancer, but also unknown confounder Z → smoking and Z → cancer (people with lung disease are more likely to smoke and more likely to die). Blocking the back door from the confounder and opening the front door through damage-to-cancer requires the graph; no amount of data alone specifies which variables to adjust for. In machine-learning fairness, causal graphs prevent discrimination: if decision ← sensitive-attribute ← common cause, adjusting for sensitive-attribute OPENS a bias path (conditioning on a collider); the graph tells you to adjust for the common cause instead. "A/B Testing & p-values" is the gold standard because randomization severs every incoming arrow to treatment, including unknown confounders — a coin flip has no causes. When randomization is impossible (historical data, ethical constraints, decisions already made), causal graphs let you state assumptions and apply adjustment, lifting observational studies from guesswork to structured inference.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Confounders and colliders look identical in a correlation table. Severity (fork) and a gate (collider) both create association, but severity is fixed by conditioning while gates are broken by it. The distinction lives only in the graph, the domain knowledge. Many researchers adjust for everything, hoping to "control for everything" — this opens colliders and manufactures spurious findings. The backdoor rule says: adjust for confounders, never for mediators (downstream of treatment), never for post-treatment variables (corrupts the comparison), and never for colliders (opens a false path). Another pitfall: confusing correlation with causation. A strong correlation means the variables are associated; the graph explains WHY. Two variables can have identical correlation but opposite causal relationships depending on which variable points at which. Raw correlation is the weakest rung; adjustment is stronger; natural experiments and randomized trials are stronger still — the ladder moves from assumption-heavy to design-heavy. Finally, the graph is an assumption. If the true causal structure differs from your drawn graph, adjustment can fail even if all the arithmetic is correct. The only defense is drawing the graph visibly, in front of colleagues, and inviting refutation.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read "A/B Testing & p-values" to understand why randomization is the gold standard for causal inference — it severs every incoming arrow to treatment, eliminating confounding by design. Study "Propensity Score Overlap Diagnostics" and "Doubly Robust Estimation" to see how propensity weighting combines the backdoor rule with modern estimation, protecting against violations. Explore "Importance Sampling & Off-Policy Estimation" to learn how reweighting deals with off-policy data, and "Synthetic Control Donor Weights" for comparative case studies. Master "Naive Bayes (Spam Filter)" to see graphical-model thinking applied to a simple classification problem: directed arrows represent independence assumptions that make computation tractable.`,
      ],
    },
  ],
};
