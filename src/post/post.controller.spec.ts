import { Test, TestingModule } from '@nestjs/testing';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { Post } from 'src/entities/post/post.entity';
import { Types } from 'mongoose';
import { AuthGuard } from '../auth/auth.guard';
import { ExecutionContext } from '@nestjs/common';
import { Readable } from 'stream';

describe('PostController', () => {
  let controller: PostController;
  let service: PostService;

  const mockPostService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    addLike: jest.fn(),
    addComment: jest.fn(),
    findByUser: jest.fn(),
  };

  const mockUser = {
    sub: new Types.ObjectId().toString(),
    email: 'test@example.com',
    role: 'user'
  };

  const mockRequest = {
    user: mockUser,
    headers: {
      authorization: 'Bearer mock-jwt-token'
    }
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostController],
      providers: [
        {
          provide: PostService,
          useValue: mockPostService,
        },
      ],
    })
    .overrideGuard(AuthGuard)
    .useValue({
      canActivate: (context: ExecutionContext) => {
        const request = context.switchToHttp().getRequest();
        return request.headers.authorization?.startsWith('Bearer ');
      }
    })
    .compile();

    controller = module.get<PostController>(PostController);
    service = module.get<PostService>(PostService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    const mockFile = {
      fieldname: 'image',
      originalname: 'test.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      destination: './uploads/posts',
      filename: 'test.jpg',
      path: 'uploads/posts/test.jpg',
      size: 1234,
      stream: new Readable(),
      buffer: Buffer.from('test')
    };

    it('should create a post when user is authenticated', async () => {
      const postDto = {
        description: 'Test post',
        location: 'Test location',
        image: mockFile
      };
      const expectedResult = { 
        ...postDto, 
        userId: mockUser.sub, 
        _id: new Types.ObjectId(),
        metadata: {
          sentiment: 'neutral',
          keywords: [],
          language: 'en',
          category: 'general',
          createdAt: expect.any(Date)
        }
      };

      mockPostService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(postDto, mockFile, mockRequest);
      expect(result).toEqual(expectedResult);
      expect(mockPostService.create).toHaveBeenCalledWith({
        ...postDto,
        userId: new Types.ObjectId(mockUser.sub)
      });
    });

    it('should throw UnauthorizedException when no token is provided', async () => {
      const postDto = {
        description: 'Test post',
        location: 'Test location',
        image: mockFile
      };
      const requestWithoutToken = {
        user: mockUser,
        headers: {}
      };

      await expect(controller.create(postDto, mockFile, requestWithoutToken))
        .rejects
        .toThrow('Unauthorized');
    });
  });

  describe('findAll', () => {
    it('should return an array of posts', async () => {
      const expectedResult = [
        {
          _id: new Types.ObjectId(),
          description: 'Test post',
          location: 'Test location',
          content: 'Test content',
          userId: mockRequest.user.sub,
          metadata: {
            sentiment: 'neutral',
            keywords: [],
            language: 'en',
            category: 'general',
            createdAt: expect.any(Date)
          }
        },
      ];

      mockPostService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll();
      expect(result).toEqual(expectedResult);
      expect(mockPostService.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single post', async () => {
      const expectedResult = {
        _id: new Types.ObjectId(),
        description: 'Test post',
        location: 'Test location',
        content: 'Test content',
        userId: mockRequest.user.sub,
        metadata: {
          sentiment: 'neutral',
          keywords: [],
          language: 'en',
          category: 'general',
          createdAt: expect.any(Date)
        }
      };

      mockPostService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.findOne(expectedResult._id.toString());
      expect(result).toEqual(expectedResult);
      expect(mockPostService.findOne).toHaveBeenCalledWith(expectedResult._id.toString());
    });
  });

  describe('update', () => {
    const mockFile = {
      fieldname: 'image',
      originalname: 'test.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      destination: './uploads/posts',
      filename: 'test.jpg',
      path: 'uploads/posts/test.jpg',
      size: 1234,
      stream: new Readable(),
      buffer: Buffer.from('test')
    };

    it('should update a post', async () => {
      const postId = new Types.ObjectId().toString();
      const updateDto = {
        description: 'Updated post',
        location: 'Updated location',
        image: mockFile
      };
      const expectedResult = {
        _id: postId,
        ...updateDto,
        content: 'Test content',
        userId: mockRequest.user.sub,
        metadata: {
          sentiment: 'neutral',
          keywords: [],
          language: 'en',
          category: 'general',
          createdAt: expect.any(Date)
        }
      };

      mockPostService.update.mockResolvedValue(expectedResult);

      const result = await controller.update(postId, updateDto, mockFile);
      expect(result).toEqual(expectedResult);
      expect(mockPostService.update).toHaveBeenCalledWith(postId, updateDto);
    });
  });

  describe('remove', () => {
    it('should delete a post', async () => {
      const postId = new Types.ObjectId().toString();
      const expectedResult = {
        _id: postId,
        description: 'Test post',
        location: 'Test location',
        content: 'Test content',
        userId: mockRequest.user.sub,
        metadata: {
          sentiment: 'neutral',
          keywords: [],
          language: 'en',
          category: 'general',
          createdAt: expect.any(Date)
        }
      };

      mockPostService.delete.mockResolvedValue(expectedResult);

      const result = await controller.remove(postId);
      expect(result).toEqual(expectedResult);
      expect(mockPostService.delete).toHaveBeenCalledWith(postId);
    });
  });

  describe('addLike', () => {
    it('should add a like to a post', async () => {
      const postId = new Types.ObjectId();
      const expectedResult = {
        _id: postId,
        likes: 1,
      };

      mockPostService.addLike.mockResolvedValue(expectedResult);

      const result = await controller.addLike(postId.toString());
      expect(result).toEqual(expectedResult);
      expect(mockPostService.addLike).toHaveBeenCalledWith(postId.toString());
    });
  });

  describe('addComment', () => {
    it('should add a comment to a post', async () => {
      const postId = new Types.ObjectId();
      const commentData = {
        text: 'Test comment',
      };
      const expectedResult = {
        _id: postId,
        comments: [{
          text: commentData.text,
          user: mockRequest.user.sub,
          createdAt: expect.any(Date)
        }],
      };

      mockPostService.addComment.mockResolvedValue(expectedResult);

      const result = await controller.addComment(postId.toString(), commentData, mockRequest);
      expect(result).toEqual(expectedResult);
      expect(mockPostService.addComment).toHaveBeenCalledWith(
        postId.toString(),
        mockRequest.user.sub,
        commentData.text,
      );
    });
  });

  describe('findByUser', () => {
    it('should return posts by user', async () => {
      const userId = new Types.ObjectId().toString();
      const expectedResult = [
        {
          _id: new Types.ObjectId(),
          description: 'Test post',
          location: 'Test location',
          content: 'Test content',
          userId,
          metadata: {
            sentiment: 'neutral',
            keywords: [],
            language: 'en',
            category: 'general',
            createdAt: expect.any(Date)
          }
        },
      ];

      mockPostService.findByUser.mockResolvedValue(expectedResult);

      const result = await controller.findByUser(userId);
      expect(result).toEqual(expectedResult);
      expect(mockPostService.findByUser).toHaveBeenCalledWith(userId);
    });
  });
}); 