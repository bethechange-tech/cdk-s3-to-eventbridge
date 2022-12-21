import Jimp = require('jimp');

function getColor(
  x: number,
  y: number,
  hex = false,
  src: any,
  originalX?: number,
  originalY?: number
) {
  const width = src.bitmap.width;
  const height = src.bitmap.height;
  if (x > 0 && x < width && y > 0 && y < height) {
    return hex ? src.getPixelColor(x, y) : Jimp.intToRGBA(src.getPixelColor(x, y));
  } else {
    if (originalX && originalY) {
      return hex
        ? src.getPixelColor(originalX, originalY)
        : Jimp.intToRGBA(src.getPixelColor(originalX, originalY));
    }
    return hex ? 0x00000000 : { r: 0, g: 0, b: 0, a: 0 };
  }
}

// use sobel
function drawEdge(grey: any, edge: Jimp) {
  const height = edge.bitmap.height;
  const width = edge.bitmap.width;
  const kernelX = [
    [-1, 0, 1],
    [-2, 0, 2],
    [-1, 0, 1],
  ];

  const kernelY = [
    [-1, -2, -1],
    [0, 0, 0],
    [1, 2, 1],
  ];

  const getGreyAt = (x: number, y: number) => getColor(x, y, false, grey).r;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pX =
        kernelX[0][0] * getGreyAt(x - 1, y - 1) +
        kernelX[0][1] * getGreyAt(x, y - 1) +
        kernelX[0][2] * getGreyAt(x + 1, y - 1) +
        kernelX[1][0] * getGreyAt(x - 1, y) +
        kernelX[1][1] * getGreyAt(x, y) +
        kernelX[1][2] * getGreyAt(x + 1, y) +
        kernelX[2][0] * getGreyAt(x - 1, y + 1) +
        kernelX[2][1] * getGreyAt(x, y + 1) +
        kernelX[2][2] * getGreyAt(x + 1, y + 1);

      const pY =
        kernelY[0][0] * getGreyAt(x - 1, y - 1) +
        kernelY[0][1] * getGreyAt(x, y - 1) +
        kernelY[0][2] * getGreyAt(x + 1, y - 1) +
        kernelY[1][0] * getGreyAt(x - 1, y) +
        kernelY[1][1] * getGreyAt(x, y) +
        kernelY[1][2] * getGreyAt(x + 1, y) +
        kernelY[2][0] * getGreyAt(x - 1, y + 1) +
        kernelY[2][1] * getGreyAt(x, y + 1) +
        kernelY[2][2] * getGreyAt(x + 1, y + 1);
      const channel = Math.sqrt(pX * pX + pY * pY) >>> 0;
      const hex = 0x00000000 + channel;
      edge.setPixelColor(hex, x, y);
    }
  }
  return edge;
}

function bilateralFilter(canvas: Jimp, raw: any, radius = 5) {
  const distance2 = function (v1: number[], v2: number[]) {
    let sum = 0;
    for (let i = 0; i < v1.length; i++) {
      sum += (v1[i] - v2[i]) * (v1[i] - v2[i]);
    }
    return sum;
  };

  let bilateralFilterWeight = function (
    x: number,
    y: number,
    centerX: number,
    centerY: number,
    sigD = 100,
    sigR = 100
  ) {
    const c1 = getColor(x, y, false, raw, centerX, centerY);
    const c2 = getColor(centerX, centerY, false, raw, centerX, centerY);
    const cArray1 = [c1.r, c1.g, c1.b, c1.a];
    const cArray2 = [c2.r, c2.g, c2.b, c2.a];

    return Math.exp(
      -(distance2([x, y], [centerX, centerY]) / (2 * sigD)) -
        distance2(cArray1, cArray2) / (2 * sigR)
    );
  };

  const width = raw.bitmap.width;
  const height = raw.bitmap.height;

  raw.scan(0, 0, width, height, (x: number, y: number, idx: number) => {
    let sumW = 0;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let sumA = 0;

    for (let i = x - radius; i <= x + radius; i++) {
      for (let j = y - radius; j <= y + radius; j++) {
        const w = bilateralFilterWeight(i, j, x, y);
        const nbrIdx = (j * width + i) * 4;
        if (nbrIdx < 0 || nbrIdx > width * height * 4 - 1) continue;
        const r = w * raw.bitmap.data[nbrIdx];
        const g = w * raw.bitmap.data[nbrIdx + 1];
        const b = w * raw.bitmap.data[nbrIdx + 2];
        const a = w * raw.bitmap.data[nbrIdx + 3];
        sumW += w;
        sumR += r;
        sumG += g;
        sumB += b;
        sumA += a;
      }
    }
    canvas.bitmap.data[idx] = sumR / sumW;
    canvas.bitmap.data[idx + 1] = sumG / sumW;
    canvas.bitmap.data[idx + 2] = sumB / sumW;
    canvas.bitmap.data[idx + 3] = sumA / sumW;
  });
  return canvas;
}

function composite(edge: Jimp, blurred: Jimp, output: Jimp, edgeWeakening = 40) {
  let width = edge.bitmap.width;
  let height = edge.bitmap.height;

  edge.blur(1);
  let sigmoid = function (x: number) {
    return 1 / (1 + Math.exp(-x));
  };

  edge.scan(0, 0, width, height, (x: number, y: number, idx: number) => {
    let a = edge.bitmap.data[idx + 3];
    a = 255 * sigmoid(a - edgeWeakening);
    // let overlapAlpha = a*1.5>255?255:a*1.5;
    const overlapAlpha = a;

    const weight = 1 - overlapAlpha / 255.0;
    const rawR = blurred.bitmap.data[idx + 0];
    const rawG = blurred.bitmap.data[idx + 1];
    const rawB = blurred.bitmap.data[idx + 2];
    const rawA = blurred.bitmap.data[idx + 3];

    output.bitmap.data[idx + 0] = weight * rawR;
    output.bitmap.data[idx + 1] = weight * rawG;
    output.bitmap.data[idx + 2] = weight * rawB;
    output.bitmap.data[idx + 3] = 255;
  });

  return output;
}

class Cartoonlization {
  private opt: Record<string, any>;
  private output: Jimp;
  private edge: Jimp;
  private blurred: Jimp;
  private src: any;

  constructor(opt: {
    blurMode: {
      name: string;
      radius: number;
    };
    edgeWeakening: number;
    resize: boolean;
  }) {
    let DEFAULT_OPT = {
      blurMode: {
        name: 'bilateral',
        radius: 5,
      },
      edgeWeakening: 50,
      resize: true,
    };

    this.opt = opt || DEFAULT_OPT;
  }

  public init(srcPath: string) {
    return Jimp.read(srcPath)
      .then((img: any) => {
        this.src = this.opt.resize ? img.resize(400, Jimp.AUTO) : img;
        return Promise.resolve(img);
      })
      .catch((err: Error) => console.error('error: ' + err))
      .then((img: Jimp) => {
        const width = img.bitmap.width;
        const height = img.bitmap.height;

        const promiseOutput = new Promise((resolve) => {
          this.output = new Jimp(width, height, 0x00000000);
          resolve(this);
        });

        const promiseEdge = new Promise((resolve) => {
          this.edge = new Jimp(width, height, 0x00000000);
          resolve(this);
        });

        const promiseBlurred = new Promise((resolve) => {
          this.blurred = new Jimp(width, height, 0x00000000);
          resolve(this);
        });

        return Promise.all([promiseOutput, promiseEdge, promiseBlurred]);
      });
  }

  public make() {
    const opt = this.opt;

    if (opt.blurMode.name === 'bilateral') {
      console.log('bilateral filtering takes longer time...');
      this.blurred = bilateralFilter(this.blurred, this.src, opt.blurMode.radius);
    } else if (opt.blurMode.name === 'gaussian') {
      this.blurred = this.src.clone().gaussian(opt.blurMode.radius);
    } else {
      this.blurred = this.src.clone().blur(opt.blurMode.radius);
    }

    // edge
    this.edge = drawEdge(this.src.clone().greyscale(), this.edge);
    this.output = composite(this.edge, this.blurred, this.output, opt.edgeWeakening);
  }

  public toFile(path = './output.png') {
    this.output.write(path);
  }

  public async getBufferAsync() {
    const mime = this.output.getMIME();

    return this.output.quality(90).getBufferAsync(mime);
  }

  public async getBase64Async() {
    const mime = this.output.getMIME();

    return this.output.quality(90).getBase64Async(mime);
  }
}

export default Cartoonlization;
