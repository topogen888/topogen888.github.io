# TopoGen project page

This repository contains a GitHub Pages-ready academic project website for:

**TopoGen: Topology-Guided Skill Recomposition for Robotic Demonstration Generation**

## Publish with GitHub Pages

1. Use the public repository `topogen888/topogen888.github.io`.
2. Copy `index.html`, `.nojekyll`, `app/globals.css`, and `public/` to the repository root, preserving their paths. Do not upload the development dependencies or original ZIP archives.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**.
5. Select **main** and **/(root)**, then save.
6. Visit `https://topogen888.github.io/`.

The root `index.html` is the GitHub Pages entry file. No Node.js build is required.

## Replace project content

- Edit title, authors, links, abstract, captions, and BibTeX in `index.html`.
- Replace figures in `public/images/`.
- The Results gallery uses `public/results-gallery.js` and `public/media/manifest.json` in both the static page and the React preview.
- The imported collection has eight tasks, 216 videos, 96 diagrams, and eight downloadable `.viser` recordings. Original ZIP archives are not published.
- Each category loads only the selected task. Videos have lightweight posters and `preload="none"` until requested. In Temporal Modeling, selecting a task starts both clips on one shared timeline: play/pause, seeking, buffering, restart, and looping are coordinated. Playback drift over 80 ms is corrected; this is browser-level timestamp synchronization, not frame-lock hardware synchronization. Other categories retain independent native controls. Simulation and real-robot examples are independently selected, not asserted to be paired.
- The shared temporal transport is implemented in `public/synchronized-videos.js`. On initial page load it waits for a click; if automatic playback after a task selection is blocked, use **Play both**.
- Temporal Modeling places the synchronized human/topology videos on the left and an embedded Viser viewer on the right. The supplied recordings contain point clouds, not Gaussian-splat primitives; the 3D timeline is independent of the two videos. Drag to orbit and scroll to zoom.
- `public/viser/index.html` is the official, self-contained Viser 1.0.24 viewer, matching all eight recordings. Its Apache-2.0 license and provenance are retained alongside it. No Python server or external hosted viewer is needed on GitHub Pages.
- Task, category, and example selections start videos muted; native controls remain available if playback is blocked. Example labels start at 1 while original asset filenames remain unchanged. Avoidance diagrams are always expanded. Data Augmentation places Background/Viewpoint above Texture/Lighting, with Combined Augmentation centered on the right.
- The TopoGen sharing image is `public/topogen-social.png`, rendered from `public/topogen-social.svg`.
- After the final GitHub URL is known, change the Open Graph image in `index.html` to its absolute URL.

## Local preview

Use an HTTP server for the static entry (the gallery loads a JSON manifest):

```bash
python -m http.server 8000
```

## Refresh the imported media

The media collection was imported from the original project. Original ZIP archives and media preparation scripts are not published. Original videos are not re-encoded.

The audited Viser metadata and self-contained viewer are retained in `public/` (see `public/viser/NOTICE.md`).

Validate gallery mappings and playback with `node --test scripts/test-media.mjs scripts/test-synchronized-videos.mjs`.

The website structure is inspired by the Nerfies academic project page and should retain the attribution required by the source template license.
