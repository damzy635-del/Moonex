export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

const CODE_EXTENSIONS = /\.(ts|tsx|js|jsx|py|json|md|html|css|sql|sh|txt|csv)$/i;

export function isImageFile(file: Pick<File, 'type'>): boolean {
  return file.type.startsWith('image/');
}

export function isCodeFile(fileName: string): boolean {
  return CODE_EXTENSIONS.test(fileName);
}

export function validateAttachment(file: Pick<File, 'name' | 'size' | 'type'>): string | null {
  if (file.size > MAX_ATTACHMENT_SIZE) return 'File exceeds the 10 MB attachment limit.';
  if (isImageFile(file)) return null;
  if (file.type === 'application/pdf' || file.type === 'text/plain' || isCodeFile(file.name)) return null;
  return 'Unsupported attachment type.';
}

export function validateAttachments(files: Array<Pick<File, 'name' | 'size' | 'type'>>): string[] {
  return files.map(validateAttachment).filter((error): error is string => error !== null);
}
