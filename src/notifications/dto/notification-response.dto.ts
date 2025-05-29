import { Notification } from '../entities/notification.entity';
import { ApiProperty } from '@nestjs/swagger';

export class NotificationResponseDto {
  @ApiProperty({ example: 'Success' })
  message: string;

  @ApiProperty({ example: 200 })
  code: number;

  @ApiProperty({
    example: {
      _id: '507f1f77bcf86cd799439011',
      userId: '507f1f77bcf86cd799439012',
      type: 'POST_LIKE',
      content: 'Hai ricevuto un nuovo like',
      payload: {
        postId: '507f1f77bcf86cd799439013',
        userId: '507f1f77bcf86cd799439014'
      },
      read: false,
      createdAt: '2024-05-07T12:00:00.000Z',
      updatedAt: '2024-05-07T12:00:00.000Z'
    }
  })
  data: Notification | Notification[];

  constructor(notification: Notification | Notification[], message: string = 'Success', code: number = 200) {
    this.message = message;
    this.code = code;
    this.data = notification;
  }
} 