// URL parsing and origin construction: the browser turns an input string plus
// base URL into structured fields used by fetch, routing, storage, and security.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'url-origin-parser-case-study',
  title: 'URL Parser & Origin Tuple',
  category: 'Systems',
  summary: 'How the WHATWG URL parser resolves bases, normalizes components, handles special schemes, computes origins, and feeds browser security checks.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['parse normalize', 'origin boundary'], defaultValue: 'parse normalize' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function urlGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'input', label: 'input', x: 0.7, y: 4.4, note: notes.input ?? '../api?q=1' },
      { id: 'base', label: 'base', x: 2.3, y: 2.4, note: notes.base ?? 'https://ex/app/' },
      { id: 'parser', label: 'parse', x: 2.3, y: 5.8, note: notes.parser ?? 'state machine' },
      { id: 'scheme', label: 'scheme', x: 4.1, y: 3.0, note: notes.scheme ?? 'https' },
      { id: 'host', label: 'host', x: 5.7, y: 3.0, note: notes.host ?? 'example.com' },
      { id: 'path', label: 'path', x: 4.1, y: 6.0, note: notes.path ?? '/api' },
      { id: 'query', label: 'query', x: 5.7, y: 6.0, note: notes.query ?? 'q=1' },
      { id: 'origin', label: 'origin', x: 7.5, y: 4.4, note: notes.origin ?? 'tuple' },
      { id: 'policy', label: 'policy', x: 9.0, y: 4.4, note: notes.policy ?? 'same?' },
    ],
    edges: [
      { id: 'e-input-parser', from: 'input', to: 'parser', weight: '' },
      { id: 'e-base-parser', from: 'base', to: 'parser', weight: '' },
      { id: 'e-parser-scheme', from: 'parser', to: 'scheme', weight: '' },
      { id: 'e-parser-host', from: 'parser', to: 'host', weight: '' },
      { id: 'e-parser-path', from: 'parser', to: 'path', weight: '' },
      { id: 'e-parser-query', from: 'parser', to: 'query', weight: '' },
      { id: 'e-scheme-origin', from: 'scheme', to: 'origin', weight: '' },
      { id: 'e-host-origin', from: 'host', to: 'origin', weight: '' },
      { id: 'e-origin-policy', from: 'origin', to: 'policy', weight: '' },
    ],
  }, { title });
}

function* parseNormalize() {
  yield {
    state: urlGraph('A URL input is parsed relative to a base URL'),
    highlight: { active: ['input', 'base', 'parser', 'e-input-parser', 'e-base-parser'], compare: ['origin'] },
    explanation: 'In the browser, many URL strings are relative. The parser combines the input with a base URL before fetch, links, routing, service workers, or security policy can reason about it.',
    invariant: 'Never compare raw URL strings when the platform compares parsed URLs.',
  };

  yield {
    state: urlGraph('The parser splits structured components', { parser: 'states', scheme: 'https', host: 'ex.com', path: '/api/v1', query: 'q=1' }),
    highlight: { active: ['parser', 'scheme', 'host', 'path', 'query', 'e-parser-scheme', 'e-parser-host', 'e-parser-path', 'e-parser-query'] },
    explanation: 'A URL is structured state: scheme, username, password, host, port, path, query, and fragment. The parser normalizes some components while preserving others exactly enough for later serialization.',
  };

  yield {
    state: labelMatrix(
      'Normalization',
      [
        { id: 'host', label: 'host' },
        { id: 'port', label: 'port' },
        { id: 'path', label: 'path' },
        { id: 'query', label: 'query' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['lower/IDNA', 'spoofing'],
        ['drop default', 'dup keys'],
        ['dot segs', 'escape'],
        ['percent', 'semantics'],
      ],
    ),
    highlight: { active: ['host:rule', 'port:rule', 'path:rule'], compare: ['query:risk'] },
    explanation: 'Normalization is not cosmetic. Default ports, host casing, dot segments, percent encoding, and internationalized domain handling all affect cache keys, allowlists, and routing.',
  };

  yield {
    state: urlGraph('Serialization gives one platform answer', { input: 'HTTPS://EX.COM:443/a/../b', path: '/b', origin: 'https://ex.com', policy: 'canonical' }),
    highlight: { found: ['scheme', 'host', 'path', 'origin', 'policy'], active: ['parser'] },
    explanation: 'The URL API gives a canonical serialized form. That is why allowlists and routers should parse first, then compare structured fields or serialized URLs produced by the platform.',
  };

  yield {
    state: urlGraph('The complete case is a redirect allowlist', { input: '/account', base: 'https://shop/', origin: 'https://shop', policy: 'allow' }),
    highlight: { active: ['input', 'base', 'parser', 'origin', 'policy'], found: ['path'] },
    explanation: 'A login page accepts next=/account. It parses next against the site base, verifies the resulting origin is the site origin, then redirects. Raw string checks are where open redirects and host confusion bugs start.',
  };
}

function* originBoundary() {
  yield {
    state: urlGraph('Origin is the browser security tuple', { scheme: 'https', host: 'app.example', origin: 'https+host+443', policy: 'storage/CORS' }),
    highlight: { active: ['scheme', 'host', 'origin', 'policy', 'e-scheme-origin', 'e-host-origin', 'e-origin-policy'], compare: ['path', 'query'] },
    explanation: 'For ordinary network schemes, origin is scheme, host, and port. Path and query can route application data, but they do not make two pages separate origins.',
    invariant: 'Same host over http and https are different origins.',
  };

  yield {
    state: labelMatrix(
      'Origin examples',
      [
        { id: 'https', label: 'https' },
        { id: 'http', label: 'http' },
        { id: 'port', label: 'port' },
        { id: 'opaque', label: 'opaque' },
      ],
      [
        { id: 'tuple', label: 'tuple' },
        { id: 'same', label: 'same?' },
      ],
      [
        ['https,h,443', 'base'],
        ['http,host,80', 'no'],
        ['https,h,8443', 'no'],
        ['unique', 'no'],
      ],
    ),
    highlight: { active: ['https:tuple'], compare: ['http:same', 'port:same', 'opaque:same'] },
    explanation: 'The tuple explains CORS, cookie scope boundaries, storage partitioning, service worker scope, and many security checks. Some URLs have opaque origins instead of a normal tuple.',
  };

  yield {
    state: urlGraph('CORS compares request origin to response policy', { input: 'fetch', origin: 'app origin', policy: 'ACAO?' }),
    highlight: { active: ['origin', 'policy', 'e-origin-policy'], compare: ['host'] },
    explanation: 'When JavaScript fetches across origins, the browser sends and checks origin policy. The URL parser created the tuple that CORS later compares.',
  };

  yield {
    state: urlGraph('Cookies and storage use related but not identical scopes', { host: 'example.com', path: '/app', origin: 'site/origin', policy: 'cookie store' }),
    highlight: { active: ['host', 'path', 'origin', 'policy'], found: ['scheme'] },
    explanation: 'Cookie Domain and Path matching are not the same as origin. That difference is why SameSite, Storage Access, and CORS need separate mental models.',
  };

  yield {
    state: labelMatrix(
      'Do not compare',
      [
        { id: 'raw', label: 'raw str' },
        { id: 'regex', label: 'regex' },
        { id: 'host', label: 'host only' },
        { id: 'url', label: 'URL obj' },
      ],
      [
        { id: 'safe', label: 'safe' },
        { id: 'miss', label: 'misses' },
      ],
      [
        ['no', 'encoding'],
        ['risky', 'parser gaps'],
        ['partial', 'scheme/port'],
        ['yes', 'policy bugs'],
      ],
    ),
    highlight: { found: ['url:safe'], removed: ['raw:safe'], compare: ['host:miss'] },
    explanation: 'The rule of thumb is simple: parse with the platform, compare structured fields, and then enforce policy. Do not build a URL security parser with regexes.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'parse normalize') yield* parseNormalize();
  else if (view === 'origin boundary') yield* originBoundary();
  else throw new InputError('Pick a URL parser view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      'Read the parser view as a string becoming structured browser state. Active nodes show the parser or a component field, found nodes show normalized fields, and compare nodes show policy checks that depend on those fields.',
      'A URL is not just text; it is parsed into scheme, credentials, host, port, path, query, fragment, and sometimes origin. An origin is the browser security boundary for ordinary network URLs: scheme, host, and port. The safe rule is: parse with the platform before comparing policy fields.',
      {type:"callout", text:"URL safety starts when validation and browser behavior share the same parsed structure instead of competing string interpretations."},
    ]},
    { heading: 'Why this exists', paragraphs: [
      'Browsers use parsed URLs for navigation, fetch, CORS, storage, service workers, cookies, caches, and redirects. If application code validates raw strings while the browser executes parsed structure, the two can disagree.',
      'Many URL bugs are interpretation bugs. The code thinks it approved one destination, but base resolution, default ports, percent encoding, credentials, or host normalization makes the browser use another.',
    ]},
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is string checks. Developers test whether a redirect starts with slash, split on slash for paths, check whether a host substring appears, or write a regular expression for allowed URLs.',
      'That feels reasonable for simple inputs such as https://example.com/account. It breaks when the input is relative, encoded, mixed case, scheme-relative, contains credentials, or relies on browser-specific normalization.',
    ]},
    { heading: 'The wall', paragraphs: [
      'A URL parser is a state machine, and the meaning of a character depends on parser state. A colon can end a scheme, a question mark can start a query, a hash starts a fragment, and a percent escape may be interpreted differently by component.',
      'The wall is parser disagreement. A regex or split-based helper becomes a second parser, and security fails when that helper disagrees with the browser parser that actually performs navigation or fetch.',
    ]},
    { heading: 'The core insight', paragraphs: [
      'Parse first, then compare the structured field that matches the policy. Compare origin for same-origin rules, hostname for host rules, pathname for route rules after origin approval, and serialized URL only when canonical identity is the policy.',
      'A URL object is not authorization. It is a shared interpretation. Product rules still decide whether the parsed destination is allowed.',
    ]},
    { heading: 'How it works', paragraphs: [
      'The URL constructor takes an input string and, when needed, a base URL. It resolves relative paths, normalizes host casing, handles default ports, processes dot segments, separates query and fragment, and exposes structured fields.',
      'Origin computation then reads the parsed result. For http and https, origin is scheme plus host plus port; path and query do not create separate origins. Opaque origins cover cases where the browser does not produce a normal tuple.',
    ]},
    { heading: 'Why it works', paragraphs: [
      'The correctness argument is shared semantics. If validation compares the same parsed fields the browser later uses, validation and execution agree about the destination.',
      'The proof still depends on choosing the right boundary. Same-origin, same-site, cookie Domain, cookie Path, service worker scope, cache key, and application authorization are related but different checks.',
    ]},
    { heading: 'Cost and complexity', paragraphs: [
      'The runtime cost of new URL(input, base) is tiny beside a network request or a security incident. The real cost is naming the rule: origin, site, host, pathname, query key, serialized URL, or product permission.',
      'When input volume doubles, parsing cost roughly doubles with it, but most applications parse only at boundaries such as redirects, fetch targets, callbacks, and router entries. The dominant engineering cost is avoiding custom parsers and keeping policy checks explicit.',
    ]},
    { heading: 'Real-world uses', paragraphs: [
      'Platform URL parsing belongs in redirect allowlists, webhook callback validation, link rewriting, router matching, service worker registration checks, CORS reasoning, cache-key construction, CSP reviews, and user-supplied navigation targets.',
      'The same lesson applies to proxies, API gateways, crawlers, link preview systems, and security scanners. The upstream checker must parse the same destination that the downstream runtime will use.',
    ]},
    { heading: 'Where it fails', paragraphs: [
      'URL parsing does not decide whether a user may access a route. A parsed same-origin URL for /admin/export is still unsafe if the user is not authorized for that export.',
      'It also does not collapse browser boundaries into one rule. Origin, site, cookie scope, storage partition key, service worker scope, CORS, CSP, and application permission each use different inputs.',
    ]},
    { heading: 'Worked example', paragraphs: [
      'A login endpoint receives next=../account?tab=billing and the base URL https://shop.example/app/login. new URL(next, base) resolves it to https://shop.example/account?tab=billing with origin https://shop.example.',
      'The safe redirect check first compares parsed origin to https://shop.example, then checks pathname against allowed routes such as /account and /orders. That accepts the example because both checks pass.',
      'An attacker sends next=https://shop.example.evil.test/account. A substring check for shop.example would pass, but parsed hostname is shop.example.evil.test and origin is https://shop.example.evil.test, so the structured check rejects it.',
    ]},
    { heading: 'Sources and study next', paragraphs: [
      'Read the WHATWG URL Standard and MDN URL API documentation. For browser security boundaries, study CORS Preflight Cache, SameSite Cookies and CSRF, Storage Access API, Service Workers, Browser Cache Partitioning, Content Security Policy, Fetch Metadata, and History API Session Stack.',
      'For parser discipline, study UTF-8 Decoder DFA, CSV Parser State Machine, Pratt Parser, Finite State Machine, and Trusted Types DOM XSS Sink Case Study. They all teach the same lesson: parse once with the right grammar, keep structured state, and enforce policy on that structure.',
    ]},
  ],
};
