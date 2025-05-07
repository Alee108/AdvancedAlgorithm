import { Test, TestingModule } from '@nestjs/testing';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { Post } from 'src/entities/post/post.entity';
import { Types } from 'mongoose';

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
    findByTags: jest.fn(),
    findByUser: jest.fn(),
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
    }).compile();

    controller = module.get<PostController>(PostController);
    service = module.get<PostService>(PostService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a post', async () => {
      const userId = new Types.ObjectId().toString();
      const postDto = {
        description: 'Test post',
        location: 'Test location',
        content: 'Test content',
        tags: ['test'],
      };
      const req = {
        user: {
          sub: userId
        }
      };
      const expectedResult = { ...postDto, userId, _id: new Types.ObjectId() };

      mockPostService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(postDto, req);
      expect(result).toEqual(expectedResult);
      expect(mockPostService.create).toHaveBeenCalledWith({
        ...postDto,
        userId
      });
    });
  });

  describe('findAll', () => {
    it('should return an array of posts', async () => {
      const userId = new Types.ObjectId().toString();
      const expectedResult = [
        {
          _id: new Types.ObjectId(),
          description: 'Test post',
          location: 'Test location',
          content: 'Test content',
          userId,
          tags: ['test'],
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
      const userId = new Types.ObjectId().toString();
      const expectedResult = {
        _id: new Types.ObjectId(),
        description: 'Test post',
        location: 'Test location',
        content: 'Test content',
        userId,
        tags: ['test'],
      };

      mockPostService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.findOne(expectedResult._id.toString());
      expect(result).toEqual(expectedResult);
      expect(mockPostService.findOne).toHaveBeenCalledWith(expectedResult._id.toString());
    });
  });

  describe('update', () => {
    it('should update a post', async () => {
      const postId = new Types.ObjectId().toString();
      const updateDto = {
        description: 'Updated post',
        location: 'Updated location',
      };
      const expectedResult = {
        _id: postId,
        ...updateDto,
        content: 'Test content',
        userId: new Types.ObjectId().toString(),
        tags: ['test'],
      };

      mockPostService.update.mockResolvedValue(expectedResult);

      const result = await controller.update(postId, updateDto);
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
        userId: new Types.ObjectId().toString(),
        tags: ['test'],
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
      const userId = new Types.ObjectId().toString();
      const commentData = {
        text: 'Test comment',
      };
      const req = {
        user: {
          sub: userId
        }
      };
      const expectedResult = {
        _id: postId,
        comments: [{
          text: commentData.text,
          user: userId,
          createdAt: expect.any(Date)
        }],
      };

      mockPostService.addComment.mockResolvedValue(expectedResult);

      const result = await controller.addComment(postId.toString(), commentData, req);
      expect(result).toEqual(expectedResult);
      expect(mockPostService.addComment).toHaveBeenCalledWith(
        postId.toString(),
        userId,
        commentData.text,
      );
    });
  });

  describe('findByTags', () => {
    it('should return posts by tags', async () => {
      const tags = 'test,photo';
      const expectedResult = [
        {
          _id: new Types.ObjectId(),
          description: 'Test post',
          location: 'Test location',
          content: 'Test content',
          userId: new Types.ObjectId().toString(),
          tags: ['test', 'photo'],
        },
      ];

      mockPostService.findByTags.mockResolvedValue(expectedResult);

      const result = await controller.findByTags(tags);
      expect(result).toEqual(expectedResult);
      expect(mockPostService.findByTags).toHaveBeenCalledWith(['test', 'photo']);
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
          tags: ['test'],
        },
      ];

      mockPostService.findByUser.mockResolvedValue(expectedResult);

      const result = await controller.findByUser(userId);
      expect(result).toEqual(expectedResult);
      expect(mockPostService.findByUser).toHaveBeenCalledWith(userId);
    });
  });
}); 