import {
  getImageConcurrency,
  getImageCostUsd,
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
  const imageUnit = getImageCostUsd();
  const imageCostUsd = roundMoney(assetCount * imageUnit);
  const totalCostUsd = roundMoney(reasoningCostUsd + imageCostUsd);
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
    totalCostUsd,
    reasoningSeconds,
    imageSeconds,
    totalSeconds,
    totalMinutes,
    breakdown: `Reasoning ~$${reasoningCostUsd} (~${reasoningSeconds}s) + ${assetCount} images × $${imageUnit} = $${imageCostUsd} (~${imageSeconds}s at ${imageConcurrency} concurrent) → ~$${totalCostUsd} / ~${minutesLabel} min`,
  };
}
