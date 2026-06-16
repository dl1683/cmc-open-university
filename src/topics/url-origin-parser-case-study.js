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
    {
      heading: 'What it is',
      paragraphs: [
        'The browser URL parser turns an input string plus optional base into structured fields: scheme, host, port, path, query, fragment, credentials, and origin. Those fields feed navigation, fetch, service worker scope, CORS, cookies, storage, and app routers.',
        'The WHATWG URL Standard is the living specification for URL parsing, special schemes, origin computation, and serialization: https://url.spec.whatwg.org/. MDN documents the JavaScript URL API that exposes this parser to applications: https://developer.mozilla.org/en-US/docs/Web/API/URL.',
      ],
    },
    {
      heading: 'Core data structure',
      paragraphs: [
        'A parsed URL is not a bag of strings. It is a state-machine output with normalized host, optional port, path list, query string, fragment, and flags such as special scheme or opaque path. The origin tuple is usually scheme, host, and port; some schemes produce opaque origins.',
        'This is why raw string comparison is brittle. HTTPS default ports can disappear, hosts can normalize, paths can resolve dot segments, and percent encodings can change representation while preserving or changing meaning depending on component.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A login endpoint accepts a next parameter. The safe implementation constructs new URL(next, siteBase), checks that the resulting origin equals the site origin, and only then redirects. It also validates the path-level product rule, such as allowing /account and /checkout but rejecting administrative paths.',
        'The unsafe implementation checks whether the raw string starts with /. That misses encoded, scheme-relative, backslash, host-confusion, and base-resolution edge cases. The platform parser should be the first authority, not an afterthought.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Origin is not the whole URL. Two pages on the same scheme, host, and port but different paths are same-origin. Cookie Domain and Path matching are related but not identical to origin. Site, origin, and host are different words because browser security needs different boundaries.',
        'Do not parse security-sensitive URLs with regexes. Regexes usually fail around encoding, IDNA, default ports, special schemes, usernames, fragments, and relative resolution.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: WHATWG URL Standard at https://url.spec.whatwg.org/ and MDN URL API at https://developer.mozilla.org/en-US/docs/Web/API/URL. Study CORS Preflight Cache, SameSite Cookies & CSRF, Storage Access API, Service Workers & Offline-First, Resource Hints, Browser Message Channels, and History API Session Stack next.',
      ],
    },
  ],
};
