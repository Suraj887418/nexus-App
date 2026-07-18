const faceapi = require('face-api.js');
const canvas = require('canvas');
const path = require('path');

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const modelsPath = path.join(__dirname, 'models');
let modelsLoaded = false;

async function loadModels() {
  if (modelsLoaded) return;
  console.log('Loading AI Face Models...');
  try {
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsPath);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath);
    modelsLoaded = true;
    console.log('✅ AI Face Models Loaded Successfully!');
  } catch (error) {
    console.error('❌ Error loading AI models:', error);
  }
}

async function getFaceDescriptor(base64Image) {
  if (!modelsLoaded) throw new Error('AI Models not loaded yet');
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      try {
        const detection = await faceapi.detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })).withFaceLandmarks().withFaceDescriptor();
        if (!detection) {
          return resolve(null);
        }
        resolve(detection.descriptor);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = (err) => reject(err);
    
    // Remove header if present
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
    img.src = Buffer.from(cleanBase64, 'base64');
  });
}

function compareFaces(descriptor1, descriptor2) {
  // distance < 0.5 is recommended face matching threshold
  const distance = faceapi.euclideanDistance(descriptor1, descriptor2);
  return {
    match: distance <= 0.5,
    distance: distance
  };
}

module.exports = {
  loadModels,
  getFaceDescriptor,
  compareFaces
};
