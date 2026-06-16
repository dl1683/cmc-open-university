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
      heading: 'What it is',
      paragraphs: [
        'A hierarchical heavy hitter is a heavy aggregate in a tree or lattice of categories. In networking, the hierarchy is often IP prefixes: 10/8 contains 10.4/16, which contains 10.4.7/24, which contains individual hosts. A flat heavy-hitter algorithm can report one host or flow; a hierarchical algorithm can report the prefix that explains many smaller flows together.',
        'The key idea is residual mass. If a descendant is already reported as heavy, subtract that descendant when deciding whether an ancestor is independently heavy. The output is not every large counter; it is a compact explanation of where the stream mass sits in the hierarchy.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For each event, map the key to every ancestor on its path. A packet from 10.4.7.9 updates the host, 10.4.7/24, 10.4/16, 10/8, and 0/0. The system maintains candidate counts or sketches at each level. During reporting, it walks the hierarchy and computes each node residual by subtracting heavy descendants that have already been selected.',
        'The threshold is usually a fraction of total stream weight, such as prefixes carrying at least phi*N bytes or packets. Approximation is needed because exact counts for all nodes can be too expensive at line rate. Count-Min, Count Sketch, Space-Saving summaries, and adaptive traffic synopses can all serve as components depending on whether the stream is positive, turnstile, or adversarial.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Each event may touch O(height) hierarchy nodes, such as /8, /16, /24, and host. Memory depends on how many levels, candidates, and sketches are retained. Reporting costs more than a flat point query because the algorithm must reason about descendants and residual mass. The payoff is interpretability: the result names the operational level where action can happen.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A network operations center sees inbound traffic spike from a botnet. Flat top-k reports thousands of modest source IPs, none large enough to explain the incident alone. A hierarchical heavy-hitter pipeline reports 10.4.7/24 and 10.9/16 as heavy residual prefixes. Operators can rate-limit those prefixes, route them through scrubbing, or contact the owning customer. The hierarchy converts a noisy leaf list into an actionable rollup.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not report every ancestor of a heavy host as a separate finding. That double-counts the same traffic and overwhelms the operator. Residual accounting is what turns the output into an explanation. Also be careful with hierarchies that are not trees. Multidimensional hierarchies, such as source prefix by destination prefix by port, form a lattice and require more careful algorithms.',
        'Approximate sketches can misrank prefixes near the threshold. Use reported prefixes as candidates for deeper flow-log inspection, packet samples, routing context, or exact counters before applying severe mitigation.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Cormode, Korn, Muthukrishnan, and Srivastava, "Finding Hierarchical Heavy Hitters in Data Streams": https://dimacs.rutgers.edu/~graham/pubs/papers/h4.pdf and the VLDB 2003 version: https://www.vldb.org/conf/2003/papers/S15P01.pdf. For online traffic monitoring, see "Online Identification of Hierarchical Heavy Hitters": https://www.cs.princeton.edu/courses/archive/spr05/cos598E/bib/p101-zhang.pdf. Study Trie and PATRICIA Trie for prefix structure, IP FIB Longest-Prefix Match Case Study for the forwarding use of the same hierarchy, Heavy Hitters: Space-Saving Summaries for candidate retention, Count Sketch for signed streams, and Elastic Sketch for a production network-measurement design.',
      ],
    },
  ],
};
