#!/usr/bin/env node

/**
 * 校验 PostgreSQL 与 MySQL 的 Prisma schema 在 ORM 语义上保持一致。
 *
 * 比较范围：模型、字段类型、默认值、关系、主键、唯一约束、索引、表映射、枚举值。
 * 忽略范围：datasource provider、@db.* 原生类型，以及 MySQL 专用的唯一索引长度。
 */

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const prismaDir = dirname(fileURLToPath(import.meta.url));
const variants = ['postgres', 'mysql'];

function stripComments(source) {
  let result = '';
  let quote = null;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (quote) {
      result += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      result += char;
      continue;
    }

    if (char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') index += 1;
      result += '\n';
      continue;
    }

    if (char === '/' && next === '*') {
      index += 2;
      while (
        index < source.length &&
        !(source[index] === '*' && source[index + 1] === '/')
      ) {
        if (source[index] === '\n') result += '\n';
        index += 1;
      }
      index += 1;
      continue;
    }

    result += char;
  }

  return result;
}

function splitStatements(body) {
  const statements = [];
  let current = '';
  let quote = null;
  let escaped = false;
  let depth = 0;

  const flush = () => {
    const statement = current.trim();
    if (statement) statements.push(statement);
    current = '';
  };

  for (const char of body) {
    if (quote) {
      current += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }

    if ('([{'.includes(char)) depth += 1;
    if (')]}'.includes(char)) depth -= 1;

    if (char === '\n' && depth === 0) {
      flush();
      continue;
    }

    current += char;
  }

  flush();
  return statements;
}

function splitTopLevel(value, delimiter = ',') {
  const parts = [];
  let current = '';
  let quote = null;
  let escaped = false;
  let depth = 0;

  for (const char of value) {
    if (quote) {
      current += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }

    if ('([{'.includes(char)) depth += 1;
    if (')]}'.includes(char)) depth -= 1;

    if (char === delimiter && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

function splitWords(statement) {
  const words = [];
  let current = '';
  let quote = null;
  let escaped = false;
  let depth = 0;

  const flush = () => {
    if (current.trim()) words.push(current.trim());
    current = '';
  };

  for (const char of statement) {
    if (quote) {
      current += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }

    if ('([{'.includes(char)) depth += 1;
    if (')]}'.includes(char)) depth -= 1;

    if (/\s/.test(char) && depth === 0) {
      flush();
      continue;
    }

    current += char;
  }

  flush();
  return words;
}

function normalize(value) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*([(),\[\]])\s*/g, '$1');
}

function findMatchingBracket(value, openIndex, open, close) {
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = openIndex; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function normalizeFieldAttribute(attribute) {
  if (attribute.startsWith('@db.')) return null;
  // MySQL 的唯一索引长度是原生存储细节，不应造成 schema 语义漂移。
  if (/^@unique(?:\([\s\S]*\))?$/.test(attribute)) return '@unique';
  if (/^@id(?:\([\s\S]*\))?$/.test(attribute)) return '@id';
  return normalize(attribute);
}

function parseIndexFields(value) {
  return normalize(value.replace(/\blength\s*:\s*\d+/g, ''));
}

function normalizeOptions(options, ignored) {
  return splitTopLevel(options)
    .map(normalize)
    .filter((option) => option && !ignored.some((name) => option.startsWith(`${name}:`)))
    .sort();
}

function normalizeBlockAttribute(statement) {
  const match = statement.match(/^@@(\w+)(?:\(([\s\S]*)\))?$/);
  if (!match) return normalize(statement);

  const [, name, args] = match;
  if (!args) return `@@${name}`;

  if (name === 'map') return `@@map(${normalize(args)})`;

  if (name === 'index' || name === 'fulltext') {
    const openIndex = args.indexOf('[');
    if (openIndex === -1) return normalize(statement);
    const closeIndex = findMatchingBracket(args, openIndex, '[', ']');
    if (closeIndex === -1) return normalize(statement);

    const fields = parseIndexFields(args.slice(openIndex + 1, closeIndex));
    const options = normalizeOptions(args.slice(closeIndex + 1), ['name', 'map']);
    return `@@${name}([${fields}]${options.length ? `,${options.join(',')}` : ''})`;
  }

  if (name === 'unique' || name === 'id') {
    const openIndex = args.indexOf('[');
    if (openIndex === -1) return normalize(statement);
    const closeIndex = findMatchingBracket(args, openIndex, '[', ']');
    if (closeIndex === -1) return normalize(statement);

    const fields = parseIndexFields(args.slice(openIndex + 1, closeIndex));
    const options = normalizeOptions(args.slice(closeIndex + 1), ['name', 'map', 'length']);
    return `@@${name}([${fields}]${options.length ? `,${options.join(',')}` : ''})`;
  }

  return normalize(statement);
}

function extractBlocks(source) {
  const blocks = [];
  const pattern = /(?:^|\n)\s*(model|enum)\s+(\w+)\s*\{/g;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    const openIndex = source.indexOf('{', match.index);
    const closeIndex = findMatchingBracket(source, openIndex, '{', '}');
    if (closeIndex === -1) {
      throw new Error(`无法解析 ${match[1]} ${match[2]}：缺少闭合花括号`);
    }
    blocks.push({
      kind: match[1],
      name: match[2],
      body: source.slice(openIndex + 1, closeIndex),
    });
    pattern.lastIndex = closeIndex + 1;
  }

  return blocks;
}

function parseModel(block) {
  const fields = new Map();
  const attributes = [];

  for (const statement of splitStatements(block.body)) {
    if (statement.startsWith('@@')) {
      attributes.push(normalizeBlockAttribute(statement));
      continue;
    }

    const [fieldName, fieldType, ...rawAttributes] = splitWords(statement);
    if (!fieldName || !fieldType) continue;

    const normalizedAttributes = rawAttributes
      .map(normalizeFieldAttribute)
      .filter(Boolean)
      .sort();

    fields.set(fieldName, {
      type: normalize(fieldType),
      attributes: normalizedAttributes,
    });
  }

  attributes.sort();
  return { fields, attributes };
}

function parseEnum(block) {
  // Prisma 枚举声明顺序在 PostgreSQL 中有排序语义，因此不能忽略顺序。
  return splitStatements(block.body).map(normalize);
}

async function loadSchema(variant) {
  const variantDir = join(prismaDir, variant);
  const modelsDir = join(variantDir, 'models');
  const files = [
    ...(await readdir(modelsDir))
      .filter((file) => file.endsWith('.prisma'))
      .map((file) => join(modelsDir, file)),
    join(variantDir, 'enums.prisma'),
  ];

  const schema = { models: new Map(), enums: new Map() };
  for (const file of files) {
    const source = stripComments(await readFile(file, 'utf8'));
    for (const block of extractBlocks(source)) {
      const target = block.kind === 'model' ? schema.models : schema.enums;
      if (target.has(block.name)) {
        throw new Error(`${variant} schema 中存在重复的 ${block.kind}: ${block.name}`);
      }
      target.set(
        block.name,
        block.kind === 'model' ? parseModel(block) : parseEnum(block),
      );
    }
  }

  return schema;
}

function setDifference(left, right) {
  const rightSet = new Set(right);
  return [...left].filter((item) => !rightSet.has(item));
}

function compareSchemas(postgres, mysql) {
  const errors = [];

  for (const name of setDifference(postgres.models.keys(), mysql.models.keys())) {
    errors.push(`MySQL 缺少模型 ${name}`);
  }
  for (const name of setDifference(mysql.models.keys(), postgres.models.keys())) {
    errors.push(`PostgreSQL 缺少模型 ${name}`);
  }

  for (const [name, pgModel] of postgres.models) {
    const myModel = mysql.models.get(name);
    if (!myModel) continue;

    for (const fieldName of setDifference(pgModel.fields.keys(), myModel.fields.keys())) {
      errors.push(`MySQL ${name} 缺少字段 ${fieldName}`);
    }
    for (const fieldName of setDifference(myModel.fields.keys(), pgModel.fields.keys())) {
      errors.push(`PostgreSQL ${name} 缺少字段 ${fieldName}`);
    }

    for (const [fieldName, pgField] of pgModel.fields) {
      const myField = myModel.fields.get(fieldName);
      if (!myField) continue;
      if (pgField.type !== myField.type) {
        errors.push(
          `${name}.${fieldName} 类型不一致: PostgreSQL=${pgField.type}, MySQL=${myField.type}`,
        );
      }
      if (pgField.attributes.join(' ') !== myField.attributes.join(' ')) {
        errors.push(
          `${name}.${fieldName} 属性不一致: PostgreSQL=${pgField.attributes.join(' ') || '(none)'}, MySQL=${myField.attributes.join(' ') || '(none)'}`,
        );
      }
    }

    const pgAttrs = new Set(pgModel.attributes);
    const myAttrs = new Set(myModel.attributes);
    for (const attribute of setDifference(pgAttrs, myAttrs)) {
      errors.push(`${name} 的约束/索引仅存在于 PostgreSQL: ${attribute}`);
    }
    for (const attribute of setDifference(myAttrs, pgAttrs)) {
      errors.push(`${name} 的约束/索引仅存在于 MySQL: ${attribute}`);
    }
  }

  for (const name of setDifference(postgres.enums.keys(), mysql.enums.keys())) {
    errors.push(`MySQL 缺少枚举 ${name}`);
  }
  for (const name of setDifference(mysql.enums.keys(), postgres.enums.keys())) {
    errors.push(`PostgreSQL 缺少枚举 ${name}`);
  }
  for (const [name, pgValues] of postgres.enums) {
    const myValues = mysql.enums.get(name);
    if (!myValues) continue;
    if (pgValues.join('|') !== myValues.join('|')) {
      errors.push(
        `${name} 枚举值不一致: PostgreSQL=${pgValues.join(', ')}, MySQL=${myValues.join(', ')}`,
      );
    }
  }

  return errors;
}

async function main() {
  const [postgres, mysql] = await Promise.all(variants.map(loadSchema));
  const errors = compareSchemas(postgres, mysql);

  if (errors.length > 0) {
    console.error('❌ PostgreSQL 与 MySQL schema 语义不一致：');
    for (const error of errors) console.error(`  - ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `✅ PostgreSQL 与 MySQL schema 一致（${postgres.models.size} 个模型，${postgres.enums.size} 个枚举）`,
  );
}

main().catch((error) => {
  console.error(`❌ Schema 一致性校验失败: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
