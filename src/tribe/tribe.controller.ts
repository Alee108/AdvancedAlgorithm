import { Controller, Post, Body, UseGuards, UseInterceptors, UploadedFile, Req, BadRequestException, Patch, Param, Delete, Get, InternalServerErrorException, NotFoundException, ForbiddenException, Query } from '@nestjs/common';
import { TribeService } from './tribe.service';
import { CreateTribeDto } from './dto/create-tribe.dto';
import { UpdateTribeDto } from './dto/update-tribe.dto';
import { UpdateTribeVisibilityDto } from './dto/update-tribe-visibility.dto';
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

  @Get(':tribeId/posts')
  @ApiOperation({ summary: 'Get all posts in a tribe' })
  @ApiResponse({ status: 200, description: 'Returns all posts in the tribe.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden - You do not have permission to view this tribe\'s posts.' })
  @ApiResponse({ status: 404, description: 'Tribe not found.' })
  async getAllPostsByTribe(
    @Param('tribeId') tribeId: string,
    @Req() req: any
  ) {
    try {
      if (!req.user || !req.user.sub) {
        throw new BadRequestException('User not authenticated');
      }

      return this.tribeService.getAllPostsByTribe(tribeId, req.user.sub);
    } catch (error) {
      console.error('Error getting tribe posts:', error);
      throw error;
    }
  }

  @Patch(':id/close')
  @ApiOperation({ summary: 'Close a tribe' })
  @ApiResponse({ status: 200, description: 'Tribe successfully closed.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only the founder can close the tribe.' })
  @ApiResponse({ status: 404, description: 'Tribe not found.' })
  async close(
    @Param('id') id: string,
    @Req() req: any
  ): Promise<string> {
    try {
      if (!req.user || !req.user.sub) {
        throw new BadRequestException('User not authenticated');
      }

      await this.tribeService.close(id, req.user.sub);
      return 'Tribe successfully closed';
    } catch (error) {
      console.error('Error closing tribe:', error);
      throw error;
    }
  }

  @Patch(':id/join')
  @ApiOperation({ summary: 'Request to join a tribe' })
  @ApiResponse({ status: 200, description: 'Successfully requested to join the tribe.' })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid tribe ID or user already has a pending request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden - Tribe is closed.' })
  @ApiResponse({ status: 404, description: 'Tribe not found.' })
  async requestJoin(
    @Param('id') tribeId: string,
    @Req() req: any
  ): Promise<Membership> {
    try {
      if (!req.user || !req.user.sub) {
        throw new BadRequestException('User not authenticated');
      }

      console.log('Join request received:', {
        tribeId,
        userId: req.user.sub,
        userEmail: req.user.email
      });

      return this.tribeService.requestJoin(tribeId, req.user.sub);
    } catch (error) {
      console.error('Error in requestJoin controller:', {
        error: error.message,
        stack: error.stack,
        tribeId,
        userId: req.user?.sub
      });

      if (error instanceof BadRequestException ||
          error instanceof NotFoundException ||
          error instanceof ForbiddenException) {
        throw error;
      }

      throw new InternalServerErrorException({
        message: 'Error processing join request',
        details: error.message,
        tribeId
      });
    }
  }

  @Post(':id/requests/:userId/:action')
  @ApiOperation({ summary: 'Handle membership request' })
  @ApiResponse({ status: 200, description: 'Membership request handled successfully.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only founders and moderators can handle requests.' })
  @ApiResponse({ status: 404, description: 'Tribe or membership request not found.' })
  async handleMembershipRequest(
    @Param('id') tribeId: string,
    @Param('userId') userId: string,
    @Param('action') action: 'accept' | 'reject',
    @Req() req: any
  ): Promise<Membership> {
    try {
      if (!req.user || !req.user.sub) {
        throw new BadRequestException('User not authenticated');
      }

      return this.tribeService.handleMembershipRequest(tribeId, userId, action, req.user.sub);
    } catch (error) {
      console.error('Error handling membership request:', error);
      throw error;
    }
  }

  @Get(':id/requests')
  @ApiOperation({ summary: 'Get pending membership requests' })
  @ApiResponse({ status: 200, description: 'Returns list of pending membership requests.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only founders and moderators can view requests.' })
  @ApiResponse({ status: 404, description: 'Tribe not found.' })
  async getPendingRequests(
    @Param('id') tribeId: string,
    @Req() req: any
  ): Promise<Membership[]> {
    try {
      if (!req.user || !req.user.sub) {
        throw new BadRequestException('User not authenticated');
      }

      return this.tribeService.getPendingRequests(tribeId, req.user.sub);
    } catch (error) {
      console.error('Error getting pending requests:', error);
      throw error;
    }
  }

  @Post(':id/members/:userId/promote')
  @ApiOperation({ summary: 'Promote a member to moderator' })
  @ApiResponse({ status: 200, description: 'Member successfully promoted to moderator.' })
  @ApiResponse({ status: 400, description: 'Bad request - User is already a moderator.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only founders and moderators can promote members.' })
  @ApiResponse({ status: 404, description: 'Tribe or active membership not found.' })
  async promoteToModerator(
    @Param('id') tribeId: string,
    @Param('userId') userId: string,
    @Req() req: any
  ): Promise<Membership> {
    try {
      if (!req.user || !req.user.sub) {
        throw new BadRequestException('User not authenticated');
      }

      return this.tribeService.upgradeToModerator(tribeId, userId, req.user.sub);
    } catch (error) {
      console.error('Error promoting member to moderator:', error);
      throw error;
    }
  }
}
