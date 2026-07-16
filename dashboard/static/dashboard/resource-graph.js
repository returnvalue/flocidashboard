(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function svg(name, attrs = {}) {
    const node = document.createElementNS(SVG_NS, name);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  }

  function short(value, limit = 26) {
    const text = String(value || '');
    return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
  }

  function wrapLabel(value, limit = 28) {
    const text = String(value || '');
    if (text.length <= limit) return [text];
    const candidates = [' ', '/', '-'];
    let splitAt = -1;
    candidates.forEach((separator) => {
      const found = text.lastIndexOf(separator, limit);
      if (found >= Math.floor(limit * 0.55)) splitAt = Math.max(splitAt, found + 1);
    });
    if (splitAt < 1) splitAt = limit;
    const first = text.slice(0, splitAt).trim();
    const second = text.slice(splitAt).trim();
    return [first, short(second, limit)];
  }

  function layout(graph) {
    const width = 242;
    const height = 96;
    const columnGap = 298;
    const rowGap = 132;
    const padding = 44;
    const layers = graph.layers || [];
    const positions = new Map();
    let maxRows = 1;
    layers.forEach((layer, column) => {
      const nodes = graph.nodes.filter((node) => node.layer === layer);
      maxRows = Math.max(maxRows, nodes.length);
      nodes.forEach((node, row) => {
        positions.set(node.id, { x: padding + column * columnGap, y: padding + row * rowGap, width, height });
      });
    });
    return { positions, width: padding * 2 + Math.max(1, layers.length) * columnGap, height: padding * 2 + maxRows * rowGap };
  }

  function renderEvidence(panel, item, type) {
    panel.textContent = '';
    const title = document.createElement('h4');
    title.textContent = type === 'node' ? item.name : item.relation;
    const meta = document.createElement('p');
    meta.className = 'resource-graph-evidence-meta';
    meta.textContent = type === 'node' ? `${item.service} · ${item.kind} · ${item.state}` : `${item.source} → ${item.target} · ${item.status}`;
    panel.append(title, meta);
    if (type === 'edge') {
      const label = document.createElement('strong');
      label.textContent = item.evidence?.label || 'Evidence';
      const value = document.createElement('pre');
      value.textContent = typeof item.evidence?.value === 'string' ? item.evidence.value : JSON.stringify(item.evidence?.value, null, 2);
      panel.append(label, value);
      if (item.detail) {
        const detail = document.createElement('p');
        detail.textContent = item.detail;
        panel.append(detail);
      }
    } else if (item.href) {
      const link = document.createElement('a');
      link.href = item.href;
      link.textContent = 'Open resource workbench';
      panel.append(link);
    }
  }

  function render(container, graph) {
    container.textContent = '';
    const summary = document.createElement('div');
    summary.className = 'resource-graph-summary';
    ['healthy', 'disabled', 'broken', 'unverified', 'unsupported'].forEach((status) => {
      const count = graph.summary?.[status] || 0;
      const badge = document.createElement('span');
      badge.className = `resource-graph-status resource-graph-status-${status}`;
      badge.textContent = `${count} ${status}`;
      summary.append(badge);
    });

    const viewport = document.createElement('div');
    viewport.className = 'resource-graph-viewport';
    const computed = layout(graph);
    const diagram = svg('svg', { viewBox: `0 0 ${computed.width} ${computed.height}`, role: 'img', 'aria-labelledby': 'resource-graph-svg-title resource-graph-svg-description' });
    const title = svg('title', { id: 'resource-graph-svg-title' });
    title.textContent = graph.title;
    const description = svg('desc', { id: 'resource-graph-svg-description' });
    description.textContent = graph.description;
    const defs = svg('defs');
    const marker = svg('marker', { id: 'resource-graph-arrow', markerWidth: 8, markerHeight: 8, refX: 7, refY: 4, orient: 'auto' });
    marker.append(svg('path', { d: 'M0,0 L8,4 L0,8 z' }));
    defs.append(marker);
    diagram.append(title, description, defs);

    const evidence = document.createElement('aside');
    evidence.className = 'resource-graph-evidence';
    evidence.setAttribute('aria-live', 'polite');
    evidence.innerHTML = '<h4>Relationship evidence</h4><p>Select a node or arrow to inspect why the relationship exists.</p>';

    graph.edges.forEach((edge) => {
      const source = computed.positions.get(edge.source);
      const target = computed.positions.get(edge.target);
      if (!source || !target) return;
      const x1 = source.x + source.width;
      const y1 = source.y + source.height / 2;
      const x2 = target.x;
      const y2 = target.y + target.height / 2;
      const control = Math.max(42, (x2 - x1) / 2);
      const group = svg('g', { class: `resource-graph-edge resource-graph-edge-${edge.status}`, tabindex: 0, role: 'button', 'aria-label': `${edge.relation}: ${edge.source} to ${edge.target}, ${edge.status}` });
      const path = svg('path', { d: `M ${x1} ${y1} C ${x1 + control} ${y1}, ${x2 - control} ${y2}, ${x2} ${y2}`, 'marker-end': 'url(#resource-graph-arrow)' });
      const hit = svg('path', { d: path.getAttribute('d'), class: 'resource-graph-edge-hit' });
      const label = svg('text', { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 7, 'text-anchor': 'middle' });
      label.textContent = short(edge.relation, 24);
      group.append(hit, path, label);
      const select = () => renderEvidence(evidence, edge, 'edge');
      group.addEventListener('click', select);
      group.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } });
      diagram.append(group);
    });

    graph.nodes.forEach((node) => {
      const position = computed.positions.get(node.id);
      if (!position) return;
      const group = svg('g', { class: `resource-graph-node resource-graph-node-${node.status}`, transform: `translate(${position.x} ${position.y})`, tabindex: 0, role: 'link', 'aria-label': `${node.service} ${node.kind}: ${node.name}, ${node.status}` });
      group.append(svg('rect', { width: position.width, height: position.height, rx: 7 }));
      const service = svg('text', { x: 14, y: 22, class: 'resource-graph-node-service' });
      service.textContent = `${node.service} · ${node.kind}`;
      const name = svg('text', { x: 14, y: 47, class: 'resource-graph-node-name' });
      wrapLabel(node.name).forEach((line, index) => {
        const span = svg('tspan', { x: 14, dy: index === 0 ? 0 : 19 });
        span.textContent = line;
        name.append(span);
      });
      const state = svg('text', { x: 14, y: 86, class: 'resource-graph-node-state' });
      state.textContent = node.state;
      group.append(service, name, state);
      const select = () => renderEvidence(evidence, node, 'node');
      group.addEventListener('click', () => { select(); if (node.href) window.location.href = node.href; });
      group.addEventListener('focus', select);
      group.addEventListener('keydown', (event) => { if (event.key === 'Enter' && node.href) window.location.href = node.href; });
      diagram.append(group);
    });
    viewport.append(diagram);
    container.append(summary, viewport, evidence);
  }

  async function load(root) {
    root.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(root.dataset.graphEndpoint);
      const graph = await response.json();
      if (!response.ok || graph.error) throw new Error(graph.error || 'Unable to load resource graph');
      render(root, graph);
    } catch (error) {
      root.innerHTML = `<div class="resource-graph-error" role="alert"></div>`;
      root.querySelector('.resource-graph-error').textContent = error.message;
    } finally {
      root.setAttribute('aria-busy', 'false');
    }
  }

  document.querySelectorAll('[data-resource-graph]').forEach((root) => load(root));
  document.addEventListener('floci:lab-changed', () => document.querySelectorAll('[data-resource-graph]').forEach((root) => load(root)));
  window.ResourceGraph = { render, load };
})();
