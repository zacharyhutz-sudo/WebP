const fileInput = document.getElementById('fileInput');
const folderInput = document.getElementById('folderInput');
const chooseFilesButton = document.getElementById('chooseFilesButton');
const chooseFolderButton = document.getElementById('chooseFolderButton');
const dropZone = document.getElementById('dropZone');
const qualityInput = document.getElementById('qualityInput');
const qualityValue = document.getElementById('qualityValue');
const maxWidthInput = document.getElementById('maxWidthInput');
const keepFoldersInput = document.getElementById('keepFoldersInput');
const convertButton = document.getElementById('convertButton');
const clearButton = document.getElementById('clearButton');
const progressText = document.getElementById('progressText');
const progressCount = document.getElementById('progressCount');
const progressFill = document.getElementById('progressFill');
const fileList = document.getElementById('fileList');
const fileSummary = document.getElementById('fileSummary');

let selectedItems = [];
let isConverting = false;

const supportedExtensions = ['.jpg', '.jpeg', '.heic', '.heif'];
const supportedMimeTypes = ['image/jpeg', 'image/heic', 'image/heif'];

qualityInput.addEventListener('input', () => {
  qualityValue.textContent = `${qualityInput.value}%`;
});

chooseFilesButton.addEventListener('click', (event) => {
  event.stopPropagation();
  fileInput.click();
});

chooseFolderButton.addEventListener('click', (event) => {
  event.stopPropagation();
  folderInput.click();
});

dropZone.addEventListener('click', (event) => {
  if (event.target === chooseFilesButton || event.target === chooseFolderButton) return;
  fileInput.click();
});

dropZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener('change', (event) => {
  const items = filesToItems(Array.from(event.target.files || []));
  addItems(items, event.target.files?.length || 0);
  fileInput.value = '';
});

folderInput.addEventListener('change', (event) => {
  const items = filesToItems(Array.from(event.target.files || []));
  addItems(items, event.target.files?.length || 0);
  folderInput.value = '';
});

['dragenter', 'dragover'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add('is-over');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove('is-over');
  });
});

dropZone.addEventListener('drop', async (event) => {
  const items = await getItemsFromDataTransfer(event.dataTransfer);
  addItems(items, items.length);
});

clearButton.addEventListener('click', () => {
  if (isConverting) return;
  selectedItems = [];
  renderFiles();
  setProgress('No files selected.', '', 0);
});

convertButton.addEventListener('click', async () => {
  if (!selectedItems.length || isConverting) return;
  await convertAll();
});

function filesToItems(files) {
  return files.map((file) => ({
    file,
    path: cleanPath(file.webkitRelativePath || file.name)
  }));
}

function isSupportedFile(file) {
  const lowerName = file.name.toLowerCase();
  return supportedMimeTypes.includes(file.type) || supportedExtensions.some((extension) => lowerName.endsWith(extension));
}

function isHeicFile(file) {
  const lowerName = file.name.toLowerCase();
  return lowerName.endsWith('.heic') || lowerName.endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif';
}

function addItems(items, attemptedCount = items.length) {
  const accepted = items.filter((item) => isSupportedFile(item.file));
  const existingKeys = new Set(selectedItems.map(getItemKey));
  let added = 0;

  for (const item of accepted) {
    const key = getItemKey(item);
    if (!existingKeys.has(key)) {
      selectedItems.push(item);
      existingKeys.add(key);
      added += 1;
    }
  }

  renderFiles();

  const ignored = Math.max(0, attemptedCount - accepted.length);
  if (attemptedCount && !accepted.length) {
    setProgress('No supported images found. Use HEIC, HEIF, JPG, or JPEG.', '', 0);
  } else if (added > 0) {
    const ignoredText = ignored ? ` ${ignored} unsupported file${ignored === 1 ? '' : 's'} ignored.` : '';
    setProgress(`${selectedItems.length} file${selectedItems.length === 1 ? '' : 's'} ready.${ignoredText}`, '', 0);
  } else if (accepted.length > 0) {
    setProgress('Those files were already added.', '', 0);
  }
}

async function getItemsFromDataTransfer(dataTransfer) {
  const dataItems = Array.from(dataTransfer.items || []);
  const fallbackItems = filesToItems(Array.from(dataTransfer.files || []));

  if (!dataItems.length) return fallbackItems;

  const collected = [];
  for (const dataItem of dataItems) {
    const entry = dataItem.webkitGetAsEntry?.();
    if (entry) {
      const entryItems = await readEntry(entry);
      collected.push(...entryItems);
    } else if (dataItem.kind === 'file') {
      const file = dataItem.getAsFile();
      if (file) collected.push({ file, path: cleanPath(file.webkitRelativePath || file.name) });
    }
  }

  return collected.length ? collected : fallbackItems;
}

function readEntry(entry) {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file(
        (file) => resolve([{ file, path: cleanPath(entry.fullPath || file.name) }]),
        () => resolve([])
      );
      return;
    }

    if (entry.isDirectory) {
      const reader = entry.createReader();
      const allItems = [];

      const readBatch = () => {
        reader.readEntries(async (entries) => {
          if (!entries.length) {
            resolve(allItems);
            return;
          }

          for (const childEntry of entries) {
            const childItems = await readEntry(childEntry);
            allItems.push(...childItems);
          }
          readBatch();
        }, () => resolve(allItems));
      };

      readBatch();
      return;
    }

    resolve([]);
  });
}

function renderFiles(statusMap = {}) {
  fileList.innerHTML = '';

  for (const item of selectedItems) {
    const { file, path } = item;
    const key = getItemKey(item);
    const status = statusMap[key] || { label: 'Ready', className: 'ready' };
    const li = document.createElement('li');
    li.innerHTML = `
      <div>
        <div class="file-name" title="${escapeHtml(path)}">${escapeHtml(path)}</div>
        <div class="file-detail">${formatBytes(file.size)} • ${isHeicFile(file) ? 'HEIC/HEIF' : 'JPG/JPEG'}</div>
      </div>
      <span class="status ${status.className}">${status.label}</span>
    `;
    fileList.appendChild(li);
  }

  fileSummary.textContent = selectedItems.length
    ? `${selectedItems.length} image${selectedItems.length === 1 ? '' : 's'} selected.`
    : 'Choose images to begin.';

  convertButton.disabled = !selectedItems.length || isConverting;
  clearButton.disabled = !selectedItems.length || isConverting;
}

async function convertAll() {
  isConverting = true;
  const statusMap = {};
  const zip = new JSZip();
  const quality = Number(qualityInput.value) / 100;
  const maxWidth = Number(maxWidthInput.value) || null;
  const keepFolders = keepFoldersInput.checked;
  const outputNames = new Set();
  let successful = 0;
  let failed = 0;

  convertButton.disabled = true;
  clearButton.disabled = true;

  for (let index = 0; index < selectedItems.length; index++) {
    const item = selectedItems[index];
    const file = item.file;
    const key = getItemKey(item);
    statusMap[key] = { label: 'Converting', className: 'working' };
    renderFiles(statusMap);
    setProgress(`Converting ${file.name}`, `${index + 1} of ${selectedItems.length}`, Math.round((index / selectedItems.length) * 100));

    try {
      const webpBlob = await convertFileToWebP(file, quality, maxWidth);
      const outputPath = makeOutputPath(item, keepFolders, outputNames);
      zip.file(outputPath, webpBlob);
      successful += 1;
      statusMap[key] = { label: 'Done', className: 'done' };
    } catch (error) {
      console.error(`Could not convert ${file.name}`, error);
      failed += 1;
      statusMap[key] = { label: 'Error', className: 'error' };
    }

    renderFiles(statusMap);
    setProgress(`Processed ${index + 1} of ${selectedItems.length}`, `${index + 1} of ${selectedItems.length}`, Math.round(((index + 1) / selectedItems.length) * 100));
  }

  if (successful > 0) {
    setProgress('Creating ZIP file…', `${successful} converted`, 100);
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(zipBlob, `webp-converted-${formatDateForFilename(new Date())}.zip`);
    setProgress(`Finished. ${successful} converted${failed ? `, ${failed} failed` : ''}.`, '', 100);
  } else {
    setProgress('No files were converted. Try smaller files or a different browser.', '', 0);
  }

  isConverting = false;
  renderFiles(statusMap);
}

async function convertFileToWebP(file, quality, maxWidth) {
  let imageBlob = file;

  if (isHeicFile(file)) {
    if (typeof heic2any !== 'function') {
      throw new Error('HEIC converter did not load. Check your internet connection or CDN settings.');
    }

    const converted = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.94
    });

    imageBlob = Array.isArray(converted) ? converted[0] : converted;
  }

  const img = await blobToImage(imageBlob);
  const { width, height } = calculateSize(img.naturalWidth || img.width, img.naturalHeight || img.height, maxWidth);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.drawImage(img, 0, 0, width, height);

  URL.revokeObjectURL(img.src);

  return await canvasToWebPBlob(canvas, quality);
}

function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image in browser.'));
    };
    img.src = url;
  });
}

function calculateSize(originalWidth, originalHeight, maxWidth) {
  if (!maxWidth || originalWidth <= maxWidth) {
    return { width: originalWidth, height: originalHeight };
  }

  const ratio = maxWidth / originalWidth;
  return {
    width: Math.round(originalWidth * ratio),
    height: Math.round(originalHeight * ratio)
  };
}

function canvasToWebPBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Browser could not export WebP.'));
        return;
      }
      if (blob.type !== 'image/webp') {
        reject(new Error('This browser does not support WebP export. Try Chrome, Edge, or Firefox.'));
        return;
      }
      resolve(blob);
    }, 'image/webp', quality);
  });
}

function makeOutputPath(item, keepFolders, outputNames) {
  const sourcePath = keepFolders && item.path ? item.path : item.file.name;
  const withoutExtension = cleanPath(sourcePath).replace(/\.[^/.]+$/, '');
  let outputPath = `${withoutExtension}.webp`;
  let counter = 2;

  while (outputNames.has(outputPath)) {
    outputPath = `${withoutExtension}-${counter}.webp`;
    counter += 1;
  }

  outputNames.add(outputPath);
  return outputPath;
}

function getItemKey(item) {
  return `${item.path}-${item.file.size}-${item.file.lastModified}`;
}

function cleanPath(path) {
  return String(path || '')
    .replace(/^\/+/, '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/');
}

function setProgress(text, count, percent) {
  progressText.textContent = text;
  progressCount.textContent = count;
  progressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const sizeIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, sizeIndex)).toFixed(sizeIndex === 0 ? 0 : 1)} ${units[sizeIndex]}`;
}

function formatDateForFilename(date) {
  return date.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
