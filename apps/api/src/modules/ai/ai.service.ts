import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
  private readonly maxRequestTokens: number;
  private readonly allowedModels: Set<string>;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const baseURL = this.configService.get<string>('OPENAI_BASE_URL');
    this.defaultModel =
      this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o';
    this.maxRequestTokens = this.readPositiveInteger('OPENAI_MAX_TOKENS', 4096);
    this.allowedModels = new Set(
      (this.configService.get<string>('OPENAI_ALLOWED_MODELS') || this.defaultModel)
        .split(',')
        .map((model) => model.trim())
        .filter(Boolean),
    );
    this.allowedModels.add(this.defaultModel);

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
      maxTokens = this.maxRequestTokens,
      abortSignal,
    } = options;

    this.validateRequest(messages, model, maxTokens);
    this.logger.log(`Chat completion request with model: ${model}`);

    const formattedMessages: ChatCompletionMessageParam[] = messages.map(
      (msg) => ({
        role: msg.role,
        content: msg.content,
      }),
    );

    const response = await this.openai.chat.completions.create(
      {
        model,
        messages: formattedMessages,
        temperature,
        max_tokens: maxTokens,
      },
      { signal: abortSignal },
    );

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
      maxTokens = this.maxRequestTokens,
      abortSignal,
    } = options;

    this.validateRequest(messages, model, maxTokens);
    this.logger.log(`Streaming chat request with model: ${model}`);

    const formattedMessages: ChatCompletionMessageParam[] = messages.map(
      (msg) => ({
        role: msg.role,
        content: msg.content,
      }),
    );

    const stream: Stream<ChatCompletionChunk> =
      await this.openai.chat.completions.create(
        {
          model,
          messages: formattedMessages,
          temperature,
          max_tokens: maxTokens,
          stream: true,
        },
        { signal: abortSignal },
      );

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
    model?: string,
  ): Promise<ChatResponse> {
    const messages: ChatMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content });

    return this.chatCompletion({ messages, model });
  }

  private validateRequest(
    messages: ChatMessage[],
    model: string,
    maxTokens: number,
  ): void {
    if (!this.allowedModels.has(model)) {
      throw new BadRequestException(`不支持的 AI 模型: ${model}`);
    }
    if (!Number.isInteger(maxTokens) || maxTokens < 1) {
      throw new BadRequestException('maxTokens 必须为正整数');
    }
    if (maxTokens > this.maxRequestTokens) {
      throw new BadRequestException(`maxTokens 不能超过 ${this.maxRequestTokens}`);
    }

    const totalCharacters = messages.reduce((total, message) => total + message.content.length, 0);
    if (totalCharacters > 20_000) {
      throw new BadRequestException('对话内容总长度不能超过 20000 字符');
    }
  }

  private readPositiveInteger(key: string, fallback: number): number {
    const value = parseInt(this.configService.get<string>(key) || String(fallback), 10);
    return Number.isSafeInteger(value) && value > 0 ? value : fallback;
  }
}
