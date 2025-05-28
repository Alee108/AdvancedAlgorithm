import { Controller, Post, Body, UseGuards, UseInterceptors, UploadedFile, Req, BadRequestException, Patch, Param, Delete, Get, InternalServerErrorException, NotFoundException, ForbiddenException, Query } from '@nestjs/common';
import { TribeService } from './tribe.service';
import { CreateTribeDto } from './dto/create-tribe.dto';
import { UpdateTribeDto } from './dto/update-tribe.dto';
import { UpdateTribeVisibilityDto } from './dto/update-tribe-visibility.dto';
import { HandleMembershipRequestDto } from './dto/handle-membership-request.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { Tribe } from '../entities/tribe/tribe.entity';
import { Membership } from '../entities/membership/membership.entity';

@ApiTags('tribes')
@Controller('tribes')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class TribeController {
  constructor(private readonly tribeService: TribeService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new tribe' })
  @ApiResponse({ status: 201, description: 'Tribe successfully created.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('profilePhoto', {
      storage: diskStorage({
        destination: './uploads/tribes',
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
  async create(
    @Body() createTribeDto: CreateTribeDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any
  ): Promise<Tribe> {
    try {
      if (!req.user || !req.user.sub) {
        throw new BadRequestException('User not authenticated');
      }

      if (file) {
        const imageBuffer = fs.readFileSync(file.path);
        createTribeDto.profilePhoto = `data:${file.mimetype};base64,${imageBuffer.toString('base64')}`;
        fs.unlinkSync(file.path);
      }

      return this.tribeService.create(createTribeDto, req.user.sub);
    } catch (error) {
      console.error('Error creating tribe:', error);
      throw error;
    }
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a tribe' })
  @ApiResponse({ status: 200, description: 'Tribe successfully updated.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only the founder can update the tribe.' })
  @ApiResponse({ status: 404, description: 'Tribe not found.' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('profilePhoto', {
      storage: diskStorage({
        destination: './uploads/tribes',
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
    @Body() updateTribeDto: UpdateTribeDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any
  ): Promise<Tribe> {
    try {
      if (!req.user || !req.user.sub) {
        throw new BadRequestException('User not authenticated');
      }

      if (file) {
        const imageBuffer = fs.readFileSync(file.path);
        updateTribeDto.profilePhoto = `data:${file.mimetype};base64,${imageBuffer.toString('base64')}`;
        fs.unlinkSync(file.path);
      }

      return this.tribeService.update(id, updateTribeDto, req.user.sub);
    } catch (error) {
      console.error('Error updating tribe:', error);
      throw error;
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a tribe' })
  @ApiResponse({ status: 200, description: 'Tribe successfully deleted.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only the founder can delete the tribe.' })
  @ApiResponse({ status: 404, description: 'Tribe not found.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async delete(
    @Param('id') id: string,
    @Req() req: any
  ): Promise<void> {
    try {
      if (!req.user || !req.user.sub) {
        throw new BadRequestException('User not authenticated');
      }

      console.log('Delete request received:', {
        tribeId: id,
        userId: req.user.sub,
        userEmail: req.user.email
      });

      await this.tribeService.delete(id, req.user.sub);
    } catch (error) {
      console.error('Error in delete tribe controller:', {
        error: error.message,
        stack: error.stack,
        tribeId: id,
        userId: req.user?.sub
      });

      if (error instanceof BadRequestException ||
          error instanceof NotFoundException ||
          error instanceof ForbiddenException) {
        throw error;
      }

      throw new InternalServerErrorException({
        message: 'Error deleting tribe',
        details: error.message,
        tribeId: id
      });
    }
  }

  @Patch(':id/visibility')
  @ApiOperation({ summary: 'Update tribe visibility' })
  @ApiResponse({ status: 200, description: 'Tribe visibility successfully updated.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only the founder can update the tribe visibility.' })
  @ApiResponse({ status: 404, description: 'Tribe not found.' })
  async updateVisibility(
    @Param('id') id: string,
    @Body() updateVisibilityDto: UpdateTribeVisibilityDto,
    @Req() req: any
  ): Promise<Tribe> {
    try {
      if (!req.user || !req.user.sub) {
        throw new BadRequestException('User not authenticated');
      }

      return this.tribeService.updateVisibility(id, updateVisibilityDto, req.user.sub);
    } catch (error) {
      console.error('Error updating tribe visibility:', error);
      throw error;
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all tribes' })
  @ApiResponse({ status: 200, description: 'Returns list of all tribes.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findAll(): Promise<Tribe[]> {
    try {
      return this.tribeService.findAll();
    } catch (error) {
      console.error('Error in find all tribes controller:', error);
      throw error;
    }
  }

  @Get('search')
  @ApiOperation({ summary: 'Search tribes by name' })
  @ApiResponse({ status: 200, description: 'Returns matching tribes.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async searchTribes(
    @Query('name') query: string,
    @Req() req: any
  ): Promise<Tribe[]> {
    try {
      if (!req.user || !req.user.sub) {
        throw new BadRequestException('User not authenticated');
      }

      return this.tribeService.searchTribes(query);
    } catch (error) {
      console.error('Error searching tribes:', error);
      throw error;
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a tribe by ID' })
  @ApiResponse({ status: 200, description: 'Tribe found successfully.' })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid tribe ID.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden - You do not have permission to view this tribe.' })
  @ApiResponse({ status: 404, description: 'Tribe not found.' })
  async findById(
    @Param('id') id: string,
    @Req() req: any
  ): Promise<Tribe> {
    try {
      if (!req.user || !req.user.sub) {
        throw new BadRequestException('User not authenticated');
      }

      return this.tribeService.findById(id, req.user.sub);
    } catch (error) {
      console.error('Error finding tribe:', error);
      throw error;
    }
  }

  @Patch(':tribeId/membership/:userId')
  @ApiOperation({ summary: 'Handle a membership request' })
  @ApiResponse({ status: 200, description: 'Membership request handled successfully.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Tribe or membership request not found.' })
  async handleMembershipRequest(
    @Param('tribeId') tribeId: string,
    @Param('userId') userId: string,
    @Body() handleMembershipRequestDto: HandleMembershipRequestDto,
    @Req() req: any
  ): Promise<Membership> {
    if (!req.user || !req.user.sub) {
      throw new BadRequestException('User not authenticated');
    }
    return this.tribeService.handleMembershipRequest(
      tribeId,
      userId,
      handleMembershipRequestDto.action,
      req.user.sub
    );
  }

  @Patch(':tribeId/members/:userId/promote')
  @ApiOperation({ summary: 'Promote a member to moderator' })
  @ApiResponse({ status: 200, description: 'Member promoted successfully.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Tribe or member not found.' })
  async promoteToModerator(
    @Param('tribeId') tribeId: string,
    @Param('userId') userId: string,
    @Req() req: any
  ): Promise<Membership> {
    if (!req.user || !req.user.sub) {
      throw new BadRequestException('User not authenticated');
    }
    return this.tribeService.upgradeToModerator(tribeId, userId, req.user.sub);
  }

  @Get(':tribeId/members')
  @ApiOperation({ summary: 'Get all tribe members' })
  @ApiResponse({ status: 200, description: 'Returns list of tribe members.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Tribe not found.' })
  async getTribeMembers(
    @Param('tribeId') tribeId: string,
    @Req() req: any
  ): Promise<Membership[]> {
    if (!req.user || !req.user.sub) {
      throw new BadRequestException('User not authenticated');
    }
    return this.tribeService.getTribeMembers(tribeId, req.user.sub);
  }

  @Get(':tribeId/pending-requests')
  @ApiOperation({ summary: 'Get pending membership requests' })
  @ApiResponse({ status: 200, description: 'Returns list of pending membership requests.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Tribe not found.' })
  async getPendingRequests(
    @Param('tribeId') tribeId: string,
    @Req() req: any
  ): Promise<Membership[]> {
    if (!req.user || !req.user.sub) {
      throw new BadRequestException('User not authenticated');
    }
    return this.tribeService.getPendingRequests(tribeId, req.user.sub);
  }

  @Post(':tribeId/join')
  @ApiOperation({ summary: 'Request to join a tribe' })
  @ApiResponse({ status: 201, description: 'Join request created successfully.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Tribe not found.' })
  async requestJoin(
    @Param('tribeId') tribeId: string,
    @Req() req: any
  ): Promise<Membership> {
    if (!req.user || !req.user.sub) {
      throw new BadRequestException('User not authenticated');
    }
    return this.tribeService.requestJoin(tribeId, req.user.sub);
  }

  @Get(':tribeId/posts')
  @ApiOperation({ summary: 'Get all posts from a tribe' })
  @ApiResponse({ status: 200, description: 'Returns list of posts from the tribe.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden - You do not have permission to view posts in this tribe.' })
  @ApiResponse({ status: 404, description: 'Tribe not found.' })
  async getAllPostsByTribe(
    @Param('tribeId') tribeId: string,
    @Req() req: any
  ) {
    if (!req.user || !req.user.sub) {
      throw new BadRequestException('User not authenticated');
    }
    return this.tribeService.getAllPostsByTribe(tribeId, req.user.sub);
  }

  @Post(':id/close')
  @ApiOperation({ summary: 'Close a tribe' })
  @ApiResponse({ status: 200, description: 'Tribe successfully closed.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only the founder can close the tribe.' })
  @ApiResponse({ status: 404, description: 'Tribe not found.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async close(
    @Param('id') id: string,
    @Req() req: any
  ): Promise<string> {
    try {
      if (!req.user || !req.user.sub) {
        throw new BadRequestException('User not authenticated');
      }

      console.log('Close tribe request received:', {
        tribeId: id,
        userId: req.user.sub,
        userEmail: req.user.email
      });

      return await this.tribeService.closeTribe(id, req.user.sub);
    } catch (error) {
      console.error('Error in close tribe controller:', {
        error: error.message,
        stack: error.stack,
        tribeId: id,
        userId: req.user?.sub
      });

      if (error instanceof BadRequestException ||
          error instanceof NotFoundException ||
          error instanceof ForbiddenException) {
        throw error;
      }

      throw new InternalServerErrorException({
        message: 'Error closing tribe',
        details: error.message,
        tribeId: id
      });
    }
  }
}
