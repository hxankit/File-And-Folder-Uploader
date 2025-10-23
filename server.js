const path = require('path');
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const mkdirp = require('mkdirp');
const archiver = require('archiver');
const extract = require('extract-zip');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// multer memory storage so we can write files respecting their relative paths
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post('/upload', upload.any(), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const baseDir = path.join(__dirname, 'uploads');
    
    for (const file of req.files) {
      // Check if the file is a zip file
      if (file.originalname.toLowerCase().endsWith('.zip')) {
        // Create a temporary file to save the zip
        const tempZipPath = path.join(baseDir, `temp-${Date.now()}.zip`);
        
        // Write the zip file
        fs.writeFileSync(tempZipPath, file.buffer);
        
        try {
          // Extract the zip file
          const extractDir = path.join(baseDir, path.basename(file.originalname, '.zip'));
          await extract(tempZipPath, { dir: extractDir });
          
          // Delete the temporary zip file
          fs.unlinkSync(tempZipPath);
        } catch (extractErr) {
          console.error('Extraction error:', extractErr);
          if (fs.existsSync(tempZipPath)) {
            fs.unlinkSync(tempZipPath);
          }
          throw new Error('Failed to extract zip file');
        }
      } else {
        // Handle regular files as before
        const relPath = file.originalname.replace(/^\/+/, '');
        const destPath = path.join(baseDir, relPath);
        const destDir = path.dirname(destPath);
        await mkdirp(destDir);
        fs.writeFileSync(destPath, file.buffer);
      }
    }

    return res.json({ ok: true, files: req.files.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Upload failed', details: err.message });
  }
});

app.get('/uploads/*', (req, res) => {
  const file = path.join(__dirname, req.path);
  res.sendFile(file);
});

// Helper to recursively list files under uploads directory
function listFiles(dir, baseDir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const it of items) {
    const full = path.join(dir, it.name);
    const rel = path.relative(baseDir, full).replace(/\\/g, '/');
    if (it.isDirectory()) {
      results.push(...listFiles(full, baseDir));
    } else {
      results.push(rel);
    }
  }
  return results;
}

// Return JSON list of uploaded files with URLs
app.get('/files', (req, res) => {
  try {
    const baseDir = path.join(__dirname, 'uploads');
    const files = listFiles(baseDir, baseDir);
    const host = req.headers.host || `localhost:${PORT}`;
    const protocol = req.protocol || 'http';
    const items = files.map(p => ({ path: p, url: `${protocol}://${host}/uploads/${encodeURI(p)}` }));
    res.json({ ok: true, files: items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Secure download endpoint: ?path=relative/path/to/file
app.get('/download', (req, res) => {
  try {
    const rel = req.query.path;
    if (!rel) return res.status(400).send('Missing path query');
    // Prevent path traversal
    const safe = path.normalize(rel).replace(/^([\\/]+)|([\\/]+)$/g, '');
    const baseDir = path.join(__dirname, 'uploads');
    const full = path.join(baseDir, safe);
    if (!full.startsWith(baseDir)) return res.status(400).send('Invalid path');
    if (!fs.existsSync(full)) return res.status(404).send('Not found');

    // If it's a directory, create a zip file
    if (fs.statSync(full).isDirectory()) {
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });

      // Set the filename to download
      res.attachment(`${path.basename(safe)}.zip`);
      
      // Pipe archive data to the response
      archive.pipe(res);
      
      // Add the folder content to the archive
      archive.directory(full, path.basename(safe));
      
      // Finalize the archive
      archive.finalize();
      
      return;
    }

    // If it's a single file, download it directly
    res.download(full);
  } catch (err) {
    console.error(err);
    res.status(500).send('Download failed');
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
