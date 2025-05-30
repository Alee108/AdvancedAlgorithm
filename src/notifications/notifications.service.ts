import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationError } from './exceptions/notification.error';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
    private readonly notificationGateway:NotificationsGateway
  ) {}

  async createNotification(notificationData: CreateNotificationDto): Promise<NotificationResponseDto> {
    try {
      // Check for duplicate notifications
      const existingNotification = await this.checkForDuplicate(notificationData);
      if (existingNotification) {
        this.logger.log(`Duplicate notification prevented for user ${notificationData.userId}`);
        return new NotificationResponseDto(existingNotification, 'Duplicate notification prevented');
      }

      // Create and save the notification
      const notification = await this.notificationModel.create(notificationData);
      this.logger.log(`Notification created for user ${notificationData.userId}`);
      this.notificationGateway.sendNotification(notification.userId,notification)
      return new NotificationResponseDto(notification, 'Notification created successfully');
    } catch (error) {
      this.logger.error(`Error creating notification: ${error.message}`, {
        userId: notificationData.userId,
        type: notificationData.type,
        error: error.stack
      });

      await this.handleFailedNotification(notificationData, error);
      throw new NotificationError('Failed to create notification', error);
    }
  }

  private async checkForDuplicate(notificationData: CreateNotificationDto): Promise<Notification | null> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    return this.notificationModel.findOne({
      userId: notificationData.userId,
      type: notificationData.type,
      'payload.id': notificationData.payload.id,
      createdAt: { $gte: fiveMinutesAgo }
    });
  }

  private async handleFailedNotification(notificationData: CreateNotificationDto, error: any): Promise<void> {
    try {
      this.logger.error('Failed notification details:', {
        data: notificationData,
        error: error.message
      });
    } catch (error) {
      this.logger.error(`Error handling failed notification: ${error.message}`);
    }
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    try {
      return this.notificationModel
        .find({ userId })
        .sort({ createdAt: -1 })
        .exec();
    } catch (error) {
      this.logger.error(`Error fetching notifications: ${error.message}`);
      throw new NotificationError('Failed to fetch notifications', error);
    }
  }

  async markAsRead(notificationId: string): Promise<Notification> {
    try {
      const notification = await this.notificationModel.findByIdAndUpdate(
        notificationId,
        { read: true },
        { new: true }
      );

      if (!notification) {
        throw new NotFoundException(`Notification ${notificationId} not found`);
      }

      return notification;
    } catch (error) {
      this.logger.error(`Error marking notification as read: ${error.message}`);
      throw new NotificationError('Failed to mark notification as read', error);
    }
  }

  async markAllAsRead(userId: string): Promise<void> {
    try {
      await this.notificationModel.updateMany(
        { userId, read: false },
        { read: true }
      );
    } catch (error) {
      this.logger.error(`Error marking all notifications as read: ${error.message}`);
      throw new NotificationError('Failed to mark all notifications as read', error);
    }
  }

  async deleteNotification(notificationId: string): Promise<void> {
    try {
      const result = await this.notificationModel.findByIdAndDelete(notificationId);
      if (!result) {
        throw new NotFoundException(`Notification ${notificationId} not found`);
      }
    } catch (error) {
      this.logger.error(`Error deleting notification: ${error.message}`);
      throw new NotificationError('Failed to delete notification', error);
    }
  }

  async deleteAllNotifications(userId: string): Promise<void> {
    try {
      const result = await this.notificationModel.deleteMany({ userId });
      this.logger.log(`Deleted ${result.deletedCount} notifications for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error deleting all notifications: ${error.message}`);
      throw new NotificationError('Failed to delete all notifications', error);
    }
  }

  async cleanupOldNotifications(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      await this.notificationModel.deleteMany({
        createdAt: { $lt: thirtyDaysAgo },
        read: true
      });

      this.logger.log('Old notifications cleaned up successfully');
    } catch (error) {
      this.logger.error(`Error cleaning up old notifications: ${error.message}`);
      throw new NotificationError('Failed to clean up old notifications', error);
    }
  }
} 