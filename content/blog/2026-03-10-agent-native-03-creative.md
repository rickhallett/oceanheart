+++
title = "Agent-native creative: where the taste boundary lives"
date = "2026-03-24"
description = "6 creative categories. Photo editing, video, audio, graphic design, 3D, UI/UX. All taste-required. The dividing line is whether the output must be perceived by human senses."
tags = ["agent-native", "creative", "taste", "design"]
draft = true
+++

{{< draft-notice >}}

## All 6 taste-required

Photo editing, video editing, audio production, graphic design, 3D modelling, UI/UX design. This section is where the taxonomy gets interesting, because the answer stops being "just use the CLI." The technical operations (resize, transcode, batch convert) are trivially automatable. But the creative decisions aren't, and the reason is structural, not a capability gap.

## The technical operations

ImageMagick handles resize, crop, rotate, colour space conversion, format conversion, batch processing. It does this from the command line, composably, at any scale. `ffmpeg` is the same for video and audio: transcode, trim, concatenate, filter, extract frames, mux/demux. `sox` handles audio processing. These tools are mature, well-documented, and scriptable.

An agent can resize 10,000 images, transcode a video library, normalise audio levels across a podcast season, or batch-convert file formats. These are fully reducible operations with deterministic outputs.

## The creative decisions

Composition. Colour grading. The mix balance between voice and music. Whether the logo works at 16px. How the page feels when you scroll it. These require seeing or hearing the result, and they require judgment about whether the result is good.

The dividing line is perception. If the operation's correctness can be verified without human senses, it's automatable. If someone needs to look at it or listen to it to know whether it's right, it requires taste.

## The tools exist, but the judgment doesn't

Photoshop's functionality is largely available through ImageMagick, GIMP's Script-Fu, or Python's Pillow. DaVinci Resolve has a scripting API. Blender has a complete Python API - you can model, texture, light, and render without ever opening the GUI. Figma has a plugin API and REST API.

The APIs are there. The problem isn't access to operations. The problem is knowing which operations to perform. "Make this look good" is not a computable instruction.

## Where agents fit in creative work

The practical split: agents handle the mechanical parts of creative workflows. Batch processing, format conversion, asset organisation, template application, responsive variant generation, export for multiple platforms. Humans make the creative decisions and evaluate the results.

I don't think this changes with better models. The output of creative work is consumed by human senses and evaluated by human taste. An agent that could judge aesthetics the way a human does would need to be, in the relevant sense, a human. That's not a capability problem - it's the nature of what "creative quality" means.

## Source

- Full taxonomy: `docs/research/agent-native-software-taxonomy.md`
- Categories 14-19 (Creative section)
