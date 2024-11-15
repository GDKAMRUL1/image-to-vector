const express = require('express');
const multer = require('multer');
const potrace = require('potrace');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver'); // New import for archiving

const app = express();
const PORT = 3000;

app.use(express.static('public'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: 'uploads',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

// Endpoint to handle file uploads and conversion to SVG
app.post('/convert-to-svg', upload.array('files'), (req, res) => {
  const svgFiles = [];

  Promise.all(req.files.map(file => {
    return new Promise((resolve, reject) => {
      const outputFilePath = path.join(__dirname, 'uploads', `${file.filename}.svg`);
      potrace.trace(file.path, (err, svg) => {
        if (err) return reject(err);

        fs.writeFile(outputFilePath, svg, (err) => {
          if (err) return reject(err);

          svgFiles.push({
            originalName: file.originalname,
            svgFilePath: `${file.filename}.svg`, // only the filename, not full path
          });
          resolve();
        });
      });
    });
  }))
    .then(() => {
      res.json(svgFiles);
    })
    .catch((error) => {
      console.error("Error processing files:", error);
      res.status(500).json({ error: 'Error processing files' });
    });
});

// Serve converted SVG files individually
app.get('/download/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'uploads', req.params.filename);
  res.download(filePath, err => {
    if (err) {
      console.error("Error sending file:", err);
      res.status(404).send("File not found.");
    }
  });
});

// Endpoint to download all SVG files as a single zip file
app.get('/download-all', (req, res) => {
  const zipFileName = 'converted_svgs.zip';
  const archive = archiver('zip', { zlib: { level: 9 } });

  res.attachment(zipFileName);

  // Archive the contents of the uploads directory
  archive.on('error', err => {
    console.error("Error creating archive:", err);
    res.status(500).send({ error: 'Error creating zip file' });
  });

  // Pipe the archive to the response
  archive.pipe(res);

  // Append each SVG file to the archive
  fs.readdirSync(path.join(__dirname, 'uploads')).forEach(file => {
    if (file.endsWith('.svg')) {
      archive.file(path.join(__dirname, 'uploads', file), { name: file });
    }
  });

  // Finalize the archive
  archive.finalize();
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
