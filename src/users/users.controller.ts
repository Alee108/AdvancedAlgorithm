import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto, UpdateUserData } from './users.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { User, UserDocument } from '../entities/users/users.entity';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'Return all users.' })
  findAll(): Promise<UserDocument[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a user by id' })
  @ApiResponse({ status: 200, description: 'Return the user.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  findOne(@Param('id') id: string): Promise<UserDocument> {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
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
  ): Promise<UserDocument> {
    try {
      const { profilePhoto, ...updateData } = updateUserDto;

      if (file) {
        // Read the file and convert to base64
        const imageBuffer = fs.readFileSync(file.path);
        const base64ProfilePhoto = `data:${file.mimetype};base64,${imageBuffer.toString('base64')}`;

        // Delete the temporary file
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
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 200, description: 'User successfully deleted.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  remove(@Param('id') id: string): Promise<void> {
    return this.usersService.delete(id);
  }

  @Post(':id/follow')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Follow a user' })
  @ApiResponse({ status: 200, description: 'Successfully followed user.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  followUser(@Param('id') userToFollowId: string, @Req() req: any): Promise<UserDocument> {
    return this.usersService.followUser(req.user.sub, userToFollowId);
  }

  @Post(':id/unfollow')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unfollow a user' })
  @ApiResponse({ status: 200, description: 'Successfully unfollowed user.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  unfollowUser(@Param('id') userToUnfollowId: string, @Req() req: any): Promise<UserDocument> {
    return this.usersService.unfollowUser(req.user.sub, userToUnfollowId);
  }

  @Get(':id/followers')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user followers' })
  @ApiResponse({ status: 200, description: 'Return user followers.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  getFollowers(@Param('id') id: string): Promise<UserDocument[]> {
    return this.usersService.getFollowers(id);
  }

  @Get(':id/following')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get users that the user is following' })
  @ApiResponse({ status: 200, description: 'Return following users.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  getFollowing(@Param('id') id: string): Promise<UserDocument[]> {
    return this.usersService.getFollowing(id);
  }

  @Patch(':id/profile-photo')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user profile photo' })
  @ApiResponse({ status: 200, description: 'Profile photo successfully updated.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  updateProfilePhoto(
    @Param('id') id: string,
    @Body('profilePhoto') profilePhoto: string
  ): Promise<UserDocument> {
    return this.usersService.updateProfilePhoto(id, profilePhoto);
  }
}