// 全局变量
let video_asset_url = "assets/combined_data.json.gz";
let video_url = "assets/01.webm";

characterVideo.addEventListener('loadedmetadata', () => {
                    console.log("loadedmetadata", characterVideo.videoWidth, characterVideo.videoHeight)
                    canvas_video.width = characterVideo.videoWidth;
                    canvas_video.height = characterVideo.videoHeight;
});

document.addEventListener('DOMContentLoaded', function() {
    // 添加开始按钮事件
    document.getElementById('startMessage').addEventListener('click', function() {
        this.style.display = 'none';
        document.getElementById('screen2').style.display = 'block';
        playCharacterVideo();
    });
});

async function loadSecret(secret) {
    try {
        let jsonString = secret;
        // 分配内存
        // 使用 TextEncoder 计算 UTF-8 字节长度
        function getUTF8Length(str) {
            const encoder = new TextEncoder();
            const encoded = encoder.encode(str);
            return encoded.length + 1; // +1 是为了包含 null 终止符
        }
        let lengthBytes = getUTF8Length(jsonString);
        console.log("GG", lengthBytes, Module)
        let stringPointer = Module._malloc(lengthBytes);
        Module.stringToUTF8(jsonString, stringPointer, lengthBytes);
        Module._processSecret(stringPointer);
        Module._free(stringPointer);
    } catch (error) {
        console.error('Error loadSecret:', error);
        throw error;
    }
}
async function fetchVideoUtilData(gzipUrl) {
        // 从服务器加载 Gzip 压缩的 JSON 文件
        const response = await fetch(gzipUrl);
        const compressedData = await response.arrayBuffer();
        const decompressedData = pako.inflate(new Uint8Array(compressedData), { to: 'string' });
//        const combinedData = JSON.parse(decompressedData);
        return decompressedData;
}
async function newVideoTask(data_url) {
    try {
        let combinedData = await fetchVideoUtilData(data_url);
        await loadSecret(combinedData);
    } catch (error) {
        console.error('视频任务初始化失败:', error);
        alert(`操作失败: ${error.message}`);
    }
}

// 加载纹理的函数
async function loadTextureToWASM(imagePath, textureName) {
    return new Promise((resolve) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => {
            // 创建临时canvas获取像素数据
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);

            // 获取像素数据
            const imageData = ctx.getImageData(0, 0, image.width, image.height);
            console.log("ttt", image.width, image.height)

            // 将数据传递给WASM
            const buffer = Module._malloc(imageData.data.length);
            Module.HEAPU8.set(imageData.data, buffer);

            // 调用WASM中的纹理创建函数
            Module._createTexture(
                textureName,
                buffer,
                image.width,
                image.height
            );

            // 释放内存
            Module._free(buffer);
            resolve();
        };
        image.src = imagePath;
    });
}

// 缓存已处理的视频URL
const videoURLCache = new Map();
// 播放角色视频
async function playCharacterVideo() {
    await newVideoTask(video_asset_url);
    // 获取原始视频URL
    const originalVideoURL = video_url;
    let finalVideoURL = originalVideoURL;

    try {
        // 检查缓存中是否有处理过的URL
        if (!videoURLCache.has(originalVideoURL)) {
            // 获取视频数据并创建同源URL
            const response = await fetch(originalVideoURL, {
                mode: 'cors',
                credentials: 'omit'
            });

            if (!response.ok) throw new Error('视频获取失败');

            // 将响应转为Blob
            const blob = await response.blob();
            // 创建同源对象URL
            const blobURL = URL.createObjectURL(blob);

            // 缓存结果
            videoURLCache.set(originalVideoURL, blobURL);
        }

        // 使用缓存的同源URL
        finalVideoURL = videoURLCache.get(originalVideoURL);
    } catch (error) {
        console.warn('视频中转失败，使用原始URL:', error);
        // 失败时添加时间戳绕过缓存
        finalVideoURL = originalVideoURL + '?ts=' + Date.now();
    }
    console.log(123)
    // 设置视频源（使用同源URL或带时间戳的原始URL）
    characterVideo.src = finalVideoURL;
    characterVideo.loop = true;
    characterVideo.muted = true;
    characterVideo.playsInline = true;

    characterVideo.load();
    console.log(124);
    try {
        await characterVideo.play();
    } catch (e) {
        console.error('视频播放失败:', e);
    }
}