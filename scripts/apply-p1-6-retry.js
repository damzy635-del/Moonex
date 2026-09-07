const fs = require('node:fs');

const path = 'src/App.tsx';
let source = fs.readFileSync(path, 'utf8');

const importAnchor = "import { normalizeMoonexModelId } from '../lib/moonex-models';";
const imports = "import { prepareMessageEdit, prepareMessageRegeneration } from './utils/conversationActions';\nimport { prepareMessageRetry } from './utils/conversationRetry';";
if (!source.includes(imports)) {
  if (!source.includes(importAnchor)) throw new Error('App import anchor not found');
  source = source.replace(importAnchor, `${importAnchor}\n${imports}`);
}

const editOld = `    const msgIndex = currentConversation.messages.findIndex((m) => m.id === messageId);\n    if (msgIndex === -1) return;\n\n    const targetMsg = currentConversation.messages[msgIndex];\n    // Keep messages strictly prior to this message\n    const trimmed = currentConversation.messages.slice(0, msgIndex);`;
const editNew = `    const mutation = prepareMessageEdit(currentConversation.messages, messageId, newContent);\n    if (!mutation || !mutation.targetMessage) return;\n\n    const targetMsg = mutation.targetMessage;\n    const trimmed = mutation.messages;`;
if (source.includes(editOld)) source = source.replace(editOld, editNew);
source = source.replace('    handleSendMessage(newContent, targetMsg.files || []);', '    handleSendMessage(targetMsg.content, targetMsg.files || [], undefined, trimmed);');

const signatureOld = `    text: string,\n    files: FileAttachment[] = [],\n    modelOverride?: string,\n  ) => {`;
const signatureNew = `    text: string,\n    files: FileAttachment[] = [],\n    modelOverride?: string,\n    baseMessages?: Message[],\n  ) => {`;
if (source.includes(signatureOld)) source = source.replace(signatureOld, signatureNew);
source = source.replace(
  '    const selectedModelId = normalizeMoonexModelId(modelOverride || currentConversation.model);',
  '    const conversationMessages = baseMessages ?? currentConversation.messages;\n    const selectedModelId = normalizeMoonexModelId(modelOverride || currentConversation.model);'
);
source = source.replace(
  '    const isFirstUserMessage = currentConversation.messages.length === 0;',
  '    const isFirstUserMessage = conversationMessages.length === 0;'
);
source = source.replace(
  '    const updatedMessages = [...currentConversation.messages, userMessage];',
  '    const updatedMessages = [...conversationMessages, userMessage];'
);

const regenStart = source.indexOf('  const handleRegenerate = () => {');
const regenEnd = source.indexOf('\n\n  // Text-to-Speech audio reader', regenStart);
if (regenStart < 0 || regenEnd < 0) throw new Error('handleRegenerate block not found');
const regen = `  const handleRegenerate = () => {\n    if (!user || isAnonymous) {\n      setAuthModalMode('signin');\n      setIsAuthModalOpen(true);\n      return;\n    }\n\n    const mutation = prepareMessageRegeneration(currentConversation.messages);\n    if (!mutation || !mutation.targetMessage) return;\n\n    setConversations((prev) =>\n      prev.map((c) =>\n        c.id === activeConversationId\n          ? { ...c, messages: mutation.messages }\n          : c\n      )\n    );\n\n    handleSendMessage(\n      mutation.targetMessage.content,\n      mutation.targetMessage.files || [],\n      undefined,\n      mutation.messages,\n    );\n  };`;
source = source.slice(0, regenStart) + regen + source.slice(regenEnd);

const retryStart = source.indexOf('  const handleRegenerate = () => {');
if (retryStart < 0) throw new Error('regenerate handler missing after replacement');
const retryEnd = source.indexOf('\n\n  // Text-to-Speech audio reader', retryStart);
const retryBlock = `  const handleRegenerate = () => {\n    if (!user || isAnonymous) {\n      setAuthModalMode('signin');\n      setIsAuthModalOpen(true);\n      return;\n    }\n\n    const mutation = prepareMessageRegeneration(currentConversation.messages);\n    if (!mutation || !mutation.targetMessage) return;\n\n    setConversations((prev) =>\n      prev.map((c) =>\n        c.id === activeConversationId\n          ? { ...c, messages: mutation.messages }\n          : c\n      )\n    );\n\n    handleSendMessage(\n      mutation.targetMessage.content,\n      mutation.targetMessage.files || [],\n      undefined,\n      mutation.messages,\n    );\n  };\n\n  const handleRetryMessage = (messageId: string) => {\n    if (!user || isAnonymous) {\n      setAuthModalMode('signin');\n      setIsAuthModalOpen(true);\n      return;\n    }\n\n    const errorIndex = currentConversation.messages.findIndex((message) => message.id === messageId);\n    if (errorIndex < 0 || !currentConversation.messages[errorIndex].isError) return;\n\n    const mutation = prepareMessageRetry(currentConversation.messages.slice(0, errorIndex + 1));\n    if (!mutation) return;\n\n    setConversations((prev) =>\n      prev.map((c) =>\n        c.id === activeConversationId\n          ? { ...c, messages: mutation.messages }\n          : c\n      )\n    );\n\n    handleSendMessage(\n      mutation.targetMessage.content,\n      mutation.targetMessage.files || [],\n      undefined,\n      mutation.messages,\n    );\n  };`;
source = source.slice(0, retryStart) + retryBlock + source.slice(retryEnd);

fs.writeFileSync(path, source);
