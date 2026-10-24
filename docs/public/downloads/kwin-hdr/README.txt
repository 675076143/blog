KWin 6.8.1 HDR screencast source adaptation — 2026-10-25

Base: https://github.com/KDE/kwin/tree/v6.8.1
Upstream HDR changes: https://invent.kde.org/plasma/kwin/-/merge_requests/8293
DRM/SPA mapping reference:
https://github.com/emersion/xdg-desktop-portal-wlr/blob/master/src/screencast/screencast_common.c

Original file copyright and SPDX notices remain in the upstream sources.
License texts are included in LICENSES. This is source only, not a universal binary.

Requirements: exact installed KWin 6.8.1 development files, Qt6 development files,
ECM, KF6 I18n/CoreAddons, Libdrm, Vulkan headers, PipeWire >=1.6, CMake/Ninja.
Apply the patch to an unmodified official v6.8.1 source tree:

  patch -d /path/to/kwin-6.8.1 -p1 < kwin-6.8.1-hdr.patch
  cmake -S . -B build -G Ninja -DKWIN_SOURCE_DIR=/path/to/kwin-6.8.1
  cmake --build build

Output: build/lib/kwin/plugins/screencast-hdr-dynamic.so
It is disabled by default. Do not load it alongside the original screencast plugin.
Installation/loading needs your own session integration and a tested rollback plan.
Do not restart a live Wayland compositor to test it; use a nested session first.
Rebuild and validate after KWin upgrades. Do not bypass version checks.

Changes include 10-bit color negotiation, matching opaque SPA formats, retaining
HDR formats after SDR negotiation and updating buffers on format changes.
Validation on the author's host: SDR -> HDR actual DMA-BUF frame, followed by
Steam RGB10/PQ -> P010 HEVC Main10 -> Deck HDR10, 1280x800 about 90 FPS.
This does not guarantee identical results on other systems.
