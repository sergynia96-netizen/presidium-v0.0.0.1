import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC/resolve/main/';
const TARGET_DIR = path.join(__dirname, 'public', 'models', 'llama');
const FILES_TO_DOWNLOAD = [
  'ndarray-cache.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'mlc-chat-config.json'
];

/**
 * Download a file from a URL, following redirects
 * @param {string} url - The URL to download from
 * @param {string} outputPath - The local file path to save to
 * @returns {Promise<void>}
 */
function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    
    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
        const redirectUrl = response.headers.location;
        if (!redirectUrl) {
          reject(new Error(`Redirect without location header: ${response.statusCode}`));
          return;
        }
        // Resolve relative redirects
        const resolvedUrl = new URL(redirectUrl, url).href;
        return downloadFile(resolvedUrl, outputPath).then(resolve).catch(reject);
      }
      
      // Handle errors
      if (response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      // Create write stream
      const fileStream = fs.createWriteStream(outputPath);
      response.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
      
      fileStream.on('error', (err) => {
        fs.unlink(outputPath, () => {}); // Delete partial file
        reject(err);
      });
    });
    
    request.on('error', (err) => {
      reject(err);
    });
    
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Ensure directory exists
 * @param {string} dirPath - Directory path
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Main function to fix model files
 */
async function fixModelFiles() {
  console.log('🔧 Starting model files repair...\n');
  
  // Ensure target directory exists
  ensureDirectoryExists(TARGET_DIR);
  
  // Download each file
  for (const filename of FILES_TO_DOWNLOAD) {
    const url = BASE_URL + filename;
    const outputPath = path.join(TARGET_DIR, filename);
    
    try {
      console.log(`📥 Downloading ${filename}...`);
      await downloadFile(url, outputPath);
      console.log(`✅ Fixed: ${filename}\n`);
    } catch (error) {
      console.error(`❌ Error downloading ${filename}:`, error.message);
      console.log('');
    }
  }
  
  console.log('✨ Repair process completed!');
}

// Run the script
fixModelFiles().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

