# Minova Tech

React and Vite website configured for deployment to Render as a static site.

## Project structure

```text
.
├── public/          # Static files copied as-is to the build
├── src/
│   ├── App.jsx      # React application entry component
│   ├── index.css    # Website styles
│   ├── site.js      # Interactions, forms, and integrations
│   └── site-content.html # Page markup rendered inside React
├── index.html       # Vite HTML entry point
├── package.json     # Scripts and dependencies
├── render.yaml      # Render deployment configuration
└── vite.config.js   # Vite configuration
```

The production build is generated in `dist/`; it is created by Vite and should
not be committed.

## Deploy to Render

1. Push this repository to GitHub or another Git provider supported by Render.
2. In Render, choose **New → Blueprint** and connect the repository.
3. Render reads `render.yaml`, installs dependencies with `npm ci`, builds the
   site with `npm run build`, and publishes `dist/`.

The same settings can be entered manually when creating a Render Static Site:

- **Build command:** `npm ci && npm run build`
- **Publish directory:** `dist`

## Local development

- `npm run dev` starts the Vite development server.
- `npm run build` creates the production site in `dist/`.
- `npm run preview` serves the production build locally.
