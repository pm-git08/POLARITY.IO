// --- DOM ELEMENT REFERENCES ---
const imageUpload = document.getElementById('imageUpload');
const originalImage = document.getElementById('originalImage');
const outputCanvas = document.getElementById('outputCanvas');
const convertBtn = document.getElementById('convertBtn');
const statusDiv = document.getElementById('status');
const loader = document.getElementById('loader');
const imageContainer = document.getElementById('imageContainer');
const compareSlider = document.getElementById('compareSlider');
const saveContainer = document.getElementById('saveContainer');
const savePngBtn = document.getElementById('savePngBtn');
const saveJpgBtn = document.getElementById('saveJpgBtn');
const saveWebpBtn = document.getElementById('saveWebpBtn');
const installBtnContainer = document.getElementById('installBtnContainer');
const installBtn = document.getElementById('installBtn');
// New Correction Refs
const correctionContainer = document.getElementById('correctionContainer');
const orangeMaskSlider = document.getElementById('orangeMaskSlider');
const orangeMaskValue = document.getElementById('orangeMaskValue');
const resetBtn = document.getElementById('resetBtn');


// STATE MANAGEMENT --->> imp
let isCvReady = false;
let isImageLoaded = false;
let deferredPrompt;
let originalInvertedMat = null; 


const delay = ms => new Promise(res => setTimeout(res, ms));

function onOpenCvReady() {
    isCvReady = true;
    statusDiv.textContent = 'System Ready. Please Upload Target Image.';
    updateButtonState();
}

function updateButtonState() {
    convertBtn.disabled = !(isCvReady && isImageLoaded);
}

async function performConversion() {
    if (!isCvReady || !isImageLoaded) return;

    loader.classList.remove('hidden');
    convertBtn.disabled = true;
    saveContainer.classList.add('hidden');
    correctionContainer.classList.add('hidden');

    try {
        statusDiv.textContent = 'Initiating System Scan...';
        await delay(1000); 
        statusDiv.textContent = 'Calibrating Polarity Matrix...';
        await delay(1500);
        statusDiv.textContent = 'Executing Quantum Inversion...';
        await delay(1500);

        let src = cv.imread(originalImage);
        if (originalInvertedMat) {
            originalInvertedMat.delete();
        }
        originalInvertedMat = new cv.Mat();
        let rgbSrc = new cv.Mat();
        cv.cvtColor(src, rgbSrc, cv.COLOR_RGBA2RGB);
        cv.bitwise_not(rgbSrc, originalInvertedMat);
        
        resetCorrections(); // For Applying to showing initial conversion

        statusDiv.innerHTML = 'Success! <span style="color: var(--secondary-glow);">Inversion Complete.</span>';
        compareSlider.value = 50;
        updateComparisonView(50);
        saveContainer.classList.remove('hidden');
        correctionContainer.classList.remove('hidden');
        
        src.delete();
        rgbSrc.delete();

    } catch (error) {
        statusDiv.textContent = 'Error: Processing Core Failure.';
        console.error("Conversion Error:", error);
    } finally {
        loader.classList.add('hidden');
        updateButtonState();
    }
}

function applyCorrections() {
    if (!originalInvertedMat || originalInvertedMat.isDeleted()) return;

    let correctedMat = originalInvertedMat.clone();
    
    // Orange Mask Correction --->> needed
    const orangeVal = parseInt(orangeMaskSlider.value);
    orangeMaskValue.textContent = orangeVal;
    if (orangeVal > 0) {
        let channels = new cv.MatVector();
        cv.split(correctedMat, channels);
        let blueChannel = channels.get(2);
        cv.add(blueChannel, new cv.Mat(blueChannel.rows, blueChannel.cols, blueChannel.type(), new cv.Scalar(orangeVal * 1.2)), blueChannel);
        let greenChannel = channels.get(1);
        cv.add(greenChannel, new cv.Mat(greenChannel.rows, greenChannel.cols, greenChannel.type(), new cv.Scalar(orangeVal * 0.2)), greenChannel);

        cv.merge(channels, correctedMat);
        channels.delete();
    }

    cv.imshow('outputCanvas', correctedMat);
    correctedMat.delete();
}

function resetCorrections() {
    orangeMaskSlider.value = 0;
    applyCorrections();
}


function updateComparisonView(value) {
    outputCanvas.style.clipPath = `polygon(0 0, ${value}% 0, ${value}% 100%, 0 100%)`;
}

function downloadImage(format) {
    const mimeTypeMap = { 'png': 'image/png', 'jpg': 'image/jpeg', 'webp': 'image/webp' };
    const mimeType = mimeTypeMap[format];
    if (!mimeType) return;
    const link = document.createElement('a');
    link.download = `polarity-io-export.${format}`;
    if (format === 'jpg') {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = outputCanvas.width;
        tempCanvas.height = outputCanvas.height;
        const ctx = tempCanvas.getContext('2d');
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        ctx.drawImage(outputCanvas, 0, 0);
        link.href = tempCanvas.toDataURL(mimeType, 0.9);
    } else {
        link.href = outputCanvas.toDataURL(mimeType);
    }
    link.click();
}

function showInstallPromotion() {
    installBtnContainer.classList.remove('hidden');
}

// EVENT LISTENERS --->> PM
imageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    imageContainer.classList.add('hidden');
    saveContainer.classList.add('hidden');
    correctionContainer.classList.add('hidden');
    statusDiv.textContent = 'Loading Target Image...';
    isImageLoaded = false;
    updateButtonState();
    const reader = new FileReader();
    reader.onload = (event) => {
        originalImage.src = event.target.result;
    };
    originalImage.onload = () => {
        isImageLoaded = true;
        imageContainer.classList.remove('hidden');
        statusDiv.textContent = 'Target Acquired. Initiate Inversion.';
        updateButtonState();
        compareSlider.value = 50;
        updateComparisonView(0);
    };
    reader.readAsDataURL(file);
});

convertBtn.addEventListener('click', performConversion);
compareSlider.addEventListener('input', (e) => updateComparisonView(e.target.value));
savePngBtn.addEventListener('click', () => downloadImage('png'));
saveJpgBtn.addEventListener('click', () => downloadImage('jpg'));
saveWebpBtn.addEventListener('click', () => downloadImage('webp'));
installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) {
        return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    deferredPrompt = null;
    installBtnContainer.classList.add('hidden');
});
orangeMaskSlider.addEventListener('input', applyCorrections);
resetBtn.addEventListener('click', resetCorrections);

//  PWA & SERVICE WORKER LOGIC --->> PM
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallPromotion();
  console.log(`'beforeinstallprompt' event was fired.`);
});

if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('Service Worker: Online'))
            .catch(err => console.error('Service Worker: Connection Failed', err));
    });
}

