import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto, UpdateCommentDto } from './comments.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { Public } from '../auth/decorators/public.decorators';

@ApiTags('comments')
@Controller('comments')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post('post/:postId')
  @ApiOperation({ summary: 'Create a new comment' })
  @ApiResponse({ status: 201, description: 'Comment created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() createCommentDto: CreateCommentDto, @Req() req: any, @Param('postId') postId: string) {
    return this.commentsService.create(createCommentDto, req.user.sub, postId);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all comments' })
  @ApiResponse({ status: 200, description: 'Return all comments' })
  findAll() {
    return this.commentsService.findAll();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a comment by id' })
  @ApiResponse({ status: 200, description: 'Return the comment' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  findOne(@Param('id') id: string) {
    return this.commentsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a comment' })
  @ApiResponse({ status: 200, description: 'Comment updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  update(
    @Param('id') id: string,
    @Body() updateCommentDto: UpdateCommentDto,
    @Req() req: any
  ) {
    return this.commentsService.update(id, updateCommentDto, req.user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a comment' })
  @ApiResponse({ status: 200, description: 'Comment deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.commentsService.remove(id, req.user.sub);
  }

  @Get('post/:postId')
  @Public()
  @ApiOperation({ summary: 'Get all comments for a post' })
  @ApiResponse({ status: 200, description: 'Return all comments for the post' })
  findByPost(@Param('postId') postId: string) {
    return this.commentsService.findByPost(postId);
  }

  @Get('user/:userId')
  @Public()
  @ApiOperation({ summary: 'Get all comments by a user' })
  @ApiResponse({ status: 200, description: 'Return all comments by the user' })
  findByUser(@Param('userId') userId: string) {
    return this.commentsService.findByUser(userId);
  }
} 