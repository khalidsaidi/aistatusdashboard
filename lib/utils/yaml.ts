function quote(value: string) {
  return JSON.stringify(value);
}

function indent(level: number) {
  return '  '.repeat(level);
}

function isPlainObject(value: any) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

export function toYaml(value: any, level = 0): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'string') {
    return quote(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    return value
      .map((item) => {
        const rendered = toYaml(item, level + 1);
        if (isPlainObject(item) || Array.isArray(item)) {
          const lines = rendered.split('\n');
          return `${indent(level)}- ${lines[0]}${lines.length > 1 ? `\n${lines.slice(1).map((line) => `${indent(level + 1)}${line}`).join('\n')}` : ''}`;
        }
        return `${indent(level)}- ${rendered}`;
      })
      .join('\n');
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (!entries.length) return '{}';
    return entries
      .map(([key, val]) => {
        const rendered = toYaml(val, level + 1);
        if (isPlainObject(val) || Array.isArray(val)) {
          return `${indent(level)}${key}:\n${indent(level + 1)}${rendered.replace(/\n/g, `\n${indent(level + 1)}`)}`;
        }
        return `${indent(level)}${key}: ${rendered}`;
      })
      .join('\n');
  }
  return quote(String(value));
}
