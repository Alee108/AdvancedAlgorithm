import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post, PostDocument } from '../entities/post/post.entity';
import { User, UserDocument } from '../entities/users/users.entity';
import { Neo4jService } from '../neo4j/neo4j.service';
import { PostView, PostViewDocument } from '../entities/post-view/post-view.entity';

interface PostScore {
  post: PostDocument;
  score: number;
}

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(PostView.name) private postViewModel: Model<PostViewDocument>,
    private neo4jService: Neo4jService
  ) {}

  async getRecommendedPosts(userId: string, limit: number = 20): Promise<PostDocument[]> {
    try {
      // Get user's interests from Neo4j
      const userInterests = await this.getUserInterests(userId);
      
      // Get user's following list
      const following = await this.getFollowingUserIds(userId);
      
      // Get user's viewed/interacted posts
      const viewedPosts = await this.getUserViewedPosts(userId);

      // Get posts to score
      const posts = await this.getPostsToScore(userId, following, viewedPosts);
      this.logger.debug(`Found ${posts.length} posts to score for user ${userId}`);
      // If no posts found, try fallback strategies
      if (posts.length === 0) {
        return this.getFallbackPosts(limit);
      }

      // Score and sort posts
      const scoredPosts = await this.scorePosts(posts, userInterests, following);
      this.logger.debug(`Scored ${scoredPosts.length} posts for user ${userId}`);
      // If we don't have enough scored posts, supplement with fallback posts
      if (scoredPosts.length < limit) {
        const fallbackPosts = await this.getFallbackPosts(limit - scoredPosts.length);
        const scoredFallbackPosts = fallbackPosts.map(post => ({ post, score: 0 }));
        scoredPosts.push(...scoredFallbackPosts);
      }

      // Return top N posts
      return scoredPosts
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => item.post);
    } catch (error) {
      this.logger.error(`Error getting recommendations for user ${userId}:`, error);
      // Fallback to popular posts if recommendation fails
      return this.getFallbackPosts(limit);
    }
  }

  private async getUserInterests(userId: string): Promise<Map<string, number>> {
    const session = this.neo4jService.getSession();
    try {
      const result = await session.run(
        `
        MATCH (u:User {id: $userId})-[r:INTERESTED_IN]->(t:Tag)
        RETURN t.name as tag, r.weight as weight
        `,
        { userId }
      );

      const interests = new Map<string, number>();
      result.records.forEach(record => {
        interests.set(record.get('tag'), record.get('weight'));
      });
      return interests;
    } catch (error) {
      this.logger.warn(`Error getting user interests for ${userId}:`, error);
      return new Map(); // Return empty map if there's an error
    } finally {
      await session.close();
    }
  }

  private async getFollowingUserIds(userId: string): Promise<Types.ObjectId[]> {
    try {
      const user = await this.userModel.findById(userId).select('following').exec();
      return user?.following || [];
    } catch (error) {
      this.logger.warn(`Error getting following list for ${userId}:`, error);
      return [];
    }
  }

  private async getUserViewedPosts(userId: string): Promise<Set<string>> {
    try {
      const userObjectId = new Types.ObjectId(userId);
      const viewedPosts = await this.postViewModel
        .find({ userId: userObjectId })
        .select('postId')
        .exec();
      
      return new Set(viewedPosts.map(view => view.postId.toString()));
    } catch (error) {
      this.logger.warn(`Error getting viewed posts for ${userId}:`, error);
      return new Set();
    }
  }

  private async getPostsToScore(
    userId: string,
    following: Types.ObjectId[],
    viewedPosts: Set<string>
  ): Promise<PostDocument[]> {
    try {
      // Get posts from followed users and posts with matching tags
      const posts = await this.postModel
        .find({
          archived: false,
          _id: { $nin: Array.from(viewedPosts).map(id => new Types.ObjectId(id)) },
          $or: [
            { userId: { $in: following } },
            { 'metadata.keywords': { $exists: true, $ne: [] } }
          ]
        })
        .populate('userId', 'name surname username profilePhoto')
        .populate('tribeId', 'name')
        .populate('comments')
        .sort({ createdAt: -1 })
        .limit(100) // Limit to recent posts for performance
        .exec();

      return posts;
    } catch (error) {
      this.logger.warn(`Error getting posts to score for ${userId}:`, error);
      return [];
    }
  }

  private async scorePosts(
    posts: PostDocument[],
    userInterests: Map<string, number>,
    following: Types.ObjectId[]
  ): Promise<PostScore[]> {
    return posts.map(post => {
      let score = 0;

      // Base score from post age (newer posts get higher score)
      const ageInHours = (Date.now() - post.createdAt.getTime()) / (1000 * 60 * 60);
      score += Math.max(0, 24 - ageInHours) * 0.5;

      // Score from user interests
      if (post.metadata?.keywords) {
        post.metadata.keywords.forEach(tag => {
          const interestWeight = userInterests.get(tag) || 0;
          score += interestWeight * 2;
        });
      }

      // Bonus for posts from followed users
      if (following.some(id => id.equals(post.userId))) {
        score += 3;
      }

      // Engagement score
      const likeCount = post.likes?.length || 0;
      const commentCount = post.comments?.length || 0;
      score += (likeCount * 0.5) + (commentCount * 1);

      return { post, score };
    });
  }

  private async getFallbackPosts(limit: number): Promise<PostDocument[]> {
    try {
      // Try to get popular posts from active tribes first
      const popularPosts = await this.postModel
        .find({ archived: false })
        .populate('userId', 'name surname username profilePhoto')
        .populate('tribeId', 'name')
        .populate('comments')
        .sort({ 
          createdAt: -1 
        })
        .limit(limit)
        .exec();

      // Sort the results in memory by engagement metrics
      popularPosts.sort((a, b) => {
        const aScore = (a.likes?.length || 0) + (a.comments?.length || 0);
        const bScore = (b.likes?.length || 0) + (b.comments?.length || 0);
        return bScore - aScore;
      });

      return popularPosts;
    } catch (error) {
      this.logger.error('Error getting fallback posts:', error);
      // Last resort: get any recent posts
      return this.postModel
        .find({ archived: false })
        .populate('userId', 'name surname username profilePhoto')
        .populate('tribeId', 'name')
        .populate('comments')
        .sort({ createdAt: -1 })
        .limit(limit)
        .exec();
    }
  }

  async recordPostView(userId: string, postId: string): Promise<void> {
    try {
      const userObjectId = new Types.ObjectId(userId);
      const postObjectId = new Types.ObjectId(postId);

      // Create or update the view record
      await this.postViewModel.findOneAndUpdate(
        { userId: userObjectId, postId: postObjectId },
        { userId: userObjectId, postId: postObjectId },
        { upsert: true, new: true }
      ).exec();
    } catch (error) {
      this.logger.error(`Error recording post view for user ${userId}, post ${postId}:`, error);
    }
  }
} 