import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, UseInterceptors, UploadedFile, UnauthorizedException, BadRequestException, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './users.dto';
import { UpdateVisibilityDto } from './dto/update-visibility.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { Public } from '../auth/decorators/public.decorators';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { UserDocument } from 'src/entities/users/users.entity';

@ApiTags('users')
@Controller('users')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'Return all users.' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get('top')
  @ApiOperation({ summary: 'Get top 50 users by followers' })
  @ApiResponse({ status: 200, description: 'Return top 50 users ordered by followers count.' })
  findTopUsers() {
    return this.usersService.findTopUsers();
  }

  @Get('search')
  @ApiOperation({ summary: 'Search users by username' })
  @ApiResponse({ status: 200, description: 'Returns matching users.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async searchUsers(
    @Query('username') query: string,
    @Req() req: any
  ) {
    try {
      if (!req.user || !req.user.sub) {
        throw new BadRequestException('User not authenticated');
      }

      return this.usersService.searchUsers(query);
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id' })
  @ApiResponse({ status: 200, description: 'Return the user.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('profilePhoto', {
      storage: diskStorage({
        destination: './uploads/profiles',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
          return callback(new Error('Only image files are allowed!'), false);
        }
        callback(null, true);
      },
    }),
  )
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() file: Express.Multer.File
  ) {
    try {
      const { profilePhoto, ...updateData } = updateUserDto;

      if (file) {
        const imageBuffer = fs.readFileSync(file.path);
        const base64ProfilePhoto = `data:${file.mimetype};base64,${imageBuffer.toString('base64')}`;
        fs.unlinkSync(file.path);
        return this.usersService.update(id, { ...updateData, profilePhoto: base64ProfilePhoto });
      }

      return this.usersService.update(id, updateData);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 200, description: 'User successfully deleted.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  remove(@Param('id') id: string) {
    return this.usersService.delete(id);
  }

  @Post(':id/follow')
  @ApiOperation({ summary: 'Follow a user' })
  @ApiResponse({ status: 200, description: 'Successfully followed user.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  followUser(@Param('id') userToFollowId: string, @Req() req: any): Promise<UserDocument> {
    return this.usersService.followUser(req.user.sub, userToFollowId);
  }

  @Post(':id/unfollow')
  @ApiOperation({ summary: 'Unfollow a user' })
  @ApiResponse({ status: 200, description: 'Successfully unfollowed user.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  unfollowUser(@Param('id') userToUnfollowId: string, @Req() req: any) {
    return this.usersService.unfollowUser(req.user.sub, userToUnfollowId);
  }

  @Get(':id/followers')
  @ApiOperation({ summary: 'Get user followers' })
  @ApiResponse({ status: 200, description: 'Return user followers.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  getFollowers(@Param('id') id: string) {
    return this.usersService.getFollowers(id);
  }

  @Get(':id/following')
  @ApiOperation({ summary: 'Get users that the user is following' })
  @ApiResponse({ status: 200, description: 'Return following users.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  getFollowing(@Param('id') id: string) {
    return this.usersService.getFollowing(id);
  }

  @Patch(':id/profile-photo')
  @ApiOperation({ summary: 'Update user profile photo' })
  @ApiResponse({ status: 200, description: 'Profile photo successfully updated.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  updateProfilePhoto(
    @Param('id') id: string,
    @Body('profilePhoto') profilePhoto: string
  ) {
    return this.usersService.updateProfilePhoto(id, profilePhoto);
  }

  @Patch('me/visibility')
  @ApiOperation({ summary: 'Update current user visibility' })
  @ApiResponse({ status: 200, description: 'Visibility updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async updateVisibility(
    @Body() updateVisibilityDto: UpdateVisibilityDto,
    @Req() req: any
  ) {
    try {
      if (!req.user || !req.user.sub) {
        throw new UnauthorizedException('User not authenticated');
      }

      console.log('Updating visibility for user:', req.user.sub);
      console.log('New visibility:', updateVisibilityDto.visibility);

      const result = await this.usersService.updateVisibility(
        req.user.sub.toString(),
        updateVisibilityDto
      );
      
      console.log('Update result:', result);
      return result;
    } catch (error) {
      console.error('Error in updateVisibility controller:', error);
      throw error;
    }
  }
}