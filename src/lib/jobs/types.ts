export type ReferenceImage = {
  name: string;
  mimeType: string;
  dataUrl: string;
};

export type PlannedAsset = {
  assetNumber: number;
  assetName: string;
  selected: boolean;
  priority: string;
  whereToUse: string;
  bestStyle: string;
  editorMove: string;
  labelNeeded: boolean;
  suggestedLabel: string;
  scriptExcerpt: string;
  scriptPlacement: string;
  scriptWordStart: number;
  scriptWordEnd: number;
  whyItMatters: string;
  whatItShouldShow: string;
  shouldFeelLike: string;
  quickPrompt: string;
  detailedPrompt: string;
  negativePrompt: string;
};

export type JobPlan = {
  diagnosis: {
    titlePromise: string;
    viewerExpectation: string;
    bestEvidenceStyles: string[];
    avoid: string[];
  };
  styleMix: Array<{ style: string; why: string }>;
  checklist: string[];
  doNotShow: string[];
  hookOrder: number[];
  editorNote: string;
  referenceStyleNotes: string;
  recommendedCount: {
    total: number;
    stillImages: number;
    smallVideos: number;
  };
  estimatedImageCostUsd: number;
  assets: PlannedAsset[];
};
