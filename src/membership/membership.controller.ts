import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, UseInterceptors, UploadedFile, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { Public } from '../auth/decorators/public.decorators';
import { MembershipService } from './membership.service';
import { CreateMembershipDto, UpdateMembershipDto } from './DTO/membership.dto';
import { MembershipStatus } from 'src/entities/membership/membership.entity';

@ApiTags('membership')
@Controller('membership')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  @Get()
  @ApiOperation({ summary: 'Get all memberships' })
  @ApiResponse({ status: 200, description: 'Return all memberships.' })
  findAll() {
    return this.membershipService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a membership by id' })
  @ApiResponse({ status: 200, description: 'Return the membership.' })
  @ApiResponse({ status: 404, description: 'Membership not found.' })
  findOne(@Param('id') id: string) {
    return this.membershipService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a membership' })
  @ApiResponse({ status: 200, description: 'Membership updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(
    @Param('id') id: string,
    @Body() updateMembership: UpdateMembershipDto,
  ) {
    try {
      if (!id) {
        throw new UnauthorizedException('Membership ID is required');
      }
      console.log('Updating membership with ID:', id);
      const updateData = {
        ...updateMembership,
        updatedAt: new Date(),
      };
      
      return this.membershipService.update(id, updateData);
    } catch (error) {
      console.error('Error updating membership:', error);
      throw error;
    }
  }

  @Get('tribe/:tribeId')
  @ApiOperation({ summary: 'Get all memberships by tribe' })
  @ApiResponse({ status: 200, description: 'Return all memberships by tribe' })
  getAllMembershipsByTribe(@Param('tribeId') tribeId: string) {
    return this.membershipService.getAllMembershipsByTribe(tribeId);
  }

  @Get('tribe/:tribeId/status/:status')
  @ApiOperation({ summary: 'Get all memberships by tribe and status' })
  @ApiResponse({ status: 200, description: 'Return memberships by tribe and status.' })
  getAllMembershipsByTribeAndStatus(
    @Param('tribeId') tribeId: string,
    @Param('status') status: MembershipStatus
  ) {
    return this.membershipService.getAllMembershipsByTribeAndStatus(tribeId, status);
  }

  @Get('user/:userId/requests')
  @ApiOperation({ summary: 'Get all membership requests by user' })
  @ApiResponse({ status: 200, description: 'Return all membership requests by user.' })
  getAllMembershipRequestsByUserId(@Param('userId') userId: string) {
    return this.membershipService.getAllMembershipRequestsByUserId(userId);
  }

  @Patch('exit/:userId/:tribeId')
  @ApiOperation({ summary: 'Exit from tribe' })
  @ApiResponse({ status: 200, description: 'User exited from tribe.' })
  exitFromTribe(
    @Param('userId') userId: string,
    @Param('tribeId') tribeId: string
  ) {
    return this.membershipService.exitFromTribe(userId, tribeId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a pending membership' })
  @ApiResponse({ status: 200, description: 'Membership deleted successfully' })
  @ApiResponse({ status: 404, description: 'Membership not found' })
  remove(@Param('id') id: string) {
    return this.membershipService.deleteMembership(id);
  }

  @Get('user/:userId')
  @ApiOperation({ 
    summary: 'Get all tribes where a user is a member or founder',
    description: 'Retrieves all tribes where the user is an active member. Includes complete tribe information, founder details, and user role.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns list of tribes with complete information',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          _id: { type: 'string', description: 'Tribe ID' },
          name: { type: 'string', description: 'Tribe name' },
          description: { type: 'string', description: 'Tribe description' },
          visibility: { type: 'string', enum: ['PUBLIC', 'PRIVATE', 'CLOSED'], description: 'Tribe visibility' },
          profilePhoto: { type: 'string', description: 'URL to tribe profile photo' },
          founder: {
            type: 'object',
            properties: {
              _id: { type: 'string', description: 'Founder ID' },
              username: { type: 'string', description: 'Founder username' },
              name: { type: 'string', description: 'Founder name' },
              surname: { type: 'string', description: 'Founder surname' },
              profilePhoto: { type: 'string', description: 'URL to founder profile photo' }
            }
          },
          userRole: { type: 'string', enum: ['FOUNDER', 'MODERATOR', 'MEMBER'], description: 'User role in tribe' },
          joinedAt: { type: 'string', format: 'date-time', description: 'When user joined the tribe' },
          createdAt: { type: 'string', format: 'date-time', description: 'When tribe was created' },
          updatedAt: { type: 'string', format: 'date-time', description: 'When tribe was last updated' }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getUserTribes(
    @Param('userId') userId: string,
    @Req() req: any
  ) {
    try {
      // Verify that the requesting user is either the target user or has admin rights
      if (req.user.sub !== userId) {
        throw new UnauthorizedException('You can only view your own tribes');
      }

      return this.membershipService.getUserTribes(userId);
    } catch (error) {
      console.error('Error in getUserTribes controller:', error);
      throw error;
    }
  }

  @Get('tribe/:tribeId/count')
  @ApiOperation({ summary: 'Get active members count for a tribe' })
  @ApiResponse({ status: 200, description: 'Returns the count of active members.' })
  async getActiveMembersCount(@Param('tribeId') tribeId: string): Promise<{ count: number }> {
    const count = await this.membershipService.getActiveMembersCount(tribeId);
    return { count };
  }
}