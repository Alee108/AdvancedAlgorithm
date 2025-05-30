import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from 'src/entities/chat/chat.entity';

export interface PopulatedUser {
  _id: Types.ObjectId;
  username: string;
  email: string;
  profilePhoto?: string;
}

export interface PopulatedMessage extends Omit<MessageDocument, 'sender' | 'receiver'> {
  sender: PopulatedUser;
  receiver: PopulatedUser;
}

export interface SimplifiedMessage {
  id: Types.ObjectId;
  message: string;
  sent_at: Date;
  senderId: Types.ObjectId;
  receiverId: Types.ObjectId;
  sender: PopulatedUser;
  receiver: PopulatedUser;
}

export interface ChatInfo {
  userId: string;
  username: string;
  email: string;
  profilePhoto?: string;
  messages: SimplifiedMessage[];
  lastMessage: {
    text: string;
    sent_at: Date;
  };
}

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
  ) {}

  private readonly logger = new Logger(ChatService.name);

  async findAllChatsByUser(userId: string): Promise<ChatInfo[]> {
    try {
      this.logger.log(`Finding all chats for user ${userId}`);
      
      const messages = await this.messageModel
        .find({
          $or: [
            { sender: userId },
            { receiver: userId }
          ]
        })
        //.sort({ createdAt: -1 })
        .populate<{ sender: PopulatedUser; receiver: PopulatedUser }>('sender', 'username email profilePhoto')
        .populate<{ sender: PopulatedUser; receiver: PopulatedUser }>('receiver', 'username email profilePhoto')
        .lean()
        .exec() as PopulatedMessage[];

      this.logger.log(`Found ${messages.length} messages`);

      const chatsMap = new Map<string, SimplifiedMessage[]>();

      for (const message of messages) {
        
        if (!message.sender || !message.receiver) {
          this.logger.warn(`Message ${message._id} has missing sender or receiver`);
          continue;
        }

        const sender = message.sender as PopulatedUser;
        const receiver = message.receiver as PopulatedUser;

        const otherUser = sender._id.toString() === userId
          ? receiver
          : sender;

        const otherUserId = otherUser._id.toString();

        if (!chatsMap.has(otherUserId)) {
          chatsMap.set(otherUserId, []);
        }

        const simplifiedMessage: SimplifiedMessage = {
          id: message._id,
          message: message.message_text,
          sent_at: message.createdAt,
          senderId: sender._id,
          receiverId: receiver._id,
          sender: {
            _id: sender._id,
            username: sender.username,
            email: sender.email,
            profilePhoto: sender.profilePhoto
          },
          receiver: {
            _id: receiver._id,
            username: receiver.username,
            email: receiver.email,
            profilePhoto: receiver.profilePhoto
          }
        };

        (chatsMap.get(otherUserId) || []).push(simplifiedMessage);
      }

      const chats = Array.from(chatsMap.entries()).map(([otherUserId, messages]) => {
        const lastMessage = messages[messages.length - 1];
        const otherUser = lastMessage.senderId.toString() === userId 
          ? lastMessage.receiver 
          : lastMessage.sender;

        return {
          userId: otherUserId,
          username: otherUser.username,
          email: otherUser.email,
          profilePhoto: otherUser.profilePhoto,
          messages,
          lastMessage: {
            text: lastMessage.message,
            sent_at: lastMessage.sent_at,
            senderId:lastMessage.senderId
          }
        };
      });

      this.logger.log(`Returning ${chats.length} chats`);
      return chats;
    } catch (error) {
      this.logger.error(`Error finding chats: ${error.message}`);
      throw error;
    }
  }

  async create(msg: Partial<Message>): Promise<PopulatedMessage> {
    const newMessage = new this.messageModel(msg);
    const savedMessage = await newMessage.save();
    const populatedMessage = await this.messageModel.findById(savedMessage._id)
      .populate<{ sender: PopulatedUser; receiver: PopulatedUser }>('sender', 'username email profilePhoto')
      .populate<{ sender: PopulatedUser; receiver: PopulatedUser }>('receiver', 'username email profilePhoto')
      .lean()
      .exec() as PopulatedMessage | null;
    
    if (!populatedMessage) {
      throw new Error('Failed to retrieve created message');
    }
    
    return populatedMessage;
  }
}