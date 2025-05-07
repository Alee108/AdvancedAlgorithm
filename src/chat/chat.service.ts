import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from 'src/entities/chat/chat.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
  ) {}

  private readonly logger = new Logger(ChatService.name);

  async findAllChatsByUser(userId: string) {
    const messages = await this.messageModel
      .find({
        $or: [
          { sender: new Types.ObjectId(userId) },
          { receiver: new Types.ObjectId(userId) }
        ]
      })
      .populate('sender', 'username email')
      .populate('receiver', 'username email')
      .sort({ createdAt: 1 })
      .exec();

    const chatsMap = new Map<string, any[]>();

    for (const message of messages) {
      const otherUser = message.sender._id.toString() === userId
        ? message.receiver
        : message.sender;

      if (!chatsMap.has(otherUser._id.toString())) {
        chatsMap.set(otherUser._id.toString(), []);
      }

      const simplifiedMessage = {
        id: message._id,
        message: message.message_text,
        sent_at: message.createdAt,
        senderId: message.sender._id,
        receiverId: message.receiver._id,
      };

      (chatsMap.get(otherUser._id.toString()) || []).push(simplifiedMessage);
    }

    const chats = Array.from(chatsMap.entries()).map(([otherUserId, messages]) => ({
      userId: otherUserId,
      messages,
    }));

    return chats;
  }

  async create(msg: Partial<Message>): Promise<MessageDocument> {
    const newMessage = new this.messageModel(msg);
    return newMessage.save();
  }
}