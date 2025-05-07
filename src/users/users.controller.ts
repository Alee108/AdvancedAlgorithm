import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { User } from '../entities/users/users.entity';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User successfully created.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 409, description: 'Email or username already exists.' })
  create(@Body() createUserDto: Partial<User>) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'Return all users.' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a user by id' })
  @ApiResponse({ status: 200, description: 'Return the user.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a user' })
  @ApiResponse({ status: 200, description: 'User successfully updated.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  update(@Param('id') id: string, @Body() updateUserDto: Partial<User>) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 200, description: 'User successfully deleted.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  remove(@Param('id') id: string) {
    return this.usersService.delete(id);
  }

  @Post(':id/follow')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Follow a user' })
  @ApiResponse({ status: 200, description: 'Successfully followed user.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  followUser(@Param('id') userToFollowId: string, @Req() req: any) {
    return this.usersService.followUser(req.user.sub, userToFollowId);
  }

  @Post(':id/unfollow')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unfollow a user' })
  @ApiResponse({ status: 200, description: 'Successfully unfollowed user.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  unfollowUser(@Param('id') userToUnfollowId: string, @Req() req: any) {
    return this.usersService.unfollowUser(req.user.sub, userToUnfollowId);
  }

  @Get(':id/followers')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user followers' })
  @ApiResponse({ status: 200, description: 'Return user followers.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  getFollowers(@Param('id') id: string) {
    return this.usersService.getFollowers(id);
  }

  @Get(':id/following')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get users that the user is following' })
  @ApiResponse({ status: 200, description: 'Return following users.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  getFollowing(@Param('id') id: string) {
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
  ) {
    return this.usersService.updateProfilePhoto(id, profilePhoto);
  }
}