import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cache } from 'cache-manager';
import { Post, PostDocument } from '../entities/post/post.entity';
import { User, UserDocument } from '../entities/users/users.entity';
import { Neo4jService } from '../neo4j/neo4j.service';
import { PostView, PostViewDocument } from '../entities/post-view/post-view.entity';

interface PostScore {
  post: PostDocument;
  score: number;
  reasons: string[]; // For debugging/explanation
}

interface PostMetadata {
  keywords?: string[];
  readingTime?: number;
  category?: string;
}

interface TribeData {
  name: string;
  category?: string;
  memberCount?: number;
}

interface UserProfile {
  interests: Map<string, number>;
  following: Types.ObjectId[];
  viewedPosts: Set<string>;
  recentInteractions: Map<string, number>; // postId -> interaction_score
}

interface RecommendationMetrics {
  totalPosts: number;
  scoredPosts: number;
  fallbackUsed: boolean;
  processingTime: number;
}

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly MAX_POSTS_TO_SCORE = 200;
  private readonly DIVERSITY_THRESHOLD = 0.3;

  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(PostView.name) private postViewModel: Model<PostViewDocument>,
    private neo4jService: Neo4jService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

  async getRecommendedPosts(userId: string, limit: number = 20): Promise<PostDocument[]> {
    const startTime = Date.now();
    const cacheKey = `recommendations:${userId}:${limit}`;
    
    try {
      // Check cache first
      const cached = await this.cacheManager.get<PostDocument[]>(cacheKey);
      if (cached) {
        this.logger.debug(`Returning cached recommendations for user ${userId}`);
        return cached;
      }

      // Build user profile
      const userProfile = await this.buildUserProfile(userId);
      
      // Get candidate posts with intelligent filtering
      const candidatePosts = await this.getCandidatePosts(userId, userProfile);
      
      if (candidatePosts.length === 0) {
        this.logger.debug(`No candidate posts found for user ${userId}, using fallback`);
        const fallbackPosts = await this.getFallbackPosts(limit, userId);
        await this.cacheManager.set(cacheKey, fallbackPosts, this.CACHE_TTL);
        return fallbackPosts;
      }

      // Score posts with multiple algorithms
      const scoredPosts = await this.scorePostsAdvanced(candidatePosts, userProfile);
      
      // Apply diversity and freshness filters
      const diversifiedPosts = this.applyDiversityFilters(scoredPosts, limit);
      
      // Extract final results
      const recommendations = diversifiedPosts
        .slice(0, limit)
        .map(item => item.post);

      // Cache results
      await this.cacheManager.set(cacheKey, recommendations, this.CACHE_TTL);
      
      // Log metrics
      const metrics: RecommendationMetrics = {
        totalPosts: candidatePosts.length,
        scoredPosts: scoredPosts.length,
        fallbackUsed: false,
        processingTime: Date.now() - startTime
      };
      
      this.logger.debug(`Recommendations generated for user ${userId}:`, metrics);
      
      return recommendations;
      
    } catch (error) {
      this.logger.error(`Error generating recommendations for user ${userId}:`, error);
      const fallbackPosts = await this.getFallbackPosts(limit, userId);
      await this.cacheManager.set(cacheKey, fallbackPosts, this.CACHE_TTL / 2); // Shorter cache for fallback
      return fallbackPosts;
    }
  }

  private async buildUserProfile(userId: string): Promise<UserProfile> {
    const [interests, following, viewedPosts, recentInteractions] = await Promise.all([
      this.getUserInterests(userId),
      this.getFollowingUsers(userId),
      this.getUserViewedPosts(userId),
      this.getRecentInteractions(userId)
    ]);

    return {
      interests,
      following,
      viewedPosts,
      recentInteractions
    };
  }

  private async getUserInterests(userId: string): Promise<Map<string, number>> {
    const cacheKey = `user_interests:${userId}`;
    const cached = await this.cacheManager.get<Map<string, number>>(cacheKey);
    if (cached) return cached;

    const session = this.neo4jService.getSession();
    try {
      const result = await session.run(
        `
        MATCH (u:User {id: $userId})-[r:INTERESTED_IN]->(t:Tag)
        RETURN t.name as tag, r.weight as weight, r.lastUpdated as lastUpdated
        ORDER BY r.weight DESC
        `,
        { userId }
      );

      const interests = new Map<string, number>();
      const decayFactor = 0.95; // Decay older interests
      const currentTime = Date.now();

      result.records.forEach(record => {
        const weight = record.get('weight');
        const lastUpdated = record.get('lastUpdated') || currentTime;
        const daysSinceUpdate = (currentTime - lastUpdated) / (1000 * 60 * 60 * 24);
        const decayedWeight = weight * Math.pow(decayFactor, daysSinceUpdate);
        interests.set(record.get('tag'), decayedWeight);
      });

      await this.cacheManager.set(cacheKey, interests, this.CACHE_TTL * 2);
      return interests;
    } catch (error) {
      this.logger.warn(`Error getting user interests for ${userId}:`, error);
      return new Map();
    } finally {
      await session.close();
    }
  }

  private async getFollowingUsers(userId: string): Promise<Types.ObjectId[]> {
    const cacheKey = `user_following:${userId}`;
    const cached = await this.cacheManager.get<Types.ObjectId[]>(cacheKey);
    if (cached) return cached;

    try {
      const user = await this.userModel
        .findById(userId)
        .select('following')
        .lean()
        .exec();
      
      const following = user?.following || [];
      await this.cacheManager.set(cacheKey, following, this.CACHE_TTL * 4);
      return following;
    } catch (error) {
      this.logger.warn(`Error getting following list for ${userId}:`, error);
      return [];
    }
  }

  private async getUserViewedPosts(userId: string): Promise<Set<string>> {
    try {
      const userObjectId = new Types.ObjectId(userId);
      const recentViews = await this.postViewModel
        .find({ 
          userId: userObjectId,
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
        })
        .select('postId')
        .lean()
        .exec();
      
      return new Set(recentViews.map(view => view.postId.toString()));
    } catch (error) {
      this.logger.warn(`Error getting viewed posts for ${userId}:`, error);
      return new Set();
    }
  }

  private async getRecentInteractions(userId: string): Promise<Map<string, number>> {
    // This would include likes, comments, shares, etc.
    // Implementation depends on your interaction tracking system
    const session = this.neo4jService.getSession();
    try {
      const result = await session.run(
        `
        MATCH (u:User {id: $userId})-[r:INTERACTED_WITH]->(p:Post)
        WHERE r.timestamp > datetime() - duration('P7D')
        RETURN p.id as postId, r.type as interactionType, r.weight as weight
        `,
        { userId }
      );

      const interactions = new Map<string, number>();
      result.records.forEach(record => {
        const postId = record.get('postId');
        const weight = record.get('weight') || 1;
        interactions.set(postId, (interactions.get(postId) || 0) + weight);
      });

      return interactions;
    } catch (error) {
      this.logger.warn(`Error getting recent interactions for ${userId}:`, error);
      return new Map();
    } finally {
      await session.close();
    }
  }

  private async getCandidatePosts(userId: string, userProfile: UserProfile): Promise<PostDocument[]> {
    const userObjectId = new Types.ObjectId(userId);
    const viewedPostIds = Array.from(userProfile.viewedPosts).map(id => new Types.ObjectId(id));
    
    // Build more sophisticated query
    const matchConditions = [
      { archived: false },
      { userId: { $ne: userObjectId } }, // Don't recommend user's own posts
      { _id: { $nin: viewedPostIds } },
      {
        $or: [
          // Posts from followed users
          { userId: { $in: userProfile.following } },
          // Posts with user's interest tags
          { 'metadata.keywords': { $in: Array.from(userProfile.interests.keys()) } },
          // Popular recent posts
          { 
            createdAt: { $gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
            $expr: { $gte: [{ $size: { $ifNull: ['$likes', []] } }, 5] }
          }
        ]
      }
    ];

    try {
      const posts = await this.postModel
        .find({ $and: matchConditions })
        .populate('userId', 'name surname username profilePhoto')
        .populate('tribeId', 'name')
        .populate({
          path: 'comments',
          populate: { path: 'userId', select: 'name surname username profilePhoto' }
        })
        .sort({ createdAt: -1 })
        .limit(this.MAX_POSTS_TO_SCORE)
        .exec();

      return posts;
    } catch (error) {
      this.logger.error(`Error getting candidate posts for user ${userId}:`, error);
      return [];
    }
  }

  private async scorePostsAdvanced(posts: PostDocument[], userProfile: UserProfile): Promise<PostScore[]> {
    return posts.map(post => {
      let score = 0;
      const reasons: string[] = [];

      // 1. Temporal decay (newer posts preferred)
      const ageInHours = (Date.now() - post.createdAt.getTime()) / (1000 * 60 * 60);
      const timeScore = Math.max(0, Math.exp(-ageInHours / 24) * 10);
      score += timeScore;
      if (timeScore > 5) reasons.push('recent');

      // 2. Interest matching with TF-IDF-like scoring
      const postMetadata = post.metadata as PostMetadata;
      if (postMetadata?.keywords?.length) {
        const totalInterests = Array.from(userProfile.interests.values()).reduce((sum, weight) => sum + weight, 0);
        let interestScore = 0;
        
        postMetadata.keywords.forEach(tag => {
          const userInterest = userProfile.interests.get(tag) || 0;
          if (userInterest > 0) {
            // Normalize by total interests (TF-IDF style)
            const normalizedScore = (userInterest / totalInterests) * 15;
            interestScore += normalizedScore;
          }
        });
        
        score += interestScore;
        if (interestScore > 5) reasons.push('interests');
      }

      // 3. Social signals (following)
      const isFromFollowed = userProfile.following.some(id => id.equals(post.userId));
      if (isFromFollowed) {
        score += 8;
        reasons.push('following');
      }

      // 4. Engagement quality score
      const likeCount = post.likes?.length || 0;
      const commentCount = post.comments?.length || 0;
      const engagementScore = Math.log(1 + likeCount) * 2 + Math.log(1 + commentCount) * 3;
      score += engagementScore;
      if (engagementScore > 3) reasons.push('popular');

      // 5. Content quality indicators
      if (post.description && post.base64Image && post.description.length > 100) {
        score += 2; // Bonus for longer content
        reasons.push('quality');
      }

      // 6. Tribe/community relevance
      if (post.tribeId) {
        score += 1; // Active tribes
      }

      // 7. Diversity penalty for similar content
      // This would require content similarity analysis

      // 8. User behavior patterns (collaborative filtering)
      const interactionBonus = userProfile.recentInteractions.get(post._id.toString()) || 0;
      score += interactionBonus * 2;

      return { post, score, reasons };
    });
  }

  private applyDiversityFilters(scoredPosts: PostScore[], limit: number): PostScore[] {
    const sorted = scoredPosts.sort((a, b) => b.score - a.score);
    const diversified: PostScore[] = [];
    const seenAuthors = new Set<string>();
    const seenTribes = new Set<string>();
    const seenTags = new Set<string>();

    for (const scoredPost of sorted) {
      if (diversified.length >= limit) break;

      const authorId = scoredPost.post.userId._id?.toString();
      const tribeId = scoredPost.post.tribeId?._id?.toString();
      const postMetadata = scoredPost.post.metadata as PostMetadata;
      const tags = postMetadata?.keywords || [];

      // Diversity checks
      const authorOverlap = authorId && seenAuthors.has(authorId);
      const tribeOverlap = tribeId && seenTribes.has(tribeId);
      const tagOverlap = tags.some(tag => seenTags.has(tag));

      // Apply diversity penalty
      if (authorOverlap && seenAuthors.size > 2) {
        scoredPost.score *= 0.7;
      }
      if (tribeOverlap && seenTribes.size > 3) {
        scoredPost.score *= 0.8;
      }

      diversified.push(scoredPost);

      // Track diversity
      if (authorId) seenAuthors.add(authorId);
      if (tribeId) seenTribes.add(tribeId);
      tags.forEach(tag => seenTags.add(tag));
    }

    return diversified.sort((a, b) => b.score - a.score);
  }

  private async getFallbackPosts(limit: number, userId?: string): Promise<PostDocument[]> {
    const cacheKey = `fallback_posts:${limit}`;
    const cached = await this.cacheManager.get<PostDocument[]>(cacheKey);
    if (cached) return cached;

    try {
      // Multi-level fallback strategy
      let posts = await this.getFallbackLevel1(limit, userId); // Popular recent posts
      
      if (posts.length < limit) {
        this.logger.debug('Level 1 fallback insufficient, trying level 2');
        const level2Posts = await this.getFallbackLevel2(limit - posts.length, userId);
        posts = [...posts, ...level2Posts];
      }
      
      if (posts.length < limit) {
        this.logger.debug('Level 2 fallback insufficient, trying level 3');
        const level3Posts = await this.getFallbackLevel3(limit - posts.length, userId);
        posts = [...posts, ...level3Posts];
      }

      // Apply basic diversity
      const diversified = this.basicDiversityFilter(posts, limit);
      
      await this.cacheManager.set(cacheKey, diversified, this.CACHE_TTL);
      return diversified;
    } catch (error) {
      this.logger.error('Error getting fallback posts:', error);
      return [];
    }
  }

  // Level 1: Popular posts from last 7 days
  private async getFallbackLevel1(limit: number, userId?: string): Promise<PostDocument[]> {
    try {
      const excludeUser = userId ? { userId: { $ne: new Types.ObjectId(userId) } } : {};
      const posts = await this.postModel
        .find({ 
          archived: false,
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          ...excludeUser
        })
        .populate('userId', 'name surname username profilePhoto')
        .populate('tribeId', 'name')
        .populate({
          path: 'comments',
          populate: { path: 'userId', select: 'name surname username profilePhoto' }
        })
        .sort({ createdAt: -1 })
        .limit(limit * 3)
        .exec();

      // Sort by engagement score in JavaScript
      return posts
        .sort((a, b) => {
          const aEngagement = (a.likes?.length || 0) + (a.comments?.length || 0) * 2;
          const bEngagement = (b.likes?.length || 0) + (b.comments?.length || 0) * 2;
          return bEngagement - aEngagement;
        })
        .slice(0, limit * 2);
        
    } catch (error) {
      this.logger.warn('Level 1 fallback failed:', error);
      return [];
    }
  }

  // Level 2: Recent posts from last 30 days (less popular but recent)
  private async getFallbackLevel2(limit: number, userId?: string): Promise<PostDocument[]> {
    try {
      const excludeUser = userId ? { userId: { $ne: new Types.ObjectId(userId) } } : {};
      return await this.postModel
        .find({ 
          archived: false,
          createdAt: { 
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          },
          ...excludeUser
        })
        .populate('userId', 'name surname username profilePhoto')
        .populate('tribeId', 'name')
        .populate({
          path: 'comments',
          populate: { path: 'userId', select: 'name surname username profilePhoto' }
        })
        .sort({ createdAt: -1 })
        .limit(limit * 2)
        .exec();
    } catch (error) {
      this.logger.warn('Level 2 fallback failed:', error);
      return [];
    }
  }

  // Level 3: Latest posts regardless of age (absolute fallback)
  private async getFallbackLevel3(limit: number, userId?: string): Promise<PostDocument[]> {
    try {
      const excludeUser = userId ? { userId: { $ne: new Types.ObjectId(userId) } } : {};
      return await this.postModel
        .find({ 
          archived: false,
          ...excludeUser
        })
        .populate('userId', 'name surname username profilePhoto')
        .populate('tribeId', 'name')
        .populate({
          path: 'comments',
          populate: { path: 'userId', select: 'name surname username profilePhoto' }
        })
        .sort({ createdAt: -1 })
        .limit(limit)
        .exec();
    } catch (error) {
      this.logger.error('Level 3 fallback failed:', error);
      return [];
    }
  }

  private basicDiversityFilter(posts: PostDocument[], limit: number): PostDocument[] {
    const result: PostDocument[] = [];
    const seenAuthors = new Set<string>();

    for (const post of posts) {
      if (result.length >= limit) break;
      const authorId = post.userId._id?.toString();
      if (!authorId || !seenAuthors.has(authorId) || seenAuthors.size < 3) {
        result.push(post);
        if (authorId) seenAuthors.add(authorId);
      }
    }

    return result;
  }
}