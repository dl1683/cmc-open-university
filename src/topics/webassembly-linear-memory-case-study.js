// WebAssembly linear memory: one growable byte array shared between Wasm and
// JavaScript, with pages, typed-array views, explicit pointers, and sandboxed bounds.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'webassembly-linear-memory-case-study',
  title: 'WebAssembly Linear Memory Case Study',
  category: 'Systems',
  summary: 'How Wasm represents memory as pages of raw bytes, exposes an ArrayBuffer to JavaScript, grows memory, and keeps native-style code sandboxed.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['linear memory', 'growth and interop'], defaultValue: 'linear memory' },
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

function memoryGraph(title) {
  return graphState({
    nodes: [
      { id: 'js', label: 'JS', x: 0.8, y: 3.7, note: 'host' },
      { id: 'memory', label: 'Memory', x: 2.7, y: 3.7, note: 'ArrayBuffer' },
      { id: 'u8', label: 'Uint8', x: 4.8, y: 1.8, note: 'bytes' },
      { id: 'u32', label: 'Uint32', x: 4.8, y: 3.7, note: 'words' },
      { id: 'f64', label: 'Float64', x: 4.8, y: 5.6, note: 'numbers' },
      { id: 'wasm', label: 'Wasm', x: 7.0, y: 3.7, note: 'instance' },
      { id: 'load', label: 'load/store', x: 9.0, y: 2.3, note: 'offset' },
      { id: 'bounds', label: 'bounds', x: 9.0, y: 5.1, note: 'trap' },
    ],
    edges: [
      { id: 'e-js-memory', from: 'js', to: 'memory' },
      { id: 'e-memory-u8', from: 'memory', to: 'u8' },
      { id: 'e-memory-u32', from: 'memory', to: 'u32' },
      { id: 'e-memory-f64', from: 'memory', to: 'f64' },
      { id: 'e-memory-wasm', from: 'memory', to: 'wasm' },
      { id: 'e-wasm-load', from: 'wasm', to: 'load' },
      { id: 'e-load-bounds', from: 'load', to: 'bounds' },
    ],
  }, { title });
}

function interopGraph(title) {
  return graphState({
    nodes: [
      { id: 'malloc', label: 'malloc', x: 0.8, y: 3.7, note: 'reserve' },
      { id: 'ptr', label: 'ptr', x: 2.5, y: 3.7, note: 'number' },
      { id: 'view', label: 'view', x: 4.2, y: 2.0, note: 'typed array' },
      { id: 'call', label: 'call', x: 4.2, y: 5.3, note: 'export' },
      { id: 'grow', label: 'grow', x: 6.1, y: 3.7, note: '+pages' },
      { id: 'old', label: 'old view', x: 7.9, y: 2.0, note: 'stale' },
      { id: 'new', label: 'new view', x: 7.9, y: 5.3, note: 'refresh' },
      { id: 'free', label: 'free', x: 9.3, y: 3.7, note: 'manual' },
    ],
    edges: [
      { id: 'e-malloc-ptr', from: 'malloc', to: 'ptr' },
      { id: 'e-ptr-view', from: 'ptr', to: 'view' },
      { id: 'e-ptr-call', from: 'ptr', to: 'call' },
      { id: 'e-call-grow', from: 'call', to: 'grow' },
      { id: 'e-grow-old', from: 'grow', to: 'old' },
      { id: 'e-grow-new', from: 'grow', to: 'new' },
      { id: 'e-new-free', from: 'new', to: 'free' },
    ],
  }, { title });
}

function* linearMemory() {
  yield {
    state: memoryGraph('Wasm memory is one indexed byte array'),
    highlight: { active: ['js', 'memory', 'wasm', 'e-js-memory', 'e-memory-wasm'], found: ['u8', 'u32', 'f64'] },
    explanation: 'WebAssembly linear memory is a contiguous mutable byte array. JavaScript sees it through WebAssembly.Memory.buffer. Wasm code sees it through numeric offsets used by load and store instructions.',
  };

  yield {
    state: labelMatrix(
      'Pages and regions inside one memory',
      [
        { id: 'p0', label: 'page 0' },
        { id: 'p1', label: 'page 1' },
        { id: 'p2', label: 'page 2' },
        { id: 'p3', label: 'page 3' },
      ],
      [
        { id: 'size', label: 'size' },
        { id: 'typical use', label: 'typical use' },
      ],
      [
        ['64 KiB', 'data segment'],
        ['64 KiB', 'stack'],
        ['64 KiB', 'heap'],
        ['64 KiB', 'future grow'],
      ],
    ),
    highlight: { active: ['p0:size', 'p1:size', 'p2:size', 'p3:size'], compare: ['p3:typical use'] },
    explanation: 'Memory grows in WebAssembly pages. One page is 64 KiB. Toolchains divide the byte array into regions such as static data, stack, and heap, but those regions are conventions built on the same byte address space.',
    invariant: 'A pointer is an offset into linear memory, not a JavaScript object reference.',
  };

  yield {
    state: memoryGraph('Typed arrays are overlapping interpretations'),
    highlight: { active: ['memory', 'u8', 'u32', 'f64', 'e-memory-u8', 'e-memory-u32', 'e-memory-f64'], compare: ['wasm'] },
    explanation: 'A Uint8Array, Uint32Array, and Float64Array can all view the same bytes. The data is not copied when a view is created; only the interpretation changes. That is why byte offsets, alignment, and encoding matter.',
  };

  yield {
    state: labelMatrix(
      'Load/store safety boundary',
      [
        { id: 'address', label: 'address' },
        { id: 'bounds', label: 'bounds check' },
        { id: 'trap', label: 'trap' },
        { id: 'sandbox', label: 'sandbox' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['integer offset', 'portable pointer'],
        ['inside memory?', 'host safety'],
        ['fail fast', 'no native memory escape'],
        ['separate store', 'browser/runtime isolation'],
      ],
    ),
    highlight: { found: ['bounds:why', 'trap:why', 'sandbox:why'] },
    explanation: 'Wasm can be low-level without giving a module native pointers. Loads and stores target linear memory and are checked against its bounds. An out-of-bounds access traps instead of reading arbitrary host memory.',
  };
}

function* growthAndInterop() {
  yield {
    state: interopGraph('Interop passes pointers and lengths across the boundary'),
    highlight: { active: ['malloc', 'ptr', 'view', 'call', 'e-malloc-ptr', 'e-ptr-view', 'e-ptr-call'], compare: ['grow'] },
    explanation: 'JavaScript and Wasm usually exchange compound data by passing a pointer and length. JavaScript writes bytes into memory, calls an exported function with the pointer, and reads bytes back through a typed-array view.',
  };

  yield {
    state: labelMatrix(
      'Memory growth edge cases',
      [
        { id: 'grow', label: 'memory.grow' },
        { id: 'old', label: 'old ArrayBuffer' },
        { id: 'new', label: 'new buffer' },
        { id: 'shared', label: 'shared memory' },
      ],
      [
        { id: 'behavior', label: 'behavior' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['adds pages', 'capacity changes'],
        ['detached', 'views go stale'],
        ['fresh length', 'recreate views'],
        ['not detached', 'length caveat'],
      ],
    ),
    highlight: { removed: ['old:behavior'], found: ['new:lesson'], compare: ['shared:behavior'] },
    explanation: 'For non-shared memory, memory.grow detaches references to the old buffer, even grow(0). Code that caches a Uint8Array over memory.buffer must recreate the view after calls that may grow memory.',
    invariant: 'Store pointer and length; recreate the typed-array view when needed.',
  };

  yield {
    state: interopGraph('Manual allocation makes JavaScript a guest in the heap'),
    highlight: { active: ['malloc', 'ptr', 'new', 'free', 'e-malloc-ptr', 'e-new-free'], removed: ['old'] },
    explanation: 'If the Wasm module owns malloc/free, JavaScript must treat returned pointers like foreign heap addresses. A pointer can outlive a temporary JS view, but the allocation still needs an ownership rule and a matching free.',
  };

  yield {
    state: labelMatrix(
      'Interop checklist',
      [
        { id: 'bytes', label: 'bytes' },
        { id: 'strings', label: 'strings' },
        { id: 'structs', label: 'structs' },
        { id: 'growth', label: 'growth' },
        { id: 'threads', label: 'threads' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'failure', label: 'failure if ignored' },
      ],
      [
        ['use Uint8Array', 'wrong element width'],
        ['encode/decode UTF-8', 'garbled text'],
        ['match layout', 'bad offsets'],
        ['refresh views', 'empty stale arrays'],
        ['SharedArrayBuffer rules', 'race or isolation issue'],
      ],
    ),
    highlight: { active: ['bytes:rule', 'strings:rule', 'structs:rule', 'growth:rule', 'threads:rule'] },
    explanation: 'The hard bugs are ordinary memory bugs wearing a browser costume: width mismatch, string encoding, struct layout, stale views, and shared-memory races. The fix is to write explicit boundary contracts.',
  };

  yield {
    state: labelMatrix(
      'What toolchains add',
      [
        { id: 'heap', label: 'HEAP views' },
        { id: 'ccall', label: 'ccall/cwrap' },
        { id: 'malloc', label: 'malloc/free' },
        { id: 'fs', label: 'virtual FS' },
      ],
      [
        { id: 'adds', label: 'adds' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['typed views', 'view refresh'],
        ['function bridge', 'export config'],
        ['C heap API', 'manual lifetime'],
        ['file illusion', 'sync and packaging'],
      ],
    ),
    highlight: { found: ['heap:adds', 'ccall:adds', 'malloc:adds'], compare: ['fs:cost'] },
    explanation: 'Emscripten and similar toolchains hide much of the ceremony, but they do not remove the model. Underneath, data still crosses as bytes, pointers, typed views, and runtime-managed heap conventions.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'linear memory') yield* linearMemory();
  else if (view === 'growth and interop') yield* growthAndInterop();
  else throw new InputError('Pick a WebAssembly memory view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the linear-memory view as one byte buffer with several typed interpretations. Active nodes show a load, store, pointer, or view being used now. Found nodes are offsets and lengths that are safe to pass across the JavaScript and WebAssembly boundary.',
        'The safe inference is that a WebAssembly pointer is a number, not a JavaScript object reference. If the animation shows pointer 1024 and length 12, JavaScript must create a view over memory.buffer at that byte range. It must not treat 1024 as a host heap address.',
        {type:'callout', text:'Linear memory is the contract that lets low-level code use numeric offsets while the host sees only a sandboxed, resizable byte buffer.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/1/1f/WebAssembly_Logo.svg', alt:'WebAssembly logo with white WA letters on a purple square.', caption:'WebAssembly logo, by Carlos Baraza Haro, CC0, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'WebAssembly needs to run low-level code without handing it native pointers into the browser or host process. C, C++, Rust, and other compiled languages still need addresses, stacks, heaps, structs, arrays, strings, and byte buffers. Linear memory is the compromise: one sandboxed byte array that Wasm can address directly.',
        'JavaScript sees that memory as a WebAssembly.Memory buffer. Wasm code sees numeric offsets inside a contiguous address space. The boundary lets compiled code use efficient loads and stores while the host keeps the memory sandboxed.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to pass JavaScript objects into compiled code and expect the module to read them. That is how ordinary JavaScript functions work, so it is a natural first thought. It fails because Wasm has no direct access to the JavaScript heap object graph.',
        'The next mistake is to treat a Wasm pointer like a host pointer. A pointer returned by malloc is only an offset into linear memory. JavaScript must combine that offset with a length and a typed-array view before it can read or write bytes.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is representation. JavaScript strings, arrays, and objects have engine-specific layouts, garbage-collector movement, and hidden metadata. Wasm instructions load and store bytes at numeric offsets. Those worlds cannot share object identity directly.',
        'Growth creates another wall. For non-shared memory, memory.grow can detach old ArrayBuffer views. Code that caches a Uint8Array over memory.buffer forever can silently read from a stale view after a call that grows memory.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The cross-boundary contract is pointer plus length. To pass a string or array, JavaScript encodes bytes into linear memory, passes the offset and byte count to Wasm, and reads results back through a fresh view. The object disappears; the byte layout is the API.',
        'One WebAssembly page is 64 KiB. A memory starts with an initial page count and may have a maximum. Loads and stores are bounds-checked against the current memory size, so an out-of-bounds access traps instead of reading arbitrary host memory.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A module can import memory from JavaScript or create and export memory. JavaScript creates views such as Uint8Array, Uint32Array, or Float64Array over memory.buffer. Those views do not copy bytes; they interpret the same buffer with different element widths.',
        'A compiled allocator manages heap space inside that buffer. malloc returns an offset, free releases a range back to the allocator, and structs are fields at agreed byte offsets. Toolchains add helpers for strings and arrays, but the underlying mechanism remains bytes, offsets, and views.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from bounded address translation. Wasm code can compute address 1024, but that address only means byte 1024 inside the module memory. The engine checks the access against current memory bounds before performing the load or store.',
        'Interop correctness comes from preserving encoding and ownership. If JavaScript writes UTF-8 bytes at ptr with length len, Wasm must read exactly that range using the same encoding. If Wasm owns the allocation, JavaScript must not keep using the range after free or after a call that may reallocate it.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The base cost is copying and encoding at the boundary. Suppose JavaScript sends a 10 MB image into Wasm. Encoding may be free if the source is already bytes, but the write into linear memory still moves 10 MB, and a result copied back moves more bytes.',
        'Memory pages make growth coarse. Growing by 16 pages adds 1 MiB because 16 * 64 KiB equals 1,048,576 bytes. Growth can be expensive because old views must be recreated and the runtime may reserve or commit more backing storage.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Linear memory fits codecs, image processing, compression, parsers, cryptography, games, scientific kernels, and libraries compiled from C, C++, Rust, or Zig. The access pattern is bulk byte exchange plus many low-level operations inside the module.',
        'It also explains nearby systems. WebGPU buffers, Apache Arrow arrays, and network protocols all force object-rich code into flat bytes at boundaries. Once data crosses that boundary, layout, alignment, and ownership become first-class design concerns.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Linear memory does not make unsafe source code safe inside the module. A C buffer overflow can corrupt the module heap even if it cannot escape into host memory. The sandbox protects the host, not every data structure inside the guest.',
        'It also fails when the boundary is too chatty. Passing thousands of tiny strings one at a time can spend more time encoding, copying, and allocating than doing useful work. Batch data and keep repeated work inside Wasm when possible.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'JavaScript wants Wasm to sum 1,000 32-bit integers. It asks Wasm malloc for 4,000 bytes, writes a Uint32Array view at pointer 2048, and calls sum(ptr, 1000). Wasm reads 1,000 values from byte offsets 2048 through 6044 and returns a 32-bit result.',
        'If memory starts at 2 pages, it has 128 KiB. If malloc needs more room and grows to 4 pages, the memory becomes 256 KiB. JavaScript must recreate its Uint8Array or Uint32Array views after the grow before reading the result buffer.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: WebAssembly Core Specification at https://www.w3.org/TR/wasm-core-2/, MDN WebAssembly.Memory at https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/Memory, and MDN memory.grow at https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/Memory/grow.',
        'Study next by role: ArrayBuffer and TypedArray for JavaScript views, Slab Allocator and Buddy Allocator for heap management, WebGPU Buffer and Bind Group for another byte-layout boundary, Apache Arrow Columnar Memory for typed buffers, and Bounds Checking for sandbox safety.',
      ],
    },
  ],
};
