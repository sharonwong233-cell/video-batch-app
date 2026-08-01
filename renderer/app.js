'use strict';

const $ = (id) => document.getElementById(id);

const el = {
  inputDir: $('inputDir'),
  outputDir: $('outputDir'),
  trimHead: $('trimHead'),
  segmentMin: $('segmentMin'),
  maskEnabled: $('maskEnabled'),
  maskConfig: $('mask-config'),
  maskColor: $('maskColor'),
  maskColorText: $('maskColorText'),
  swatches: $('swatches'),
  maskSizeType: $('maskSizeType'),
  maskSizeValue: $('maskSizeValue'),
  posRow: $('posRow'),
  previewBox: $('previewBox'),
  btnStart: $('btn-start'),
  btnCancel: $('btn-cancel'),
  btnInput: $('btn-input'),
  btnOutput: $('btn-output'),
  clipList: $('clipList'),
  queueCount: $('queueCount'),
  overallProgress: $('overallProgress'),
  overallFill: $('overallFill'),
  overallText: $('overallText'),
  summary: $('summary'),
  summaryText: $('summaryText'),
  headerStatus: $('header-status'),
};

let state = {
  running: false,
  clips: [],            // { name, path, duration }
  maskPos: 'topleft',
  stage: 'idle',
  dragIndex: -1,
};

// ---------- 素材加载 ----------

async function loadDir() {
  if (state.running) return;
  const dir = await window.api.selectFolder({ title: '选择素材文件夹' });
  if (!dir) return;
  el.inputDir.value = dir;
  autoOutput();

  state.clips = [];
  renderClips();
  el.queueCount.textContent = '扫描中…';

  try {
    const items = await window.api.scanDir(dir);
    state.clips = items.map((it) => ({
      name: it.name,
      path: it.path,
      duration: it.duration,
    }));
  } catch (e) {
    state.clips = [];
  }
  renderClips();
}

function autoOutput() {
  if (el.outputDir.value) return;
  const d = el.inputDir.value.trim();
  if (!d) return;
  el.outputDir.value = d.replace(/[\\/]+$/, '') + '_merged';
}

el.btnInput.addEventListener('click', () => loadDir());
el.btnOutput.addEventListener('click', async () => {
  if (state.running) return;
  const dir = await window.api.selectFolder({ title: '选择输出文件夹' });
  if (dir) el.outputDir.value = dir;
});

// ---------- 素材列表渲染 ----------

function renderClips() {
  el.clipList.innerHTML = '';
  el.queueCount.textContent = `${state.clips.length} 个文件`;

  if (!state.clips.length) {
    el.clipList.innerHTML = '<div class="empty-state"><p>还没有素材。</p><p class="empty-sub">选择文件夹自动加载，拖动调整拼接顺序。</p></div>';
    return;
  }

  state.clips.forEach((c, i) => {
    const row = document.createElement('div');
    row.className = 'clip-item';
    row.draggable = true;
    row.dataset.index = i;

    row.innerHTML = `
      <span class="drag-handle" aria-hidden="true">⋮⋮</span>
      <span class="c-order">${i + 1}</span>
      <span class="c-name" title="${escapeHtml(c.path)}">${escapeHtml(c.name)}</span>
      <span class="c-dur">${c.duration != null ? c.duration.toFixed(1) + 's' : '--'}</span>
      <button class="c-up" type="button" title="上移" ${i === 0 ? 'disabled' : ''}>▲</button>
      <button class="c-down" type="button" title="下移" ${i === state.clips.length - 1 ? 'disabled' : ''}>▼</button>
    `;

    row.querySelector('.c-up').addEventListener('click', () => move(i, -1));
    row.querySelector('.c-down').addEventListener('click', () => move(i, 1));

    // 拖拽排序
    row.addEventListener('dragstart', (e) => {
      state.dragIndex = i;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      el.clipList.querySelectorAll('.drag-over').forEach((r) => r.classList.remove('drag-over'));
      state.dragIndex = -1;
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      row.classList.add('drag-over');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.classList.remove('drag-over');
      if (state.dragIndex < 0 || state.dragIndex === i) return;
      moveTo(state.dragIndex, i);
    });

    el.clipList.appendChild(row);
  });
}

function move(from, delta) {
  const to = from + delta;
  if (to < 0 || to >= state.clips.length) return;
  moveTo(from, to);
}

function moveTo(from, to) {
  const [item] = state.clips.splice(from, 1);
  state.clips.splice(to, 0, item);
  renderClips();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

// ---------- 色块配置 ----------

el.maskEnabled.addEventListener('change', () => {
  el.maskConfig.hidden = !el.maskEnabled.checked;
});

function syncColor(color) {
  const v = color.toLowerCase();
  el.maskColor.value = v.startsWith('#') && v.length === 7 ? v : el.maskColor.value;
  el.maskColorText.value = v;
  el.previewBox.style.background = v;
}

el.maskColor.addEventListener('input', () => syncColor(el.maskColor.value));
el.maskColorText.addEventListener('input', () => {
  el.previewBox.style.background = el.maskColorText.value || '#4a7dff';
});
el.maskColorText.addEventListener('change', () => syncColor(el.maskColorText.value.trim()));

el.swatches.addEventListener('click', (e) => {
  const btn = e.target.closest('.swatch');
  if (!btn) return;
  syncColor(btn.dataset.color);
});

el.posRow.addEventListener('click', (e) => {
  const btn = e.target.closest('.pos-btn');
  if (!btn) return;
  el.posRow.querySelectorAll('.pos-btn').forEach((b) => {
    b.classList.toggle('active', b === btn);
    b.setAttribute('aria-pressed', String(b === btn));
  });
  state.maskPos = btn.dataset.pos;
  updatePreview();
});

el.maskSizeValue.addEventListener('input', updatePreview);
el.maskSizeType.addEventListener('change', updatePreview);

function updatePreview() {
  const box = el.previewBox;
  const pw = box.parentElement.clientWidth;
  if (el.maskSizeType.value === 'pct') {
    const s = Math.max(8, (pw * (parseFloat(el.maskSizeValue.value) || 15)) / 100);
    box.style.width = s + 'px';
    box.style.height = s + 'px';
  } else {
    const s = Math.max(8, Math.min(pw * 0.5, parseFloat(el.maskSizeValue.value) || 100));
    box.style.width = s + 'px';
    box.style.height = s + 'px';
  }
  if (state.maskPos === 'topright') {
    box.style.left = 'auto'; box.style.right = '6px';
  } else {
    box.style.left = '6px'; box.style.right = 'auto';
  }
  box.style.top = '6px';
}

window.addEventListener('resize', () => { if (el.maskEnabled.checked) updatePreview(); });

// ---------- 开始 / 取消 ----------

async function start() {
  const inputDir = el.inputDir.value.trim();
  if (!inputDir) { alert('请先选择素材文件夹'); return; }
  if (!state.clips.length) { alert('素材列表为空'); return; }

  const trimHead = parseFloat(el.trimHead.value) || 0;
  const segmentMin = parseFloat(el.segmentMin.value) || 5;
  const maskColor = el.maskEnabled.checked ? (el.maskColorText.value.trim() || '#000000') : null;

  state.running = true;
  state.stage = 'merge';
  el.btnStart.disabled = true;
  el.btnCancel.disabled = false;
  el.summary.hidden = true;
  el.overallProgress.hidden = false;
  el.overallFill.style.width = '0%';
  el.headerStatus.textContent = '拼接中';
  el.headerStatus.className = 'busy';

  const config = {
    files: state.clips.map((c) => c.path),
    outputDir: el.outputDir.value.trim() || (inputDir.replace(/[\\/]+$/, '') + '_merged'),
    trimHeadSec: trimHead,
    segmentMin,
    maskColor,
    maskSize: maskColor
      ? (el.maskSizeType.value === 'pct' ? `${parseFloat(el.maskSizeValue.value) || 15}%` : el.maskSizeValue.value.trim())
      : '15%',
    maskPos: state.maskPos,
  };

  try {
    const res = await window.api.startProcess(config);
    finishRun(res.error ? null : res.result, res.error);
  } catch (e) {
    finishRun(null, e.message);
  }
}

function finishRun(result, error) {
  state.running = false;
  state.stage = 'idle';
  el.btnStart.disabled = false;
  el.btnCancel.disabled = true;

  if (error) {
    el.headerStatus.textContent = '出错';
    el.headerStatus.className = 'busy';
    el.overallFill.style.width = '100%';
    el.summary.hidden = false;
    el.summary.className = 'summary';
    el.summaryText.textContent = '处理出错：' + error;
  } else if (result && result.cancelled) {
    el.headerStatus.textContent = '已取消';
    el.headerStatus.className = 'done';
    el.overallFill.style.width = '0%';
  } else if (result) {
    el.headerStatus.textContent = '完成';
    el.headerStatus.className = 'done';
    el.overallFill.style.width = '100%';
    el.summary.hidden = false;
    el.summary.className = 'summary success';
    el.summaryText.textContent =
      `拼接完成（${result.duration.toFixed(0)}s），切成 ${result.segments} 段 → ${result.outputDir}`;
  }
}

el.btnStart.addEventListener('click', start);
el.btnCancel.addEventListener('click', () => {
  if (state.running) window.api.cancelProcess();
  el.btnCancel.disabled = true;
});

// ---------- 事件流 ----------

window.api.onProgress((msg) => {
  if (msg.type === 'stage') {
    state.stage = msg.stage;
    el.headerStatus.textContent = msg.stage === 'merge' ? '拼接中' : '切分中';
    el.overallFill.style.width = '0%';
    el.overallText.textContent = msg.stage === 'merge' ? '正在拼接素材…' : '正在切分片段…';
  } else if (msg.type === 'merge-progress') {
    el.overallFill.style.width = msg.percent + '%';
    el.overallText.textContent = `拼接中 ${msg.percent}%`;
  } else if (msg.type === 'split-progress') {
    el.overallFill.style.width = msg.percent + '%';
    el.overallText.textContent = `切分中 ${msg.percent}%`;
  }
});
