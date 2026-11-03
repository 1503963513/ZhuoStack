import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChatDto } from './chat.dto';

describe('ChatDto', () => {
  it('限制消息数组最多 20 条', async () => {
    const dto = plainToInstance(ChatDto, {
      messages: Array.from({ length: 21 }, () => ({ role: 'user', content: 'hello' })),
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'messages')).toBe(true);
  });

  it('拒绝空消息数组', async () => {
    const dto = plainToInstance(ChatDto, { messages: [] });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'messages')).toBe(true);
  });
});
