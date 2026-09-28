import OpenAI from "openai";
import {
  getContactBoxApiKey,
  getContactBoxBaseUrl,
  getReasoningModel,
  getReasoningTimeoutMs,
} from "@/lib/env";

export function createContactBoxClient() {
  const apiKey = getContactBoxApiKey();
  if (!apiKey) {
    throw new Error("CONTACTBOX_API_KEY is not set");
  }
  return new OpenAI({
    apiKey,
    baseURL: getContactBoxBaseUrl(),
    timeout: getReasoningTimeoutMs(),
  });
}

export function getPlannerModel() {
  return getReasoningModel();
}
