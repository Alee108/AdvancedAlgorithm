import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Notification } from './entities/notification.entity';
import { JwtService } from '@nestjs/jwt';
import { Inject } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8080'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  },
  namespace: '/',
  transports: ['websocket'],
})
export class NotificationsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient,
    private readonly jwtService: JwtService,
  ) {}

  @WebSocketServer() io: Server;

  afterInit() {
    this.logger.log('Notifications WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractTokenFromHandshake(client);
      if (!token) {
        throw new Error('No token provided');
      }

      // Remove 'Bearer ' prefix if present
      const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
      
      const payload = await this.jwtService.verifyAsync(cleanToken);
      const userId = payload.sub.toString();
      await this.redisClient.set(`user:${userId}`, client.id, {
        EX: 1800, // 30 min exp
      });

     // this.logger.log(`User ${userId} connected with socket ${client.id}`);
    } catch (error) {
      this.logger.error(`Authentication failed: ${error.message}`);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      for (const key of await this.redisClient.keys('user:*')) {
        const socketId = await this.redisClient.get(key);
        if (socketId === client.id) {
          await this.redisClient.del(key);
          this.logger.log(`Removed user id: ${key.split(':')[1]} from Redis`);
          break;
        }
      }
    } catch (error) {
      this.logger.error(`Error during disconnect: ${error.message}`);
    }
  }

  // Metodo per inviare una notifica a un utente specifico
  async sendNotification(userId: string, notification: Notification) {
    try {
      const recipientSocketId = await this.redisClient.get(`user:${userId}`);
      if (recipientSocketId) {
        this.logger.log(`User ${userId} is online (socket: ${recipientSocketId}), sending notification`);
        this.io.to(recipientSocketId).emit('notification', notification);
      } else {
        this.logger.warn(`User ${userId} is not online, notification will be available when they connect`);
      }
    } catch (error) {
      this.logger.error(`Error sending notification: ${error.message}`);
    }
  }

  // Metodo per inviare una notifica a più utenti
  async sendNotificationToUsers(userIds: string[], notification: Notification) {
    for (const userId of userIds) {
      await this.sendNotification(userId, notification);
    }
  }

  private extractTokenFromHandshake(client: Socket): string | null {
    try {
      // Try to get token from auth object first (socket.io-client format)
      if (client.handshake.auth && client.handshake.auth.token) {
        return client.handshake.auth.token;
      }

      // Fallback to headers
      const authHeader = client.handshake.headers.authorization;
      if (!authHeader) {
        return null;
      }

      const [type, token] = authHeader.split(' ');
      if (type !== 'Bearer') {
        return null;
      }

      return token;
    } catch (error) {
      this.logger.error(`Error extracting token: ${error.message}`);
      return null;
    }
  }
}