import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, UseInterceptors, UploadedFile, Inject } from '@nestjs/common';
import { PostService } from './post.service';
import { CreatePostDto, UpdatePostDto, AddCommentDto } from './post.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { Public } from '../auth/decorators/public.decorators';
import { Types } from 'mongoose';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { CreatePostData } from './post.service';
import { ClientKafka } from '@nestjs/microservices';
import sharp from 'sharp';

@ApiTags('posts')
@ApiBearerAuth()
@Controller('posts')
@UseGuards(AuthGuard)
export class PostController {
  constructor(private readonly postService: PostService,
    @Inject('KAFKA_CLIENT') private readonly kafkaClient: ClientKafka

  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new post' })
  @ApiResponse({ status: 201, description: 'Post created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      fileFilter: (req, file, callback) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
          return callback(new Error('Only image files are allowed!'), false);
        }
        callback(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  
  async create(
    @Body() createPostDto: CreatePostDto,
    @UploadedFile() file: Express.Multer.File,
    @Request() req
  ) {
    try {
      if (!file) {
        throw new Error('Image file is required');
      }
      
      console.log('File received:', file);
      // ✅ Comprime l’immagine con sharp in JPEG qualità 70
      const compressedBuffer = await sharp(file.buffer)
        .resize({ width: 1024 }) // Ridimensiona (opzionale)
        .jpeg({ quality: 70 })   // Comprime
        .toBuffer();
  
      const base64Image = `data:image/jpeg;base64,${compressedBuffer.toString('base64')}`;
  
      // Crea post con immagine compressa
      const postData = {
        description: createPostDto.description,
        location: createPostDto.location,
        base64Image,
        userId: new Types.ObjectId(req.user.sub),
      };
  
      const img = await this.postService.create(postData);
  
      // Invia a Kafka
      this.kafkaClient.emit('photo-upload', JSON.stringify({
        userId: req.user.sub,
        photoId: img.id,
        imageUrl: img.base64Image,
      }));
  
      return img;
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  }
  
  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all posts' })
  @ApiResponse({ status: 200, description: 'Return all posts' })
  findAll() {
    return this.postService.findAll();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a post by id' })
  @ApiResponse({ status: 200, description: 'Return the post' })
  findOne(@Param('id') id: string) {
    return this.postService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a post' })
  @ApiResponse({ status: 200, description: 'Post updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads/posts',
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
  async update(
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto,
    @UploadedFile() file: Express.Multer.File
  ) {
    try {
      const updateData: Partial<CreatePostData> = {
        description: updatePostDto.description,
        location: updatePostDto.location
      };

      if (file) {
        // Read the file and convert to base64
        const imageBuffer = fs.readFileSync(file.path);
        const base64Image = `data:${file.mimetype};base64,${imageBuffer.toString('base64')}`;

        // Delete the temporary file
        fs.unlinkSync(file.path);

        updateData.base64Image = base64Image;
      }

      return this.postService.update(id, updateData);
    } catch (error) {
      console.error('Error updating post:', error);
      throw error;
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a post' })
  @ApiResponse({ status: 200, description: 'Post deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  remove(@Param('id') id: string) {
    return this.postService.delete(id);
  }

  @Post(':id/like')
  @ApiOperation({ summary: 'Like a post' })
  @ApiResponse({ status: 200, description: 'Post liked successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  addLike(@Param('id') id: string) {
    return this.postService.addLike(id);
  }

  @Post(':id/comment')
  @ApiOperation({ summary: 'Add a comment to a post' })
  @ApiResponse({ status: 201, description: 'Comment added successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  addComment(
    @Param('id') id: string,
    @Body() addCommentDto: AddCommentDto,
    @Request() req
  ) {
    return this.postService.addComment(id, req.user.sub, addCommentDto.text);
  }

  @Get('user/:userId')
  @Public()
  @ApiOperation({ summary: 'Get all posts by a user' })
  @ApiResponse({ status: 200, description: 'Return all posts by the user' })
  findByUser(@Param('userId') userId: string) {
    return this.postService.findByUser(userId);
  }
} 