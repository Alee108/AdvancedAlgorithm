import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../auth/auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { NotificationResponseDto } from './dto/notification-response.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all notifications for the current user' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns list of notifications for the current user',
    type: NotificationResponseDto 
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getNotifications(@Request() req): Promise<NotificationResponseDto> {
    const notifications = await this.notificationsService.getNotifications(req.user.sub);
    return new NotificationResponseDto(notifications, 'Notifications retrieved successfully');
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({ 
    status: 200, 
    description: 'Notification marked as read successfully',
    type: NotificationResponseDto 
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markAsRead(@Param('id') id: string): Promise<NotificationResponseDto> {
    const notification = await this.notificationsService.markAsRead(id);
    return new NotificationResponseDto(notification, 'Notification marked as read');
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ 
    status: 200, 
    description: 'All notifications marked as read successfully',
    type: NotificationResponseDto 
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAllAsRead(@Request() req): Promise<NotificationResponseDto> {
    await this.notificationsService.markAllAsRead(req.user.sub);
    return new NotificationResponseDto([], 'All notifications marked as read');
  }

  @Post(':id/delete')
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiResponse({ 
    status: 200, 
    description: 'Notification deleted successfully',
    type: NotificationResponseDto 
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async deleteNotification(@Param('id') id: string): Promise<NotificationResponseDto> {
    await this.notificationsService.deleteNotification(id);
    return new NotificationResponseDto([], 'Notification deleted successfully');
  }
} 