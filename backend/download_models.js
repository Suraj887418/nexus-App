const https = require('https');
const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, 'models');
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir);
}

const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';

const files = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2'
];

async function downloadFile(filename) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(modelsDir, filename);
    if (fs.existsSync(filePath)) {
      console.log(`✅ Already exists: ${filename}`);
      return resolve();
    }
    
    console.log(`Downloading ${filename}...`);
    const file = fs.createWriteStream(filePath);
    
    https.get(baseUrl + filename, (response) => {
      if (response.statusCode !== 200) {
        fs.unlinkSync(filePath);
        return reject(new Error(`Failed to download ${filename}: ${response.statusCode}`));
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`✅ Downloaded: ${filename}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlinkSync(filePath);
      reject(err);
    });
  });
}

async function downloadAll() {
  console.log('Downloading face-api.js models...');
  try {
    for (const file of files) {
      await downloadFile(file);
    }
    console.log('🎉 All models downloaded successfully!');
  } catch (error) {
    console.error('❌ Error downloading models:', error);
    process.exit(1);
  }
}

downloadAll();
