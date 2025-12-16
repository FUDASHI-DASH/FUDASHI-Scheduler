# FUDASHI PHUTURE - Schedule Automation System

A cyberpunk-themed scheduling automation tool built with React, Vite, and Tailwind CSS.

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📦 Deployment

### Option 1: Vercel (Recommended)

1. Push this project to GitHub
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub
3. Click "New Project" and import your repository
4. Vercel auto-detects Vite - just click "Deploy"
5. Done! You'll get a `.vercel.app` URL

### Option 2: Netlify

1. Push to GitHub
2. Go to [netlify.com](https://netlify.com) and sign in
3. Click "Add new site" → "Import an existing project"
4. Select your GitHub repo
5. Build settings (auto-detected):
   - Build command: `npm run build`
   - Publish directory: `dist`
6. Click "Deploy"

### Option 3: GitHub Pages

1. Install gh-pages: `npm install --save-dev gh-pages`
2. Add to `vite.config.js`:
   ```js
   export default defineConfig({
     base: '/your-repo-name/',
     plugins: [react()],
   })
   ```
3. Add to `package.json` scripts:
   ```json
   "deploy": "npm run build && gh-pages -d dist"
   ```
4. Run `npm run deploy`

## 🛠️ Tech Stack

- **React 18** - UI framework
- **Vite 5** - Build tool & dev server
- **Tailwind CSS 3** - Utility-first styling
- **Lucide React** - Icon library

## 📁 Project Structure

```
fudashi-scheduler/
├── public/
│   └── favicon.svg
├── src/
│   ├── ScheduleAutomation.jsx  # Main app component
│   ├── main.jsx                # Entry point
│   └── index.css               # Tailwind + custom styles
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## 🎨 Features

- Agent management with availability scheduling
- Flexibility scoring algorithm
- Hours of Operation (HOOP) configuration
- Automated schedule generation
- Target/Max hours enforcement
- Cyberpunk UI theme

---

Built with 💜 by FUDASHI
