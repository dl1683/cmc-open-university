// AudioLDM moves text-to-audio generation into a latent representation:
// CLAP-style text/audio embeddings condition a latent diffusion model, then a
// decoder renders waveform audio.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'audioldm-latent-audio-diffusion-case-study',
  title: 'AudioLDM Latent Audio Diffusion Case Study',
  category: 'AI & ML',
  summary: 'Text-to-audio generation with latent diffusion: CLAP conditioning, audio latents, denoising, waveform decoding, edit masks, and evaluation ledgers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['latent pipeline', 'audio edits'], defaultValue: 'latent pipeline' },
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

function audioGraph(title) {
  return graphState({
    nodes: [
      { id: 'prompt', label: 'text', x: 0.8, y: 3.2, note: 'prompt' },
      { id: 'clapT', label: 'CLAP-T', x: 2.3, y: 2.3, note: 'text emb' },
      { id: 'clapA', label: 'CLAP-A', x: 2.3, y: 4.4, note: 'audio emb' },
      { id: 'latent', label: 'latent', x: 4.2, y: 3.3, note: 'z' },
      { id: 'noise', label: 'noise', x: 5.9, y: 4.4, note: 'zt' },
      { id: 'denoise', label: 'denoise', x: 7.2, y: 3.3, note: 'LDM' },
      { id: 'mel', label: 'mel', x: 8.6, y: 2.4, note: 'spec' },
      { id: 'wave', label: 'wave', x: 9.5, y: 4.0, note: 'audio' },
    ],
    edges: [
      { id: 'e-prompt-clapt', from: 'prompt', to: 'clapT' },
      { id: 'e-clapt-denoise', from: 'clapT', to: 'denoise' },
      { id: 'e-clapa-latent', from: 'clapA', to: 'latent' },
      { id: 'e-latent-noise', from: 'latent', to: 'noise' },
      { id: 'e-noise-denoise', from: 'noise', to: 'denoise' },
      { id: 'e-denoise-mel', from: 'denoise', to: 'mel' },
      { id: 'e-mel-wave', from: 'mel', to: 'wave' },
    ],
  }, { title });
}

function* latentPipeline() {
  yield {
    state: audioGraph('Text-conditioned latent audio generation'),
    highlight: { active: ['prompt', 'clapT', 'denoise', 'e-prompt-clapt', 'e-clapt-denoise'], found: ['latent', 'noise'] },
    explanation: 'AudioLDM conditions latent diffusion with text embeddings from contrastive language-audio pretraining. The denoiser works in a compact latent audio space instead of directly generating every waveform sample.',
    invariant: 'The text condition guides the latent denoising path; the decoder is responsible for turning latents back into audible structure.',
  };

  yield {
    state: labelMatrix(
      'Audio tensors',
      [
        { id: 'wave', label: 'wave' },
        { id: 'mel', label: 'mel' },
        { id: 'latent', label: 'latent' },
        { id: 'embed', label: 'embed' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'job', label: 'job' },
      ],
      [
        ['wav', 'listen'],
        ['t/f', 'decode'],
        ['z grid', 'diff'],
        ['vec', 'cond'],
      ],
    ),
    highlight: { active: ['latent:job', 'embed:job'], compare: ['wave:shape', 'mel:shape'] },
    explanation: 'The implementation is a stack of representations. Waveforms are for playback, spectrogram-like features are for audio rendering, latents are for efficient diffusion, and embeddings carry text-audio alignment.',
  };

  yield {
    state: audioGraph('Denoised latent becomes spectrogram and waveform'),
    highlight: { active: ['noise', 'denoise', 'mel', 'wave', 'e-noise-denoise', 'e-denoise-mel', 'e-mel-wave'], compare: ['clapT'] },
    explanation: 'After iterative denoising, the latent decoder and vocoder-like rendering path produce audible sound. The model has to preserve event timing, texture, and prompt semantics through several representation changes.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'second', min: 0, max: 8 }, y: { label: 'energy', min: 0, max: 100 } },
      series: [
        { id: 'rain', label: 'rain', points: [{ x: 0, y: 40 }, { x: 1, y: 45 }, { x: 2, y: 47 }, { x: 3, y: 49 }, { x: 4, y: 48 }, { x: 5, y: 46 }, { x: 6, y: 44 }, { x: 7, y: 43 }] },
        { id: 'thunder', label: 'thunder', points: [{ x: 0, y: 8 }, { x: 1, y: 12 }, { x: 2, y: 18 }, { x: 3, y: 82 }, { x: 4, y: 35 }, { x: 5, y: 13 }, { x: 6, y: 11 }, { x: 7, y: 10 }] },
      ],
      markers: [
        { id: 'hit', x: 3, y: 82, label: 'event' },
      ],
    }),
    highlight: { active: ['rain', 'thunder', 'hit'] },
    explanation: 'Audio quality is temporal. A good generation does not only match a label such as rain; it places events, ambience, and dynamics at plausible times.',
  };
}

function* audioEdits() {
  yield {
    state: labelMatrix(
      'Edit masks',
      [
        { id: 'inpaint', label: 'paint' },
        { id: 'style', label: 'style' },
        { id: 'super', label: 'super' },
        { id: 'mix', label: 'mix' },
      ],
      [
        { id: 'mask', label: 'mask' },
        { id: 'condition', label: 'cond' },
      ],
      [
        ['span', 'gap'],
        ['global', 'texture'],
        ['band', 'restore'],
        ['stems', 'mix'],
      ],
    ),
    highlight: { active: ['inpaint:mask', 'style:condition', 'super:mask'], compare: ['mix:condition'] },
    explanation: 'Latent audio diffusion can support edits because the state is structured. Masks can target time spans, frequency bands, style vectors, or separated stems depending on the product.',
  };

  yield {
    state: audioGraph('Inpainting preserves context and regenerates a gap'),
    highlight: { active: ['latent', 'noise', 'denoise', 'mel'], found: ['prompt'], compare: ['wave'] },
    explanation: 'For inpainting, the known audio context stays fixed while the masked latent span is noised and regenerated. The prompt and surrounding sound both condition the missing segment.',
  };

  yield {
    state: labelMatrix(
      'Evaluation ledger',
      [
        { id: 'fd', label: 'FD' },
        { id: 'sem', label: 'sem' },
        { id: 'pref', label: 'human' },
        { id: 'safety', label: 'safety' },
      ],
      [
        { id: 'asks', label: 'asks' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['dist', 'proxy'],
        ['match', 'shallow'],
        ['prefs', 'cost'],
        ['policy', 'miss'],
      ],
    ),
    highlight: { active: ['fd:asks', 'sem:asks', 'pref:asks', 'safety:asks'], compare: ['fd:risk', 'sem:risk'] },
    explanation: 'Audio evaluation needs several ledgers. Distribution metrics, prompt matching, human preference, safety review, and latency all catch different failure modes.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'guidance', min: 0, max: 10 }, y: { label: 'relative score', min: 0, max: 100 } },
      series: [
        { id: 'align', label: 'align', points: [{ x: 1, y: 40 }, { x: 3, y: 62 }, { x: 5, y: 78 }, { x: 7, y: 85 }, { x: 9, y: 88 }] },
        { id: 'natural', label: 'natural', points: [{ x: 1, y: 86 }, { x: 3, y: 84 }, { x: 5, y: 78 }, { x: 7, y: 66 }, { x: 9, y: 48 }] },
      ],
      markers: [
        { id: 'trade', x: 5, y: 78, label: 'route' },
      ],
    }),
    highlight: { active: ['align', 'natural', 'trade'] },
    explanation: 'Guidance can improve prompt adherence while hurting naturalness. A production tool often routes preview, final render, and edit modes to different guidance and sampler settings.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'latent pipeline') yield* latentPipeline();
  else if (view === 'audio edits') yield* audioEdits();
  else throw new InputError('Pick an AudioLDM view.');
}

export const article = {
  references: [
    { title: 'AudioLDM: Text-to-Audio Generation with Latent Diffusion Models', url: 'https://proceedings.mlr.press/v202/liu23f.html' },
    { title: 'AudioLDM project page', url: 'https://audioldm.github.io/' },
    { title: 'AudioLDM paper PDF', url: 'https://proceedings.mlr.press/v202/liu23f/liu23f.pdf' },
  ],
  sections: [
    {
      heading: 'The real problem',
      paragraphs: [
        'Text-to-audio generation asks for more than assigning a label to a clip. The output has to contain plausible acoustic events, timing, texture, dynamics, and scene consistency. "Rain in a metal warehouse with distant thunder" is not just rain plus thunder; it is reverberation, material, distance, and temporal placement.',
        'Generating raw waveform samples directly is expensive because audio has high temporal resolution. A few seconds of sound contain far more sample positions than a small image contains pixels, and tiny waveform errors can become audible artifacts.',
      ],
    },
    {
      heading: 'The obvious wall',
      paragraphs: [
        'The obvious way to generate sound is to predict waveform samples directly. That gives maximum fidelity in principle, but it makes the model operate on a long, fragile sequence where small errors can become audible clicks, noise, or timing artifacts.',
        'Another obvious route is to retrieve a matching clip from a library. Retrieval is reliable when the exact asset exists, but it cannot compose new scenes, edit a selected region, or satisfy unusual prompts without a very large catalog. AudioLDM sits between those extremes: generate new audio, but do the slow denoising in a compressed latent representation.',
      ],
    },
    {
      heading: 'Why latent diffusion',
      paragraphs: [
        'AudioLDM moves the denoising problem into a learned latent space. The sampler does not repeatedly predict every waveform sample. It denoises a compact continuous audio representation, then a decoder renders the result back into an audible waveform path.',
        'The original AudioLDM paper frames this as text-to-audio generation with latent diffusion and CLAP-style language-audio embeddings. The project page describes training latent diffusion models with audio embeddings while using text embeddings as the condition during sampling.',
      ],
    },
    {
      heading: 'Representation stack',
      paragraphs: [
        'A production pipeline stores several different objects: prompt text, text embeddings, audio embeddings, latent tensors, timestep noise levels, denoised latents, spectrogram-like representations, waveform samples, edit masks, seeds, sampler settings, and evaluation records.',
        'Each representation has a job. Text embeddings carry semantic intent. Audio embeddings align the training signal with audio examples. Latents make diffusion cheaper. Spectrogram-like features preserve time-frequency structure. Waveforms are the final playback artifact.',
      ],
    },
    {
      heading: 'Training versus sampling',
      paragraphs: [
        'During training, the model learns to reverse noise in latent audio space. The training target is not "the word thunder"; it is a distribution over latent audio states that can reconstruct real sound and align with language-audio representations.',
        'During sampling, the prompt is embedded and used as conditioning while the denoiser gradually turns noise into a latent audio sample. Guidance can push the sample toward the prompt, but too much guidance can make the result harsh, repetitive, or less natural.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A sound-design tool receives "rain in a metal warehouse with distant thunder." It encodes the prompt, samples a latent plan for the sound scene, decodes the latent into audio, and stores the seed, prompt, sampler settings, model version, and output path.',
        'A useful output keeps low, dense rain energy throughout the clip, places a thunder event at a plausible time, and gives the scene a metallic reverberant tail. A weak output may contain rain and thunder labels in some metric while still sounding flat, clipped, mistimed, or spatially wrong.',
      ],
    },
    {
      heading: 'Text-guided edits',
      paragraphs: [
        'Latent diffusion also supports edit operations because the state has spatial and temporal structure. A mask can protect known context while a selected time span or frequency band is regenerated. Style transfer, inpainting, and super-resolution become constrained denoising problems rather than full restarts.',
        'For the warehouse clip, the editor can mask two seconds and ask for a louder thunder hit. The system keeps surrounding context fixed, noises the masked latent region, denoises under the new prompt condition, and records the mask and seed so the edit can be reproduced.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The method works because the model separates three hard jobs. A representation model compresses audio into a latent space, contrastive audio-language training supplies a conditioning bridge, and diffusion provides an iterative generative process that can trade diversity for prompt adherence.',
        'The separation is not perfect. If the latent space discards details, the decoder cannot recover them. If the embedding model has shallow semantic coverage, the prompt may steer toward the wrong sound. If the sampler is tuned poorly, plausible latents can become unnatural audio.',
      ],
    },
    {
      heading: 'Evaluation',
      paragraphs: [
        'Audio evaluation needs a ledger, not one score. Distribution metrics can catch broad realism problems. Text-audio similarity can catch prompt mismatch. Human preference can catch timing, texture, and annoyance. Safety review can catch speech, identity, copyrighted style, or harmful content concerns.',
        'The evaluation record should include latency and reproducibility data too: model version, seed, prompt, negative prompt if used, guidance scale, sampler steps, duration, sample rate, and post-processing. Without that ledger, product teams cannot compare failures or reproduce a bad generation.',
      ],
    },
    {
      heading: 'Costs and latency',
      paragraphs: [
        'Latent diffusion is cheaper than direct waveform diffusion, but it is still an iterative sampler. More steps usually cost more latency. Longer clips enlarge the latent grid. Higher sample rates and stereo outputs increase decode and storage costs.',
        'Serving systems often need separate routes for preview, final render, and edit mode. Preview may use fewer steps and lower duration. Final render may spend more compute. Edit mode may preserve context and regenerate only masked regions.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Prompt match can be shallow. The model may produce a generic ambience that scores as "rain" but lacks warehouse acoustics or distant thunder timing. It may also smear transients, loop textures, clip peaks, hallucinate speech, or produce unstable loudness.',
        'Editing has its own failures. A masked region can create seams at the boundary, change ambience outside the intended span, or ignore the existing rhythm. Good tools need crossfades, loudness normalization, and audit trails for what was regenerated.',
      ],
    },
    {
      heading: 'Where it fits',
      paragraphs: [
        'AudioLDM-style systems fit sound design, game ambience, video prototyping, accessibility audio sketches, dataset augmentation, and creative exploration where plausible generated sound is useful and human review is acceptable.',
        'They fit less well when exact reproduction is required: legal evidence, medical audio, safety alarms, music licensing-sensitive production, voice identity, and low-latency interactive instruments. In those domains, generated plausibility can be a liability.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'The latent pipeline view shows the representation handoffs: text to CLAP text embedding, audio examples to audio embeddings, latent noise through the denoiser, then decoded spectrogram-like structure and waveform output.',
        'The audio edits view shows why masks and evaluation matter. The mask decides what can change, the prompt decides the new condition, and the evaluation ledger catches failures that a single text-match score would miss.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Audio generation becomes tractable when the system separates semantic control, compact acoustic representation, and waveform rendering. Text embeddings say what the user wants. Latent diffusion searches a compressed sound space. The decoder turns the chosen latent trajectory back into audible samples.',
        'That separation also explains the failures. A bad text-audio embedding loses intent, a weak latent representation loses acoustic detail, and a poor decoder turns a plausible latent into noisy playback. The pipeline is only as strong as the interfaces between those representations.',
      ],
    },
    {
      heading: 'Rule of thumb',
      paragraphs: [
        'Use AudioLDM-style generation for creative sound drafts, ambience, prototyping, and controlled edits where a human can judge the result. Keep seeds, prompts, model versions, and sampler settings because reproducibility is part of the creative workflow.',
        'Do not treat text-audio similarity as sufficient evaluation. A generated clip can match the words and still fail timing, spatial impression, loudness, transient quality, or safety policy. Audio is experienced over time, so evaluation needs listening and context.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: AudioLDM at https://proceedings.mlr.press/v202/liu23f.html, AudioLDM project page at https://audioldm.github.io/, and the paper PDF at https://proceedings.mlr.press/v202/liu23f/liu23f.pdf.',
        'Study Diffusion Models for the denoising loop, Variational Autoencoders for latent compression, Embeddings & Similarity for text-audio alignment, Convolution for time-frequency feature extraction, and Product Quantization for a different view of compressed representation search.',
      ],
    },
  ],
};
