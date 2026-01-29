import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_DIR = path.join(__dirname, 'public', 'models', 'llama');
const MIN_FILE_SIZE = 1024; // 1KB

const CONFIG_URL = 'https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC/resolve/main/mlc-chat-config.json?download=true';
const TOKENIZER_URL = 'https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC/resolve/main/tokenizer.json?download=true';

/**
 * Download a file from URL
 * @param {string} url - URL to download from
 * @param {string} filePath - Local file path to save to
 * @returns {Promise<void>}
 */
function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    console.log(`📥 Downloading ${path.basename(filePath)}...`);
    
    const file = fs.createWriteStream(filePath);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        return downloadFile(response.headers.location, filePath)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(filePath);
        reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedSize = 0;
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize > 0) {
          const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
          process.stdout.write(`\r   Progress: ${percent}% (${(downloadedSize / 1024).toFixed(1)} KB)`);
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`\n✅ Downloaded ${path.basename(filePath)} (${(downloadedSize / 1024).toFixed(1)} KB)`);
        resolve();
      });
      
      file.on('error', (err) => {
        file.close();
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        reject(err);
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      reject(err);
    });
  });
}

/**
 * Check if file exists and has minimum size
 * @param {string} filePath - File path to check
 * @returns {boolean}
 */
function fileExistsAndValid(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return false;
    }
    const stats = fs.statSync(filePath);
    return stats.size >= MIN_FILE_SIZE;
  } catch (error) {
    return false;
  }
}

/**
 * Ensure directory exists
 * @param {string} dirPath - Directory path
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Created directory: ${dirPath}`);
  }
}

/**
 * Format file size
 * @param {number} bytes - File size in bytes
 * @returns {string}
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * List directory contents
 * @param {string} dirPath - Directory path
 */
function listDirectoryContents(dirPath) {
  console.log(`\n📋 Contents of ${path.relative(__dirname, dirPath)}:\n`);
  
  if (!fs.existsSync(dirPath)) {
    console.log('   (directory does not exist)');
    return;
  }
  
  try {
    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    
    if (files.length === 0) {
      console.log('   (empty)');
      return;
    }
    
    // Sort files: directories first, then files
    files.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });
    
    for (const file of files) {
      const filePath = path.join(dirPath, file.name);
      try {
        const stats = fs.statSync(filePath);
        const size = file.isDirectory() ? '(dir)' : formatFileSize(stats.size);
        const icon = file.isDirectory() ? '📁' : '📄';
        console.log(`   ${icon} ${file.name} ${file.isDirectory() ? '' : `(${size})`}`);
      } catch (error) {
        console.log(`   ❓ ${file.name} (error reading)`);
      }
    }
  } catch (error) {
    console.error(`❌ Error reading directory: ${error.message}`);
  }
}

/**
 * Main function
 */
async function fixConfigs() {
  console.log('🔧 Fixing JSON config files...\n');
  
  // Ensure target directory exists
  ensureDirectoryExists(TARGET_DIR);
  
  // Check and download mlc-chat-config.json
  const configPath = path.join(TARGET_DIR, 'mlc-chat-config.json');
  if (!fileExistsAndValid(configPath)) {
    try {
      await downloadFile(CONFIG_URL, configPath);
    } catch (error) {
      console.error(`❌ Failed to download mlc-chat-config.json: ${error.message}`);
      process.exit(1);
    }
  } else {
    const stats = fs.statSync(configPath);
    console.log(`✅ mlc-chat-config.json exists (${formatFileSize(stats.size)})`);
  }
  
  // Check and download tokenizer.json
  const tokenizerPath = path.join(TARGET_DIR, 'tokenizer.json');
  if (!fileExistsAndValid(tokenizerPath)) {
    try {
      await downloadFile(TOKENIZER_URL, tokenizerPath);
    } catch (error) {
      console.error(`❌ Failed to download tokenizer.json: ${error.message}`);
      process.exit(1);
    }
  } else {
    const stats = fs.statSync(tokenizerPath);
    console.log(`✅ tokenizer.json exists (${formatFileSize(stats.size)})`);
  }
  
  // List final contents
  listDirectoryContents(TARGET_DIR);
  
  // Verify required files
  console.log('\n🔍 Verification:\n');
  const requiredFiles = [
    'model.wasm',
    'mlc-chat-config.json',
    'tokenizer.json',
    'ndarray-cache.json'
  ];
  
  let allPresent = true;
  for (const filename of requiredFiles) {
    const filePath = path.join(TARGET_DIR, filename);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`✅ ${filename} (${formatFileSize(stats.size)})`);
    } else {
      console.log(`❌ ${filename} - MISSING`);
      allPresent = false;
    }
  }
  
  // Check for params_shard files
  console.log('\n📦 Model weight shards:');
  try {
    const files = fs.readdirSync(TARGET_DIR);
    const shardFiles = files.filter(f => f.startsWith('params_shard_') && f.endsWith('.bin'));
    if (shardFiles.length > 0) {
      console.log(`   Found ${shardFiles.length} shard file(s)`);
      shardFiles.sort().forEach(file => {
        const filePath = path.join(TARGET_DIR, file);
        const stats = fs.statSync(filePath);
        console.log(`   ✅ ${file} (${formatFileSize(stats.size)})`);
      });
    } else {
      console.log('   ⚠️  No shard files found');
    }
  } catch (error) {
    console.log(`   ❌ Error checking shards: ${error.message}`);
  }
  
  console.log('\n' + (allPresent ? '✅ All required config files are present!' : '⚠️  Some files are missing.'));
}

// Run the script
fixConfigs().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

