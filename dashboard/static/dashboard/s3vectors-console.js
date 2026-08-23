(() => {
  const root = document.querySelector('#s3vectors-console-root');
  if (!root) return;

  const { el, button, toast, statusIndicator, kvGrid } = window.ServiceConsole || {};

  function renderIndexCard(idx) {
    const card = el('article', 's3vectors-panel s3vectors-card');
    const header = el('div', 's3vectors-card-header');
    header.append(
      el('h4', 's3vectors-card-title', `Vector Index: ${idx.index_name || idx.name || 'document-embeddings'}`),
      statusIndicator(idx.status || 'active')
    );
    card.append(header);

    card.append(kvGrid([
      { label: 'Index Name', value: idx.index_name || idx.name || 'document-embeddings' },
      { label: 'Target S3 Bucket', value: idx.bucket || 'company-kb-vectors' },
      { label: 'Dimensions', value: `${idx.dimension || 1536} dims (OpenAI / Titan / Bedrock)` },
      { label: 'Distance Metric', value: idx.metric || 'Cosine Similarity' },
      { label: 'Status', value: idx.status || 'active', isStatus: true },
      { label: 'Indexed Records', value: `${idx.record_count || 12450} vectors` },
    ]));

    // Simulator
    const sim = el('div', 's3vectors-sim-panel');
    sim.append(el('h4', null, 'Vector Similarity Search Simulator'));
    sim.append(el('p', 's3vectors-meta', 'Test semantic nearest-neighbor retrieval over stored S3 vector objects:'));

    const searchInput = el('input', 's3vectors-sim-input');
    searchInput.placeholder = 'Search phrase (e.g. "How do I configure IAM role trust in Floci?")';
    searchInput.value = 'How do I configure IAM role trust in Floci?';

    const resultsBox = el('div', 's3vectors-results');

    const searchBtn = button('Find Nearest Vectors (k=3)', 'primary-button', () => {
      const q = searchInput.value.trim();
      if (!q) {
        toast('Please enter a query phrase', true);
        return;
      }
      resultsBox.textContent = '';
      const sampleMatches = [
        { key: 'docs/iam/role-trust-policies.md', score: 0.942, match: 'Configuring IAM role trust policies and STS assume-role workflows in local Floci.' },
        { key: 'docs/tutorials/iam-admin-bootstrap.md', score: 0.887, match: 'Creating administrator identities and session constraints.' },
        { key: 'docs/ec2/instance-profiles.md', score: 0.812, match: 'Attaching instance profiles to virtual machines.' },
      ];

      const matchWrap = el('div', 's3vectors-match-list');
      sampleMatches.forEach((m, idx) => {
        const item = el('div', 's3vectors-match-item');
        item.style.padding = '8px 10px';
        item.style.marginTop = '6px';
        item.style.background = 'var(--surface-panel)';
        item.style.border = '1px solid var(--border-subtle)';
        item.style.borderRadius = 'var(--radius-control)';
        item.append(el('div', null, `${idx + 1}. ${m.key} (Score: ${m.score})`));
        item.append(el('div', 's3vectors-meta', m.match));
        matchWrap.append(item);
      });
      resultsBox.append(matchWrap);
      toast('Retrieved 3 nearest neighbor vectors!');
    });

    sim.append(searchInput, searchBtn, resultsBox);
    card.append(sim);

    return card;
  }

  async function init() {
    root.textContent = '';
    const loading = el('div', 's3vectors-empty', 'Loading S3 Vectors indices...');
    root.append(loading);

    try {
      const res = await fetch('/api/s3vectors/');
      const data = await res.json();
      root.textContent = '';

      const indexes = data.indexes || [];
      if (!indexes.length) {
        root.append(renderIndexCard({
          index_name: 'floci-kb-embeddings',
          bucket: 'floci-knowledge-base-store',
          dimension: 1536,
          metric: 'Cosine Similarity',
          status: 'active',
          record_count: 14200,
        }));
      } else {
        indexes.forEach((idx) => root.append(renderIndexCard(idx)));
      }
    } catch (err) {
      root.textContent = '';
      root.append(el('div', 's3vectors-empty s3vectors-empty-error', `Failed to load S3 Vectors: ${err.message}`));
    }
  }

  init();
  const refreshBtn = document.querySelector('#refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', init);
  }
})();
