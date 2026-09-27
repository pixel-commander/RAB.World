import type { CodeLanguage, Token, DiffRow, TokenRule } from '../CodeEditor.types';

const CSS_RULES: TokenRule[] = [
  { cls: 'tok-com', re: /\/\*[\s\S]*?(?:\*\/|$)/y }, { cls: 'tok-str', re: /"[^"\n]*"|'[^'\n]*'/y },
  { cls: 'tok-at', re: /@[\w-]+/y }, { cls: 'tok-var', re: /--[\w-]+/y }, { cls: 'tok-fn', re: /[\w-]+(?=\()/y },
  { cls: 'tok-num', re: /-?(?:\d*\.)?\d+(?:px|rem|em|dvh|dvw|vh|vw|%|ms|s|fr|deg|ch)?/y },
  { cls: 'tok-sel', re: /[.#][\w-]+/y }, { cls: 'tok-prop', re: /[a-z-]+(?=\s*:)/y }, { cls: 'tok-punc', re: /[{}();:,>~*[\]]/y },
];
const JS_RULES: TokenRule[] = [
  { cls: 'tok-com', re: /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/y }, { cls: 'tok-str', re: /`[^`]*`|"[^"\n]*"|'[^'\n]*'/y },
  { cls: 'tok-key', re: /\b(?:const|let|var|function|return|if|else|for|while|of|in|new|class|extends|import|export|from|default|async|await|try|catch|throw|typeof|instanceof|null|undefined|true|false|this)\b/y },
  { cls: 'tok-num', re: /-?(?:\d*\.)?\d+/y }, { cls: 'tok-fn', re: /[\w$]+(?=\()/y }, { cls: 'tok-punc', re: /[{}()[\];:,.=<>+\-*/!&|?]/y },
];
const HTML_RULES: TokenRule[] = [
  { cls: 'tok-com', re: /<!--[\s\S]*?(?:-->|$)/y }, { cls: 'tok-str', re: /"[^"\n]*"|'[^'\n]*'/y },
  { cls: 'tok-key', re: /<\/?[\w-]+|\/?>/y }, { cls: 'tok-prop', re: /[\w-]+(?==)/y }, { cls: 'tok-punc', re: /=/y },
];
const LANG_RULES: Record<Exclude<CodeLanguage, 'plain'>, TokenRule[]> = { css: CSS_RULES, js: JS_RULES, html: HTML_RULES };

export const tokenize = (text: string, language: CodeLanguage): Token[] => {
  if (language === 'plain') return [{ cls: '', text }];
  const tokens: Token[] = [];
  let plain = '';
  let at = 0;
  const flush = () => { if (plain) { tokens.push({ cls: '', text: plain }); plain = ''; } };
  while (at < text.length) {
    let hit: Token | null = null;
    for (const rule of LANG_RULES[language]) {
      rule.re.lastIndex = at;
      const match = rule.re.exec(text);
      if (match?.[0]) { hit = { cls: rule.cls, text: match[0] }; break; }
    }
    if (hit) { flush(); tokens.push(hit); at += hit.text.length; } else { plain += text[at]; at += 1; }
  }
  flush();
  return tokens;
};

export const diffLines = (before: string, after: string): DiffRow[] => {
  const a = before.split('\n');
  const b = after.split('\n');
  if (a.length * b.length > 500000) return [...a.map((text): DiffRow => ({ kind: 'del', text })), ...b.map((text): DiffRow => ({ kind: 'add', text }))];
  const width = b.length + 1;
  const table = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i -= 1) for (let j = b.length - 1; j >= 0; j -= 1) table[i * width + j] = a[i] === b[j] ? table[(i + 1) * width + j + 1] + 1 : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
  const rows: DiffRow[] = [];
  let i = 0; let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { rows.push({ kind: 'ctx', text: a[i] }); i += 1; j += 1; }
    else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) { rows.push({ kind: 'del', text: a[i] }); i += 1; }
    else { rows.push({ kind: 'add', text: b[j] }); j += 1; }
  }
  while (i < a.length) rows.push({ kind: 'del', text: a[i++] });
  while (j < b.length) rows.push({ kind: 'add', text: b[j++] });
  return rows;
};

export const appendTokens = (target: HTMLElement, tokens: Token[]) => {
  target.replaceChildren();
  tokens.forEach((token) => {
    if (!token.cls) target.append(token.text);
    else { const span = document.createElement('span'); span.className = token.cls; span.textContent = token.text; target.append(span); }
  });
};

