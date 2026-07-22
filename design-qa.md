# Design QA

**Source visual truth**

- Full view: `/var/folders/p_/wzf0jt6n5kx_8td0rcr1l78r0000gq/T/codex-clipboard-60332e9a-f7be-42a3-869a-7b90c1ea4b3d.png`
- Focused comparison: `/private/tmp/openprototype-review-buttons-source-focus.png`
- Source pixels: 4096 × 2060; interpreted as a 2048 × 1030 CSS-pixel capture at 2× density.

**Implementation evidence**

- Full view: `/private/tmp/openprototype-review-buttons-implementation-selected.png`
- Focused comparison: `/private/tmp/openprototype-review-buttons-implementation-selected-focus.png`
- Browser viewport: 2048 × 1024 CSS px, devicePixelRatio 1.
- Browser screenshot pixels: 1532 × 1024 due to in-app-browser capture normalization.
- Focused comparison normalization: source top-left 600 × 600 px was downsampled to 300 × 300 px; implementation top-left 300 × 300 px was compared at native size.
- State: `customer_list.html` selected; PRD and HTML both unreviewed.

**Full-view comparison evidence**

- The surrounding navigation, preview, and Agent layout remains unchanged by this scoped edit.
- The two review controls retain their existing size, spacing, border, color, and selected-row treatment.

**Focused comparison evidence**

- The selected row shows the same two compact review controls in the same position.
- DOM order is now `md` / “PRD 未审核” first and `html` / “HTML 未审核” second.
- Focused evidence was required because the native title tooltip is too small to judge reliably in the full-view capture.

**Findings**

- No actionable P0/P1/P2 mismatches remain.
- Fonts and typography: unchanged from the existing shell; no new text styling was introduced.
- Spacing and layout rhythm: unchanged; only control order changed.
- Colors and visual tokens: unchanged.
- Image quality and asset fidelity: no image or icon assets were added or replaced.
- Copy and content: the left control is labeled PRD and the right control HTML in `title`, `aria-label`, and refreshed state text.

**Interaction verification**

- Clicking the left control changed only `md` to “PRD 已审核”; HTML remained unreviewed.
- Clicking the right control changed only `html` to “HTML 已审核”; PRD remained unreviewed.
- Both controls were returned to their original unreviewed state after testing.
- Selecting `customer_list.html` still loaded the page normally.
- Browser console: no errors or warnings.

**Comparison history**

- Earlier finding: the left control represented HTML while the right control represented the PRD/MD state.
- Fix: render the PRD (`md`) control first, render HTML second, and use “PRD” consistently when refreshing the button state.
- Post-fix evidence: implementation screenshot above plus verified DOM order and independent toggle behavior.

**Implementation checklist**

- [x] PRD review is left.
- [x] HTML review is right.
- [x] Tooltip and accessible labels match the new order.
- [x] Independent review state behavior passes.
- [x] Repository changed-file checks pass.

**Follow-up polish**

- None required for this scoped correction.

final result: passed
