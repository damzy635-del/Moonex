const KEYWORDS = /\b(?:const|let|var|function|return|if|else|for|while|switch|case|break|continue|class|extends|new|import|from|export|default|async|await|try|catch|throw|interface|type|enum|public|private|protected|static|readonly|def|in|is|and|or|not|True|False|None|fn|pub|impl|struct|match|package|func|go|defer|select|range)\b/g;
const BUILTINS = /\b(?:console|Math|JSON|Object|Array|String|Number|Boolean|Date|Promise|RegExp|Error|print|len|str|int|float|map|set)\b/g;
const NUMBERS = /\b(?:0x[\da-fA-F]+|\d+(?:\.\d+)?)\b/g;
const STRINGS = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g;
const COMMENTS = /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)/g;

export type CodeTokenKind = 'plain' | 'keyword' | 'builtin' | 'number' | 'string' | 'comment';

export type CodeToken = { kind: CodeTokenKind; value: string };

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function tokenizeCode(code: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  const patterns: Array<[CodeTokenKind, RegExp]> = [
    ['comment', COMMENTS],
    ['string', STRINGS],
    ['keyword', KEYWORDS],
    ['builtin', BUILTINS],
    ['number', NUMBERS],
  ];

  let cursor = 0;
  while (cursor < code.length) {
    let best: { kind: CodeTokenKind; start: number; end: number } | null = null;
    for (const [kind, pattern] of patterns) {
      pattern.lastIndex = cursor;
      const match = pattern.exec(code);
      if (!match) continue;
      if (!best || match.index < best.start) best = { kind, start: match.index, end: match.index + match[0].length };
    }

    if (!best) {
      tokens.push({ kind: 'plain', value: code.slice(cursor) });
      break;
    }
    if (best.start > cursor) tokens.push({ kind: 'plain', value: code.slice(cursor, best.start) });
    tokens.push({ kind: best.kind, value: code.slice(best.start, best.end) });
    cursor = best.end;
  }
  return tokens;
}

export function highlightCodeHtml(code: string): string {
  return tokenizeCode(code)
    .map(({ kind, value }) => `<span class="moonex-code-${kind}">${escapeHtml(value)}</span>`)
    .join('');
}
