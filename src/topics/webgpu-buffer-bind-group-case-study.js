// WebGPU: host arrays become GPUBuffer resources, bind groups connect those
// buffers to shader slots, and command buffers move work onto the GPU queue.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'webgpu-buffer-bind-group-case-study',
  title: 'WebGPU Buffer & Bind Group Case Study',
  category: 'Systems',
  summary: 'How WebGPU moves typed-array data into GPUBuffer objects, binds resources to shader slots, records commands, and submits work to a GPU queue.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['resource binding', 'compute pass'], defaultValue: 'resource binding' },
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

function resourceGraph(title) {
  return graphState({
    nodes: [
      { id: 'js', label: 'JS', x: 0.7, y: 3.6, note: 'host' },
      { id: 'array', label: 'Array', x: 2.4, y: 1.7, note: 'CPU bytes' },
      { id: 'device', label: 'device', x: 2.4, y: 5.7, note: 'logical' },
      { id: 'buffer', label: 'Buffer', x: 4.4, y: 3.7, note: 'flags' },
      { id: 'layout', label: 'Layout', x: 6.4, y: 1.4, note: 'slots' },
      { id: 'bind', label: 'Bind', x: 6.4, y: 5.8, note: 'resources' },
      { id: 'pipe', label: 'Pipe', x: 8.4, y: 2.3, note: 'shader' },
      { id: 'queue', label: 'Queue', x: 9.3, y: 5.0, note: 'submit' },
    ],
    edges: [
      { id: 'e-js-array', from: 'js', to: 'array' },
      { id: 'e-js-device', from: 'js', to: 'device' },
      { id: 'e-array-buffer', from: 'array', to: 'buffer', weight: 'write/copy' },
      { id: 'e-device-buffer', from: 'device', to: 'buffer', weight: 'create' },
      { id: 'e-buffer-bind', from: 'buffer', to: 'bind' },
      { id: 'e-layout-bind', from: 'layout', to: 'bind' },
      { id: 'e-layout-pipe', from: 'layout', to: 'pipe' },
      { id: 'e-bind-pipe', from: 'bind', to: 'pipe' },
      { id: 'e-pipe-queue', from: 'pipe', to: 'queue' },
    ],
  }, { title });
}

function computeGraph(title) {
  return graphState({
    nodes: [
      { id: 'inA', label: 'input A', x: 0.7, y: 2.1, note: 'storage' },
      { id: 'inB', label: 'input B', x: 0.7, y: 5.2, note: 'storage' },
      { id: 'bind', label: 'bind group', x: 2.8, y: 3.6, note: 'slots 0..2' },
      { id: 'shader', label: 'WGSL', x: 4.8, y: 3.6, note: 'kernel' },
      { id: 'dispatch', label: 'dispatch', x: 6.7, y: 3.6, note: 'workgroups' },
      { id: 'out', label: 'output', x: 8.5, y: 2.1, note: 'storage' },
      { id: 'readback', label: 'readback', x: 8.5, y: 5.2, note: 'MAP_READ' },
    ],
    edges: [
      { id: 'e-a-bind', from: 'inA', to: 'bind' },
      { id: 'e-b-bind', from: 'inB', to: 'bind' },
      { id: 'e-bind-shader', from: 'bind', to: 'shader' },
      { id: 'e-shader-dispatch', from: 'shader', to: 'dispatch' },
      { id: 'e-dispatch-out', from: 'dispatch', to: 'out' },
      { id: 'e-out-readback', from: 'out', to: 'readback' },
    ],
  }, { title });
}

function* resourceBinding() {
  yield {
    state: resourceGraph('WebGPU starts with a logical device and explicit buffers'),
    highlight: { active: ['js', 'device', 'buffer', 'e-js-device', 'e-device-buffer'], compare: ['array'] },
    explanation: 'A WebGPU app asks the browser for a GPUAdapter and GPUDevice, then creates GPUBuffer objects with explicit usage flags. The buffer is not a JavaScript array; it is a GPU resource with declared allowed uses.',
  };

  yield {
    state: resourceGraph('Typed arrays upload bytes into GPUBuffer storage'),
    highlight: { active: ['array', 'buffer', 'e-array-buffer'], found: ['js'], compare: ['device'] },
    explanation: 'Host data usually starts as a TypedArray. The app writes it into a GPUBuffer with queue.writeBuffer, mapped ranges, or copy commands. This is the same boundary lesson as WebAssembly linear memory: bytes cross explicitly, and layout is the contract.',
    invariant: 'The shader sees bytes with a declared layout; JavaScript object shape is not visible on the GPU.',
  };

  yield {
    state: resourceGraph('Bind group layout names the shader resource contract'),
    highlight: { active: ['layout', 'bind', 'buffer', 'pipe', 'e-layout-bind', 'e-buffer-bind', 'e-layout-pipe'], compare: ['queue'] },
    explanation: 'A bind group layout says which resource slots exist, which shader stages can see them, and whether a buffer is uniform, read-only storage, writable storage, or another resource type. A bind group fills those slots with concrete resources.',
  };

  yield {
    state: labelMatrix(
      'GPUBuffer usage flags',
      [
        { id: 'mapread', label: 'MAP_READ' },
        { id: 'mapwrite', label: 'MAP_WRITE' },
        { id: 'copy', label: 'COPY_SRC/DST' },
        { id: 'vertex', label: 'VERTEX/INDEX' },
        { id: 'uniform', label: 'UNIFORM' },
        { id: 'storage', label: 'STORAGE' },
      ],
      [
        { id: 'purpose', label: 'purpose' },
        { id: 'common pitfall', label: 'common pitfall' },
      ],
      [
        ['read back to CPU', 'must copy from compute output first'],
        ['CPU writes mapped range', 'not a free live JS view'],
        ['staging and transfers', 'missing flag blocks copy'],
        ['draw input streams', 'wrong stride breaks vertices'],
        ['small constants', 'alignment and size limits'],
        ['large shader data', 'race and bounds discipline'],
      ],
    ),
    highlight: { active: ['copy:purpose', 'uniform:purpose', 'storage:purpose'], compare: ['mapread:common pitfall'] },
    explanation: 'Usage flags are a validation data structure. They let the browser reject impossible or unsafe resource transitions before commands reach the driver.',
  };
}

function* computePass() {
  yield {
    state: computeGraph('A compute pass binds buffers and dispatches workgroups'),
    highlight: { active: ['inA', 'inB', 'bind', 'shader', 'dispatch', 'e-a-bind', 'e-b-bind', 'e-bind-shader', 'e-shader-dispatch'], compare: ['out'] },
    explanation: 'A compute shader reads storage buffers through a bind group, runs many invocations grouped into workgroups, and writes results into another storage buffer. This is GPU data-parallelism exposed inside the browser.',
  };

  yield {
    state: labelMatrix(
      'Resource type fit',
      [
        { id: 'uniform', label: 'uniform buffer' },
        { id: 'storage', label: 'storage buffer' },
        { id: 'vertex', label: 'vertex buffer' },
        { id: 'index', label: 'index buffer' },
        { id: 'readback', label: 'readback buffer' },
      ],
      [
        { id: 'shader access', label: 'shader access' },
        { id: 'data structure shape', label: 'data structure shape' },
      ],
      [
        ['read constants', 'small config block'],
        ['read/write arrays', 'large flat arrays'],
        ['read per vertex', 'struct stream'],
        ['read indices', 'compact topology'],
        ['CPU map after copy', 'staging result'],
      ],
    ),
    highlight: { active: ['storage:shader access', 'vertex:data structure shape', 'index:data structure shape'], found: ['uniform:data structure shape'] },
    explanation: 'Choosing the buffer type is choosing the access pattern. Uniforms are compact constants, storage buffers are large arrays, vertex and index buffers are draw-specific streams, and readback buffers are CPU-visible staging space.',
  };

  yield {
    state: resourceGraph('Command encoding separates recording from execution'),
    highlight: { active: ['pipe', 'queue', 'e-pipe-queue'], found: ['bind'], compare: ['js'] },
    explanation: 'WebGPU records work into a command encoder, finishes a command buffer, then submits it to the queue. JavaScript is describing future GPU work, not executing each shader invocation directly.',
    invariant: 'The queue timeline and the JavaScript event loop are related but not the same timeline.',
  };

  yield {
    state: computeGraph('Readback copies GPU output into a mappable buffer'),
    highlight: { active: ['out', 'readback', 'e-out-readback'], found: ['dispatch'], compare: ['inA', 'inB'] },
    explanation: 'Compute output usually lives in a storage buffer that is not directly mappable for CPU reads. The usual path is copyBufferToBuffer into a MAP_READ staging buffer, then mapAsync and read the ArrayBuffer after the GPU has completed the copy.',
  };

  yield {
    state: labelMatrix(
      'Complete case study: sparse PageRank in the browser',
      [
        { id: 'rowptr', label: 'rowPtr' },
        { id: 'colidx', label: 'colIdx' },
        { id: 'rank', label: 'rank values' },
        { id: 'next', label: 'next values' },
        { id: 'control', label: 'iteration params' },
      ],
      [
        { id: 'WebGPU resource', label: 'WebGPU resource' },
        { id: 'source topic', label: 'source topic' },
      ],
      [
        ['read-only storage', 'Compressed Sparse Row Graph'],
        ['read-only storage', 'Compressed Sparse Row Graph'],
        ['storage buffer', 'PageRank'],
        ['writable storage', 'PageRank'],
        ['uniform buffer', 'algorithm constants'],
      ],
    ),
    highlight: { active: ['rowptr:WebGPU resource', 'colidx:WebGPU resource', 'rank:WebGPU resource', 'next:WebGPU resource'], found: ['control:WebGPU resource'] },
    explanation: 'The case-study bridge is concrete: a CSR graph becomes flat storage buffers, a PageRank iteration becomes a compute dispatch, and the browser app reads back only summaries or the final rank vector.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'resource binding') yield* resourceBinding();
  else if (view === 'compute pass') yield* computePass();
  else throw new InputError('Pick a WebGPU view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The "resource binding" view traces data from a JavaScript TypedArray through GPUBuffer creation, bind group layout declaration, bind group instantiation, pipeline attachment, and queue submission. Active nodes are the current stage of the resource pipeline. Found nodes are resources whose state is now committed. Compare nodes are participants waiting for their turn in the chain.',
        'The "compute pass" view traces a GPU compute workload end to end: input storage buffers feed a bind group, the WGSL kernel executes across dispatched workgroups, output lands in a storage buffer, and readback copies results into CPU-mappable memory.',
        {
          type: 'note',
          text: 'The safe inference at each frame: if a node is active and the edge leading to it is highlighted, that stage has received or produced data. If a downstream node is not yet active, the data has not crossed that boundary and no shader or JavaScript code can observe it there.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          attribution: 'WebGPU design rationale',
          text: 'The GPU is not a faster CPU. It is a different machine with different memory, different timing, and no concept of a JavaScript object. Every byte that crosses the boundary must be packed, declared, and validated before the driver touches it.',
        },
        'JavaScript lives in a garbage-collected heap where objects have prototypes, Maps have hash tables, and arrays can be sparse. A GPU lives in a world of flat byte buffers, fixed-function pipelines, and thousands of threads executing the same instruction. Those two worlds share nothing by default -- not memory layout, not timing, not even the concept of a "variable."',
        'WebGL papered over this gap with implicit state: you called gl.bindBuffer, set uniforms one by one, and hoped the driver assembled a valid configuration. Errors surfaced as silent black screens or driver-specific crashes. WebGPU replaces that implicit model with explicit resource declarations: every buffer states its allowed uses, every shader slot is named in a layout, and the browser validates the entire command stream before it reaches the driver.',
        'The cost is verbosity. The payoff is that a WebGPU app that passes validation will behave the same on every conformant implementation -- Chrome on Windows, Firefox on Linux, Safari on macOS. That portability contract is the reason the API exists.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct is to pass a JavaScript array directly to the GPU. Write a shader, hand it your data, get results. This is how WebGL uniform uploads felt -- you called gl.uniform4fv and the driver handled the rest. It worked for small, simple cases.',
        {
          type: 'code',
          language: 'javascript',
          body: '// The WebGL way: implicit state, hope for the best.\ngl.bindBuffer(gl.ARRAY_BUFFER, buf);\ngl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);\ngl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);\ngl.enableVertexAttribArray(0);\n// Which buffer is bound? What are the usage rules? What if you\n// forget enableVertexAttribArray? Silent failure.',
        },
        'The second instinct is to create one big buffer and use it for everything: vertex data, uniform constants, compute input, compute output, and CPU readback. One allocation, one bind, done.',
        'Both approaches fail for the same reason: they hide the contract between JavaScript and the GPU. When the contract is implicit, validation is impossible, errors are silent, and portability breaks on the first driver that interprets the ambiguity differently.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is not performance. The wall is that the GPU cannot interpret JavaScript objects, and JavaScript cannot observe GPU memory.',
        {
          type: 'table',
          headers: ['Assumption', 'Why it breaks', 'WebGPU enforcement'],
          rows: [
            ['GPU can read JS arrays', 'GPU sees bytes at physical addresses, not GC-managed heap objects', 'Data must be copied into a GPUBuffer via writeBuffer or mapped range'],
            ['One buffer for all uses', 'MAP_READ and STORAGE are incompatible usage flags on most implementations', 'Usage flags declared at creation; misuse is a validation error'],
            ['Shader reads any buffer', 'Shader slots are typed and numbered; buffer must be bound to the correct slot', 'Bind group layout declares slot types; bind group fills them'],
            ['Results appear immediately', 'GPU executes asynchronously on a separate timeline', 'Readback requires copyBufferToBuffer + mapAsync; result is a Promise'],
            ['Byte layout matches automatically', 'WGSL struct alignment (16-byte for vec4) differs from JS TypedArray packing', 'Misaligned data produces wrong values; no runtime error, just garbage'],
          ],
        },
        'Each row in that table is a real bug that WebGL silently tolerated and WebGPU explicitly rejects. The explicitness is the design. A missing usage flag, a mismatched bind group layout, or a forgotten alignment pad does not produce a black screen -- it produces a validation error with a message telling you exactly what went wrong.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'GPU programming is data-layout programming. The shader is fast only after the data is flat, typed, aligned, and bound to the right slot. WebGPU makes that layout contract visible and enforceable.',
        {
          type: 'diagram',
          alt: 'Data flow from JavaScript to GPU shader execution',
          label: 'The two translations: bytes and bindings',
          body: 'JavaScript TypedArray (CPU heap)\n       |\n       | queue.writeBuffer() or mapped range\n       v\nGPUBuffer (GPU-visible memory, usage flags declared)\n       |\n       | GPUBindGroup maps buffer to slot number\n       v\nBind Group Layout (shader contract: slot 0 = storage, slot 1 = uniform, ...)\n       |\n       | GPUComputePipeline or GPURenderPipeline references layout\n       v\nWGSL Shader (@group(0) @binding(0) var<storage> data: array<f32>)\n       |\n       | dispatchWorkgroups() or draw()\n       v\nGPU execution (thousands of threads, same instruction, different data)',
          text: 'JavaScript TypedArray (CPU heap)\n       |\n       | queue.writeBuffer() or mapped range\n       v\nGPUBuffer (GPU-visible memory, usage flags declared)\n       |\n       | GPUBindGroup maps buffer to slot number\n       v\nBind Group Layout (shader contract: slot 0 = storage, slot 1 = uniform, ...)\n       |\n       | GPUComputePipeline or GPURenderPipeline references layout\n       v\nWGSL Shader (@group(0) @binding(0) var<storage> data: array<f32>)\n       |\n       | dispatchWorkgroups() or draw()\n       v\nGPU execution (thousands of threads, same instruction, different data)',
        },
        'The first translation converts JavaScript values into GPU-visible bytes. The second translation connects those bytes to shader slots through a bind group. Both translations are explicit, validated, and portable. This is the same lesson as WebAssembly linear memory, Apache Arrow columnar layout, and CSR graph storage: when code crosses a low-level boundary, object shape disappears and byte layout becomes the API.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The resource pipeline has five stages. Each stage narrows what the GPU can do with the data, and each stage is validated independently.',
        {
          type: 'bullets',
          items: [
            'GPUBuffer creation: device.createBuffer({ size, usage }). Usage flags are a bitmask: VERTEX, INDEX, UNIFORM, STORAGE, COPY_SRC, COPY_DST, MAP_READ, MAP_WRITE. The browser rejects any command that uses a buffer in a way its flags do not permit.',
            'Data upload: queue.writeBuffer(buffer, offset, typedArray) copies bytes from the CPU heap into GPU-visible memory. For large or frequent uploads, buffer mapping (MAP_WRITE, then getMappedRange) avoids an extra copy.',
            'Bind group layout: device.createBindGroupLayout({ entries }) declares the shader contract. Each entry specifies a binding number, shader stage visibility (COMPUTE, VERTEX, FRAGMENT), and resource type (uniform buffer, storage buffer, read-only storage, sampler, texture).',
            'Bind group: device.createBindGroup({ layout, entries }) fills the layout slots with actual GPUBuffer references and byte offsets. The bind group is immutable after creation -- you cannot swap a buffer in an existing bind group.',
            'Command recording: a GPUCommandEncoder records passes (compute or render), each pass sets a pipeline and bind groups, dispatches work, and finishes. The finished command buffer is submitted to the device queue. JavaScript is describing future GPU work, not executing it.',
          ],
        },
        {
          type: 'code',
          language: 'javascript',
          body: '// Complete compute dispatch: vector addition on the GPU.\nconst N = 1024;\nconst a = new Float32Array(N).fill(1.0);\nconst b = new Float32Array(N).fill(2.0);\n\n// 1. Create buffers with declared usage.\nconst bufA = device.createBuffer({\n  size: a.byteLength,\n  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,\n});\nconst bufB = device.createBuffer({\n  size: b.byteLength,\n  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,\n});\nconst bufOut = device.createBuffer({\n  size: N * 4,\n  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,\n});\nconst bufReadback = device.createBuffer({\n  size: N * 4,\n  usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,\n});\n\n// 2. Upload data.\ndevice.queue.writeBuffer(bufA, 0, a);\ndevice.queue.writeBuffer(bufB, 0, b);\n\n// 3. Bind group layout + bind group.\nconst layout = device.createBindGroupLayout({\n  entries: [\n    { binding: 0, visibility: GPUShaderStage.COMPUTE,\n      buffer: { type: "read-only-storage" } },\n    { binding: 1, visibility: GPUShaderStage.COMPUTE,\n      buffer: { type: "read-only-storage" } },\n    { binding: 2, visibility: GPUShaderStage.COMPUTE,\n      buffer: { type: "storage" } },\n  ],\n});\nconst bindGroup = device.createBindGroup({\n  layout,\n  entries: [\n    { binding: 0, resource: { buffer: bufA } },\n    { binding: 1, resource: { buffer: bufB } },\n    { binding: 2, resource: { buffer: bufOut } },\n  ],\n});\n\n// 4. Record and submit.\nconst encoder = device.createCommandEncoder();\nconst pass = encoder.beginComputePass();\npass.setPipeline(pipeline); // pipeline created from WGSL module + layout\npass.setBindGroup(0, bindGroup);\npass.dispatchWorkgroups(Math.ceil(N / 64));\npass.end();\nencoder.copyBufferToBuffer(bufOut, 0, bufReadback, 0, N * 4);\ndevice.queue.submit([encoder.finish()]);\n\n// 5. Readback: async, because GPU runs on a separate timeline.\nawait bufReadback.mapAsync(GPUMapMode.READ);\nconst result = new Float32Array(bufReadback.getMappedRange());\n// result[i] === 3.0 for all i\nbufReadback.unmap();',
        },
        'Every line in that example corresponds to a boundary crossing. writeBuffer crosses CPU-to-GPU. The bind group crosses buffer-to-shader-slot. dispatchWorkgroups crosses description-to-execution. copyBufferToBuffer crosses GPU-only-to-mappable. mapAsync crosses GPU-timeline-to-JS-timeline.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The model works because every boundary has an explicit, validated contract. There are five contracts, and all five must hold before any GPU work executes.',
        {
          type: 'table',
          headers: ['Contract', 'What it validates', 'Failure mode if violated'],
          rows: [
            ['Usage flags', 'Buffer can only be used for declared operations', 'Validation error at command encoding time'],
            ['Bind group layout', 'Shader slot types match the resources bound to them', 'Pipeline creation fails or bind group creation fails'],
            ['WGSL declarations', 'Shader reads bytes according to declared struct layout', 'Silent data corruption if alignment is wrong (no runtime error)'],
            ['Command encoding', 'Passes are well-formed, resources are not used conflictingly', 'Validation error at submit time'],
            ['Queue timeline', 'GPU work completes before CPU reads mappable buffers', 'mapAsync resolves only after GPU is done; premature read is impossible'],
          ],
        },
        'The first four contracts are structural: the browser checks them before any GPU instruction runs. The fifth is temporal: the Promise-based mapAsync API prevents JavaScript from reading a buffer before the GPU has finished writing it. Together, these contracts make WebGPU deterministic across implementations. If the validation passes, the result is the same on every conformant browser.',
        {
          type: 'note',
          text: 'WGSL alignment is the one contract the browser cannot fully enforce at the byte level. If you pack a vec3<f32> (12 bytes) but WGSL expects 16-byte alignment for the next field, the shader reads the wrong bytes. The data is valid GPU memory -- it is just not the data you intended. This is the WebGPU equivalent of a C struct padding bug.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Cost axis', 'What you pay', 'When it dominates'],
          rows: [
            ['Buffer creation', '~0.01-0.05 ms per createBuffer call', 'Hundreds of small buffers per frame; pool and reuse instead'],
            ['Data upload', 'PCIe bandwidth: ~12 GB/s on desktop, less on mobile', 'Uploading megabytes every frame; use persistent mapped buffers'],
            ['Bind group creation', 'Lightweight object allocation, but immutable', 'Swapping resources frequently; create bind groups ahead of time'],
            ['Pipeline compilation', '10-500 ms for shader compilation; cached after first use', 'First frame or shader variant explosion; use pipeline caching'],
            ['Command recording', 'CPU cost proportional to number of draw/dispatch calls', 'Thousands of draw calls; use indirect dispatch or instancing'],
            ['Readback latency', 'At least one full GPU-CPU round trip (often 1-3 frames)', 'Real-time feedback loops; avoid per-frame readback if possible'],
          ],
        },
        'The dominant cost for compute workloads is usually the readback round trip, not the shader execution. A GPU can add two 1024-element vectors in microseconds, but copying the result back and waiting for mapAsync to resolve can take milliseconds. The practical rule: keep data on the GPU as long as possible. Chain multiple dispatches before reading back.',
        'For rendering workloads, the dominant cost is often pipeline compilation on the first frame. WebGPU pipelines include the compiled shader, vertex layout, and render state. Chrome caches compiled pipelines in a disk cache keyed by shader content, so subsequent page loads skip compilation. But the first visit pays the full cost.',
        {
          type: 'note',
          text: 'WGSL struct alignment rules often waste bytes. A struct with a f32 followed by a vec4<f32> requires 12 bytes of padding between them (f32 is 4 bytes, but vec4 must start at a 16-byte boundary). For a buffer with millions of structs, that padding is real memory. Reorder fields to minimize alignment gaps: put vec4 fields first, then vec2, then scalars.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Trace a sparse matrix-vector multiply (SpMV) on the GPU, the core kernel behind PageRank, graph neural networks, and iterative solvers. The matrix is stored in CSR format: three arrays (rowPtr, colIdx, values) plus a dense input vector and a dense output vector.',
        {
          type: 'table',
          headers: ['Step', 'JavaScript side', 'GPU side', 'State after'],
          rows: [
            ['1. Create buffers', 'createBuffer for rowPtr (STORAGE|COPY_DST), colIdx (STORAGE|COPY_DST), values (STORAGE|COPY_DST), vecIn (STORAGE|COPY_DST), vecOut (STORAGE|COPY_SRC)', 'Five GPU allocations with declared flags', 'Buffers exist but contain no data'],
            ['2. Upload CSR arrays', 'writeBuffer for rowPtr, colIdx, values, vecIn', 'Bytes copied into GPU memory', 'Four buffers populated; vecOut is zeroed'],
            ['3. Create bind group', 'Layout: slots 0-3 read-only-storage, slot 4 storage. Bind group fills all five slots', 'N/A (CPU-side object)', 'Shader contract established'],
            ['4. Record dispatch', 'beginComputePass, setPipeline, setBindGroup, dispatchWorkgroups(ceil(numRows/64))', 'N/A (commands not yet submitted)', 'Command buffer recorded'],
            ['5. Copy + submit', 'copyBufferToBuffer(vecOut -> readback), queue.submit', 'GPU executes SpMV kernel, then copies result', 'GPU is working; JS continues'],
            ['6. Readback', 'await readback.mapAsync(READ), new Float32Array(getMappedRange())', 'GPU has finished; mapped range is valid', 'Result available in JavaScript'],
          ],
        },
        {
          type: 'code',
          language: 'wgsl',
          body: '// WGSL kernel: one thread per row of the sparse matrix.\n@group(0) @binding(0) var<storage, read> rowPtr: array<u32>;\n@group(0) @binding(1) var<storage, read> colIdx: array<u32>;\n@group(0) @binding(2) var<storage, read> values: array<f32>;\n@group(0) @binding(3) var<storage, read> vecIn: array<f32>;\n@group(0) @binding(4) var<storage, read_write> vecOut: array<f32>;\n\n@compute @workgroup_size(64)\nfn main(@builtin(global_invocation_id) gid: vec3<u32>) {\n  let row = gid.x;\n  if (row >= arrayLength(&vecOut)) { return; }\n  var sum: f32 = 0.0;\n  let start = rowPtr[row];\n  let end = rowPtr[row + 1u];\n  for (var i = start; i < end; i = i + 1u) {\n    sum = sum + values[i] * vecIn[colIdx[i]];\n  }\n  vecOut[row] = sum;\n}',
        },
        'Each thread handles one row. The rowPtr array tells it where its nonzeros begin and end. The colIdx and values arrays provide the column index and coefficient for each nonzero. The result is a standard SpMV -- the same kernel used in iterative PageRank, conjugate gradient solvers, and GNN message passing.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'WebGPU compute wins when the data is large, flat, and parallel, and the result can stay on the GPU for multiple passes before readback.',
        {
          type: 'bullets',
          items: [
            'Browser ML inference: frameworks like ONNX Runtime Web and Transformers.js use WebGPU storage buffers to run transformer attention, matrix multiplications, and activation functions entirely on the GPU. Bind groups map weight tensors and activation buffers to shader slots.',
            'Real-time rendering: vertex buffers, index buffers, uniform buffers for camera matrices, and storage buffers for skinning or particle simulation all use the same resource model. A deferred renderer might use 10+ bind groups per frame.',
            'Scientific visualization: fluid simulations, n-body physics, and volume rendering dispatch compute shaders that read from and write to ping-pong storage buffers. The CPU only reads back summary statistics or final frames.',
            'Image processing: convolution, histogram computation, tone mapping, and post-processing filters run as compute shaders with texture and storage buffer bindings.',
            'Graph analytics in the browser: the SpMV kernel above powers PageRank, label propagation, and spectral clustering on graphs with millions of edges, running entirely in a browser tab.',
          ],
        },
        {
          type: 'note',
          text: 'WebGPU is not limited to compute. The same buffer and bind group model applies to vertex shaders, fragment shaders, and render passes. A render pipeline uses vertex buffers (not bound via bind groups but via setVertexBuffer), plus bind groups for uniforms and textures. The resource contract is identical: declare usage, bind to slots, validate before execution.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'table',
          headers: ['Anti-pattern', 'Why it breaks', 'Better alternative'],
          rows: [
            ['Per-frame readback of full output', 'mapAsync round trip dominates total time; GPU-CPU sync kills parallelism', 'Read back only summaries or use timestamp queries to measure without reading data'],
            ['One buffer per draw call', 'Thousands of tiny createBuffer calls and bind groups per frame', 'Suballocate from a large buffer; use dynamic offsets in bind groups'],
            ['Ignoring WGSL alignment', 'Shader reads wrong bytes; results are silently incorrect', 'Use a struct layout calculator or manually pad to 16-byte boundaries'],
            ['Missing COPY_DST on upload target', 'writeBuffer fails with validation error', 'Always OR in COPY_DST for any buffer you will fill with writeBuffer'],
            ['Dispatching too few threads', 'GPU occupancy is low; thousands of cores sit idle', 'Dispatch at least enough workgroups to saturate the GPU; profile with timestamp queries'],
            ['Recompiling pipelines every frame', 'Shader compilation takes milliseconds; creates frame stutters', 'Cache pipelines; use createComputePipelineAsync for non-blocking compilation'],
          ],
        },
        'The most common beginner mistake is treating WebGPU like a synchronous API. queue.submit returns immediately. The GPU has not finished. Calling mapAsync on a buffer that is still being written by the GPU does not crash -- the Promise simply waits. But structuring your frame loop around that wait means the CPU and GPU never overlap, and you lose the pipeline parallelism that makes GPUs fast.',
        'The most common architectural mistake is over-readback. If you need the GPU result only to send it back to the GPU for the next pass, do not read it back to JavaScript. Keep both buffers on the GPU and swap bind groups between passes. The CPU should orchestrate dispatches, not shuttle bytes.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the W3C WebGPU specification (https://www.w3.org/TR/webgpu/), the W3C WGSL specification (https://www.w3.org/TR/WGSL/), and MDN reference pages for GPUBuffer, GPUBindGroup, GPUBindGroupLayout, GPUCommandEncoder, and GPUQueue. WebGPU Fundamentals (https://webgpufundamentals.org/) provides practical compute and rendering tutorials.',
        {
          type: 'bullets',
          items: [
            'Prerequisite: WebAssembly Linear Memory -- the same byte-boundary lesson in a different context.',
            'Prerequisite: Apache Arrow Columnar Memory -- flat, typed, aligned layout as an interprocess contract.',
            'Prerequisite: Compressed Sparse Row Graph -- the flat array layout used in the SpMV worked example.',
            'Extension: WebGPU Parallel Prefix Scan -- a compute shader pattern that chains multiple dispatches without CPU readback.',
            'Extension: GPU All-Reduce -- aggregation patterns that keep partial results on the GPU.',
            'Extension: Render Graph Framegraph Resource Lifetimes -- how rendering engines manage buffer and texture lifetimes across complex frame graphs.',
            'Contrast: WebGL -- implicit state, no compute shaders, no storage buffers, no validation error messages.',
            'Contrast: CUDA/HIP -- similar explicit buffer model but with direct pointer access, no browser sandbox, and no bind group indirection.',
          ],
        },
        'The engineering question for WebGPU is not whether the GPU is fast. The question is whether your data layout, your buffer usage flags, your bind group structure, and your readback strategy are aligned with how the GPU actually consumes and produces bytes. Get the contracts right and the performance follows.',
      ],
    },
  ],
};

