import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { ChatService, ChatInfo, PopulatedMessage } from './chat.service';
import { Message } from 'src/entities/chat/chat.entity';
import { AuthGuard } from '../auth/auth.guard';

@ApiBearerAuth()
@ApiTags('Chat')
@Controller('chat')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get(':userId')
  @ApiOperation({ summary: 'Get all chats for a user' })
  async findAllChatsByUser(@Param('userId') userId: string): Promise<ChatInfo[]> {
    return this.chatService.findAllChatsByUser(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new message' })
  @ApiBody({ type: Message })
  async createMsg(@Body() msg: Partial<Message>): Promise<PopulatedMessage> {
    return this.chatService.create(msg);
  }

  /*@Delete(':id')
  remove(@Param('id') id: string) {
    console.log(`Deleting user with id: ${id}`);
    return this.usersService.delete(+id);
  }*/
}