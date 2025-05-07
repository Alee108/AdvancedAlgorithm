import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { MongooseModule } from '@nestjs/mongoose';
import { Message, MessageSchema } from 'src/entities/chat/chat.entity';
import { ChatService } from './chat.service';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Message.name, schema: MessageSchema }]),
    RedisModule
  ],
  controllers: [ChatController],
  providers: [ChatGateway, ChatService]
})
export class ChatModule {}
