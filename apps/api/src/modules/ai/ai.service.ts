import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  ChatCompletionMessageParam,
  ChatCompletionChunk,
} from 'openai/resources/chat/completions';
import { Stream } from 'openai/streaming';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  abortSignal?: AbortSignal;
}

export interface ChatResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openai: OpenAI;
  private readonly defaultModel: string;
  private readonly defaultMaxTokens: number;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const baseURL = this.configService.get<string>('OPENAI_BASE_URL');
    this.defaultModel =
      this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o';
    this.defaultMaxTokens =
      parseInt(this.configService.get<string>('OPENAI_MAX_TOKENS') || '4096', 10);

    this.openai = new OpenAI({
      apiKey: apiKey || 'sk-placeholder',
      baseURL: baseURL || 'https://api.openai.com/v1',
    });
  }

  /**
   * Send a chat completion request (non-streaming)
   */
  async chatCompletion(options: ChatOptions): Promise<ChatResponse> {
    const {
      messages,
      model = this.defaultModel,
      temperature = 0.7,
      maxTokens = this.defaultMaxTokens,
    } = options;

    this.logger.log(`Chat completion request with model: ${model}`);

    const formattedMessages: ChatCompletionMessageParam[] = messages.map(
      (msg) => ({
        role: msg.role,
        content: msg.content,
      }),
    );

    const response = await this.openai.chat.completions.create({
      model,
      messages: formattedMessages,
      temperature,
      max_tokens: maxTokens,
    });

    const choice = response.choices[0];
    return {
      content: choice?.message?.content || '',
      model: response.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : null,
    };
  }

  /**
   * Send a chat completion request (streaming)
   * Returns an async iterable of chunk deltas
   */
  async *chatCompletionStream(
    options: ChatOptions,
  ): AsyncGenerator<string, void, undefined> {
    const {
      messages,
      model = this.defaultModel,
      temperature = 0.7,
      maxTokens = this.defaultMaxTokens,
      abortSignal,
    } = options;

    this.logger.log(`Streaming chat request with model: ${model}`);

    const formattedMessages: ChatCompletionMessageParam[] = messages.map(
      (msg) => ({
        role: msg.role,
        content: msg.content,
      }),
    );

    const stream: Stream<ChatCompletionChunk> =
      await this.openai.chat.completions.create({
        model,
        messages: formattedMessages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      });

    for await (const chunk of stream) {
      if (abortSignal?.aborted) break;
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
    }
  }

  /**
   * Simple prompt helper - send a single user message and get a response
   */
  async prompt(
    content: string,
    systemPrompt?: string,
  ): Promise<string> {
    const messages: ChatMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content });

    const result = await this.chatCompletion({ messages });
    return result.content;
  }
}
