import { ApiProperty } from '@nestjs/swagger';
import { IsEmpty, IsEnum, IsInt, IsNotEmpty, IsString } from 'class-validator';

export class chatDTO{
    @ApiProperty({example:"Hi you ok?"})
    @IsString()
    @IsNotEmpty()
    readonly message: string;
  
    @ApiProperty({example:1})
    @IsString()
    @IsNotEmpty()
    readonly senderId: number;

    @ApiProperty({example:1})
    @IsString()
    @IsNotEmpty()
    readonly receiverId: number;


}