import {
  getImageConcurrency,
  getImageCostUsd,
  getImageCreditsPerImage,
  getImageSecondsAvg,
  getReasoningCostUsd,
  getReasoningSecondsAvg,
} from "@/lib/env";

export type CostEstimate = {
  assetCount: number;
  imageConcurrency: number;
  imageBatches: number;
  reasoningCostUsd: number;
  imageCostUsd: number;
  imageCreditsPerImage: number;
  imageCreditsTotal: number;
  totalCostUsd: number;
  reasoningSeconds: number;
  imageSeconds: number;
  totalSeconds: number;
  totalMinutes: number;
  breakdown: string;
};

function roundMoney(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function estimateJob(input: {
  assetCount: number;
  referenceCount?: number;
}): CostEstimate {
  const assetCount = Math.min(25, Math.max(1, Math.round(input.assetCount || 1)));
  const imageConcurrency = getImageConcurrency();
  const imageBatches = Math.ceil(assetCount / imageConcurrency);
  const reasoningCostUsd = roundMoney(getReasoningCostUsd());
  const creditsEach = getImageCreditsPerImage();
  const imageUnit = getImageCostUsd();
  const imageCostUsd = roundMoney(assetCount * imageUnit);
  const imageCreditsTotal = assetCount * creditsEach;
  const totalCostUsd = roundMoney(reasoningCostUsd + imageCostUsd);
  const imageCostLine = `${assetCount} images × ${creditsEach} credits = ${imageCreditsTotal} credits (~$${imageCostUsd})`;
  const reasoningSeconds = getReasoningSecondsAvg();
  const imageSeconds = imageBatches * getImageSecondsAvg();
  const totalSeconds = reasoningSeconds + imageSeconds;
  const totalMinutes = Math.round((totalSeconds / 60) * 10) / 10;
  const minutesLabel = Math.max(1, Math.round(totalMinutes));

  return {
    assetCount,
    imageConcurrency,
    imageBatches,
    reasoningCostUsd,
    imageCostUsd,
    imageCreditsPerImage: creditsEach,
    imageCreditsTotal,
    totalCostUsd,
    reasoningSeconds,
    imageSeconds,
    totalSeconds,
    totalMinutes,
    breakdown: `Reasoning ~$${reasoningCostUsd} (~${reasoningSeconds}s) + ${imageCostLine} (~${imageSeconds}s at ${imageConcurrency} concurrent) → ~$${totalCostUsd} / ~${minutesLabel} min`,
  };
}
