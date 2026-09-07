const fs = require('node:fs');

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`${label} not found`);
  return source.replace(from, to);
}

let app = fs.readFileSync('src/App.tsx', 'utf8');
const importAnchor = "import { normalizeMoonexModelId } from '../lib/moonex-models';";
const imports = "import { prepareMessageEdit, prepareMessageRegeneration } from './utils/conversationActions';\nimport { prepareMessageRetry } from './utils/conversationRetry';";
if (!app.includes('prepareMessageRetry')) app = replaceOnce(app, importAnchor, `${importAnchor}\n${imports}`, 'App imports');

const editOld = `    const msgIndex = currentConversation.messages.findIndex((m) => m.id === messageId);\n    if (msgIndex === -1) return;\n\n    const targetMsg = currentConversation.messages[msgIndex];\n    // Keep messages strictly prior to this message\n    const trimmed = currentConversation.messages.slice(0, msgIndex);`;
const editNew = `    const mutation = prepareMessageEdit(currentConversation.messages, messageId, newContent);\n    if (!mutation || !mutation.targetMessage) return;\n\n    const targetMsg = mutation.targetMessage;\n    const trimmed = mutation.messages;`;
if (app.includes(editOld)) app = app.replace(editOld, editNew);
if (app.includes('handleSendMessage(newContent, targetMsg.files || []);')) app = app.replace('handleSendMessage(newContent, targetMsg.files || []);', 'handleSendMessage(targetMsg.content, targetMsg.files || [], undefined, trimmed);');

const signatureOld = `    text: string,\n    files: FileAttachment[] = [],\n    modelOverride?: string,\n  ) => {`;
const signatureNew = `    text: string,\n    files: FileAttachment[] = [],\n    modelOverride?: string,\n    baseMessages?: Message[],\n  ) => {`;
if (app.includes(signatureOld)) app = app.replace(signatureOld, signatureNew);
if (!app.includes('const conversationMessages = baseMessages ?? currentConversation.messages;')) {
  app = replaceOnce(app, '    const selectedModelId = normalizeMoonexModelId(modelOverride || currentConversation.model);', '    const conversationMessages = baseMessages ?? currentConversation.messages;\n    const selectedModelId = normalizeMoonexModelId(modelOverride || currentConversation.model);', 'conversation snapshot');
  app = replaceOnce(app, '    const isFirstUserMessage = currentConversation.messages.length === 0;', '    const isFirstUserMessage = conversationMessages.length === 0;', 'first-message check');
  app = replaceOnce(app, '    const updatedMessages = [...currentConversation.messages, userMessage];', '    const updatedMessages = [...conversationMessages, userMessage];', 'updated messages');
}

const regenStart = app.indexOf('  const handleRegenerate = () => {');
const regenEnd = app.indexOf('\n\n  // Text-to-Speech audio reader', regenStart);
if (regenStart < 0 || regenEnd < 0) throw new Error('handleRegenerate block not found');
const handlers = `  const handleRegenerate = () => {\n    if (!user || isAnonymous) {\n      setAuthModalMode('signin');\n      setIsAuthModalOpen(true);\n      return;\n    }\n\n    const mutation = prepareMessageRegeneration(currentConversation.messages);\n    if (!mutation || !mutation.targetMessage) return;\n\n    setConversations((prev) =>\n      prev.map((c) =>\n        c.id === activeConversationId\n          ? { ...c, messages: mutation.messages }\n          : c\n      )\n    );\n\n    handleSendMessage(\n      mutation.targetMessage.content,\n      mutation.targetMessage.files || [],\n      undefined,\n      mutation.messages,\n    );\n  };\n\n  const handleRetryMessage = (messageId: string) => {\n    if (!user || isAnonymous) {\n      setAuthModalMode('signin');\n      setIsAuthModalOpen(true);\n      return;\n    }\n\n    const errorIndex = currentConversation.messages.findIndex((message) => message.id === messageId);\n    if (errorIndex < 0 || !currentConversation.messages[errorIndex].isError) return;\n\n    const mutation = prepareMessageRetry(currentConversation.messages.slice(0, errorIndex + 1));\n    if (!mutation) return;\n\n    setConversations((prev) =>\n      prev.map((c) =>\n        c.id === activeConversationId\n          ? { ...c, messages: mutation.messages }\n          : c\n      )\n    );\n\n    handleSendMessage(\n      mutation.targetMessage.content,\n      mutation.targetMessage.files || [],\n      undefined,\n      mutation.messages,\n    );\n  };`;
app = app.slice(0, regenStart) + handlers + app.slice(regenEnd);
app = replaceOnce(app, 'onRegenerate={handleRegenerate}', 'onRegenerate={handleRegenerate}\n                  onRetry={handleRetryMessage}', 'MessageItem retry callback');
fs.writeFileSync('src/App.tsx', app);

let item = fs.readFileSync('src/components/MessageItem.tsx', 'utf8');
if (!item.includes('onRetry?:')) item = replaceOnce(item, '  onRegenerate?: () => void;\n', '  onRegenerate?: () => void;\n  onRetry?: (messageId: string) => void;\n', 'MessageItem prop');
if (!item.includes('  onRetry,\n')) item = replaceOnce(item, '  onRegenerate,\n', '  onRegenerate,\n  onRetry,\n', 'MessageItem destructure');
item = item.replace('                  {onRegenerate && (', '                  {(onRetry || onRegenerate) && (');
item = item.replace('                        onClick={onRegenerate}', '                        onClick={() => (onRetry ? onRetry(message.id) : onRegenerate?.())}');
fs.writeFileSync('src/components/MessageItem.tsx', item);

const testPath = 'tests/conversation-retry.test.ts';
fs.writeFileSync(testPath, `import assert from 'node:assert/strict';\nimport test from 'node:test';\nimport { prepareMessageRetry } from '../src/utils/conversationRetry.ts';\nimport type { Message } from '../src/types';\n\nconst message = (id: string, role: Message['role'], content: string, files?: Message['files']): Message => ({\n  id,\n  role,\n  content,\n  timestamp: 1,\n  files,\n});\n\ntest('retry removes the failed assistant response and preserves the exact user request', () => {\n  const attachment = { id: 'f1', name: 'prompt.txt', size: 3, type: 'document' as const, mimeType: 'text/plain', data: 'abc' };\n  const messages = [\n    message('u1', 'user', 'older'),\n    message('a1', 'assistant', 'older answer'),\n    message('u2', 'user', 'retry this', [attachment]),\n    { ...message('e2', 'assistant', 'temporary failure'), isError: true },\n  ];\n\n  const result = prepareMessageRetry(messages);\n\n  assert.deepEqual(result?.messages.map((item) => item.id), ['u1', 'a1']);\n  assert.equal(result?.targetMessage.id, 'u2');\n  assert.equal(result?.targetMessage.content, 'retry this');\n  assert.deepEqual(result?.targetMessage.files, [attachment]);\n});\n\ntest('retry does not create a duplicate user turn', () => {\n  const result = prepareMessageRetry([\n    message('u1', 'user', 'request'),\n    { ...message('e1', 'assistant', 'failed'), isError: true },\n  ]);\n\n  assert.deepEqual(result?.messages, []);\n  assert.equal(result?.targetMessage.id, 'u1');\n});\n\ntest('retry safely rejects a conversation with no user request', () => {\n  assert.equal(prepareMessageRetry([{ ...message('e1', 'assistant', 'failed'), isError: true }]), null);\n});\n`);
