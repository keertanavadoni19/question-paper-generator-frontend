// Reads an image file, scales it down and returns { src: dataURL, ratio: width / height }.
// Logos and inserted images are stored inside the paper, so they are kept small.
export function readImageFile(file, { maxSide = 1000, maxBytes = 8 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\/(png|jpe?g|gif|bmp|webp)$/i.test(file.type)) return reject(new Error("Choose a PNG, JPG, GIF, BMP or WebP image."));
    if (file.size > maxBytes) return reject(new Error("Image is too large (max 8 MB)."));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      // PNG keeps transparency (logos); photos are stored as JPEG to stay small.
      const png = /png|gif|webp/i.test(file.type);
      resolve({ src: canvas.toDataURL(png ? "image/png" : "image/jpeg", 0.88), ratio: w / h });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this image."));
    };
    img.src = url;
  });
}
