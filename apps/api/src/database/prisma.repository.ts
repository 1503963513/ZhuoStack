import { PrismaService } from './prisma.service';

/**
 * Generic base repository that encapsulates common CRUD operations.
 * Extend this class for specific entity repositories.
 */
export abstract class BaseRepository<T> {
  protected abstract readonly model: {
    findUnique(args: unknown): Promise<T | null>;
    findFirst(args: unknown): Promise<T | null>;
    findMany(args?: unknown): Promise<T[]>;
    create(args: unknown): Promise<T>;
    update(args: unknown): Promise<T>;
    delete(args: unknown): Promise<T>;
    count(args?: unknown): Promise<number>;
  };

  constructor(protected readonly prisma: PrismaService) {}

  async findById(id: string): Promise<T | null> {
    return this.model.findUnique({ where: { id } });
  }

  async findOne(where: Record<string, unknown>): Promise<T | null> {
    return this.model.findFirst({ where });
  }

  async findMany(args?: Record<string, unknown>): Promise<T[]> {
    return this.model.findMany(args);
  }

  async create(data: Record<string, unknown>): Promise<T> {
    return this.model.create({ data });
  }

  async update(id: string, data: Record<string, unknown>): Promise<T> {
    return this.model.update({ where: { id }, data });
  }

  async delete(id: string): Promise<T> {
    return this.model.delete({ where: { id } });
  }

  async count(args?: Record<string, unknown>): Promise<number> {
    return this.model.count(args);
  }

  async paginate(
    page: number = 1,
    pageSize: number = 10,
    args?: Record<string, unknown>,
  ): Promise<{ data: T[]; total: number; page: number; pageSize: number }> {
    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      this.model.findMany({ ...args, skip, take: pageSize }),
      this.model.count(args),
    ]);

    return { data, total, page, pageSize };
  }
}
