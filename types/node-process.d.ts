declare const process: {
  env: Record<string, string | undefined>;
};

declare const Buffer: {
  from(input: string, encoding?: 'base64' | 'utf8'): {
    toString(encoding: 'base64' | 'utf8'): string;
  };
  byteLength(input: string, encoding?: string): number;
};
