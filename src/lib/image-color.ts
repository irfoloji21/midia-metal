export const sampleImageEdgeColor = (image: HTMLImageElement): string | null => {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  try {
    context.drawImage(image, 0, 0, size, size);
    const pixels = context.getImageData(0, 0, size, size).data;
    const channels: [number[], number[], number[]] = [[], [], []];
    const edge = 5;

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (x >= edge && x < size - edge && y >= edge && y < size - edge) continue;

        const offset = (y * size + x) * 4;
        if (pixels[offset + 3] < 200) continue;

        channels[0].push(pixels[offset]);
        channels[1].push(pixels[offset + 1]);
        channels[2].push(pixels[offset + 2]);
      }
    }

    if (channels[0].length === 0) return null;

    const median = (values: number[]) => {
      values.sort((a, b) => a - b);
      return values[Math.floor(values.length / 2)];
    };

    return `rgb(${median(channels[0])}, ${median(channels[1])}, ${median(channels[2])})`;
  } catch {
    // Cross-origin images without CORS headers still render; their blurred backdrop remains visible.
    return null;
  }
};
