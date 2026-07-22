import { describe, expect, it } from 'vitest';
import { buildUrl, getErrorMessage } from './utils';

describe('web utilities', () => {
  it('构建查询字符串时过滤空值并进行 URL 编码', () => {
    expect(
      buildUrl('/api/user', {
        page: 1,
        search: '张 三&admin',
        status: undefined,
      }),
    ).toBe('/api/user?page=1&search=%E5%BC%A0+%E4%B8%89%26admin');
  });

  it('不会假定捕获值一定是 Error', () => {
    expect(getErrorMessage(new Error('请求失败'))).toBe('请求失败');
    expect(getErrorMessage({ message: 'untrusted' }, '未知错误')).toBe('未知错误');
  });
});
