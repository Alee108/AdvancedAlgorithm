import { Injectable, Logger, Inject } from '@nestjs/common';
import { createClient } from 'redis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: ReturnType<typeof createClient>,
  ) {}

  async setUserSession(userId: string, socketId: string): Promise<void> {
    try {
      // Set user session with expiration
      await this.redisClient.set(`user:${userId}`, socketId, { EX: 1800 }); // 30 minutes
      
      // Add user to active users set
      await this.redisClient.sAdd('active_users', userId);
      
      this.logger.log(`Session set for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error setting user session: ${error.message}`);
      throw error;
    }
  }

  async getUserSession(userId: string): Promise<string | null> {
    try {
      return await this.redisClient.get(`user:${userId}`);
    } catch (error) {
      this.logger.error(`Error getting user session: ${error.message}`);
      return null;
    }
  }

  async removeUserSession(userId: string): Promise<void> {
    try {
      await this.redisClient.del(`user:${userId}`);
      await this.redisClient.sRem('active_users', userId);
      this.logger.log(`Session removed for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error removing user session: ${error.message}`);
      throw error;
    }
  }

  async cleanupInactiveSessions(): Promise<void> {
    try {
      const activeUsers = await this.redisClient.sMembers('active_users');
      for (const userId of activeUsers) {
        const exists = await this.redisClient.exists(`user:${userId}`);
        if (!exists) {
          await this.redisClient.sRem('active_users', userId);
          this.logger.log(`Cleaned up inactive session for user ${userId}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error cleaning up sessions: ${error.message}`);
    }
  }

  async isUserActive(userId: string): Promise<boolean> {
    try {
      return await this.redisClient.sIsMember('active_users', userId);
    } catch (error) {
      this.logger.error(`Error checking user active status: ${error.message}`);
      return false;
    }
  }

  async getActiveUsers(): Promise<string[]> {
    try {
      return await this.redisClient.sMembers('active_users');
    } catch (error) {
      this.logger.error(`Error getting active users: ${error.message}`);
      return [];
    }
  }
} 