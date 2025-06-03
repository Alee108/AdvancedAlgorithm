import { Controller, Get, Post, Param, UseGuards, Req, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RecommendationService } from './recommendation.service';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('recommendations')
@Controller('recommendations')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @Get('posts')
  @ApiOperation({ summary: 'Get recommended posts for the current user' })
  @ApiResponse({ status: 200, description: 'Returns recommended posts' })
  //@ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of posts to return (default: 20)' })
  async getRecommendedPosts(
    @Req() req: any,
   // @Query('limit') limit?: number
  ) {
    const posts = await this.recommendationService.getRecommendedPosts(req.user.sub, 20);
    console.log("found: ", posts.length, Date.now())
    return posts
  }

  @Get('users')
  @ApiOperation({ summary: 'Get recommended users based on followers and their followers' })
  @ApiResponse({ status: 200, description: 'Returns recommended users' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of users to return (default: 20)' })
  async getRecommendedUsers(
    @Req() req: any,
    @Query('limit') limit?: number
  ) {
    const users = await this.recommendationService.getRecommendedUsers(req.user.sub, limit);
    return users;
  }

  /*@Post('posts/:postId/view')
  @ApiOperation({ summary: 'Record a post view for recommendation purposes' })
  @ApiResponse({ status: 200, description: 'View recorded successfully' })
  async recordPostView(
    @Req() req: any,
    @Param('postId') postId: string
  ) {
    await this.recommendationService.recordPostView(req.user.sub, postId);
    return { success: true };
  }*/
} 