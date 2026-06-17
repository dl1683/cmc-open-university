// Hierarchical heavy hitters: report heavy aggregates over a prefix hierarchy.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'hierarchical-heavy-hitters-prefix-sketch',
  title: 'Hierarchical Heavy Hitters: Prefix Sketch',
  category: 'Data Structures',
  summary: 'Find dominant IP prefixes or category rollups by combining stream summaries with a hierarchy and subtracting already-reported descendants.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['prefix hierarchy', 'ddos case study'], defaultValue: 'prefix hierarchy' },
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

function prefixTree(title) {
  return graphState({
    nodes: [
      { id: 'root', label: '0/0', x: 5.0, y: 6.8, note: 'all' },
      { id: 'n10', label: '10/8', x: 3.0, y: 5.4, note: '42%' },
      { id: 'n192', label: '192/8', x: 7.0, y: 5.4, note: '18%' },
      { id: 'n104', label: '10.4/16', x: 2.0, y: 3.9, note: '30%' },
      { id: 'n109', label: '10.9/16', x: 4.3, y: 3.9, note: '12%' },
      { id: 'n1047', label: '10.4.7', x: 1.1, y: 2.3, note: '/24 24%' },
      { id: 'host', label: 'host', x: 0.7, y: 0.9, note: '17%' },
      { id: 'spread', label: '10.4.8', x: 3.1, y: 2.3, note: '/24 6%' },
      { id: 'n1922', label: '192.2', x: 7.0, y: 3.9, note: '/16 8%' },
    ],
    edges: [
      { id: 'e-root-10', from: 'root', to: 'n10', weight: '' },
      { id: 'e-root-192', from: 'root', to: 'n192', weight: '' },
      { id: 'e-10-104', from: 'n10', to: 'n104', weight: '' },
      { id: 'e-10-109', from: 'n10', to: 'n109', weight: '' },
      { id: 'e-104-1047', from: 'n104', to: 'n1047', weight: '' },
      { id: 'e-104-spread', from: 'n104', to: 'spread', weight: '' },
      { id: 'e-1047-host', from: 'n1047', to: 'host', weight: '' },
      { id: 'e-192-1922', from: 'n192', to: 'n1922', weight: '' },
    ],
  }, { title });
}

function updateGraph(title) {
  return graphState({
    nodes: [
      { id: 'packet', label: 'packet', x: 0.6, y: 3.5, note: 'src IP' },
      { id: 'prefixes', label: 'prefixes', x: 2.5, y: 3.5, note: '/8 /16 /24' },
      { id: 'sketches', label: 'sketches', x: 4.7, y: 3.5, note: 'per level' },
      { id: 'subtract', label: 'subtract', x: 6.9, y: 3.5, note: 'children' },
      { id: 'report', label: 'report', x: 8.9, y: 3.5, note: 'HHH' },
    ],
    edges: [
      { id: 'e-packet-prefixes', from: 'packet', to: 'prefixes', weight: '' },
      { id: 'e-prefixes-sketches', from: 'prefixes', to: 'sketches', weight: '' },
      { id: 'e-sketches-subtract', from: 'sketches', to: 'subtract', weight: '' },
      { id: 'e-subtract-report', from: 'subtract', to: 'report', weight: '' },
    ],
  }, { title });
}

function* prefixHierarchy() {
  yield {
    state: prefixTree('Heavy traffic can hide at many prefix levels'),
    highlight: { active: ['n10', 'n104', 'n1047'], found: ['host'] },
    explanation: 'A flat heavy-hitter summary finds individual keys. Network operators often need aggregates: a single host, a /24 botnet, a /16 customer block, or an entire /8 region. Hierarchical heavy hitters search a tree of prefixes and report the levels that remain heavy after accounting for heavy descendants.',
    invariant: 'A prefix can be heavy because one child is heavy, or because many children are collectively heavy.',
  };

  yield {
    state: updateGraph('Each packet updates the prefixes on its path'),
    highlight: { active: ['packet', 'prefixes', 'sketches', 'e-packet-prefixes', 'e-prefixes-sketches'], found: ['report'] },
    explanation: 'For source IP 10.4.7.9, the stream contributes to 10/8, 10.4/16, 10.4.7/24, and the host leaf. Implementations can keep exact counters for retained candidates or sketches at each level, depending on traffic volume and memory.',
  };

  yield {
    state: labelMatrix(
      'Residual rule: subtract reported descendants',
      [
        { id: 'root', label: '0/0' },
        { id: 'n10', label: '10/8' },
        { id: 'n104', label: '10.4/16' },
        { id: 'n1047', label: '10.4.7/24' },
        { id: 'host', label: '10.4.7.9' },
      ],
      [
        { id: 'raw', label: 'raw' },
        { id: 'child', label: 'child HHH' },
        { id: 'resid', label: 'resid' },
        { id: 'report', label: 'report?' },
      ],
      [
        ['100%', '42%', '58%', 'no'],
        ['42%', '30%', '12%', 'maybe'],
        ['30%', '24%', '6%', 'no'],
        ['24%', '17%', '7%', 'maybe'],
        ['17%', '0%', '17%', 'yes'],
      ],
    ),
    highlight: { active: ['n1047:raw', 'n1047:child', 'n1047:resid'], found: ['host:report'] },
    explanation: 'The residual count prevents double-reporting. If the host is already reported as heavy, its traffic is subtracted from ancestors when deciding whether the ancestor is independently heavy. The reported set becomes a concise explanation of where the mass really sits.',
  };

  yield {
    state: labelMatrix(
      'Hierarchy choices',
      [
        { id: 'ip', label: 'IP prefixes' },
        { id: 'url', label: 'URL paths' },
        { id: 'geo', label: 'geo tree' },
        { id: 'org', label: 'org chart' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'action', label: 'action' },
      ],
      [
        ['who sends bytes?', 'rate limit'],
        ['which path hot?', 'cache/index'],
        ['where spike?', 'route traffic'],
        ['which team?', 'page owner'],
      ],
    ),
    highlight: { found: ['ip:action', 'url:action'], compare: ['org:question'] },
    explanation: 'The structure is not limited to IP addresses. Any tree-shaped rollup can use the same idea: track candidate mass at multiple levels, subtract heavy descendants, and report the smallest useful explanation.',
  };
}

function* ddosCaseStudy() {
  yield {
    state: graphState({
      nodes: [
        { id: 'routers', label: 'routers', x: 0.7, y: 3.5, note: 'packets' },
        { id: 'syn', label: 'synopsis', x: 2.7, y: 3.5, note: 'sketches' },
        { id: 'hh', label: 'HHH', x: 4.8, y: 3.5, note: 'prefixes' },
        { id: 'noc', label: 'NOC', x: 6.8, y: 3.5, note: 'explain' },
        { id: 'acl', label: 'ACL', x: 8.8, y: 3.5, note: 'mitigate' },
      ],
      edges: [
        { id: 'e-routers-syn', from: 'routers', to: 'syn', weight: '' },
        { id: 'e-syn-hh', from: 'syn', to: 'hh', weight: '' },
        { id: 'e-hh-noc', from: 'hh', to: 'noc', weight: '' },
        { id: 'e-noc-acl', from: 'noc', to: 'acl', weight: '' },
      ],
    }, { title: 'Case study: DDoS telemetry needs aggregate explanations' }),
    highlight: { active: ['syn', 'hh', 'noc'], found: ['acl'] },
    explanation: 'During an attack, the top individual source IPs may be unhelpful: thousands of bots each send a little traffic. Hierarchical heavy hitters identify the aggregate prefix that matters, letting operators rate-limit or route around a block rather than chase every leaf.',
  };

  yield {
    state: prefixTree('Single elephant vs spread attack'),
    highlight: { active: ['host'], compare: ['n1047', 'spread'], found: ['n104'] },
    explanation: 'A single elephant should report the host. A spread attack across many hosts in one prefix should report the prefix. The hierarchy lets the answer move to the right abstraction level as traffic changes.',
  };

  yield {
    state: labelMatrix(
      'DDoS reporting decisions',
      [
        { id: 'single', label: 'one source' },
        { id: 'subnet', label: 'many /24' },
        { id: 'customer', label: 'one customer' },
        { id: 'global', label: 'global rise' },
      ],
      [
        { id: 'flat', label: 'flat top-k' },
        { id: 'hhh', label: 'HHH' },
        { id: 'ops', label: 'ops action' },
      ],
      [
        ['host', 'host', 'block host'],
        ['many leaves', '/24', 'rate limit /24'],
        ['mixed', '/16', 'call owner'],
        ['no clear key', '0/0', 'shed/load balance'],
      ],
    ),
    highlight: { active: ['subnet:hhh', 'customer:hhh'], found: ['subnet:ops'] },
    explanation: 'Flat top-k gives a list. Hierarchical heavy hitters give an explanation. That distinction matters when mitigation happens at prefix, customer, region, or routing-policy boundaries.',
  };

  yield {
    state: updateGraph('Production pipelines pair summaries with verification'),
    highlight: { active: ['sketches', 'subtract', 'report'], found: ['report'] },
    explanation: 'As with Count-Min and Space-Saving, the synopsis should feed verification. Operators can ask for packet samples, exact flow logs, or routing context for the reported prefixes before taking destructive action.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'prefix hierarchy') yield* prefixHierarchy();
  else if (view === 'ddos case study') yield* ddosCaseStudy();
  else throw new InputError('Pick a hierarchical heavy-hitter view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Flat heavy hitters answer which individual keys are frequent. Operators often need a different answer: which prefix, customer, URL subtree, region, or organization unit explains the load?',
        'Hierarchical heavy hitters exist for streams whose keys live inside a tree. Instead of reporting only leaves, they report the level where the mass is still heavy after already-explained descendants are removed. That turns raw counters into an operational explanation.',
      ],
    },
    {
      heading: 'Naive baseline and wall',
      paragraphs: [
        'The first baseline is flat top-k over source IPs, flow IDs, users, or documents. That works when one key dominates. It fails when a crowd of related keys is heavy together but no single leaf is large enough to stand out.',
        'The second baseline is to count every prefix exactly. That gives the right vocabulary, but it can be too expensive at line rate and it produces redundant output: if one host is heavy, all of its ancestors may look heavy too.',
        'The wall is not only finding mass. It is explaining mass once. A useful report should say whether the problem is one host, one /24, one /16, or a wider aggregate without listing the same traffic at every level.',
      ],
    },
    {
      heading: 'Core insight and invariant',
      paragraphs: [
        'The core idea is residual mass. A node is independently heavy only if its total count minus the counts of already-reported heavy descendants still exceeds the threshold.',
        'The invariant is that reported nodes form an explanation of disjoint residual traffic. Descendant traffic should not make every ancestor look independently important. Ancestors are reported only when they contain heavy mass not already explained below.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the prefix hierarchy view, read the tree as containment. The root is all traffic, 10/8 contains its /16 children, 10.4/16 contains /24 children, and a host is a leaf. A highlighted path means one event contributes to every prefix on that path.',
        'The residual table is the key frame. Raw count says how large a node looks before explanation. Child HHH says how much has already been explained by reported descendants. Residual says whether the parent still deserves to be reported on its own.',
        'In the DDoS case-study view, watch the answer move between abstraction levels. A single elephant source should stay at host level. A distributed group inside a subnet should rise to the subnet. The output level is part of the diagnosis.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'For each stream event, update the nodes on its path through the hierarchy. A packet from 10.4.7.9 contributes to 10.4.7.9, 10.4.7/24, 10.4/16, 10/8, and 0/0. A URL request might contribute to /, /products, /products/search, and the full path.',
        'The counters can be exact for small retained candidate sets, or approximate sketches when the stream is too large. Common designs keep a summary per level, recover candidate nodes, then verify or estimate their counts before reporting.',
        'Reporting is usually bottom-up. Decide whether descendants are heavy, subtract their explained mass from ancestors, and report an ancestor only if its residual count remains above the threshold.',
        'A production implementation often separates discovery from confirmation. Sketches find likely heavy prefixes fast, then an exact or sampled pass checks those candidates before paging an operator or changing network policy. That two-stage shape keeps the streaming path small while keeping severe actions tied to evidence.',
      ],
    },
    {
      heading: 'Correctness',
      paragraphs: [
        'Updating every ancestor ensures no aggregate is hidden. If many small leaves inside 10.4/16 create a spike, the 10.4/16 counter rises even when none of the leaves individually crosses the threshold.',
        'Residual subtraction is what makes the report concise. Because children partition their parent in a tree, subtracting reported descendants removes traffic already explained at a more specific level. What remains is the parent traffic that still needs its own explanation.',
        'With approximate sketches, correctness is usually thresholded rather than exact. A production system uses error margins, conservative thresholds, or verification against exact logs before treating a near-threshold prefix as fact.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose 10.4.7.9 contributes 17 percent of traffic, 10.4.7/24 contributes 24 percent total, and 10.4/16 contributes 30 percent total. With a 15 percent threshold, the host is a heavy hitter.',
        'After the host is reported, the /24 residual is 24 - 17 = 7 percent, so the /24 does not need a separate report at that threshold. The /16 residual is 30 - 17 = 13 percent if no other descendant was reported, so it also stays below 15 percent. The report says one host explains the spike, not every ancestor of that host.',
        'If the same 30 percent were spread across many hosts under 10.4/16, no single host might cross the threshold. Then the residual at 10.4/16 would remain heavy, and the correct report would move up to the prefix.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Each event costs O(height) updates if every ancestor on the path is touched. For IP prefixes with a few retained levels, that is manageable. For deep URL paths, taxonomies, or multidimensional hierarchies, the height and candidate count can dominate.',
        'Memory depends on the number of levels, the number of candidates retained at each level, and whether counts are exact or sketched. Sketches save memory but add error. Exact counters simplify reporting but may be too expensive for high-cardinality streams.',
        'The output is more interpretable than flat top-k, but the implementation has sharper edges: threshold choice, sketch error, descendant subtraction, and verification policy all affect whether operators trust the result.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'It wins when action happens at aggregate boundaries: rate-limit a subnet, route traffic away from a region, page a service owner, split a customer bill, identify a hot URL subtree, or explain a monitoring spike.',
        'It is especially useful during distributed attacks. Thousands of modest bot IPs can become a small number of residual prefixes, which is far more actionable than a flat list of leaves.',
        'It also improves communication. A flat list says "these keys are large." A hierarchical report says "this part of the tree explains the load after more specific causes are removed." That is closer to how operators assign ownership and choose a response.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the hierarchy is the wrong model. Some problems are not tree-shaped, and multidimensional questions such as source prefix by destination prefix by port form a lattice with many overlapping explanations.',
        'It also fails as an automatic mitigation engine. Approximate prefixes near the threshold need packet samples, exact flow logs, routing context, or owner metadata before severe actions such as blocking or blackholing traffic.',
        'Another failure is stale hierarchy metadata. IP ownership, customer mappings, URL routing, and organization charts change. If the prefix tree or taxonomy is old, the algorithm can still be mathematically consistent while explaining load in terms the current system no longer uses.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Trie and PATRICIA Trie for prefix representation, IP FIB Longest-Prefix Match Case Study for the forwarding side of the same hierarchy, Heavy Hitters: Space-Saving Summaries for candidate retention, Count-Min Sketch and Count Sketch for approximate stream counts, and Elastic Sketch for production network measurement.',
        'For the original research line, read Cormode, Korn, Muthukrishnan, and Srivastava on hierarchical heavy hitters, then compare it with online traffic-monitoring work that adds operational constraints and verification.',
      ],
    },
  ],
};
