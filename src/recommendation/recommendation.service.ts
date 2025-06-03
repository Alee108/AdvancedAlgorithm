import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cache } from 'cache-manager';
import { int } from 'neo4j-driver';

// Entities
import { Post, PostDocument } from '../entities/post/post.entity';
import { User, UserDocument } from '../entities/users/users.entity';
import {
  PostView,
  PostViewDocument,
} from '../entities/post-view/post-view.entity';

// Services
import { Neo4jService } from '../neo4j/neo4j.service';

// Interfaces
interface PostScore {
  post: PostDocument;
  score: number;
  reasons: string[]; // Per debug/descrizione del punteggio
}

interface PostMetadata {
  keywords?: string[];
  readingTime?: number;
  category?: string;
}

interface UserProfile {
  interests: Map<string, number>; // tag -> peso
  following: Types.ObjectId[]; // utenti seguiti
  viewedPosts: Set<string>; // postId -> già visto
  recentInteractions: Map<string, number>; // postId -> interazioni recenti
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
  private readonly CACHE_TTL = 300; // 5 minuti
  private readonly MAX_POSTS_TO_SCORE = 200;
  private readonly DIVERSITY_THRESHOLD = 0.3;

  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(PostView.name) private postViewModel: Model<PostViewDocument>,
    private neo4jService: Neo4jService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Genera i post raccomandati per un utente.
   */
  async getRecommendedPosts(
    userId: string,
    limit: number = 20,
  ): Promise<PostDocument[]> {
    const startTime = Date.now();
    const cacheKey = `recommendations:${userId}:${limit}`;

    try {
      // Verifica se esiste una cache
      const cached = await this.cacheManager.get<PostDocument[]>(cacheKey);
      if (cached) {
        this.logger.debug(
          `Returning cached recommendations for user ${userId}`,
        );
        return cached;
      }

      // Costruisce il profilo dell'utente
      const userProfile = await this.buildUserProfile(userId);

      // Recupera i candidati
      const candidatePosts = await this.getCandidatePosts(userId, userProfile);

      let recommendations: PostDocument[] = [];

      if (candidatePosts.length === 0) {
        this.logger.warn(
          `No candidate posts found for user ${userId}. Using fallback.`,
        );
        recommendations = await this.getFallbackPosts(limit, userId);
      } else {
        const scoredPosts = await this.scorePostsAdvanced(
          candidatePosts,
          userProfile,
        );
        const diversifiedPosts = this.applyDiversityFilters(scoredPosts, limit);
        recommendations = diversifiedPosts
          .slice(0, limit)
          .map((item) => item.post);
      }

      // Memorizza in cache
      await this.cacheManager.set(cacheKey, recommendations, this.CACHE_TTL);

      // Logga le metriche
      const metrics: RecommendationMetrics = {
        totalPosts: candidatePosts.length,
        scoredPosts: candidatePosts.length,
        fallbackUsed: candidatePosts.length === 0,
        processingTime: Date.now() - startTime,
      };

      this.logger.debug(
        `Recommendations generated for user ${userId}:`,
        metrics,
      );

      // Segna i post come visti
      const recommendedPostIds = recommendations.map((post) =>
        post._id.toString(),
      );
      await this.markPostsAsViewed(userId, recommendedPostIds);

      return recommendations;
    } catch (error) {
      this.logger.error(
        `Error generating recommendations for user ${userId}:`,
        error,
      );
      const fallbackPosts = await this.getFallbackPosts(limit, userId);
      await this.cacheManager.set(cacheKey, fallbackPosts, this.CACHE_TTL / 2);
      return fallbackPosts;
    }
  }

  /**
   * Costruisce il profilo dell'utente per le raccomandazioni.
   */
  private async buildUserProfile(userId: string): Promise<UserProfile> {
    const [interests, following, viewedPosts, interactions] = await Promise.all(
      [
        this.getUserInterests(userId),
        this.getFollowingUsers(userId),
        this.getUserViewedPosts(userId),
        this.getRecentInteractions(userId),
      ],
    );

    return {
      interests,
      following,
      viewedPosts,
      recentInteractions: interactions,
    };
  }

  /**
   * Recupera gli interessi dell'utente da Neo4j.
   */
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
        { userId },
      );

      const interests = new Map<string, number>();
      const decayFactor = 0.95;
      const currentTime = Date.now();

      result.records.forEach((record) => {
        const tag = record.get('tag');
        const weight = record.get('weight') || 1;
        const lastUpdated = record.get('lastUpdated') || currentTime;
        const daysSinceUpdate =
          (currentTime - lastUpdated) / (1000 * 60 * 60 * 24);
        const decayedWeight = weight * Math.pow(decayFactor, daysSinceUpdate);
        interests.set(tag, decayedWeight);
      });

      await this.cacheManager.set(cacheKey, interests, this.CACHE_TTL * 2);
      return interests;
    } catch (error) {
      this.logger.warn(`Failed to fetch user interests for ${userId}:`, error);
      return new Map();
    } finally {
      await session.close();
    }
  }

  /**
   * Recupera la lista degli utenti che l'utente segue.
   */
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
      this.logger.warn(`Failed to fetch following list for ${userId}:`, error);
      return [];
    }
  }

  /**
   * Recupera i post che l'utente ha già visualizzato negli ultimi 7 giorni.
   */
  private async getUserViewedPosts(userId: string): Promise<Set<string>> {
    try {
      const userObjectId = new Types.ObjectId(userId);
      const recentViews = await this.postViewModel
        .find({
          userId: userObjectId,
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Ultimi 7 giorni
        })
        .select('postId')
        .lean()
        .exec();

      return new Set(recentViews.map((view) => view.postId.toString()));
    } catch (error) {
      this.logger.warn(`Failed to fetch viewed posts for ${userId}:`, error);
      return new Set();
    }
  }

  /**
   * Recupera le interazioni recenti dell'utente (like, commenti, ecc.).
   */
  private async getRecentInteractions(
    userId: string,
  ): Promise<Map<string, number>> {
    const session = this.neo4jService.getSession();
    try {
      const result = await session.run(
        `
        MATCH (u:User {id: $userId})-[r:INTERACTED_WITH]->(p:Post)
        WHERE r.timestamp > datetime() - duration('P7D')
        RETURN p.id as postId, r.type as interactionType, r.weight as weight
        `,
        { userId },
      );

      const interactions = new Map<string, number>();
      result.records.forEach((record) => {
        const postId = record.get('postId');
        const weight = record.get('weight') || 1;
        interactions.set(postId, (interactions.get(postId) || 0) + weight);
      });

      return interactions;
    } catch (error) {
      this.logger.warn(
        `Failed to fetch recent interactions for ${userId}:`,
        error,
      );
      return new Map();
    } finally {
      await session.close();
    }
  }

  /**
   * Recupera i post candidati per le raccomandazioni.
   */
  private async getCandidatePosts(
    userId: string,
    userProfile: UserProfile,
  ): Promise<PostDocument[]> {
    const userObjectId = new Types.ObjectId(userId);
    const viewedPostIds = Array.from(userProfile.viewedPosts).map(
      (id) => new Types.ObjectId(id),
    );

    const matchConditions = [
      { archived: false },
      { userId: { $ne: userObjectId } },
      { _id: { $nin: viewedPostIds } },
      { userId: { $nin: userProfile.following } },
      {
        $or: [
          {
            'metadata.keywords': {
              $in: Array.from(userProfile.interests.keys()),
            },
          },
          {
            createdAt: { $gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
            $expr: { $gte: [{ $size: { $ifNull: ['$likes', []] } }, 5] },
          },
        ],
      },
    ];

    try {
      return await this.postModel
        .find({ $and: matchConditions })
        .populate('userId', 'name surname username profilePhoto')
        .populate('tribeId', 'name')
        .populate({
          path: 'comments',
          populate: {
            path: 'userId',
            select: 'name surname username profilePhoto',
          },
        })
        .sort({ createdAt: -1 })
        .limit(this.MAX_POSTS_TO_SCORE)
        .exec();
    } catch (error) {
      this.logger.error(
        `Failed to fetch candidate posts for user ${userId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Calcola il punteggio per ogni post basandosi su diversi criteri.
   */
  private async scorePostsAdvanced(
    posts: PostDocument[],
    userProfile: UserProfile,
  ): Promise<PostScore[]> {
    return posts.map((post) => {
      let score = 0;
      const reasons: string[] = [];

      // Tempo decrescente
      const ageInHours =
        (Date.now() - post.createdAt.getTime()) / (1000 * 60 * 60);
      const timeScore = Math.max(0, Math.exp(-ageInHours / 24) * 10);
      score += timeScore;
      if (timeScore > 5) reasons.push('recent');

      // Interessi dell'utente
      const postMetadata = post.metadata as Record<string, any>;
      if (postMetadata?.keywords?.length) {
        const totalInterestWeights = Array.from(
          userProfile.interests.values(),
        ).reduce((sum, w) => sum + w, 0);
        let interestScore = 0;

        postMetadata.keywords.forEach((tag: string) => {
          const interestWeight = userProfile.interests.get(tag) || 0;
          if (interestWeight > 0) {
            interestScore += (interestWeight / totalInterestWeights) * 15;
          }
        });

        score += interestScore;
        if (interestScore > 5) reasons.push('interests');
      }

      // Da utenti seguiti
      if (userProfile.following.some((id) => id.equals(post.userId))) {
        score += 8;
        reasons.push('following');
      }

      // Engagement
      const likes = post.likes?.length || 0;
      const comments = post.comments?.length || 0;
      const engagementScore =
        Math.log(1 + likes) * 2 + Math.log(1 + comments) * 3;
      score += engagementScore;
      if (engagementScore > 3) reasons.push('popular');

      // Qualità del contenuto
      if (
        post.description &&
        post.base64Image &&
        post.description.length > 100
      ) {
        score += 2;
        reasons.push('quality');
      }

      // Tribù
      if (post.tribeId) {
        score += 1;
      }

      // Bonus interazioni recenti
      const interactionBonus =
        userProfile.recentInteractions.get(post._id.toString()) || 0;
      score += interactionBonus * 2;

      return { post, score, reasons };
    });
  }

  /**
   * Applica filtri di diversità ai post selezionati.
   */
  private applyDiversityFilters(
    scoredPosts: PostScore[],
    limit: number,
  ): PostScore[] {
    const sorted = scoredPosts.sort((a, b) => b.score - a.score);
    const diversified: PostScore[] = [];
    const seenAuthors = new Set<string>();
    const seenTribes = new Set<string>();
    const seenTags = new Set<string>();

    for (const scoredPost of sorted) {
      if (diversified.length >= limit) break;

      const authorId = scoredPost.post.userId._id?.toString();
      const tribeId = scoredPost.post.tribeId?._id?.toString();
      const tags = (scoredPost.post.metadata as any)?.keywords || [];

      if (authorId && seenAuthors.has(authorId)) {
        scoredPost.score *= 0.7;
      }

      if (tribeId && seenTribes.has(tribeId)) {
        scoredPost.score *= 0.8;
      }

      diversified.push(scoredPost);

      if (authorId) seenAuthors.add(authorId);
      if (tribeId) seenTribes.add(tribeId);
      tags.forEach((tag) => seenTags.add(tag));
    }

    return diversified.sort((a, b) => b.score - a.score);
  }

  /**
   * Strategia di fallback per quando non ci sono abbastanza post candidati.
   */
  private async getFallbackPosts(
    limit: number,
    userId?: string,
  ): Promise<PostDocument[]> {
    const cacheKey = `fallback_posts:${limit}`;
    const cached = await this.cacheManager.get<PostDocument[]>(cacheKey);
    if (cached) return cached;

    try {
      // Ottieni i post visti dell'utente
      const userProfile = await this.buildUserProfile(userId || '');
      const viewedPostIds = Array.from(userProfile.viewedPosts).map(
        (id) => new Types.ObjectId(id),
      );

      this.logger.debug(
        `Excluding ${viewedPostIds.length} viewed posts in fallback for user ${userId}`,
      );

      // Usa i fallback con esclusione dei post visti
      let posts = await this.getFallbackLevel1(limit, userId, viewedPostIds);
      if (posts.length < limit) {
        posts = [
          ...posts,
          ...(await this.getFallbackLevel2(
            limit - posts.length,
            userId,
            viewedPostIds,
          )),
        ];
      }
      if (posts.length < limit) {
        posts = [
          ...posts,
          ...(await this.getFallbackLevel3(
            limit - posts.length,
            userId,
            viewedPostIds,
          )),
        ];
      }

      const diversified = this.basicDiversityFilter(posts, limit);
      await this.cacheManager.set(cacheKey, diversified, this.CACHE_TTL);
      return diversified;
    } catch (error) {
      this.logger.error('Error getting fallback posts:', error);
      return [];
    }
  }

  private async getFallbackLevel1(
    limit: number,
    userId?: string,
    excludedPostIds: Types.ObjectId[] = [],
  ): Promise<PostDocument[]> {
    try {
      const excludeUser = userId
        ? { userId: { $ne: new Types.ObjectId(userId) } }
        : {};
      const excludePosts =
        excludedPostIds.length > 0 ? { _id: { $nin: excludedPostIds } } : {};

      const posts = await this.postModel
        .find({
          archived: false,
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          ...excludeUser,
          ...excludePosts,
        })
        .populate('userId', 'name surname username profilePhoto')
        .populate('tribeId', 'name')
        .populate({
          path: 'comments',
          populate: {
            path: 'userId',
            select: 'name surname username profilePhoto',
          },
        })
        .sort({ createdAt: -1 })
        .limit(limit * 3)
        .exec();

      return posts
        .sort((a, b) => {
          const aEngagement =
            (a.likes?.length || 0) + (a.comments?.length || 0) * 2;
          const bEngagement =
            (b.likes?.length || 0) + (b.comments?.length || 0) * 2;
          return bEngagement - aEngagement;
        })
        .slice(0, limit * 2);
    } catch (error) {
      this.logger.warn('Level 1 fallback failed:', error);
      return [];
    }
  }

  private async getFallbackLevel2(
    limit: number,
    userId?: string,
    excludedPostIds: Types.ObjectId[] = [],
  ): Promise<PostDocument[]> {
    try {
      const excludeUser = userId
        ? { userId: { $ne: new Types.ObjectId(userId) } }
        : {};
      const excludePosts =
        excludedPostIds.length > 0 ? { _id: { $nin: excludedPostIds } } : {};

      return await this.postModel
        .find({
          archived: false,
          createdAt: {
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
          ...excludeUser,
          ...excludePosts,
        })
        .populate('userId', 'name surname username profilePhoto')
        .populate('tribeId', 'name')
        .populate({
          path: 'comments',
          populate: {
            path: 'userId',
            select: 'name surname username profilePhoto',
          },
        })
        .sort({ createdAt: -1 })
        .limit(limit * 2)
        .exec();
    } catch (error) {
      this.logger.warn('Level 2 fallback failed:', error);
      return [];
    }
  }

  private async getFallbackLevel3(
    limit: number,
    userId?: string,
    excludedPostIds: Types.ObjectId[] = [],
  ): Promise<PostDocument[]> {
    try {
      const excludeUser = userId
        ? { userId: { $ne: new Types.ObjectId(userId) } }
        : {};
      const excludePosts =
        excludedPostIds.length > 0 ? { _id: { $nin: excludedPostIds } } : {};

      return await this.postModel
        .find({
          archived: false,
          ...excludeUser,
          ...excludePosts,
        })
        .populate('userId', 'name surname username profilePhoto')
        .populate('tribeId', 'name')
        .populate({
          path: 'comments',
          populate: {
            path: 'userId',
            select: 'name surname username profilePhoto',
          },
        })
        .sort({ createdAt: -1 })
        .limit(limit)
        .exec();
    } catch (error) {
      this.logger.error('Level 3 fallback failed:', error);
      return [];
    }
  }

  private basicDiversityFilter(
    posts: PostDocument[],
    limit: number,
  ): PostDocument[] {
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

  /**
   * Segna i post come visti nel database.
   */
  private async markPostsAsViewed(
    userId: string,
    postIds: string[],
  ): Promise<void> {
    this.logger.log(`Marking posts as viewed for user ${userId}:`, postIds);
    const userObjectId = new Types.ObjectId(userId);
    const operations = postIds.map((postId) => ({
      updateOne: {
        filter: { userId: userObjectId, postId: new Types.ObjectId(postId) },
        update: {
          $setOnInsert: {
            userId: userObjectId,
            postId: new Types.ObjectId(postId),
          },
        },
        upsert: true,
      },
    }));

    if (operations.length > 0) {
      await this.postViewModel.bulkWrite(operations);
    }
  }

  /**
   * Gets recommended users based on followers and their followers
   * @param userId The ID of the user to get recommendations for
   * @param limit Maximum number of recommendations to return
   * @returns Array of recommended users
   */
  async getRecommendedUsers(
    userId: string,
    limit: number = 20,
  ): Promise<(UserDocument & { commonFollowers: number; commonFollowersList: { _id: string; name: string; surname: string; username: string; profilePhoto?: string }[] })[]> {
    const cacheKey = `user_recommendations:${userId}:${limit}`;

    try {
      // Check cache first
      const cached = await this.cacheManager.get<(UserDocument & { commonFollowers: number; commonFollowersList: any[] })[]>(cacheKey);
      if (cached) {
        this.logger.debug(`Returning cached user recommendations for user ${userId}`);
        return cached;
      }

      const session = this.neo4jService.getSession();
      try {
        const neo4jLimit = int(Math.floor(limit * 1.5)); // Request more to account for potential filtering

        // First try: Get users with followers that the current user follows
        const result = await session.run(
          `MATCH (me:User {id: $userId})
           WITH me
           MATCH (rec:User)<-[:FOLLOWS]-(follower:User)
           WHERE rec.id <> $userId 
           AND NOT EXISTS((me)-[:FOLLOWS]->(rec))
           AND EXISTS((me)-[:FOLLOWS]->(follower))
           WITH rec, follower
           WITH rec, COLLECT(DISTINCT follower) AS commonFollowers
           WITH rec, commonFollowers, SIZE(commonFollowers) AS followerCount
           ORDER BY followerCount DESC
           LIMIT $neo4jLimit
           RETURN rec.id AS userId, 
                  followerCount AS commonFollowersCount,
                  [f IN commonFollowers | {
                    id: f.id,
                    name: f.name,
                    surname: f.surname,
                    username: f.username,
                    profilePhoto: f.profilePhoto
                  }] AS commonFollowersList`,
          { userId, neo4jLimit },
        );

        this.logger.debug(`Neo4j returned ${result.records.length} records for user ${userId}`);

        let recommendedUserIds = result.records.map((record) => record.get('userId'));
        const commonFollowersMap = new Map(
          result.records.map((record) => [
            record.get('userId'),
            record.get('commonFollowersCount').toNumber(),
          ]),
        );
        const commonFollowersListMap = new Map(
          result.records.map((record) => [
            record.get('userId'),
            record.get('commonFollowersList'),
          ]),
        );

        // If we don't have enough recommendations, get more users
        if (recommendedUserIds.length < limit) {
          // Second try: Get users who are followed by users with similar interests
          const additionalResult = await session.run(
            `MATCH (me:User {id: $userId})
             WITH me
             MATCH (me)-[:INTERESTED_IN]->(t:Tag)<-[:INTERESTED_IN]-(similar:User)-[:FOLLOWS]->(rec:User)
             WHERE rec.id <> $userId 
             AND NOT EXISTS((me)-[:FOLLOWS]->(rec))
             AND NOT rec.id IN $existingIds
             WITH rec, similar
             WITH rec, COLLECT(DISTINCT similar) AS similarUsers
             WITH rec, similarUsers, SIZE(similarUsers) AS similarityScore
             ORDER BY similarityScore DESC
             LIMIT $additionalLimit
             RETURN rec.id AS userId, 
                    similarityScore AS commonFollowersCount,
                    [s IN similarUsers | {
                      id: s.id,
                      name: s.name,
                      surname: s.surname,
                      username: s.username,
                      profilePhoto: s.profilePhoto
                    }] AS commonFollowersList`,
            { 
              userId, 
              existingIds: recommendedUserIds,
              additionalLimit: int(limit - recommendedUserIds.length)
            },
          );

          const additionalIds = additionalResult.records.map((record) => record.get('userId'));
          recommendedUserIds = [...recommendedUserIds, ...additionalIds];
          
          additionalResult.records.forEach((record) => {
            commonFollowersMap.set(
              record.get('userId'),
              record.get('commonFollowersCount').toNumber(),
            );
            commonFollowersListMap.set(
              record.get('userId'),
              record.get('commonFollowersList'),
            );
          });
        }

        // If we still don't have enough recommendations, get random users
        if (recommendedUserIds.length < limit) {
          // Get users that the current user follows
          const followingResult = await session.run(
            `MATCH (me:User {id: $userId})-[:FOLLOWS]->(f:User)
             RETURN COLLECT(f.id) AS followingIds`,
            { userId }
          );
          const followingIds = followingResult.records[0]?.get('followingIds') || [];

          const randomUsers = await this.userModel
            .find({ 
              _id: { 
                $ne: new Types.ObjectId(userId),
                $nin: [...recommendedUserIds.map(id => new Types.ObjectId(id)), ...followingIds.map(id => new Types.ObjectId(id))]
              }
            })
            .limit(limit - recommendedUserIds.length)
            .lean()
            .exec();

          const randomUserIds = randomUsers.map(user => user._id.toString());
          recommendedUserIds = [...recommendedUserIds, ...randomUserIds];
          
          randomUsers.forEach(user => {
            commonFollowersMap.set(user._id.toString(), 0);
            commonFollowersListMap.set(user._id.toString(), []);
          });
        }

        // Ensure ObjectId conversion for MongoDB query
        const objectIds = recommendedUserIds.map((id) => new Types.ObjectId(id));

        const recommendedUsers = await this.userModel
          .find({ _id: { $in: objectIds } })
          .lean()
          .exec();

        const usersWithFollowers = recommendedUsers.map((user) => {
          const idStr = user._id.toString();
          return {
            ...user,
            commonFollowers: commonFollowersMap.get(idStr) || 0,
            commonFollowersList: commonFollowersListMap.get(idStr) || [],
          };
        }) as unknown as (UserDocument & { 
          commonFollowers: number; 
          commonFollowersList: { 
            _id: string; 
            name: string; 
            surname: string; 
            username: string; 
            profilePhoto?: string 
          }[] 
        })[];

        // Sort by commonFollowers to maintain the original ranking
        usersWithFollowers.sort((a, b) => b.commonFollowers - a.commonFollowers);

        // Shuffle the results while maintaining some relevance
        const shuffledUsers = this.shuffleWithRelevance(usersWithFollowers);

        await this.cacheManager.set(cacheKey, shuffledUsers, this.CACHE_TTL);
        return shuffledUsers;
      } finally {
        await session.close();
      }
    } catch (error) {
      this.logger.error(`Error getting recommended users for ${userId}:`, error);

      // Fallback to random users
      const fallbackUsers = await this.userModel
        .find({ _id: { $ne: new Types.ObjectId(userId) } })
        .limit(limit)
        .lean()
        .exec();

      const usersWithFollowers = fallbackUsers.map((user) => ({
        ...user,
        commonFollowers: 0,
        commonFollowersList: [],
      })) as unknown as (UserDocument & { 
        commonFollowers: number; 
        commonFollowersList: { 
          _id: string; 
          name: string; 
          surname: string; 
          username: string; 
          profilePhoto?: string 
        }[] 
      })[];

      // Shuffle fallback users
      const shuffledFallbackUsers = this.shuffleWithRelevance(usersWithFollowers);
      return shuffledFallbackUsers;
    }
  }

private shuffleWithRelevance<T extends { commonFollowers: number }>(users: T[]): T[] {
  // Bias con probabilità proporzionale a (commonFollowers + 1)
  const weighted = users.map(user => ({
    user,
    weight: user.commonFollowers + 1,
  }));

  const result: T[] = [];
  while (weighted.length > 0) {
    const totalWeight = weighted.reduce((sum, u) => sum + u.weight, 0);
    let rand = Math.random() * totalWeight;
    const index = weighted.findIndex(({ weight }) => {
      rand -= weight;
      return rand <= 0;
    });
    result.push(weighted[index].user);
    weighted.splice(index, 1);
  }

  return result;
}

}
