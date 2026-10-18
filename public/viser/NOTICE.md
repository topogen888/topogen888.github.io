# Viser static viewer

This folder vendors the unmodified static client from **Viser 1.0.24**, matching
the version stored in the supplied `.viser` recordings.

- Project: https://github.com/viser-project/viser
- Documentation: https://viser.studio/
- Distribution: official `viser-1.0.24-py3-none-any.whl` from PyPI
- Wheel SHA-256: `df91331b6c20c8fb39367faaa8eb2707cb3a403cb8b6f18396683798aa68ccba`
- Client source entry: `viser/client/build/index.html`
- License: Apache-2.0; full text retained in `LICENSE`

The site uses `playbackPath` and initial-camera URL parameters documented by
Viser. The supplied scene recordings contain PointCloudMessage data, not
GaussianSplatsMessage data. Source recordings are preserved unchanged.
