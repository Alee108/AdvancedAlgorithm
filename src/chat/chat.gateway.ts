import { Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService, PopulatedMessage } from './chat.service';
import { Message } from 'src/entities/chat/chat.entity';
import { JwtService } from '@nestjs/jwt';
import { Inject } from '@nestjs/common';
import { createClient } from 'redis';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationType } from 'src/notifications/enums/notification-type.enum';

@ApiBearerAuth()
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
@ApiTags('Chat')
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ChatGateway.name);

  private clientMap: Map<string, Socket> = new Map();
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient,
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @WebSocketServer() io: Server;

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket, ...args: any[]) {
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
        EX: 1800, //30 min exp
      });
  
      const { sockets } = this.io.sockets;
      //this.logger.debug(`Number of connected clients: ${sockets.size}`);
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

  @SubscribeMessage('send')
  @ApiOperation({ summary: 'Send a chat message' })
  @ApiBody({ type: () => Object })
  async handleMessage(@MessageBody() data: Partial<Message>, @ConnectedSocket() client: Socket) {
    this.logger.log(`Received message from client ${client.id}:`, data);
    
    const message = await this.chatService.create(data);
    this.logger.log(`Message saved to database:`, message);
    
    const receivedMsg = {
      id: message._id,
      message: message.message_text,
      message_text: message.message_text,
      sent_at: message.createdAt,
      senderId: message.sender._id,
      receiverId: message.receiver._id,
      sender: {
        _id: message.sender._id,
        username: message.sender.username,
        email: message.sender.email,
        profilePhoto: message.sender.profilePhoto
      },
      receiver: {
        _id: message.receiver._id,
        username: message.receiver.username,
        email: message.receiver.email,
        profilePhoto: message.receiver.profilePhoto
      }
    };
    
    this.logger.log(`Sending confirmation back to sender ${client.id}`);
    // Send message back to sender
    client.emit('receive', receivedMsg);
    
    // Send message to receiver if online
    await this.sendMSGtoReceiver(message);

      // Send notification to receiver
      await this.notificationsService.createNotification({
        userId: message.receiver._id.toString(),
        type: NotificationType.NEW_MESSAGE,
        content: `Hai ricevuto un nuovo messaggio`,
        payload: {
          senderId: client.id,
          messageContent: message.message_text,
        },
      });
  }

  private async sendMSGtoReceiver(message: PopulatedMessage) {
    const receivedMsg = {
      id: message._id,
      message: message.message_text,
      message_text: message.message_text,
      sent_at: message.createdAt,
      senderId: message.sender._id,
      receiverId: message.receiver._id,
      sender: {
        _id: message.sender._id,
        username: message.sender.username,
        email: message.sender.email,
        profilePhoto: message.sender.profilePhoto
      },
      receiver: {
        _id: message.receiver._id,
        username: message.receiver.username,
        email: message.receiver.email,
        profilePhoto: message.receiver.profilePhoto
      }
    };
  
    this.logger.log(`Attempting to send message to receiver: ${message.receiver._id}`);
  
    const recipientSocketId = await this.redisClient.get(`user:${receivedMsg.receiverId}`);
    if (recipientSocketId) {
      this.logger.log(`Receiver is online (socket: ${recipientSocketId}), sending message`);
      this.io.to(recipientSocketId).emit('receive', receivedMsg); 
    } else {
      this.logger.warn(`Receiver with id ${receivedMsg.receiverId} is not online`);
    }
  }

  @SubscribeMessage('receive')
  @ApiOperation({ summary: 'Receive a chat message' })
  handleReceive(@MessageBody() data: any) {
    // Questo metodo è solo un placeholder per la sottoscrizione
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