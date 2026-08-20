import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma database client wrapper for PostgreSQL.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Connected to PostgreSQL via Prisma');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (process.env.NODE_ENV === 'production') {
        this.logger.error(`Prisma connection failed: ${message}`);
        throw error;
      }
      this.logger.warn(`Prisma connection skipped/failed during bootstrap: ${message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
