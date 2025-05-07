import { Controller, Get, Post, Body, Param, Put, Delete, HttpCode, HttpStatus, ParseIntPipe, Logger } from '@nestjs/common';
import { ChatService } from './chat.service';
import { User } from 'src/entities/users/users.entity';
import { ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { Public } from 'src/auth/decorators/public.decorators';
import { Message } from 'src/entities/chat/chat.entity';

@Controller('chat')
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}
  private readonly logger = new Logger(ChatController.name);

  @Get(':userId')
  async findAllChatsByUser(@Param('userId') userId: string) {
    return this.chatService.findAllChatsByUser(userId);
  }

  @Post()
  createMsg(@Body() msg: Message) {
    return this.chatService.create(msg);
  }

  /*@Delete(':id')
  remove(@Param('id') id: string) {
    console.log(`Deleting user with id: ${id}`);
    return this.usersService.delete(+id);
  }*/
}