import { IsString, IsNotEmpty, IsEnum, IsOptional, IsJSON } from 'class-validator';
import { NotificationType } from '../enums/notification-type.enum';

export class CreateNotificationDto {
  @IsString()
  @IsNotEmpty()
  userId: string; // ID dell'utente destinatario

  @IsEnum(NotificationType)
  @IsNotEmpty()
  type: NotificationType; // Tipo di notifica

  @IsString()
  @IsNotEmpty()
  content: string; // Contenuto testuale

  @IsOptional()
  @IsJSON()
  payload?: any; // Dati aggiuntivi
} 