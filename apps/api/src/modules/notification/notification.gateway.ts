import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { Subject, Observable, interval, map, takeUntil, finalize, merge } from 'rxjs';

/** SSE 事件结构 */
export interface SseEvent {
  type: string;
  data: Record<string, unknown>;
}

/** SSE 消息格式（NestJS @Sse 要求） */
interface SseMessage {
  data: Record<string, unknown>;
  type?: string;
  id?: string;
  retry?: number;
}

/** SSE 心跳间隔（30 秒） */
const HEARTBEAT_INTERVAL = 30_000;

/**
 * SSE 连接管理器
 * 维护每个用户的 Subject 列表，支持同一用户多标签页同时订阅
 */
@Injectable()
export class NotificationGateway implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationGateway.name);

  /** userId → Subject 列表（同一用户可能打开多个标签页） */
  private readonly subjects = new Map<string, Subject<SseEvent>[]>();

  /** 模块销毁时关闭所有连接 */
  onModuleDestroy(): void {
    for (const [, list] of this.subjects) {
      list.forEach((s) => s.complete());
    }
    this.subjects.clear();
    this.logger.log('所有 SSE 连接已关闭');
  }

  /** 注册用户 SSE 连接，返回包含心跳的事件流 */
  subscribe(userId: string): Observable<SseMessage> {
    const subject = new Subject<SseEvent>();
    const list = this.subjects.get(userId) || [];
    list.push(subject);
    this.subjects.set(userId, list);
    this.logger.log(`用户 ${userId} 建立 SSE 连接（当前 ${list.length} 个）`);

    // 心跳流：每 30 秒发送一个 comment 保持连接
    const heartbeat$ = interval(HEARTBEAT_INTERVAL).pipe(
      map(
        (): SseMessage => ({
          type: 'heartbeat',
          data: { timestamp: Date.now() },
        }),
      ),
      takeUntil(subject),
    );

    // 事件流
    const event$ = subject.asObservable().pipe(
      map(
        (event): SseMessage => ({
          type: event.type,
          data: event.data,
          id: String(Date.now()),
        }),
      ),
    );

    // 合并心跳与事件，连接断开时清理
    return merge(heartbeat$, event$).pipe(
      finalize(() => {
        const remaining = (this.subjects.get(userId) || []).filter(
          (s) => s !== subject,
        );
        if (remaining.length > 0) {
          this.subjects.set(userId, remaining);
        } else {
          this.subjects.delete(userId);
        }
        this.logger.log(
          `用户 ${userId} 断开 SSE 连接（剩余 ${remaining.length} 个）`,
        );
      }),
    );
  }

  /** 推送给指定用户的所有连接 */
  pushToUser(userId: string, event: SseEvent): void {
    const list = this.subjects.get(userId);
    if (list?.length) {
      list.forEach((s) => s.next(event));
      this.logger.debug(
        `推送 [${event.type}] 到用户 ${userId}（${list.length} 个连接）`,
      );
    }
  }

  /** 广播给所有在线用户 */
  broadcast(event: SseEvent): void {
    let count = 0;
    for (const [, list] of this.subjects) {
      list.forEach((s) => {
        s.next(event);
        count++;
      });
    }
    this.logger.debug(`广播 [${event.type}] 到 ${count} 个连接`);
  }

  /** 获取当前在线连接数 */
  getConnectionCount(): number {
    let count = 0;
    for (const [, list] of this.subjects) {
      count += list.length;
    }
    return count;
  }

  /** 获取当前在线用户ID列表 */
  getOnlineUserIds(): string[] {
    return Array.from(this.subjects.keys());
  }
}
