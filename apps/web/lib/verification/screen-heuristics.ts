import sharp from 'sharp';
import type { ScreenHeuristicResult } from './types';

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function proximity(value: number, target: number, tolerance: number): number {
  return clamp(1 - Math.abs(value - target) / tolerance);
}

function commonAspectMatch(width: number, height: number): number {
  const ratio = Math.max(width, height) / Math.min(width, height);
  return Math.max(
    proximity(ratio, 16 / 9, 0.045),
    proximity(ratio, 16 / 10, 0.045),
    proximity(ratio, 4 / 3, 0.04),
  );
}

function commonResolutionMatch(width: number, height: number): number {
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  const displays: Array<[number, number]> = [
    [3840, 2160], [2560, 1440], [1920, 1080], [1680, 1050], [1600, 900],
    [1440, 900], [1366, 768], [1280, 800], [1280, 720], [1170, 2532],
    [1290, 2796], [1080, 2400],
  ];
  return displays.reduce((best, [displayLong, displayShort]) => {
    const delta = Math.abs(long - displayLong) / displayLong
      + Math.abs(short - displayShort) / displayShort;
    return Math.max(best, clamp(1 - delta / 0.04));
  }, 0);
}

function autocorrelation(values: number[], lag: number): number {
  if (values.length <= lag + 1) return 0;
  let mean = 0;
  for (const value of values) mean += value;
  mean /= values.length;
  let numerator = 0;
  let leftPower = 0;
  let rightPower = 0;
  for (let index = 0; index < values.length - lag; index += 1) {
    const left = (values[index] ?? 0) - mean;
    const right = (values[index + lag] ?? 0) - mean;
    numerator += left * right;
    leftPower += left * left;
    rightPower += right * right;
  }
  if (leftPower <= 0 || rightPower <= 0) return 0;
  return clamp(Math.abs(numerator / Math.sqrt(leftPower * rightPower)));
}

export async function analyzeScreenRephotographHeuristics(
  bytes: Buffer,
  sourceWidth: number,
  sourceHeight: number,
  threshold: number,
): Promise<ScreenHeuristicResult> {
  const { data, info } = await sharp(bytes, { failOn: 'none', limitInputPixels: 100_000_000 })
    .resize({ width: 256, height: 256, fit: 'inside', withoutEnlargement: false })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const horizontalEdges: number[] = [];
  const verticalEdges: number[] = [];
  let edgeTotal = 0;
  let edgeCount = 0;
  let highlights = 0;
  let borderTotal = 0;
  let borderCount = 0;
  let interiorTotal = 0;
  let interiorCount = 0;

  const pixel = (x: number, y: number) => data[y * width + x] ?? 0;
  for (let y = 0; y < height; y += 1) {
    let rowEdge = 0;
    for (let x = 0; x < width; x += 1) {
      const current = pixel(x, y);
      if (current >= 245) highlights += 1;
      const border = x < 5 || y < 5 || x >= width - 5 || y >= height - 5;
      if (border) {
        borderTotal += current;
        borderCount += 1;
      } else {
        interiorTotal += current;
        interiorCount += 1;
      }
      if (x > 0) {
        const difference = Math.abs(current - pixel(x - 1, y)) / 255;
        rowEdge += difference;
        edgeTotal += difference;
        edgeCount += 1;
      }
    }
    horizontalEdges.push(rowEdge / Math.max(1, width - 1));
  }

  for (let x = 0; x < width; x += 1) {
    let columnEdge = 0;
    for (let y = 1; y < height; y += 1) {
      columnEdge += Math.abs(pixel(x, y) - pixel(x, y - 1)) / 255;
    }
    verticalEdges.push(columnEdge / Math.max(1, height - 1));
  }

  let periodicTexture = 0;
  for (let lag = 2; lag <= 8; lag += 1) {
    periodicTexture = Math.max(
      periodicTexture,
      autocorrelation(horizontalEdges, lag),
      autocorrelation(verticalEdges, lag),
    );
  }

  const edgeDensity = clamp((edgeTotal / Math.max(1, edgeCount)) / 0.22);
  const borderMean = borderTotal / Math.max(1, borderCount);
  const interiorMean = interiorTotal / Math.max(1, interiorCount);
  const borderContrast = clamp(Math.abs(borderMean - interiorMean) / 70);
  const highlightFraction = clamp((highlights / Math.max(1, width * height)) / 0.12);
  const displayAspectMatch = commonAspectMatch(sourceWidth, sourceHeight);
  const displayResolutionMatch = commonResolutionMatch(sourceWidth, sourceHeight);

  // This intentionally cannot clear an image. It is an escalation-only heuristic.
  // Texture periodicity receives the largest weight; dimensions and highlights are
  // weak supporting signals because legitimate photos can share them.
  const score = clamp(
    periodicTexture * 0.48
    + edgeDensity * 0.18
    + borderContrast * 0.14
    + highlightFraction * 0.08
    + displayAspectMatch * 0.07
    + displayResolutionMatch * 0.05,
  );

  const reasons: string[] = [];
  if (periodicTexture >= 0.65) reasons.push('periodic high-frequency texture consistent with moire or a pixel grid');
  if (borderContrast >= 0.65) reasons.push('strong border-to-interior contrast consistent with a cropped bezel or print edge');
  if (highlightFraction >= 0.75) reasons.push('unusually concentrated bright reflections');
  if (displayAspectMatch >= 0.9 && displayResolutionMatch >= 0.9) reasons.push('dimensions closely match a common display capture');

  return {
    score,
    suspected: score >= threshold,
    coverage: 'partial_v1',
    signals: {
      periodicTexture,
      edgeDensity,
      borderContrast,
      highlightFraction,
      displayAspectMatch,
      displayResolutionMatch,
    },
    reasons,
    limitations: [
      'May miss tightly cropped, defocused or high-quality screen rephotographs.',
      'May miss a screen or print that occupies only a small region of the image.',
      'Dimension and reflection cues are weak and never produce an automatic rejection.',
      'This v1 heuristic is not a trained recapture classifier and only triggers escalation.',
    ],
  };
}
