import { build } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

const root = process.cwd();

async function run() {
  console.log('🚀 Starting Site Voice extension build...');

  // Step 1: Build Popup (HTML entry)
  console.log('📦 Building popup UI...');
  await build({
    configFile: false,
    publicDir: 'public',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: resolve(root, 'popup.html'),
        },
      },
    },
  });

  // Step 2: Build Background Service Worker (ES Module)
  console.log('⚙️ Building background service worker...');
  await build({
    configFile: false,
    publicDir: false,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      lib: {
        entry: resolve(root, 'src/background/index.ts'),
        formats: ['es'],
        fileName: () => 'background.js',
      },
    },
  });

  // Step 3: Build Content Script (IIFE single bundle, no chunk splits)
  console.log('🎨 Building content script with Readability & HUD...');
  await build({
    configFile: false,
    publicDir: false,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      lib: {
        entry: resolve(root, 'src/content/index.ts'),
        formats: ['iife'],
        name: 'SiteVoiceContent',
        fileName: () => 'content.js',
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
  });

  // Ensure manifest.json and icons are in dist
  if (fs.existsSync('public/manifest.json')) {
    fs.copyFileSync('public/manifest.json', 'dist/manifest.json');
  }

  console.log('✅ Build complete! Output directory: dist/');
}

run().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
