import { Controller, Get, Post, Body, Param, Put, Delete, Query, UseGuards, Request } from '@nestjs/common';
import { PostService } from './post.service';
import { Post as PostEntity } from 'src/entities/post/post.entity';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { Public } from 'src/auth/decorators/public.decorators';
import { CreatePostDto } from '../DTO/create-post.dto';

@Controller('posts')
@ApiTags('Posts')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new post' })
  @ApiBody({ type: CreatePostDto })
  create(@Body() createPostDto: CreatePostDto, @Request() req) {
    console.log('User from request:', req.user);
    return this.postService.create({
      ...createPostDto,
      userId: req.user.sub
    });
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all posts' })
  findAll() {
    return this.postService.findAll();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a post by id' })
  findOne(@Param('id') id: string) {
    return this.postService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a post' })
  update(@Param('id') id: string, @Body() updatePostDto: Partial<PostEntity>) {
    return this.postService.update(id, updatePostDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a post' })
  remove(@Param('id') id: string) {
    return this.postService.delete(id);
  }

  @Post(':id/like')
  @ApiOperation({ summary: 'Add a like to a post' })
  addLike(@Param('id') id: string) {
    return this.postService.addLike(id);
  }

  @Post(':id/comment')
  @ApiOperation({ summary: 'Add a comment to a post' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          example: 'This is a comment'
        }
      }
    }
  })
  addComment(
    @Param('id') id: string,
    @Body() commentData: { text: string },
    @Request() req
  ) {
    return this.postService.addComment(id, req.user.sub, commentData.text);
  }

  @Get('tags/search')
  @Public()
  @ApiOperation({ summary: 'Search posts by tags' })
  findByTags(@Query('tags') tags: string) {
    const tagArray = tags.split(',').map(tag => tag.trim());
    return this.postService.findByTags(tagArray);
  }

  @Get('user/:userId')
  @Public()
  @ApiOperation({ summary: 'Get all posts by a user' })
  findByUser(@Param('userId') userId: string) {
    return this.postService.findByUser(userId);
  }
} 