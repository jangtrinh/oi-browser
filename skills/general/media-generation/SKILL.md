---
name: media-generation
description: Use when the user asks to generate or edit an image, generate a short video, or create music, a song, soundtrack, beat, loop, or other audio with Ổi Browser's media models.
metadata:
  title: Media Generation
---

# Media Generation

Generate media through the lazy `oi.media` API inside `exec`. Return the call result so the generated file path is visible to the next model step.

## Images

```ts
return await oi.media.generateImage({
  prompt: 'A detailed description of subject, style, composition, color, lighting, and mood',
  model: 'gpt-image-2.5-sunburst',
  background: 'opaque',
  media_references: ['/exact/path/to/reference.png']
})
```

Use `generateImage` for new images and edits. Include `media_references` whenever the result should modify, match, or build from an existing image. Every image is a 1024x1024 PNG.

Use an original attachment directly unless the requested composition specifically needs a crop. Do not copy or crop an attachment merely to make it acceptable as a reference.

When the user is exploring a visual direction and has not already chosen one, ask whether they want a small set of distinct initial examples to compare and select from. If they do, ask which qualities should vary when that would materially improve the choices; otherwise, make the examples meaningfully different in composition, style, or treatment. Present the sample for selection before generating a larger set of related items, unless the user explicitly asks you to choose or proceed autonomously.

Use the selected example as the canonical base image. Pass its exact `filepath` in `media_references` for every related variation and describe only the intended differences in each prompt. For example, let the user choose a base card design before creating alternate colors, states, or content variants from it. If the user does not need a choice set, generate one canonical base image first. Do not generate consistency-sensitive variants independently.

### Choose a model

Ổi Browser has two image models. When you omit `model`, it uses GPT Image 2.5 Flare, or GPT Image 2.5 Sunburst when `media_references` are included. Set `model` yourself whenever another model fits the request better.

|                          | GPT Image 2.5 Flare                  | GPT Image 2.5 Sunburst          |
| ------------------------ | ------------------------------------ | ------------------------------- |
| `model`                  | `"gpt-image-2.5-flare"`              | `"gpt-image-2.5-sunburst"`      |
| Default when omitted     | New images without references        | Edits with `media_references`   |
| Typical time per image   | About 25 seconds (17 to 27)          | About 40 seconds (33 to 49)     |
| Arena text-to-image Elo  | 1401, rank 2                         | 1424, rank 1                    |
| Arena image edit Elo     | 1482, rank 2                         | 1526, rank 1                    |
| Transparent background   | Yes                                  | Yes                             |
| Reference images         | Up to 10                             | Up to 10                        |
| Cost                     | Same token rates as Sunburst         | Same token rates as Flare       |

Times are for one image without references. References add time. Elo scores come from the arena.ai leaderboards of September 2026.

- Use Flare for new images, drafts, choice sets, icons, stickers, illustrations, and everyday requests. It is nearly twice as fast for the same cost, and people prefer Sunburst in only about 53% of blind text-to-image comparisons.
- Use Sunburst when you edit or build from `media_references`, when a person, product, character, or brand must stay recognizable, when the image carries dense text or a precise layout, and for final assets the user will publish. People prefer its edits in about 56% of blind comparisons.
- When the user asks for a model, for speed, or for the best quality, follow that request.
- The result names the model that generated the image.

### Transparent background

Set `background: "transparent"` for a cutout, logo, icon, sticker, sprite, or product image that needs no backdrop. Both models return a PNG with a real alpha channel. Do not imitate transparency with a checkerboard pattern. `background` defaults to `"opaque"`.

## Video

Generate short videos with Gemini Omni 1.1 Flash (`gemini-omni-1.1-flash`).

```ts
return await oi.media.generateVideo({
  prompt:
    'A detailed scene with subject motion, camera movement, style, lighting, mood, and timing',
  aspect_ratio: '16:9',
  duration_seconds: 8,
  negative_prompt: 'Elements to avoid',
  media_references: ['/exact/path/to/reference.png']
})
```

- `aspect_ratio` is optional: `"16:9"` or `"9:16"`.
- `duration_seconds` is optional and must be from 4 to 10. Omit it to let the model choose the length.
- `media_references` may contain up to three images. Video references are not supported.
- With one reference image, the image becomes the starting frame. Two or more images guide the look of a character, product, or setting without fixing the first frame.
- Videos include generated audio. For a silent result, remove the audio from the generated video afterward.
- The result names the model that generated the video.
- If Gemini Omni is unavailable in the request's region, explain the failure. If a generation is blocked, change the prompt or references before trying again. Do not repeat the same request.

## Music

```ts
return await oi.media.generateMusic({
  prompt: 'Genre, mood, instruments, BPM, key, structure, vocal style, and supplied lyrics',
  output_path: 'generated/theme.mp3',
  mode: 'song',
  format: 'mp3',
  media_references: ['/exact/path/to/moodboard.png']
})
```

- `output_path` is required and is relative to the session root. Its extension must match `format`.
- `mode: "clip"` makes a quick 30-second preview or loop. `mode: "song"` makes a full structured track and is the default.
- `format` is `"mp3"` by default. WAV is available for song mode.
- `media_references` accepts up to ten images as visual inspiration.
- Do not request the voice of a living artist or reproduce copyrighted lyrics.

## References and output paths

Use the exact absolute `filepath` attached to a chat image or media file when available. Exact file paths are canonical; friendly filenames are only a compatibility fallback. References may also be open tab IDs or URLs.

For visual artifacts, reference the exported media file, not the HTML frame that displays it. Generated files are written into the session workspace and appear in the existing image, video, or music card.
