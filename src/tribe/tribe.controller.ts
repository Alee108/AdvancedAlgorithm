import { Controller, Post, Body, UseGuards, UseInterceptors, UploadedFile, Req, BadRequestException } from '@nestjs/common';
import { TribeService } from './tribe.service';
import { CreateTribeDto } from './dto/create-tribe.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { Tribe } from '../entities/tribe/tribe.entity';

@ApiTags('tribes')
@Controller('tribes')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class TribeController {
  constructor(private readonly tribeService: TribeService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new tribe' })
  @ApiResponse({ status: 201, description: 'Tribe successfully created.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('profilePhoto', {
      storage: diskStorage({
        destination: './uploads/tribes',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
          return callback(new Error('Only image files are allowed!'), false);
        }
        callback(null, true);
      },
    }),
  )
  async create(
    @Body() createTribeDto: CreateTribeDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any
  ): Promise<Tribe> {
    try {
      if (!req.user || !req.user.sub) {
        throw new BadRequestException('User not authenticated');
      }

      if (file) {
        const imageBuffer = fs.readFileSync(file.path);
        createTribeDto.profilePhoto = `data:${file.mimetype};base64,${imageBuffer.toString('base64')}`;
        fs.unlinkSync(file.path);
      }

      return this.tribeService.create(createTribeDto, req.user.sub);
    } catch (error) {
      console.error('Error creating tribe:', error);
      throw error;
    }
  }
}
