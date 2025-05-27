import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, UseInterceptors, UploadedFile, Inject, Req, Query, BadRequestException } from '@nestjs/common';
import { PostService } from './post.service';
import { CommentsService } from '../comments/comments.service';
import { CreatePostDto, UpdatePostDto } from './post.dto';
import { CreateCommentDto } from '../comments/comments.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiQuery } from '@nestjs/swagger';
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
import { FilterPostDto } from './dto/post.filter.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('posts')
@ApiBearerAuth()
@Controller('posts')
@UseGuards(AuthGuard)
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly commentsService: CommentsService,
    @Inject('KAFKA_CLIENT') private readonly kafkaClient: ClientKafka
  ) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60 } }) // 5 posts per minute
  @ApiOperation({ summary: 'Create a new post' })
  @ApiResponse({ status: 201, description: 'Post created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - User must be a member of the tribe' })
  @ApiResponse({ status: 429, description: 'Too Many Requests - Rate limit exceeded' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      fileFilter: (req, file, callback) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp|PNG|JPG)$/)) {
          return callback(new Error('Only image files are allowed!'), false);
        }
        callback(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    }),
  )
  async create(
    @Body() createPostDto: CreatePostDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    try {
      if (!file) {
        throw new Error('Image file is required');
      }

      // Process image with sharp
      const processedImage = await sharp(file.buffer)
        .resize(1200, 1200, { // Max dimensions
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 80 }) // Convert to JPEG with 80% quality
        .toBuffer();

      const base64Image = `data:${file.mimetype};base64,${processedImage.toString('base64')}`;

      const postData = {
        ...createPostDto,
        base64Image,
        userId: new Types.ObjectId(req.user.sub),
        tribeId: new Types.ObjectId(createPostDto.tribeId),
      };

      const img = await this.postService.create(postData);

      /*this.kafkaClient.emit('photo-upload', JSON.stringify({
        userId: req.user.sub,
        photoId: img.id,
        imageUrl: img.base64Image,
      }));*/

      return img;
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  }
  


  @Get('home')
  @ApiOperation({ summary: 'Get home feed - posts from followed users' })
  @ApiResponse({ status: 200, description: 'Return posts from followed users' })
  getHomeFeed(@Req() req: any) {
    return this.postService.getHomeFeed(req.user.sub);
  }

  @Get(':id')
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
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp|PNG|JPG)$/)) {
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
      if (file) {
        const imageBuffer = fs.readFileSync(file.path);
        const base64Image = `data:${file.mimetype};base64,${imageBuffer.toString('base64')}`;
        fs.unlinkSync(file.path);
        return this.postService.update(id, { ...updatePostDto, base64Image });
      }
      return this.postService.update(id, updatePostDto);
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
  addLike(@Param('id') id: string, @Req() req: any) {
    return this.postService.addLike(id, req.user.sub);
  }

  @Delete(':id/like')
  @ApiOperation({ summary: 'Remove a like from a post' })
  @ApiResponse({ status: 200, description: 'Like removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  removeLike(@Param('id') id: string, @Req() req: any) {
    return this.postService.removeLike(id, req.user.sub);
  }

  @Post(':id/comment')
  @ApiOperation({ summary: 'Add a comment to a post' })
  @ApiResponse({ status: 201, description: 'Comment added successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  addComment(
    @Param('id') id: string,
    @Body() createCommentDto: CreateCommentDto,
    @Req() req: any
  ) {
    return this.commentsService.create(createCommentDto, req.user.sub, id);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get all posts by a user' })
  @ApiResponse({ status: 200, description: 'Return all posts by the user' })
  findByUser(@Param('userId') userId: string) {
    return this.postService.findByUser(userId);
  }


  @Get('tribe/:tribeId')
  @ApiOperation({ summary: 'Get all posts by tribe' })
  @ApiResponse({ status: 200, description: 'Return all posts by tribe' })
  findByTribe(@Param('tribeId') tribeId: string) {
    return this.postService.findByTribe(tribeId);
  }

  //get all posts by tribe with filters (most recent, most liked, most commented)
  @Get('tribe/:tribeId/filter')
  @ApiOperation({ summary: 'Get all posts by tribe with filters' })
  @ApiResponse({ status: 200, description: 'Return all posts by tribe with filters' })
  @ApiQuery({ name: 'filter', required: true, enum: ['most_recent', 'most_liked', 'most_commented'] })
  getAllPostsByTribeWithFilters(
    @Param('tribeId') tribeId: string,
    @Body('filter') filter: FilterPostDto
  ) {
    return this.postService.getAllPostsByTribeWithFilters(tribeId, filter.filter);
  }
} 