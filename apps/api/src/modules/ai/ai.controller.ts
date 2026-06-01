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
import { Observable } from 'rxjs';
import { AiService, ChatMessage } from './ai.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ChatDto, StreamChatDto } from './dto';

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
  @ApiOperation({ summary: 'Send a chat completion request' })
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
  @ApiOperation({ summary: 'Stream a chat completion (SSE)' })
  streamChat(@Body() dto: StreamChatDto): Observable<SseMessage> {
    const messages: ChatMessage[] = dto.messages.map((m) => ({
      role: m.role as ChatMessage['role'],
      content: m.content,
    }));

    const self = this.aiService;
    async function* generate(): AsyncGenerator<SseMessage, void, undefined> {
      for await (const chunk of self.chatCompletionStream({
        messages,
        model: dto.model,
        temperature: dto.temperature,
        maxTokens: dto.maxTokens,
      })) {
        yield { data: JSON.stringify({ content: chunk }) };
      }
      yield { data: JSON.stringify({ done: true }) };
    }

    return new Observable<SseMessage>((subscriber) => {
      (async () => {
        try {
          for await (const event of generate()) {
            subscriber.next(event);
          }
          subscriber.complete();
        } catch (err) {
          subscriber.error(err);
        }
      })();
    });
  }

  @Post('prompt')
  @ApiOperation({ summary: 'Simple prompt - send a message and get a response' })
  async prompt(
    @Body() dto: { content: string; systemPrompt?: string; model?: string },
  ) {
    const result = await this.aiService.prompt(
      dto.content,
      dto.systemPrompt,
    );
    return { content: result, model: dto.model || 'default' };
  }
}
