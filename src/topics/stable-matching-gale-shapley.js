// Stable Matching: Gale-Shapley propose-reject algorithm for finding
// a stable one-to-one matching between two equal-sized groups.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'stable-matching-gale-shapley',
  title: 'Stable Matching (Gale-Shapley)',
  category: 'Data Structures',
  summary: 'Find a stable one-to-one matching between two groups using the propose-reject algorithm: no pair would rather leave their assigned partners for each other.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['full algorithm', 'worked example'], defaultValue: 'full algorithm' },
  ],
  run,
};

/* ------------------------------------------------------------------ helpers */

function prefMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState(
    { title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] },
  );
}

function matchingGraph(title, matches, proposals, rejection) {
  // 3 men (m1-m3) on left, 3 women (w1-w3) on right
  const nodes = [
    { id: 'm1', label: 'm1', x: 1.0, y: 1.5, note: matches.m1 ? `matched ${matches.m1}` : 'free' },
    { id: 'm2', label: 'm2', x: 1.0, y: 4.0, note: matches.m2 ? `matched ${matches.m2}` : 'free' },
    { id: 'm3', label: 'm3', x: 1.0, y: 6.5, note: matches.m3 ? `matched ${matches.m3}` : 'free' },
    { id: 'w1', label: 'w1', x: 6.0, y: 1.5, note: matches.w1 ? `matched ${matches.w1}` : 'free' },
    { id: 'w2', label: 'w2', x: 6.0, y: 4.0, note: matches.w2 ? `matched ${matches.w2}` : 'free' },
    { id: 'w3', label: 'w3', x: 6.0, y: 6.5, note: matches.w3 ? `matched ${matches.w3}` : 'free' },
  ];
  const edges = [];
  // Stable matched edges
  for (const [m, w] of Object.entries(matches)) {
    if (m.startsWith('m') && w) {
      edges.push({ id: `e-${m}-${w}`, from: m, to: w, weight: 'matched' });
    }
  }
  // Current proposal edge
  if (proposals) {
    edges.push({ id: `e-prop-${proposals.from}-${proposals.to}`, from: proposals.from, to: proposals.to, weight: 'proposal' });
  }
  // Rejection edge
  if (rejection) {
    edges.push({ id: `e-rej-${rejection.from}-${rejection.to}`, from: rejection.from, to: rejection.to, weight: 'rejected' });
  }
  return graphState({ nodes, edges }, { title });
}

/* ----------------------------------------------------------- full algorithm */

function* fullAlgorithm() {
  const men = ['m1', 'm2', 'm3'];
  const women = ['w1', 'w2', 'w3'];
  const n = men.length;
  const menPrefs = { m1: ['w1', 'w2', 'w3'], m2: ['w1', 'w3', 'w2'], m3: ['w2', 'w1', 'w3'] };
  const womenPrefs = { w1: ['m2', 'm3', 'm1'], w2: ['m1', 'm3', 'm2'], w3: ['m1', 'm2', 'm3'] };
  const matches = {};
  const freeList = [...men];
  const nextProposal = { m1: 0, m2: 0, m3: 0 };
  let round = 0;
  let totalProposals = 0;

  yield {
    state: prefMatrix(
      'Preference lists: each person ranks the other side',
      [
        { id: 'm1', label: 'm1' },
        { id: 'm2', label: 'm2' },
        { id: 'm3', label: 'm3' },
        { id: 'w1', label: 'w1' },
        { id: 'w2', label: 'w2' },
        { id: 'w3', label: 'w3' },
      ],
      [{ id: 'c1', label: '1st choice' }, { id: 'c2', label: '2nd choice' }, { id: 'c3', label: '3rd choice' }],
      [
        ['w1', 'w2', 'w3'],
        ['w1', 'w3', 'w2'],
        ['w2', 'w1', 'w3'],
        ['m2', 'm3', 'm1'],
        ['m1', 'm3', 'm2'],
        ['m1', 'm2', 'm3'],
      ],
    ),
    highlight: { active: ['m1:c1', 'm2:c1', 'm3:c1'] },
    explanation: `The input is ${n} men and ${n} women (${n * 2} people total), each holding a strict ranking of the ${n} people on the other side. The algorithm finds a matching where no unmatched pair mutually prefer each other over their assigned partners. That property is stability. Maximum possible proposals: ${n * n}.`,
    invariant: `Every person appears exactly once in every preference list on the opposing side (${n} entries per list).`,
  };

  // Round 1: m1->w1, m2->w1, m3->w2
  round = 1;
  totalProposals += 3;
  yield {
    state: matchingGraph(`Round ${round}: all free men propose to their top choice`, {}, null, null),
    highlight: { active: ['m1', 'm2', 'm3'] },
    explanation: `Every free proposer starts by proposing to the highest-ranked person they have not yet proposed to. ${men[0]} and ${men[1]} both propose to ${menPrefs.m1[0]}. ${men[2]} proposes to ${menPrefs.m3[0]}. ${totalProposals} proposals made so far. When multiple proposers target the same recipient, the recipient chooses.`,
  };

  // w1 receives m1, m2 — holds m2 (ranked 1st), rejects m1 (ranked 3rd)
  const w1Rank_m2 = womenPrefs.w1.indexOf('m2') + 1;
  const w1Rank_m1 = womenPrefs.w1.indexOf('m1') + 1;
  yield {
    state: matchingGraph(`${women[0]} receives proposals from ${men[0]} and ${men[1]}`, {}, { from: 'm1', to: 'w1' }, null),
    highlight: { active: ['m1', 'm2'], compare: ['w1'] },
    explanation: `${women[0]} ranks ${men[1]} ${w1Rank_m2}${w1Rank_m2 === 1 ? 'st' : w1Rank_m2 === 2 ? 'nd' : 'rd'} and ${men[0]} ${w1Rank_m1}${w1Rank_m1 === 1 ? 'st' : w1Rank_m1 === 2 ? 'nd' : 'rd'}. She tentatively accepts ${men[1]} and rejects ${men[0]}. The acceptance is tentative: if a better proposer arrives later, she will switch. ${men[0]} returns to the free pool.`,
  };

  matches.m2 = 'w1'; matches.w1 = 'm2'; matches.m3 = 'w2'; matches.w2 = 'm3';
  nextProposal.m1 = 1;
  const matchedPairs1 = ['m2-w1', 'm3-w2'];
  yield {
    state: matchingGraph('w1 holds m2; w2 holds m3; m1 is free', { m2: 'w1', w1: 'm2', m3: 'w2', w2: 'm3' }, null, { from: 'w1', to: 'm1' }),
    highlight: { found: ['m2', 'w1', 'm3', 'w2'], active: ['m1'] },
    explanation: `After round ${round}: ${matchedPairs1.join(' and ')} are tentatively matched. ${men[0]} is free and moves to his ${nextProposal.m1 + 1}${nextProposal.m1 + 1 === 2 ? 'nd' : 'rd'} choice (${menPrefs.m1[nextProposal.m1]}). Each rejection pushes a proposer down his list, never to revisit that recipient.`,
    invariant: `A rejected proposer is never reconsidered by that recipient.`,
  };

  // Round 2: m1 proposes to w2
  round = 2;
  totalProposals += 1;
  const w2Rank_m1 = womenPrefs.w2.indexOf('m1') + 1;
  const w2Rank_m3 = womenPrefs.w2.indexOf('m3') + 1;
  const target2 = menPrefs.m1[nextProposal.m1];
  yield {
    state: matchingGraph(`Round ${round}: ${men[0]} proposes to ${target2} (his 2nd choice)`, { m2: 'w1', w1: 'm2', m3: 'w2', w2: 'm3' }, { from: 'm1', to: 'w2' }, null),
    highlight: { active: ['m1'], compare: ['w2', 'm3'] },
    explanation: `${target2} currently holds ${matches[target2]}. She ranks ${men[0]} ${w2Rank_m1}${w2Rank_m1 === 1 ? 'st' : w2Rank_m1 === 2 ? 'nd' : 'rd'} and ${matches[target2]} ${w2Rank_m3}${w2Rank_m3 === 1 ? 'st' : w2Rank_m3 === 2 ? 'nd' : 'rd'}. ${men[0]} is better, so ${target2} drops ${matches[target2]} and tentatively accepts ${men[0]}. ${matches[target2]} is now free.`,
  };

  const ejected1 = matches.w2;
  matches.m1 = 'w2'; matches.w2 = 'm1'; delete matches.m3;
  nextProposal.m3 = 1;
  yield {
    state: matchingGraph(`${target2} switches to ${men[0]}; ${ejected1} is now free`, { m2: 'w1', w1: 'm2', m1: 'w2', w2: 'm1' }, null, { from: 'w2', to: 'm3' }),
    highlight: { found: ['m1', 'w2', 'm2', 'w1'], active: ['m3'] },
    explanation: `This is the propose-reject mechanism in action. A tentative match is not permanent. When a recipient gets a better proposal, she upgrades and the old partner rejoins the free pool. ${ejected1} was dropped from ${target2} and moves to his ${nextProposal.m3 + 1}${nextProposal.m3 + 1 === 2 ? 'nd' : 'rd'} choice (${menPrefs.m3[nextProposal.m3]}). ${totalProposals} proposals so far out of ${n * n} maximum.`,
  };

  // Round 3: m3 proposes to w1
  round = 3;
  totalProposals += 1;
  const target3 = menPrefs.m3[nextProposal.m3];
  const w1Rank_m2_now = womenPrefs.w1.indexOf('m2') + 1;
  const w1Rank_m3_now = womenPrefs.w1.indexOf('m3') + 1;
  yield {
    state: matchingGraph(`Round ${round}: ${ejected1} proposes to ${target3} (his 2nd choice)`, { m2: 'w1', w1: 'm2', m1: 'w2', w2: 'm1' }, { from: 'm3', to: 'w1' }, null),
    highlight: { active: ['m3'], compare: ['w1', 'm2'] },
    explanation: `${target3} currently holds m2. She ranks m2 ${w1Rank_m2_now}${w1Rank_m2_now === 1 ? 'st' : w1Rank_m2_now === 2 ? 'nd' : 'rd'} and ${ejected1} ${w1Rank_m3_now}${w1Rank_m3_now === 1 ? 'st' : w1Rank_m3_now === 2 ? 'nd' : 'rd'}. m2 is better, so ${target3} rejects ${ejected1}. ${ejected1} stays free and must propose to his last choice.`,
  };

  // Round 4: m3 proposes to w3
  round = 4;
  totalProposals += 1;
  nextProposal.m3 = 2;
  const target4 = menPrefs.m3[nextProposal.m3];
  yield {
    state: matchingGraph(`Round ${round}: ${ejected1} proposes to ${target4} (his 3rd choice)`, { m2: 'w1', w1: 'm2', m1: 'w2', w2: 'm1' }, { from: 'm3', to: 'w3' }, null),
    highlight: { active: ['m3'], compare: ['w3'] },
    explanation: `${target4} is free and has no one to compare against. She accepts ${ejected1}. All ${n} men are now matched after ${totalProposals} proposals (out of ${n * n} maximum). The algorithm terminates.`,
  };

  matches.m3 = 'w3'; matches.w3 = 'm3';
  const finalPairs = ['m1-w2', 'm2-w1', 'm3-w3'];
  yield {
    state: matchingGraph('Final stable matching', { m1: 'w2', w2: 'm1', m2: 'w1', w1: 'm2', m3: 'w3', w3: 'm3' }, null, null),
    highlight: { found: ['m1', 'w2', 'm2', 'w1', 'm3', 'w3'] },
    explanation: `Stable matching: ${finalPairs.join(', ')}. ${totalProposals} total proposals used out of ${n * n} maximum. No unmatched pair would both prefer each other over their current partners. The algorithm always terminates, always produces a perfect matching, and the result is always stable.`,
    invariant: `No blocking pair exists: for every man-woman pair not matched together, at least one of them prefers their current partner. ${finalPairs.length} pairs formed from ${n * 2} people.`,
  };
}

/* -------------------------------------------------------- worked example */

function* workedExample() {
  const names = { m1: 'Alex', m2: 'Blake', m3: 'Chris', w1: 'Dana', w2: 'Eden', w3: 'Fran' };
  const menPrefs = { Alex: ['Dana', 'Eden', 'Fran'], Blake: ['Dana', 'Fran', 'Eden'], Chris: ['Eden', 'Dana', 'Fran'] };
  const womenPrefs = { Dana: ['Blake', 'Chris', 'Alex'], Eden: ['Alex', 'Chris', 'Blake'], Fran: ['Alex', 'Blake', 'Chris'] };
  const n = 3;
  let totalProposals = 0;
  let round = 0;

  yield {
    state: prefMatrix(
      'Setup: 3 men, 3 women, each with a strict ranking',
      [
        { id: 'm1', label: 'Alex' },
        { id: 'm2', label: 'Blake' },
        { id: 'm3', label: 'Chris' },
        { id: 'w1', label: 'Dana' },
        { id: 'w2', label: 'Eden' },
        { id: 'w3', label: 'Fran' },
      ],
      [{ id: 'c1', label: '1st' }, { id: 'c2', label: '2nd' }, { id: 'c3', label: '3rd' }],
      [
        ['Dana', 'Eden', 'Fran'],
        ['Dana', 'Fran', 'Eden'],
        ['Eden', 'Dana', 'Fran'],
        ['Blake', 'Chris', 'Alex'],
        ['Alex', 'Chris', 'Blake'],
        ['Alex', 'Blake', 'Chris'],
      ],
    ),
    highlight: { active: ['m1:c1', 'm2:c1', 'm3:c1'] },
    explanation: `Men propose in order of their preference lists. ${names.m1} wants ${menPrefs.Alex[0]} most, ${names.m2} wants ${menPrefs.Blake[0]} most, ${names.m3} wants ${menPrefs.Chris[0]} most. Each woman compares competing proposals against her own ranking. ${n * n} maximum proposals possible.`,
  };

  round = 1;
  totalProposals = 3;
  const danaRankAlex = womenPrefs.Dana.indexOf('Alex') + 1;
  const danaRankBlake = womenPrefs.Dana.indexOf('Blake') + 1;
  yield {
    state: prefMatrix(
      `Round ${round}: ${names.m1} and ${names.m2} both propose to ${names.w1}`,
      [
        { id: 'a', label: 'Alex -> Dana' },
        { id: 'b', label: 'Blake -> Dana' },
        { id: 'c', label: 'Chris -> Eden' },
      ],
      [{ id: 'action', label: 'action' }, { id: 'result', label: 'result' }],
      [
        ['proposes 1st choice', `rejected (Dana ranks Alex ${danaRankAlex}${danaRankAlex === 3 ? 'rd' : 'th'})`],
        ['proposes 1st choice', `held (Dana ranks Blake ${danaRankBlake}${danaRankBlake === 1 ? 'st' : 'nd'})`],
        ['proposes 1st choice', 'held (Eden has no one)'],
      ],
    ),
    highlight: { active: ['a:action', 'b:action', 'c:action'], found: ['b:result', 'c:result'], removed: ['a:result'] },
    explanation: `${names.w1} gets proposals from ${names.m1} and ${names.m2}. Her ranking is ${womenPrefs.Dana.join(' > ')}. She holds ${names.m2} (ranked ${danaRankBlake}${danaRankBlake === 1 ? 'st' : 'nd'}) and rejects ${names.m1} (ranked ${danaRankAlex}${danaRankAlex === 3 ? 'rd' : 'th'}). ${names.w2} gets only ${names.m3} and holds him. ${names.m1} is now free. ${totalProposals} proposals so far.`,
  };

  round = 2;
  totalProposals = 4;
  const edenRankAlex = womenPrefs.Eden.indexOf('Alex') + 1;
  const edenRankChris = womenPrefs.Eden.indexOf('Chris') + 1;
  yield {
    state: prefMatrix(
      `Round ${round}: ${names.m1} proposes to ${names.w2} (his 2nd choice)`,
      [
        { id: 'a', label: 'Alex -> Eden' },
        { id: 'comp', label: 'Eden compares' },
        { id: 'out', label: 'Chris ejected' },
      ],
      [{ id: 'action', label: 'action' }, { id: 'result', label: 'result' }],
      [
        ['proposes 2nd choice', `Eden ranks Alex ${edenRankAlex}${edenRankAlex === 1 ? 'st' : 'nd'}`],
        [`Alex (${edenRankAlex}${edenRankAlex === 1 ? 'st' : 'nd'}) vs Chris (${edenRankChris}${edenRankChris === 1 ? 'st' : edenRankChris === 2 ? 'nd' : 'rd'})`, 'prefers Alex'],
        ['freed from Eden', 'moves to 2nd choice'],
      ],
    ),
    highlight: { active: ['a:action'], found: ['comp:result'], removed: ['out:result'] },
    explanation: `${names.w2} currently holds ${names.m3}. She ranks ${names.m1} ${edenRankAlex}${edenRankAlex === 1 ? 'st' : 'nd'} and ${names.m3} ${edenRankChris}${edenRankChris === 1 ? 'st' : edenRankChris === 2 ? 'nd' : 'rd'}. She drops ${names.m3} for ${names.m1}. ${names.m3} is now free and proposes to his 2nd choice, ${menPrefs.Chris[1]}. ${totalProposals} proposals so far.`,
  };

  round = 3;
  totalProposals = 5;
  const danaRankChris = womenPrefs.Dana.indexOf('Chris') + 1;
  yield {
    state: prefMatrix(
      `Round ${round}: ${names.m3} proposes to ${names.w1} (his 2nd choice)`,
      [
        { id: 'c', label: 'Chris -> Dana' },
        { id: 'comp', label: 'Dana compares' },
        { id: 'keep', label: 'Blake stays' },
      ],
      [{ id: 'action', label: 'action' }, { id: 'result', label: 'result' }],
      [
        ['proposes 2nd choice', `Dana ranks Chris ${danaRankChris}${danaRankChris === 2 ? 'nd' : 'rd'}`],
        [`Blake (${danaRankBlake}${danaRankBlake === 1 ? 'st' : 'nd'}) vs Chris (${danaRankChris}${danaRankChris === 2 ? 'nd' : 'rd'})`, 'prefers Blake'],
        ['Blake still held', 'Chris rejected'],
      ],
    ),
    highlight: { active: ['c:action'], found: ['keep:result'], removed: ['c:result'] },
    explanation: `${names.w1} holds ${names.m2} (her ${danaRankBlake}${danaRankBlake === 1 ? 'st' : 'nd'} choice). ${names.m3} is her ${danaRankChris}${danaRankChris === 2 ? 'nd' : 'rd'} choice. She keeps ${names.m2}. ${names.m3} is rejected again and falls to his last choice, ${menPrefs.Chris[2]}. ${totalProposals} proposals so far.`,
  };

  round = 4;
  totalProposals = 6;
  const finalPairs = ['Alex-Eden', 'Blake-Dana', 'Chris-Fran'];
  yield {
    state: prefMatrix(
      `Round ${round}: ${names.m3} proposes to ${names.w3} (his 3rd choice)`,
      [
        { id: 'c', label: 'Chris -> Fran' },
        { id: 'result', label: 'Fran accepts' },
        { id: 'done', label: 'all matched' },
      ],
      [{ id: 'action', label: 'action' }, { id: 'result', label: 'result' }],
      [
        ['proposes 3rd choice', 'Fran is free'],
        ['no competition', 'holds Chris'],
        ['terminate', 'stable matching found'],
      ],
    ),
    highlight: { active: ['c:action'], found: ['result:result', 'done:result'] },
    explanation: `${names.w3} is unmatched and accepts ${names.m3}. All ${n} men are matched after ${totalProposals} proposals (out of ${n * n} maximum). The algorithm terminates with: ${finalPairs.join(', ')}.`,
  };

  const blockingChecks = 6;
  yield {
    state: prefMatrix(
      'Stability check: verify no blocking pair exists',
      [
        { id: 'p1', label: 'Alex & Dana?' },
        { id: 'p2', label: 'Alex & Fran?' },
        { id: 'p3', label: 'Blake & Eden?' },
        { id: 'p4', label: 'Blake & Fran?' },
        { id: 'p5', label: 'Chris & Dana?' },
        { id: 'p6', label: 'Chris & Eden?' },
      ],
      [{ id: 'check', label: 'both prefer each other?' }, { id: 'verdict', label: 'blocking?' }],
      [
        ['Alex prefers Dana, but Dana prefers Blake (her match)', 'no'],
        ['Alex prefers Eden (his match) over Fran', 'no'],
        ['Blake prefers Dana (his match) over Eden', 'no'],
        ['Blake prefers Dana (his match) over Fran', 'no'],
        ['Dana prefers Blake (her match) over Chris', 'no'],
        ['Eden prefers Alex (her match) over Chris', 'no'],
      ],
    ),
    highlight: { found: ['p1:verdict', 'p2:verdict', 'p3:verdict', 'p4:verdict', 'p5:verdict', 'p6:verdict'] },
    explanation: `All ${blockingChecks} unmatched man-woman pairs checked: for every pair, at least one prefers their current partner. 0 blocking pairs found. The matching ${finalPairs.join(', ')} is stable. ${totalProposals} proposals used out of ${n * n} maximum. The proposing side (men) got their best achievable partner under any stable matching; the receiving side (women) got their worst.`,
    invariant: `Proposer-optimal, recipient-pessimal: the proposing side cannot do better in any stable matching. ${n} pairs, ${totalProposals} proposals, 0 blocking pairs.`,
  };
}

/* ---------------------------------------------------------------- dispatch */

export function* run(input) {
  const view = String(input.view);
  if (view === 'full algorithm') yield* fullAlgorithm();
  else if (view === 'worked example') yield* workedExample();
  else throw new InputError('Pick a stable matching view.');
}

/* ----------------------------------------------------------------- article */

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: ['Active proposers move down preference lists, compare markers show recipients evaluating offers, and found edges are tentative matches. A rejection is permanent for that proposer-recipient pair.', {type: 'callout', text: 'Stable matching is not the highest-score pairing; it is the pairing where every rejected pair has at least one side that will not leave.'}, {type: 'image', src: './assets/gifs/stable-matching-gale-shapley.gif', alt: 'Animated walkthrough of the stable matching gale shapley visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},], },
    { heading: 'Why this exists', paragraphs: ['Some allocation problems have two sides with preferences, such as residents and hospitals. A stable matching has no unmatched pair who both prefer each other to their assigned partners.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Graph_K3-3.svg/250px-Graph_K3-3.svg.png', alt: 'Complete bipartite graph K3,3 with three vertices on each side and every cross-side edge drawn', caption: 'A two-sided matching market starts as a bipartite candidate graph; preferences and stability decide which edges survive. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Graph_K3-3.svg.'}], },
    { heading: 'The obvious approach', paragraphs: ['The obvious approach enumerates every complete matching and checks each for blocking pairs. It is correct, but n people per side create n factorial matchings.'], },
    { heading: 'The wall', paragraphs: ['Stability is global because any unmatched pair can block the result. Greedy top-choice pairing can create later blocking pairs even when early matches look reasonable.'], },
    { heading: 'The core insight', paragraphs: ['Build stability through rejection instead of testing it afterward. Proposers only move down their lists, while recipients only keep the same partner or upgrade.'], },
    { heading: 'How it works', paragraphs: ['A free proposer proposes to the highest-ranked recipient not yet tried. The recipient holds the better offer and rejects the other, and the rejected proposer continues later.'], },
    { heading: 'Why it works', paragraphs: ['Termination holds because each proposer can propose to each recipient at most once. Stability holds because any proposer who prefers a recipient over the final match must have been rejected by that recipient for someone at least as preferred.'], },
    { heading: 'Cost and complexity', paragraphs: ['The worst-case time is O(n squared) proposals. Preference storage is O(n squared), while current matches and next-proposal pointers are O(n).'], },
    { heading: 'Real-world uses', paragraphs: ['Deferred acceptance underlies residency and school-choice systems, usually with policy-specific extensions. The clean one-to-one algorithm is the core around capacities, priorities, ties, and incomplete lists.'], },
    { heading: 'Where it fails', paragraphs: ['The result favors the proposing side, assumes strict complete rankings, and ignores preference intensity. Couples, ties, quotas, and many-to-many markets need extensions that may lose the simple guarantee.'], },
    { heading: 'Worked example', paragraphs: ['Let m1 prefer w1 then w2, m2 prefer w1, and m3 prefer w2 then w1 then w3. If w1 holds m2 over m1 and w2 later switches from m3 to m1, m3 eventually proposes to w3, producing m1-w2, m2-w1, m3-w3 after six proposals.'], },
    { heading: 'Sources and study next', paragraphs: ['Study Gale and Shapley on college admissions, Roth on resident matching, and Roth and Sotomayor on two-sided matching. Then compare Bipartite Matching, Hungarian Algorithm, Stable Roommates, and deferred acceptance with capacities.'], },
  ],
};
