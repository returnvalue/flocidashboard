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
    policyInput.value = JSON.stringify({
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
    policyInput.value = JSON.stringify({
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
    if (!repositories().length) {
      list.append(el('div', 'ecr-empty', 'No ECR repositories found.'));
    } else {
      repositories().forEach((repo) => {
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
    consoleUi.addField(facts, 'Tags', repo.tags);
    body.append(facts);
    if (repo.uri) {
      body.append(
        el('pre', 'ecr-command', `docker pull alpine:3.19\ndocker tag alpine:3.19 ${repo.uri}:v1\ndocker push ${repo.uri}:v1`),
      );
    }
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
    const body = el('div', 'ecr-card-list');
    const images = repo.image_details || repo.images || [];
    images.forEach((image) => {
      const card = el('article', 'ecr-card');
      const tags = image.imageTags || [image.imageTag].filter(Boolean);
      card.append(el('h3', null, tags?.length ? tags.join(', ') : image.imageDigest || 'Image'));
      const facts = el('dl', 'ecr-facts');
      consoleUi.addField(facts, 'Digest', image.imageDigest);
      consoleUi.addField(facts, 'Tags', tags);
      consoleUi.addField(facts, 'Size bytes', image.imageSizeInBytes);
      consoleUi.addField(facts, 'Pushed at', consoleUi.formatDate(image.imagePushedAt));
      consoleUi.addField(facts, 'Manifest media type', image.imageManifestMediaType);
      card.append(facts);
      body.append(card);
    });
    if (!images.length) {
      body.append(el('p', 'ecr-empty', 'No images found in this repository.'));
    }
    panel.append(body);
    return panel;
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
    if (!repo) {
      detail.append(el('section', 'ecr-panel ecr-empty-panel', 'Create a repository to start pushing local container images.'));
    } else {
      detail.append(renderRepositoryDetail(repo), renderImagesPanel(repo));
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
