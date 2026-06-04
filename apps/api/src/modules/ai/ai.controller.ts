import {
  Controller,
  Post,
  Body,
  UseGuards,
  Sse,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Observable } from 'rxjs';
import { AiService, ChatMessage } from './ai.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ChatDto, StreamChatDto, PromptDto } from './dto';

interface SseMessage {
  data: string;
}

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: '发送聊天完成请求' })
  async chat(@Body() dto: ChatDto) {
    const messages: ChatMessage[] = dto.messages.map((m) => ({
      role: m.role as ChatMessage['role'],
      content: m.content,
    }));

    const result = await this.aiService.chatCompletion({
      messages,
      model: dto.model,
      temperature: dto.temperature,
      maxTokens: dto.maxTokens,
    });

    return result;
  }

  @Sse('chat/stream')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: '流式聊天完成 (SSE)' })
  streamChat(@Body() dto: StreamChatDto): Observable<SseMessage> {
    const messages: ChatMessage[] = dto.messages.map((m) => ({
      role: m.role as ChatMessage['role'],
      content: m.content,
    }));

    const self = this.aiService;
    const abortController = new AbortController();

    async function* generate(): AsyncGenerator<SseMessage, void, undefined> {
      for await (const chunk of self.chatCompletionStream({
        messages,
        model: dto.model,
        temperature: dto.temperature,
        maxTokens: dto.maxTokens,
        abortSignal: abortController.signal,
      })) {
        yield { data: JSON.stringify({ content: chunk }) };
      }
      yield { data: JSON.stringify({ done: true }) };
    }

    return new Observable<SseMessage>((subscriber) => {
      const iterator = generate();

      (async () => {
        try {
          for await (const event of iterator) {
            subscriber.next(event);
          }
          subscriber.complete();
        } catch (err) {
          // AbortError 是正常取消，不抛出
          if (err instanceof Error && err.name === 'AbortError') {
            subscriber.complete();
          } else {
            subscriber.error(err);
          }
        }
      })();

      // 客户端断开时取消 OpenAI 请求
      return () => {
        abortController.abort();
      };
    });
  }

  @Post('prompt')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: '简单提示 - 发送消息获取回复' })
  async prompt(@Body() dto: PromptDto) {
    const result = await this.aiService.prompt(
      dto.content,
      dto.systemPrompt,
    );
    return { content: result, model: dto.model || 'default' };
  }
}
