const IMAGE_MIME = /^image\//i;
const CODE_FILE = /\.(ts|tsx|js|jsx|py|json|md|html|css|sql|sh|txt|csv)$/i;

export function requiredMoonexCapabilities(context = {}) {
  const messages = Array.isArray(context.messages) ? context.messages : [];
  const files = messages.flatMap((message) => Array.isArray(message?.files) ? message.files : []);
  const capabilities = [];

  if (files.some((file) => IMAGE_MIME.test(String(file?.mimeType || '')) || file?.type === 'image')) capabilities.push('vision');
  if (context.enableWebSearch === true) capabilities.push('search');
  if (typeof context.thinkingLevel === 'string' && context.thinkingLevel !== 'none') capabilities.push('reasoning');
  if (files.some((file) => file?.type === 'code' || CODE_FILE.test(String(file?.name || '')))) capabilities.push('tools');

  return [...new Set(capabilities)];
}

export function profileSupportsMoonexCapabilities(profile, required) {
  const profileCapabilities = new Set(profile?.requiredCapabilities || []);
  return (required || []).every((capability) => profileCapabilities.has(capability));
}

export function capabilityContractError(required) {
  return {
    code: 'CAPABILITY_CONTRACT_VIOLATION',
    requiredCapabilities: [...new Set(required || [])],
  };
}
