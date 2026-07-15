/* global ServiceConsole */

const ECRConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('ecr-console-root');
  const breadcrumbsEl = document.getElementById('ecr-breadcrumbs');
  const summaryEl = document.getElementById('ecr-summary');
  const loadedAtEl = document.getElementById('ecr-loaded-at');

  const state = {
    inventory: null,
    selectedRepositoryName: '',
    selectedImageId: '',
    activeView: 'overview',
    resourceQuery: '',
    lastResult: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'ecr',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'ecr');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'ecr',
      toast,
    });

  function repositories() {
    return state.inventory?.repositories || [];
  }

  function repoName(repo) {
    return repo?.name || repo?.repositoryName || '';
  }

  function selectedRepository() {
    return repositories().find((repo) => repoName(repo) === state.selectedRepositoryName) || repositories()[0] || null;
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'ecr',
      targets: {
        repositories: 'Repositories',
        images: 'Repositories',
        tagged_images: 'Repositories',
        auth_endpoints: 'Auth proxy endpoints',
        storage_bytes: 'Image bytes',
      },
    });
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    const home = btn('ECR', null, () => {
      state.selectedRepositoryName = repositories()[0] ? repoName(repositories()[0]) : '';
      render();
    });
    breadcrumbsEl.append(home);
    const repo = selectedRepository();
    if (repo) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, repoName(repo)));
    }
  }

  function parseJson(value, fallback, label) {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      return fallback;
    }
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      throw new Error(`${label} must be valid JSON`);
    }
  }

  function parseList(value) {
    return String(value || '')
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function matchesQuery(...values) {
    const query = state.resourceQuery.trim().toLowerCase();
    return !query || values.some((value) => JSON.stringify(value ?? '').toLowerCase().includes(query));
  }

  function policyDocument(policy, key) {
    const value = policy?.[key];
    if (!value) return {};
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch (error) { return value; }
  }

  function imageIdentity(image) {
    return image.imageDigest || image.imageTag || image.imageTags?.[0] || '';
  }

  function option(select, value, label, selected = false) {
    const node = document.createElement('option');
    node.value = value || '';
    node.textContent = label || value || '';
    node.selected = selected;
    select.append(node);
  }

  function copyText(value, label) {
    navigator.clipboard?.writeText(value).then(
      () => toast(`${label} copied`),
      () => toast(`${label}: ${value}`),
    );
  }

  function showCreateRepositoryModal() {
    const form = el('div', 'ecr-modal-form');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'floci-it/app';
    const mutabilityInput = document.createElement('select');
    ['MUTABLE', 'IMMUTABLE'].forEach((value) => option(mutabilityInput, value, value));
    const tagsInput = document.createElement('textarea');
    tagsInput.placeholder = '[{"Key":"env","Value":"local"}]';
    form.append(
      el('label', null, 'Repository name'),
      nameInput,
      el('label', null, 'Image tag mutability'),
      mutabilityInput,
      el('label', null, 'Tags JSON'),
      tagsInput,
    );
    openModal('Create repository', form, 'Create', async (close) => {
      const data = await apiJson('/api/ecr/repositories/', {
        method: 'POST',
        body: JSON.stringify({
          name: nameInput.value.trim(),
          image_tag_mutability: mutabilityInput.value,
          tags: parseJson(tagsInput.value, [], 'Tags'),
        }),
      });
      state.selectedRepositoryName = data.name || nameInput.value.trim();
      state.lastResult = data;
      close();
      toast('Repository created');
      await refresh();
    });
  }

  async function getAuthToken() {
    const data = await apiJson('/api/ecr/auth-token/', { method: 'POST' });
    state.lastResult = data;
    toast('Authorization token loaded');
    render();
  }

  async function runGarbageCollection() {
    if (!window.confirm('Run ECR registry garbage collection?')) {
      return;
    }
    const data = await apiJson('/api/ecr/garbage-collection/', { method: 'POST' });
    state.lastResult = data;
    toast('Garbage collection completed');
    render();
  }

  async function deleteRepository(repo) {
    if (!window.confirm('Delete this repository and its images?')) {
      return;
    }
    const data = await apiJson('/api/ecr/repositories/delete/', {
      method: 'POST',
      body: JSON.stringify({ repository_name: repoName(repo), force: true }),
    });
    state.lastResult = data;
    state.selectedRepositoryName = '';
    toast('Repository deleted');
    await refresh();
  }

  function showDeleteImagesModal(repo) {
    const form = el('div', 'ecr-modal-form');
    const imagesInput = document.createElement('textarea');
    imagesInput.placeholder = 'v1\nsha256:...';
    form.append(el('label', null, 'Image tags or digests'), imagesInput);
    openModal('Delete images', form, 'Delete', async (close) => {
      const data = await apiJson('/api/ecr/images/delete/', {
        method: 'POST',
        body: JSON.stringify({
          repository_name: repoName(repo),
          image_ids: parseList(imagesInput.value),
        }),
      });
      state.lastResult = data;
      close();
      toast('Images deleted');
      await refresh();
    });
  }

  async function deleteImage(repo, image) {
    const imageId = image.imageDigest || image.imageTags?.[0] || image.imageTag;
    if (!imageId || !window.confirm(`Delete image ${imageId}?`)) return;
    const data = await apiJson('/api/ecr/images/delete/', { method: 'POST', body: JSON.stringify({ repository_name: repoName(repo), image_ids: [imageId] }) });
    state.lastResult = data; state.selectedImageId = ''; toast('Image deleted'); await refresh();
  }

  async function loadImageManifest(repo, image) {
    const imageId = image.imageDigest || image.imageTags?.[0] || image.imageTag;
    const data = await apiJson('/api/ecr/images/get/', {
      method: 'POST',
      body: JSON.stringify({ repository_name: repoName(repo), image_ids: [imageId], accepted_media_types: [image.imageManifestMediaType].filter(Boolean) }),
    });
    state.lastResult = data; toast('Image manifest loaded'); render();
  }

  function showMutabilityModal(repo) {
    const form = el('div', 'ecr-modal-form');
    const mutabilityInput = document.createElement('select');
    ['MUTABLE', 'IMMUTABLE'].forEach((value) => option(
      mutabilityInput,
      value,
      value,
      value === repo.tag_mutability,
    ));
    form.append(el('label', null, 'Image tag mutability'), mutabilityInput);
    openModal('Set tag mutability', form, 'Save', async (close) => {
      const data = await apiJson('/api/ecr/tag-mutability/', {
        method: 'POST',
        body: JSON.stringify({
          repository_name: repoName(repo),
          image_tag_mutability: mutabilityInput.value,
        }),
      });
      state.lastResult = data;
      close();
      toast('Tag mutability updated');
      await refresh();
    });
  }

  function showLifecyclePolicyModal(repo) {
    const form = el('div', 'ecr-modal-form');
    const policyInput = document.createElement('textarea');
    const existing = policyDocument(repo.lifecycle_policy, 'lifecyclePolicyText');
    policyInput.value = JSON.stringify(Object.keys(existing || {}).length ? existing : {
      rules: [{
        rulePriority: 1,
        description: 'Keep recent tagged images',
        selection: {
          tagStatus: 'tagged',
          tagPrefixList: ['v'],
          countType: 'imageCountMoreThan',
          countNumber: 10,
        },
        action: { type: 'expire' },
      }],
    }, null, 2);
    form.append(
      el('label', null, 'Lifecycle policy JSON'),
      policyInput,
      btn('Delete policy', 'ecr-btn-danger', async () => {
        try {
          const data = await apiJson('/api/ecr/lifecycle-policy/', {
            method: 'DELETE',
            body: JSON.stringify({ repository_name: repoName(repo) }),
          });
          state.lastResult = data;
          toast('Lifecycle policy deleted');
          await refresh();
        } catch (error) {
          toast(error.message, true);
        }
      }),
    );
    openModal('Lifecycle policy', form, 'Save', async (close) => {
      const data = await apiJson('/api/ecr/lifecycle-policy/', {
        method: 'POST',
        body: JSON.stringify({
          repository_name: repoName(repo),
          lifecycle_policy_text: parseJson(policyInput.value, {}, 'Lifecycle policy'),
        }),
      });
      state.lastResult = data;
      close();
      toast('Lifecycle policy saved');
      await refresh();
    });
  }

  function showRepositoryPolicyModal(repo) {
    const form = el('div', 'ecr-modal-form');
    const policyInput = document.createElement('textarea');
    const existing = policyDocument(repo.repository_policy, 'policyText');
    policyInput.value = JSON.stringify(Object.keys(existing || {}).length ? existing : {
      Version: '2012-10-17',
      Statement: [],
    }, null, 2);
    form.append(
      el('label', null, 'Repository policy JSON'),
      policyInput,
      btn('Delete policy', 'ecr-btn-danger', async () => {
        try {
          const data = await apiJson('/api/ecr/repository-policy/', {
            method: 'DELETE',
            body: JSON.stringify({ repository_name: repoName(repo) }),
          });
          state.lastResult = data;
          toast('Repository policy deleted');
          await refresh();
        } catch (error) {
          toast(error.message, true);
        }
      }),
    );
    openModal('Repository policy', form, 'Save', async (close) => {
      const data = await apiJson('/api/ecr/repository-policy/', {
        method: 'POST',
        body: JSON.stringify({
          repository_name: repoName(repo),
          policy_text: parseJson(policyInput.value, {}, 'Repository policy'),
          force: true,
        }),
      });
      state.lastResult = data;
      close();
      toast('Repository policy saved');
      await refresh();
    });
  }

  function showTagsModal(repo) {
    const form = el('div', 'ecr-modal-form');
    const arnInput = document.createElement('input');
    arnInput.value = repo.arn || '';
    const tagsInput = document.createElement('textarea');
    tagsInput.placeholder = '[{"Key":"env","Value":"local"}]';
    const keysInput = document.createElement('input');
    keysInput.placeholder = 'env,owner';
    form.append(
      el('label', null, 'Resource ARN'),
      arnInput,
      el('label', null, 'Add tags JSON'),
      tagsInput,
      btn('Add tags', null, async () => {
        try {
          await apiJson('/api/ecr/tags/', {
            method: 'POST',
            body: JSON.stringify({
              resource_arn: arnInput.value.trim(),
              tags: parseJson(tagsInput.value, [], 'Tags'),
            }),
          });
          toast('Tags added');
          await refresh();
        } catch (error) {
          toast(error.message, true);
        }
      }),
      el('label', null, 'Remove tag keys'),
      keysInput,
      btn('Remove tags', 'ecr-btn-secondary', async () => {
        try {
          await apiJson('/api/ecr/tags/', {
            method: 'DELETE',
            body: JSON.stringify({
              resource_arn: arnInput.value.trim(),
              tag_keys: parseList(keysInput.value),
            }),
          });
          toast('Tags removed');
          await refresh();
        } catch (error) {
          toast(error.message, true);
        }
      }),
    );
    openModal('Repository tags', form, 'Done', (close) => close());
  }

  function renderRepositoryList() {
    const panel = el('section', 'ecr-panel');
    panel.append(el('div', 'ecr-panel-heading', 'Repositories'));
    const list = el('div', 'ecr-repo-list');
    const visibleRepositories = repositories().filter((repo) => matchesQuery(repoName(repo), repo.arn, repo.uri, repo.tags));
    if (!visibleRepositories.length) {
      list.append(el('div', 'ecr-empty', 'No ECR repositories found.'));
    } else {
      visibleRepositories.forEach((repo) => {
        const active = repoName(repo) === repoName(selectedRepository());
        const row = el('button', `ecr-repo-row${active ? ' ecr-repo-row-active' : ''}`);
        row.append(
          el('span', 'ecr-repo-name', repoName(repo)),
          el('span', 'ecr-repo-meta', `${repo.tag_mutability || 'MUTABLE'} / ${repo.image_count || 0} images`),
        );
        row.addEventListener('click', () => {
          state.selectedRepositoryName = repoName(repo);
          render();
        });
        list.append(row);
      });
    }
    panel.append(list);
    return panel;
  }

  function renderRepositoryDetail(repo) {
    const panel = el('section', 'ecr-panel');
    panel.append(el('div', 'ecr-panel-heading', 'Selected repository'));
    const body = el('div', 'ecr-detail');
    const facts = el('dl', 'ecr-facts');
    consoleUi.addField(facts, 'Repository', repoName(repo));
    consoleUi.addField(facts, 'ARN', repo.arn);
    consoleUi.addField(facts, 'URI', repo.uri);
    consoleUi.addField(facts, 'Registry ID', repo.registry_id);
    consoleUi.addField(facts, 'Tag mutability', repo.tag_mutability);
    consoleUi.addField(facts, 'Image count', repo.image_count);
    consoleUi.addField(facts, 'Created', consoleUi.formatDate(repo.created));
    consoleUi.addField(facts, 'Encryption', repo.encryption_configuration);
    consoleUi.addField(facts, 'Tags', repo.tags);
    body.append(facts);
    const actions = el('div', 'ecr-action-row');
    actions.append(
      btn('Delete images', null, () => showDeleteImagesModal(repo)),
      btn('Mutability', 'ecr-btn-secondary', () => showMutabilityModal(repo)),
      btn('Lifecycle policy', 'ecr-btn-secondary', () => showLifecyclePolicyModal(repo)),
      btn('Repository policy', 'ecr-btn-secondary', () => showRepositoryPolicyModal(repo)),
      btn('Tags', 'ecr-btn-secondary', () => showTagsModal(repo)),
      btn('Delete repository', 'ecr-btn-danger', () => deleteRepository(repo).catch((error) => toast(error.message, true))),
    );
    body.append(actions);
    panel.append(body);
    return panel;
  }

  function renderImagesPanel(repo) {
    const panel = el('section', 'ecr-panel');
    panel.append(el('div', 'ecr-panel-heading', `Images (${repo.image_count || 0})`));
    const body = el('div', 'ecr-resource-layout');
    const list = el('div', 'ecr-resource-list');
    const detail = el('div', 'ecr-resource-detail');
    const images = (repo.image_details || repo.images || []).filter((image) => matchesQuery(image.imageDigest, image.imageTag, image.imageTags, image.imageManifestMediaType));
    images.forEach((image) => {
      const tags = image.imageTags || [image.imageTag].filter(Boolean);
      const identity = imageIdentity(image);
      list.append(btn(tags?.length ? tags.join(', ') : identity, identity === (state.selectedImageId || imageIdentity(images[0])) ? 'ecr-btn-active' : 'ecr-btn-secondary', () => { state.selectedImageId = identity; render(); }));
    });
    const image = images.find((item) => imageIdentity(item) === state.selectedImageId) || images[0];
    if (image) {
      const card = el('article', 'ecr-card');
      const tags = image.imageTags || [image.imageTag].filter(Boolean);
      card.append(el('h3', null, tags?.length ? tags.join(', ') : image.imageDigest || 'Image'));
      const facts = el('dl', 'ecr-facts');
      consoleUi.addField(facts, 'Digest', image.imageDigest);
      consoleUi.addField(facts, 'Tags', tags);
      consoleUi.addField(facts, 'Size bytes', image.imageSizeInBytes);
      consoleUi.addField(facts, 'Pushed at', consoleUi.formatDate(image.imagePushedAt));
      consoleUi.addField(facts, 'Manifest media type', image.imageManifestMediaType);
      consoleUi.addField(facts, 'Artifact media type', image.artifactMediaType);
      consoleUi.addField(facts, 'Last pull', consoleUi.formatDate(image.lastRecordedPullTime));
      const actions = el('div', 'ecr-action-row');
      actions.append(btn('View manifest', null, () => loadImageManifest(repo, image).catch((error) => toast(error.message, true))), btn('Copy pull command', 'ecr-btn-secondary', () => copyText(`docker pull ${repo.uri}:${tags?.[0] || image.imageDigest}`, 'Pull command')), btn('Delete image', 'ecr-btn-danger', () => deleteImage(repo, image).catch((error) => toast(error.message, true))));
      card.append(facts, actions);
      detail.append(card);
    }
    if (!images.length) {
      detail.append(el('p', 'ecr-empty', 'No images match the current filter.'));
    }
    body.append(list, detail);
    panel.append(body);
    return panel;
  }

  function renderPoliciesPanel(repo) {
    const panel = el('section', 'ecr-panel');
    panel.append(el('div', 'ecr-panel-heading', 'Stored policies'));
    const body = el('div', 'ecr-card-list');
    [['Lifecycle policy', repo.lifecycle_policy, () => showLifecyclePolicyModal(repo)], ['Repository policy', repo.repository_policy, () => showRepositoryPolicyModal(repo)]].forEach(([label, policy, edit]) => {
      const card = el('article', 'ecr-card');
      card.append(el('h3', null, label), el('pre', 'ecr-command', JSON.stringify(consoleUi.displayValue(policy || {}), null, 2)), btn(`Edit ${label.toLowerCase()}`, 'ecr-btn-secondary', edit));
      body.append(card);
    });
    body.append(el('p', 'ecr-empty', 'Floci stores and returns these policies but does not enforce repository permissions or lifecycle expiration.'));
    panel.append(body); return panel;
  }

  function renderPushPullPanel(repo) {
    const panel = el('section', 'ecr-panel');
    panel.append(el('div', 'ecr-panel-heading', 'Push and pull with Docker'));
    const body = el('div', 'ecr-detail');
    const commands = [`aws ecr get-login-password --endpoint-url http://localhost:4566 | docker login --username AWS --password-stdin ${String(repo.uri || '').split('/')[0]}`, 'docker pull alpine:3.19', `docker tag alpine:3.19 ${repo.uri}:v1`, `docker push ${repo.uri}:v1`, `docker pull ${repo.uri}:v1`];
    commands.forEach((command) => {
      const row = el('div', 'ecr-command-row');
      row.append(el('code', null, command), btn('Copy', 'ecr-btn-secondary', () => copyText(command, 'Command')));
      body.append(row);
    });
    body.append(el('p', 'ecr-empty', 'The repository URI points to Floci’s real local OCI registry. EKS clusters created by Floci receive the corresponding containerd mirror automatically.'));
    panel.append(body); return panel;
  }

  function renderResourceTabs() {
    const tabs = el('div', 'ecr-resource-tabs');
    const navigation = el('div', 'ecr-resource-tab-buttons');
    [['overview', 'Overview'], ['images', 'Images'], ['policies', 'Policies'], ['pushpull', 'Push / pull']].forEach(([key, label]) => navigation.append(btn(label, state.activeView === key ? 'ecr-btn-active' : 'ecr-btn-secondary', () => { state.activeView = key; render(); })));
    const search = document.createElement('input');
    search.type = 'search'; search.placeholder = 'Filter repositories or images'; search.value = state.resourceQuery; search.setAttribute('aria-label', 'Filter ECR resources');
    search.addEventListener('input', () => { state.resourceQuery = search.value; });
    search.addEventListener('change', render);
    search.addEventListener('keydown', (event) => { if (event.key === 'Enter') render(); });
    tabs.append(navigation, search); return tabs;
  }

  function renderResult() {
    if (!state.lastResult) {
      return null;
    }
    const panel = el('section', 'ecr-panel');
    panel.append(el('div', 'ecr-panel-heading', 'Last action result'));
    const pre = el('pre', 'ecr-result');
    pre.textContent = JSON.stringify(consoleUi.displayValue(state.lastResult), null, 2);
    panel.append(pre);
    const auth = state.lastResult.authorization_data?.[0];
    if (auth?.docker_login) {
      panel.append(btn('Copy docker login', 'ecr-btn-secondary', () => copyText(auth.docker_login, 'Docker login command')));
    }
    return panel;
  }

  function renderWorkbench() {
    const workbench = el('div', 'ecr-workbench');
    const repo = selectedRepository();
    workbench.append(renderRepositoryList());
    const detail = el('div', 'ecr-detail-stack');
    detail.append(renderResourceTabs());
    if (!repo) {
      detail.append(el('section', 'ecr-panel ecr-empty-panel', 'Create a repository to start pushing local container images.'));
    } else {
      if (state.activeView === 'overview') detail.append(renderRepositoryDetail(repo));
      if (state.activeView === 'images') detail.append(renderImagesPanel(repo));
      if (state.activeView === 'policies') detail.append(renderPoliciesPanel(repo));
      if (state.activeView === 'pushpull') detail.append(renderPushPullPanel(repo));
    }
    const result = renderResult();
    if (result) {
      detail.append(result);
    }
    workbench.append(detail);
    return workbench;
  }

  function render() {
    if (!root) {
      return;
    }
    root.textContent = '';
    renderBreadcrumbs();
    renderSummary(state.inventory?.summary || {});
    root.append(toolbar(
      [
        btn('Create repository', null, showCreateRepositoryModal),
        btn('Docker login', 'ecr-btn-secondary', () => getAuthToken().catch((error) => toast(error.message, true))),
        btn('Run GC', 'ecr-btn-danger', () => runGarbageCollection().catch((error) => toast(error.message, true))),
      ],
      [el('span', 'ecr-toolbar-note', 'Local OCI registry and image metadata workflows')],
    ));
    root.append(renderWorkbench());
    if (loadedAtEl) {
      loadedAtEl.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
    }
  }

  async function refresh() {
    if (!root) {
      return;
    }
    const data = await apiJson('/api/ecr/');
    state.inventory = data;
    if (!state.selectedRepositoryName && repositories()[0]) {
      state.selectedRepositoryName = repoName(repositories()[0]);
    }
    render();
  }

  return { refresh };
})();

window.ECRConsole = ECRConsole;
