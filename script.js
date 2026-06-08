const fileInput = document.getElementById('fileInput');
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

let selectedFiles = [];
let isConverting = false;

const supportedExtensions = ['.jpg', '.jpeg', '.heic', '.heif'];

qualityInput.addEventListener('input', () => {
  qualityValue.textContent = `${qualityInput.value}%`;
});

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener('change', (event) => {
  addFiles(Array.from(event.target.files || []));
  fileInput.value = '';
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
  const files = await getFilesFromDataTransfer(event.dataTransfer);
  addFiles(files);
});

clearButton.addEventListener('click', () => {
  if (isConverting) return;
  selectedFiles = [];
  renderFiles();
  setProgress('No files selected.', '', 0);
});

convertButton.addEventListener('click', async () => {
  if (!selectedFiles.length || isConverting) return;
  await convertAll();
});

function isSupportedFile(file) {
  const lowerName = file.name.toLowerCase();
  return supportedExtensions.some((extension) => lowerName.endsWith(extension));
}

function isHeicFile(file) {
  const lowerName = file.name.toLowerCase();
  return lowerName.endsWith('.heic') || lowerName.endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif';
}

function addFiles(files) {
  const accepted = files.filter(isSupportedFile);
  const existingKeys = new Set(selectedFiles.map((file) => `${file.webkitRelativePath || file.name}-${file.size}-${file.lastModified}`));

  for (const file of accepted) {
    const key = `${file.webkitRelativePath || file.name}-${file.size}-${file.lastModified}`;
    if (!existingKeys.has(key)) {
      selectedFiles.push(file);
      existingKeys.add(key);
    }
  }

  renderFiles();

  if (files.length && !accepted.length) {
    setProgress('No supported images found. Use HEIC, HEIF, JPG, or JPEG.', '', 0);
  } else if (accepted.length) {
    setProgress(`${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'} ready.`, '', 0);
  }
}

async function getFilesFromDataTransfer(dataTransfer) {
  const items = Array.from(dataTransfer.items || []);
  const files = Array.from(dataTransfer.files || []);

  if (!items.length) return files;

  const collected = [];
  for (const item of items) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) {
      const entryFiles = await readEntry(entry);
      collected.push(...entryFiles);
    } else if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file) collected.push(file);
    }
  }

  return collected.length ? collected : files;
}

function readEntry(entry) {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file((file) => resolve([file]), () => resolve([]));
      return;
    }

    if (entry.isDirectory) {
      const reader = entry.createReader();
      const allFiles = [];

      const readBatch = () => {
        reader.readEntries(async (entries) => {
          if (!entries.length) {
            resolve(allFiles);
            return;
          }

          for (const childEntry of entries) {
            const childFiles = await readEntry(childEntry);
            allFiles.push(...childFiles);
          }
          readBatch();
        }, () => resolve(allFiles));
      };

      readBatch();
      return;
    }

    resolve([]);
  });
}

function renderFiles(statusMap = {}) {
  fileList.innerHTML = '';

  for (const file of selectedFiles) {
    const key = getFileKey(file);
    const status = statusMap[key] || 'ready';
    const li = document.createElement('li');
    li.innerHTML = `
      <div>
        <div class="file-name" title="${escapeHtml(file.webkitRelativePath || file.name)}">${escapeHtml(file.webkitRelativePath || file.name)}</div>
        <div class="file-detail">${formatBytes(file.size)} • ${isHeicFile(file) ? 'HEIC/HEIF' : 'JPG/JPEG'}</div>
      </div>
      <span class="status ${status.className}">${status.label}</span>
    `;
    fileList.appendChild(li);
  }

  fileSummary.textContent = selectedFiles.length
    ? `${selectedFiles.length} image${selectedFiles.length === 1 ? '' : 's'} selected.`
    : 'Choose images to begin.';

  convertButton.disabled = !selectedFiles.length || isConverting;
  clearButton.disabled = !selectedFiles.length || isConverting;
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

  for (let index = 0; index < selectedFiles.length; index++) {
    const file = selectedFiles[index];
    const key = getFileKey(file);
    statusMap[key] = { label: 'Converting', className: 'working' };
    renderFiles(statusMap);
    setProgress(`Converting ${file.name}`, `${index + 1} of ${selectedFiles.length}`, Math.round((index / selectedFiles.length) * 100));

    try {
      const webpBlob = await convertFileToWebP(file, quality, maxWidth);
      const outputPath = makeOutputPath(file, keepFolders, outputNames);
      zip.file(outputPath, webpBlob);
      successful += 1;
      statusMap[key] = { label: 'Done', className: 'done' };
    } catch (error) {
      console.error(`Could not convert ${file.name}`, error);
      failed += 1;
      statusMap[key] = { label: 'Error', className: 'error' };
    }

    renderFiles(statusMap);
    setProgress(`Processed ${index + 1} of ${selectedFiles.length}`, `${index + 1} of ${selectedFiles.length}`, Math.round(((index + 1) / selectedFiles.length) * 100));
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

function makeOutputPath(file, keepFolders, outputNames) {
  const sourcePath = keepFolders && file.webkitRelativePath ? file.webkitRelativePath : file.name;
  const withoutExtension = sourcePath.replace(/\.[^/.]+$/, '');
  let outputPath = `${withoutExtension}.webp`;
  let counter = 2;

  while (outputNames.has(outputPath)) {
    outputPath = `${withoutExtension}-${counter}.webp`;
    counter += 1;
  }

  outputNames.add(outputPath);
  return outputPath;
}

function getFileKey(file) {
  return `${file.webkitRelativePath || file.name}-${file.size}-${file.lastModified}`;
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
  const sizeIndex = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, sizeIndex)).toFixed(sizeIndex === 0 ? 0 : 1)} ${units[sizeIndex]}`;
}

function formatDateForFilename(date) {
  return date.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
