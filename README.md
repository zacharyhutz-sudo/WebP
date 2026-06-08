# Bulk Image to WebP Converter

A simple GitHub Pages-ready website that bulk converts `.heic`, `.heif`, `.jpg`, and `.jpeg` images to `.webp` in the browser.

## What it does

- Drag and drop many images at once
- Supports JPG/JPEG and HEIC/HEIF
- Converts to WebP locally in the browser
- Downloads converted images as a ZIP
- Includes a WebP quality slider
- Includes an optional max-width resize field
- Keeps folder structure when possible

## Privacy

Images are processed locally in the browser. They are not uploaded to a server.

## How to publish on GitHub Pages

1. Create a new GitHub repository.
2. Upload these files to the root of the repository:
   - `index.html`
   - `style.css`
   - `script.js`
   - `README.md`
3. In GitHub, go to **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select your `main` branch and `/root` folder.
6. Save.
7. GitHub will give you a live URL like:

```text
https://your-username.github.io/your-repo-name/
```

## Notes

This site uses CDN-hosted browser libraries:

- JSZip for creating ZIP downloads
- heic2any for decoding HEIC/HEIF files

Because the tool is browser-based, very large batches can take time and may use a lot of memory. HEIC files are usually slower than JPG files.


## Batch selection tip

Use **Choose files** and select multiple photos with Shift, Command, or Ctrl. Use **Choose folder** when you want the app to scan an entire folder. Dragging a folder into the drop zone also works in Chromium-based browsers.
