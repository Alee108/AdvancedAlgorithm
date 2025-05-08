import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, UseInterceptors, UploadedFile } from '@nestjs/common';
import { PostService } from './post.service';
import { CommentsService } from '../comments/comments.service';
import { CreatePostDto, UpdatePostDto } from './post.dto';
import { CreateCommentDto } from '../comments/comments.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { Public } from '../auth/decorators/public.decorators';
import { Types } from 'mongoose';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { CreatePostData } from './post.service';

@ApiTags('posts')
@ApiBearerAuth()
@Controller('posts')
@UseGuards(AuthGuard)
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly commentsService: CommentsService
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new post' })
  @ApiResponse({ status: 201, description: 'Post created successfully' })
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
  async create(
    @Body() createPostDto: CreatePostDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any
  ) {
    try {
      let base64Image: string | null = null;
      
      if (file) {
        // Read the file and convert to base64
        const imageBuffer = fs.readFileSync(file.path);
        base64Image = `data:${file.mimetype};base64,${imageBuffer.toString('base64')}`;

        // Delete the temporary file
        fs.unlinkSync(file.path);
      }

      const postData = {
        ...createPostDto,
        base64Image,
        userId: req.user.sub
      };

      return this.postService.create(postData);
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
      if (file) {
        // Read the file and convert to base64
        const imageBuffer = fs.readFileSync(file.path);
        const base64Image = `data:${file.mimetype};base64,${imageBuffer.toString('base64')}`;

        // Delete the temporary file
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
  @Public()
  @ApiOperation({ summary: 'Get all posts by a user' })
  @ApiResponse({ status: 200, description: 'Return all posts by the user' })
  findByUser(@Param('userId') userId: string) {
    return this.postService.findByUser(userId);
  }
} 