import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_DIR = path.join(__dirname, 'public', 'models', 'llama');
const SEARCH_DIRS = [
  __dirname, // frontend directory
  TARGET_DIR // public/models/llama
];

const REQUIRED_SHARDS = 22; // 0 to 21
const MIN_FILE_SIZE = 1024 * 1024; // 1MB in bytes

/**
 * Recursively find all files starting with "params_shard_" in a directory
 * @param {string} dir - Directory to search
 * @param {string[]} results - Array to store results
 * @param {string} baseDir - Base directory for relative paths
 */
function findShardFiles(dir, results = [], baseDir = dir) {
  if (!fs.existsSync(dir)) {
    return results;
  }

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively search subdirectories
        findShardFiles(fullPath, results, baseDir);
      } else if (entry.isFile() && entry.name.startsWith('params_shard_')) {
        results.push({
          path: fullPath,
          name: entry.name,
          relativePath: path.relative(baseDir, fullPath)
        });
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }
  
  return results;
}

/**
 * Format file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string}
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Ensure target directory exists
 * @param {string} dirPath - Directory path
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Move a file to target directory
 * @param {string} sourcePath - Source file path
 * @param {string} targetPath - Target file path
 */
function moveFile(sourcePath, targetPath) {
  try {
    // If target exists, remove it first (overwrite)
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
    fs.renameSync(sourcePath, targetPath);
    return true;
  } catch (error) {
    console.error(`Error moving file ${sourcePath}:`, error.message);
    return false;
  }
}

/**
 * Main function to organize model files
 */
async function organizeModel() {
  console.log('🔍 Searching for model weight files...\n');
  
  // Find all shard files in search directories
  const foundFiles = [];
  for (const searchDir of SEARCH_DIRS) {
    const files = findShardFiles(searchDir);
    foundFiles.push(...files);
  }
  
  if (foundFiles.length === 0) {
    console.log('❌ No params_shard_* files found.');
    return;
  }
  
  console.log(`📦 Found ${foundFiles.length} shard file(s):\n`);
  
  // Ensure target directory exists
  ensureDirectoryExists(TARGET_DIR);
  
  // Process each found file
  const processedFiles = new Map();
  
  for (const file of foundFiles) {
    let sourcePath = file.path;
    let filename = file.name;
    
    // Check if file needs .bin extension
    if (!filename.endsWith('.bin')) {
      const newFilename = filename + '.bin';
      const tempPath = path.join(path.dirname(sourcePath), newFilename);
      
      console.log(`📝 Renaming ${filename} → ${newFilename}`);
      try {
        fs.renameSync(sourcePath, tempPath);
        sourcePath = tempPath;
        filename = newFilename;
      } catch (error) {
        console.error(`❌ Error renaming ${filename}:`, error.message);
        continue;
      }
    }
    
    // Extract shard number
    const match = filename.match(/params_shard_(\d+)\.bin/);
    if (!match) {
      console.log(`⚠️  Skipping invalid filename: ${filename}`);
      continue;
    }
    
    const shardNum = parseInt(match[1], 10);
    const targetPath = path.join(TARGET_DIR, filename);
    
    // Check if file is already in target location
    if (path.resolve(sourcePath) === path.resolve(targetPath)) {
      console.log(`✓ ${filename} already in target location`);
    } else {
      // Check if source file still exists (might have been moved already)
      if (!fs.existsSync(sourcePath)) {
        console.log(`⚠️  ${filename} already moved, skipping`);
        // Check if target exists instead
        if (fs.existsSync(targetPath)) {
          try {
            const stats = fs.statSync(targetPath);
            processedFiles.set(shardNum, {
              path: targetPath,
              filename: filename,
              size: stats.size
            });
          } catch (error) {
            // Ignore
          }
        }
        continue;
      }
      
      console.log(`📦 Moving ${filename} to target directory...`);
      if (!moveFile(sourcePath, targetPath)) {
        continue;
      }
    }
    
    // Get file size
    try {
      const stats = fs.statSync(targetPath);
      processedFiles.set(shardNum, {
        path: targetPath,
        filename: filename,
        size: stats.size
      });
      console.log(`   Size: ${formatFileSize(stats.size)}\n`);
    } catch (error) {
      console.error(`❌ Error reading ${filename}:`, error.message);
    }
  }
  
  // Validate all shards are present
  console.log('🔍 Validating shard files...\n');
  
  // Also check target directory for any files that might already be there
  if (fs.existsSync(TARGET_DIR)) {
    try {
      const existingFiles = fs.readdirSync(TARGET_DIR);
      for (const filename of existingFiles) {
        const match = filename.match(/params_shard_(\d+)\.bin/);
        if (match) {
          const shardNum = parseInt(match[1], 10);
          if (!processedFiles.has(shardNum)) {
            const filePath = path.join(TARGET_DIR, filename);
            try {
              const stats = fs.statSync(filePath);
              processedFiles.set(shardNum, {
                path: filePath,
                filename: filename,
                size: stats.size
              });
            } catch (error) {
              // Ignore
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error reading target directory:`, error.message);
    }
  }
  
  const missingShards = [];
  const invalidShards = [];
  
  for (let i = 0; i < REQUIRED_SHARDS; i++) {
    const shard = processedFiles.get(i);
    
    if (!shard) {
      missingShards.push(i);
      continue;
    }
    
    // Check file size
    if (shard.size < MIN_FILE_SIZE) {
      invalidShards.push({
        shard: i,
        size: shard.size,
        filename: shard.filename
      });
    } else {
      console.log(`✅ Shard ${i}: ${shard.filename} (${formatFileSize(shard.size)})`);
    }
  }
  
  console.log('');
  
  // Report results
  if (missingShards.length > 0) {
    console.log(`❌ Missing shards: ${missingShards.join(', ')}`);
  }
  
  if (invalidShards.length > 0) {
    console.log(`❌ Invalid shards (size < 1MB):`);
    for (const invalid of invalidShards) {
      console.log(`   - Shard ${invalid.shard}: ${invalid.filename} (${formatFileSize(invalid.size)})`);
    }
  }
  
  // Final status
  if (missingShards.length === 0 && invalidShards.length === 0 && processedFiles.size === REQUIRED_SHARDS) {
    console.log('✅ READY TO ACTIVATE');
  } else {
    console.log(`\n⚠️  Status: ${processedFiles.size}/${REQUIRED_SHARDS} valid shards found`);
  }
}

// Run the script
organizeModel().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

