# Cloudscape-Inspired AWS-Adjacent Theme Migration

## Status

Implemented as the default theme foundation. This document now serves as the migration record and follow-up guide for future visual cleanup.

## Decision

Move Floci Dashboard to one AWS-adjacent default visual system inspired by Cloudscape Design, implemented with Django templates, CSS, and vanilla JavaScript only.

This is not a direct copy of Cloudscape and does not add React. The goal is to make the app immediately read as a local AWS console and lab environment while keeping the codebase simple and server-rendered.

## Product Goal

The current design is friendly, but Floci Dashboard should visually signal:

- local AWS console,
- resource inventory and inspection,
- practical workflow labs,
- developer operations surface,
- AWS learning and certification-adjacent tooling.

The new theme should feel familiar to AWS users without pretending to be AWS.

Guiding phrase:

```text
Floci clarity, AWS-console ergonomics.
```

## Non-Goals

- Do not adopt React.
- Do not add a frontend build step.
- Do not vendor Cloudscape components.
- Do not create a parallel legacy theme.
- Do not fork every component into `classic` and `console` variants.
- Do not rewrite all templates before the shared CSS foundation is stable.

## Technical Direction

Use a single semantic CSS token layer and one AWS-adjacent set of token values.

Tokens are named CSS variables that describe intent rather than raw colors:

```css
:root {
  --surface-page: #f2f3f3;
  --surface-panel: #ffffff;
  --text-primary: #16191f;
  --text-secondary: #5f6b7a;
  --border-subtle: #d5dbdb;
  --action-primary: #0972d3;
  --action-primary-hover: #033160;
  --focus-ring: #0972d3;
  --radius-control: 2px;
  --radius-panel: 2px;
}
```

Components should use tokens:

```css
.primary-action {
  background: var(--action-primary);
  color: var(--text-on-action);
  border-radius: var(--radius-control);
}
```

The first migration target was maintainability, not theming. Tokens make the new default easier to tune globally.

## Visual Principles

- Prefer dense, scannable operational layouts over decorative dashboards.
- Use white panels on a light gray page surface.
- Use a dark console-style top shell or side navigation where it improves orientation.
- Keep borders crisp and shadows minimal.
- Reduce large rounded cards; Cloudscape-like panels should use small radii.
- Use blue for primary actions and links.
- Use orange/amber for warning and attention states.
- Use red, green, and blue status colors consistently.
- Prefer tables, property grids, tabs, side panels, and split layouts over decorative cards.
- Keep labs readable and instructional, but visually align them with console workflows.

## Files Touched In This Batch

Shared templates:

- `dashboard/templates/dashboard/base.html`
- `dashboard/templates/dashboard/index.html`
- `dashboard/templates/dashboard/service.html`
- `dashboard/templates/dashboard/service_matrix.html`
- `dashboard/templates/dashboard/labs.html`
- `dashboard/templates/dashboard/labs_directory.html`
- `dashboard/templates/dashboard/environment.html`
- `dashboard/templates/dashboard/_status.html`

Global static files:

- `dashboard/static/dashboard/styles.css`
- `dashboard/static/dashboard/dashboard.js`
- `dashboard/static/dashboard/service-console.js`
- `dashboard/static/dashboard/labs.js`

Per-service CSS files:

- `dashboard/static/dashboard/*-console.css`

Per-service JS files needed only small class-name alignment in this batch.

## Migration Phases

## Progress So Far

- Added a semantic token foundation in `styles.css` for AWS-adjacent surfaces, text, borders, actions, status colors, spacing, radius, shadows, and type.
- Shifted the default theme to a single console-like visual language with a dark topbar, light panels, crisp borders, small radii, and denser controls.
- Standardized the primary page navigation across home, environment, labs, service matrix, and service pages: Environment, Labs, Service Matrix, Refresh.
- Added active topbar states for environment, labs, and service matrix pages.
- Introduced `console-theme.css` as a late-loading compatibility layer so existing per-service console CSS inherits the new theme without rewriting every service in one batch.
- Added neutral collection classes for shared service resource panels produced by `dashboard.js` and `service-console.js`.
- Restyled labs as runbook-style panels with left navigation, compact steps, command blocks, artifact details, response states, and completion badges.
- Added responsive topbar and labs behavior so the console layout remains usable on narrow screens.
- Tightened topbar titles across the homepage, service pages, labs, Environment, and Service Matrix.
- Updated the homepage default selected-service count to 24 for first-time users.
- Updated the README screenshot to `flocidashboard.png`.

### Phase 1: Token Foundation

Create a semantic token block at the top of `styles.css`.

Initial token groups:

- surface colors,
- text colors,
- border colors,
- action colors,
- status colors,
- spacing scale,
- typography scale,
- radius scale,
- shadow/elevation scale,
- focus states,
- table density,
- code block colors.

Then replace high-frequency raw values in `styles.css` with tokens.

Success criteria:

- The app still looks close to the current UI after token extraction.
- Color and radius changes can be made from the token block.
- No template behavior changes.

### Phase 2: Shared Console Shell

Restyle the global application frame.

Targets:

- top header,
- homepage navigation actions,
- breadcrumbs,
- page headers,
- section headings,
- shared cards/panels,
- footer if present.

Desired direction:

- More AWS console-like hierarchy.
- Stronger page title and action row.
- Reduced decorative gradients and oversized shapes.
- Clear content width rules.

Success criteria:

- Homepage, service pages, labs, and matrix pages share the same shell language.
- The app reads as a console before any page-specific styling is touched.

### Phase 3: Core Components

Standardize shared component classes.

Targets:

- primary/secondary/danger buttons,
- links,
- input/select/textarea controls,
- labels,
- badges/status indicators,
- tabs,
- tables,
- empty states,
- loading states,
- alerts,
- code blocks,
- property grids,
- modals/drawers if present.

Expected classes to rationalize:

- `.primary-action`
- `.secondary-action`
- `.danger-action`
- `.matrix-table`
- `.section-block`
- `.service-card`
- `.stat-card`
- `.status-*`
- service console button/table/card variants.

Success criteria:

- Most pages use one shared button style.
- Tables share one visual language.
- Status indicators are consistent across services, labs, and workbenches.

### Phase 4: Data Surfaces

Move inventory-heavy screens toward Cloudscape-like collection views.

Targets:

- service matrix,
- service inventory pages,
- resource detail panels,
- tracked resources,
- environment diagnostics,
- tables rendered by `dashboard.js`.

Patterns:

- page header with title, description, and actions,
- collection toolbar with search/filter/refresh controls,
- dense table with clear header row,
- side or lower detail panel,
- property grid for selected resource metadata,
- compact empty/error states.

Success criteria:

- Resource pages feel closer to AWS console inventory pages.
- Users can scan names, ARNs, IDs, statuses, and counts quickly.

### Phase 5: Labs

Restyle labs as AWS workflow runbooks.

Targets:

- `labs.html`,
- `labs_directory.html`,
- `labs.js` output states,
- command cards,
- artifact previews,
- verification results,
- reset affordances.

Patterns:

- left lab navigation as a console side list,
- active lab content as a runbook panel,
- each step as a compact expandable operation row,
- command block styled like AWS CLI documentation,
- verification states using consistent status indicators,
- reset action clearly separated as a destructive operation.

Success criteria:

- Labs keep their teaching clarity.
- Labs feel more like guided AWS console/CLI workflows.
- Run/reset results remain obvious after each action.

### Phase 6: Workbenches

Update one or two representative workbenches first, then repeat.

Recommended pilot workbenches:

- S3 object browser,
- SQS console,
- Lambda invoke workbench,
- EventBridge Pipes workbench.

Patterns:

- split view: collection/list left, detail/action panel right,
- compact toolbars,
- tabbed detail sections,
- property grids,
- small status pills,
- consistent modals and forms.

Success criteria:

- A pilot workbench proves the visual language works for the most interactive pages.
- Shared helper functions in `service-console.js` can be reused rather than duplicating per-service styles.

### Phase 7: Per-Service CSS Cleanup

After shared primitives settle, reduce drift in `*-console.css`.

Approach:

- Replace bespoke button classes with shared button tokens/classes where feasible.
- Replace one-off cards with shared panel styles.
- Keep service-specific layout only where the service genuinely needs it.
- Preserve established service workflows.

Success criteria:

- New service consoles require less custom CSS.
- Existing service CSS becomes smaller and more predictable over time.

### Phase 8: Responsive And Accessibility Pass

Audit the AWS-adjacent theme across viewport sizes and keyboard flows.

Checklist:

- focus rings visible,
- contrast passes for text and status colors,
- controls reachable by keyboard,
- tables readable on narrow screens,
- sidebars collapse sensibly,
- modals/drawers manage focus,
- buttons do not wrap awkwardly,
- no text overlap,
- command/code blocks scroll instead of breaking layout.

Success criteria:

- Desktop console experience is strong.
- Mobile and narrow windows remain usable, even if not as dense.

## JavaScript Scope

Keep vanilla JavaScript.

Good JS enhancements:

- tab activation,
- collapsible panels,
- copy buttons,
- sticky toolbar state,
- row selection,
- drawer open/close behavior,
- local table filtering where already client-rendered,
- status refresh controls,
- preserving expanded state per page.

Avoid:

- client-side routing,
- large client stores,
- framework islands,
- reimplementing server state in the browser.

## Suggested Token Names

Surfaces:

```css
--surface-page
--surface-panel
--surface-panel-alt
--surface-header
--surface-selected
--surface-hover
--surface-code
```

Text:

```css
--text-primary
--text-secondary
--text-muted
--text-inverse
--text-link
--text-link-hover
--text-code
```

Borders:

```css
--border-subtle
--border-strong
--border-control
--border-control-hover
--border-selected
```

Actions:

```css
--action-primary
--action-primary-hover
--action-primary-active
--action-secondary-bg
--action-secondary-hover
--action-danger
--action-danger-hover
--text-on-action
```

Status:

```css
--status-success
--status-success-bg
--status-warning
--status-warning-bg
--status-error
--status-error-bg
--status-info
--status-info-bg
```

Layout:

```css
--space-xxs
--space-xs
--space-sm
--space-md
--space-lg
--space-xl
--space-xxl
--content-max-width
--shell-header-height
```

Shape:

```css
--radius-control
--radius-panel
--radius-pill
--shadow-panel
--shadow-popover
```

Typography:

```css
--font-body
--font-mono
--font-size-xs
--font-size-sm
--font-size-md
--font-size-lg
--font-size-xl
--line-height-body
--line-height-heading
```

## AWS-Adjacent Palette Starting Point

Approximate starting values:

```css
:root {
  --surface-page: #f2f3f3;
  --surface-panel: #ffffff;
  --surface-panel-alt: #fafafa;
  --surface-header: #16191f;
  --surface-hover: #f4f8fb;
  --surface-selected: #f1f8ff;
  --surface-code: #16191f;

  --text-primary: #16191f;
  --text-secondary: #414d5c;
  --text-muted: #687078;
  --text-inverse: #ffffff;
  --text-link: #0972d3;
  --text-link-hover: #033160;
  --text-code: #f2f3f3;

  --border-subtle: #d5dbdb;
  --border-strong: #879596;
  --border-control: #879596;
  --border-control-hover: #5f6b7a;
  --border-selected: #0972d3;

  --action-primary: #0972d3;
  --action-primary-hover: #033160;
  --action-primary-active: #001f3f;
  --action-secondary-bg: #ffffff;
  --action-secondary-hover: #f2f8fd;
  --action-danger: #d13212;
  --action-danger-hover: #7d2105;
  --text-on-action: #ffffff;

  --status-success: #037f0c;
  --status-success-bg: #f2fcf3;
  --status-warning: #8a6d00;
  --status-warning-bg: #fff7d6;
  --status-error: #d13212;
  --status-error-bg: #fff3f1;
  --status-info: #0972d3;
  --status-info-bg: #f1f8ff;

  --radius-control: 2px;
  --radius-panel: 2px;
  --radius-pill: 999px;
}
```

These values should be tuned by screenshots, not treated as final.

## QA Plan

Run automated checks after each migration phase:

```bash
python3 manage.py test dashboard
python3 manage.py check
```

Manual screenshot review pages:

- `/`
- `/labs/`
- `/service/iam/`
- `/service/s3/`
- `/service/lambda/`
- `/service/lambda/labs/`
- `/service/sqs/`
- `/service/eventbridge/`
- `/service/pipes/`
- `/matrix/`
- `/environment/`

Viewport checks:

- desktop wide,
- laptop,
- tablet-ish width,
- narrow mobile.

Visual risks to watch:

- text overlap in cards/buttons,
- tables overflowing without scroll,
- code blocks breaking panels,
- low contrast status colors,
- excessive density in labs,
- per-service CSS fighting global tokens,
- old gradients or rounded cards making the theme inconsistent.

## Implemented First Batch

The contained foundation batch:

1. Add the token block to `styles.css`.
2. Convert global body, header, links, panels, tables, buttons, badges, breadcrumbs, and code blocks to tokens.
3. Shift the global palette to AWS-adjacent values.
4. Lightly update `base.html` only if needed for shell semantics.
5. Avoid per-service CSS changes unless something visually breaks.
6. Run tests and screenshot-check the core pages.

This first batch should make the app visibly more AWS-adjacent without trying to perfect every workbench.

## Open Questions

- Should the top shell be dark across every page, or only navigation/header?
- Should the homepage remain slightly more welcoming, or become fully console-dense?
- Should service cards become table rows or stay as compact cards with AWS-like styling?
- Should labs use expandable steps by default, or keep every step visible?
- Should command output stay inline, or move toward a split output panel?

## Success Definition

The migration is successful when a new user can glance at Floci Dashboard and immediately understand it as:

```text
An AWS-adjacent local cloud console with guided workflow labs.
```

The implementation should remain:

- Django-rendered,
- CSS and vanilla JS only,
- easy to test,
- easy to extend per service,
- visually coherent across inventory pages, labs, and workbenches.
