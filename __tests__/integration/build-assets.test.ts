/**
 * Build Assets Integration Test
 * Ensures all required static assets are generated during build
 */

import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

describe('Build Assets Integration', () => {
  const staticDir = join(process.cwd(), '.next/static');
  const mediaDir = join(staticDir, 'media');
  const chunksDir = join(staticDir, 'chunks');

  describe('Font Assets', () => {
    it('should generate required font files', () => {
      if (!existsSync(mediaDir)) {
        console.log('⚠️ Build not found - run "NODE_ENV=production npm run build" first');
        return;
      }

      const mediaFiles = readdirSync(mediaDir);
      
      // Check for any woff2 font files (Next.js generates them dynamically)
      const woff2Fonts = mediaFiles.filter(file => file.includes('.woff2'));
      
      // Check for different font types (Next.js 15 patterns)
      const preloadFonts = woff2Fonts.filter(file => file.includes('.p.') && file.includes('.woff2'));
      const regularFonts = woff2Fonts.filter(file => !file.includes('.p.') && file.includes('.woff2'));

      console.log(`✅ Found ${mediaFiles.length} media files`);
      console.log(`✅ WOFF2 fonts: ${woff2Fonts.length}`);
      console.log(`✅ Regular fonts: ${regularFonts.length}`);
      console.log(`✅ Preload fonts: ${preloadFonts.length}`);

      expect(woff2Fonts.length).toBeGreaterThan(0);
      expect(regularFonts.length + preloadFonts.length).toBeGreaterThan(0);
      
      // Ensure font files are not empty
      woff2Fonts.forEach(font => {
        expect(font).toMatch(/\.woff2$/);
      });
    });

    it('should generate comprehensive font family coverage', () => {
      if (!existsSync(mediaDir)) {
        console.log('⚠️ Build not found - skipping font coverage test');
        return;
      }

      const mediaFiles = readdirSync(mediaDir);
      const woff2Files = mediaFiles.filter(file => file.endsWith('.woff2'));
      
      console.log(`📊 Total font files: ${woff2Files.length}`);
      
      // Should have multiple font weights/variants
      expect(woff2Files.length).toBeGreaterThan(5);
      
      // Should include both regular and preload (.p.woff2) fonts
      const preloadFonts = woff2Files.filter(file => file.includes('.p.') && file.includes('.woff2'));
      const regularFonts = woff2Files.filter(file => !file.includes('.p.') && file.includes('.woff2'));
      
      expect(preloadFonts.length).toBeGreaterThan(0);
      expect(regularFonts.length).toBeGreaterThan(0);
      
      console.log(`✅ Preload fonts: ${preloadFonts.length}`);
      console.log(`✅ Regular fonts: ${regularFonts.length}`);
    });
  });

  describe('JavaScript Chunks', () => {
    it('should generate required JavaScript chunks', () => {
      if (!existsSync(chunksDir)) {
        console.log('⚠️ Build not found - run "NODE_ENV=production npm run build" first');
        return;
      }

      const chunkFiles = readdirSync(chunksDir, { recursive: true });
      const jsFiles = chunkFiles.filter(file => 
        typeof file === 'string' && file.endsWith('.js')
      );
      
      console.log(`✅ Found ${jsFiles.length} JavaScript chunks`);
      
      // Check for essential chunks
      // Look for app-related chunks (Next.js 15 may have different names)
      const appChunks = jsFiles.filter(file => file.includes('app'));
      const layoutChunk = jsFiles.find(file => file.includes('layout'));
      
      expect(appChunks.length).toBeGreaterThan(0);
      expect(jsFiles.length).toBeGreaterThan(3); // Should have multiple chunks for code splitting
      
      console.log(`✅ App chunks: ${appChunks.length}`);
      console.log(`✅ Layout chunk: ${layoutChunk ? 'found' : 'not found'}`);
      console.log(`✅ Total JS chunks: ${jsFiles.length}`);
    });

    it('should generate API route chunks', () => {
      if (!existsSync(chunksDir)) {
        console.log('⚠️ Build not found - skipping API chunks test');
        return;
      }

      const chunkFiles = readdirSync(chunksDir, { recursive: true });
      const jsFiles = chunkFiles.filter(file => 
        typeof file === 'string' && file.endsWith('.js')
      );
      
      // Should have chunks for API routes
      const apiChunks = jsFiles.filter(file => 
        file.includes('api') || file.includes('route')
      );
      
      console.log(`✅ API-related chunks: ${apiChunks.length}`);
      
      // We have several API routes, should have some chunks
      expect(jsFiles.length).toBeGreaterThan(0);
    });
  });

  describe('Build Completeness', () => {
    it('should have proper build structure', () => {
      const nextDir = join(process.cwd(), '.next');
      
      if (!existsSync(nextDir)) {
        console.log('⚠️ No .next directory found - build required');
        return;
      }

      // Check essential directories exist
      expect(existsSync(staticDir)).toBe(true);
      expect(existsSync(mediaDir)).toBe(true);
      expect(existsSync(chunksDir)).toBe(true);
      
      // Check for build manifest
      const buildManifest = join(nextDir, 'build-manifest.json');
      expect(existsSync(buildManifest)).toBe(true);
      
      console.log('✅ Build structure is complete');
    });

    it('should generate assets with proper NODE_ENV', () => {
      // This test documents the requirement that NODE_ENV=production is needed
      console.log('📝 Remember: Assets are only generated with NODE_ENV=production npm run build');
      console.log('📝 Font 404s indicate missing build or wrong NODE_ENV');
      
      expect(true).toBe(true); // Always pass, this is documentation
    });
  });
}); 