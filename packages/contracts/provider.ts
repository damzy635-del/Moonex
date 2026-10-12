export type ProviderId="openai"|"google"|"mistral"|"groq";
export type Capability="text"|"vision"|"reasoning"|"code"|"research";
export interface GenerateInput{model:string;system?:string;messages:Array<{role:"user"|"assistant";content:string}>;signal?:AbortSignal}
export interface GenerateResult{text:string;usage?:{inputTokens?:number;outputTokens?:number};provider:ProviderId;upstreamModelId:string}
export interface AIProviderAdapter{readonly id:ProviderId;generate(input:GenerateInput):Promise<GenerateResult>;stream(input:GenerateInput):AsyncIterable<string>;verifyCredentials():Promise<boolean>}