# Folder Upload Demo

Small Node.js demo that accepts a folder upload from the browser and recreates the folder under `uploads/`.

Prereqs
- Node.js 14+ and npm

Install

1. cd into the project
2. npm install

Run

npm start

Open

Visit http://localhost:3000 and choose a folder using the file input. Click Upload. Files will be saved to `uploads/your-folder/...` on the server.

Notes
- This is a demo. It writes files directly to disk using the filename provided by the client. Do not use as-is in production without validating paths and adding authentication.

Listing and downloading uploaded files

- GET /files — returns JSON list of uploaded files with URLs. Example:

	GET http://localhost:3000/files

- GET /download?path=relative/path/to/file — download a specific uploaded file or folder. Examples:

	# Download a single file
	GET http://localhost:3000/download?path=myFolder/image.png

	# Download an entire folder as zip
	GET http://localhost:3000/download?path=myFolder

