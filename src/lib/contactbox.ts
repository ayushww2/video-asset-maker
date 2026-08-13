import OpenAI from "openai";
import { contactBoxBaseUrl, contactBoxKey, reasoningModel } from "@/lib/env";

export function createContactBoxClient() {
  const apiKey = contactBoxKey();
  if (!apiKey) throw new Error("CONTACTBOX_API_KEY is not set");
  return new OpenAI({ apiKey, baseURL: contactBoxBaseUrl(), timeout: 180_000 });
}

export function plannerModel() {
  return reasoningModel();
}
