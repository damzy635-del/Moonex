export type MoonexRequestCapability = 'vision' | 'search' | 'reasoning' | 'tools';

type RequestFile = {
  mimeType?: string;
  type?: string;
  name?: string;
};

type RequestMessage = {
  files?: RequestFile[];
};

export type MoonexCapabilityContext = {
  messages?: RequestMessage[];
  enableWebSearch?: boolean;
  thinkingLevel?: string;
};

const IMAGE_MIME = /^image\//i;
const CODE_FILE = /\.(ts|tsx|js|jsx|py|json|md|html|css|sql|sh|txt|csv)$/i;

export function requiredMoonexCapabilities(context: MoonexCapabilityContext = {}): MoonexRequestCapability[] {
  const messages = Array.isArray(context.messages) ? context.messages : [];
  const files = messages.flatMap((message) => Array.isArray(message?.files) ? message.files : []);
  const capabilities: MoonexRequestCapability[] = [];

  if (files.some((file) => IMAGE_MIME.test(String(file?.mimeType || '')) || file?.type === 'image')) capabilities.push('vision');
  if (context.enableWebSearch === true) capabilities.push('search');
  if (typeof context.thinkingLevel === 'string' && context.thinkingLevel !== 'none') capabilities.push('reasoning');
  if (files.some((file) => file?.type === 'code' || CODE_FILE.test(String(file?.name || '')))) capabilities.push('tools');

  return [...new Set(capabilities)];
}

export function profileSupportsMoonexCapabilities(profile: { requiredCapabilities?: MoonexRequestCapability[] }, required: MoonexRequestCapability[]) {
  const profileCapabilities = new Set(profile?.requiredCapabilities || []);
  return required.every((capability) => profileCapabilities.has(capability));
}

export function capabilityContractError(required: MoonexRequestCapability[]) {
  return {
    code: 'CAPABILITY_CONTRACT_VIOLATION',
    requiredCapabilities: [...new Set(required)],
  };
}
