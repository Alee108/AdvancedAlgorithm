import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, UseInterceptors, UploadedFile, UnauthorizedException, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { Public } from '../auth/decorators/public.decorators';
import { MembershipService } from './membership.service';
import { CreateMembershipDto, UpdateMembershipDto } from './DTO/membership.dto';
import { MembershipStatus } from 'src/entities/membership/membership.entity';
import { TribeVisibility } from 'src/entities/tribe/tribe.entity';

@ApiTags('membership')
@Controller('membership')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  @Get()
  @ApiOperation({ summary: 'Get all memberships' })
  @ApiResponse({ status: 200, description: 'Return all memberships.' })
  async findAll() {
    try {
      return await this.membershipService.findAll();
    } catch (error) {
      console.error('Error in findAll memberships:', error);
      throw error;
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a membership by id' })
  @ApiResponse({ status: 200, description: 'Return the membership.' })
  @ApiResponse({ status: 404, description: 'Membership not found.' })
  async findOne(@Param('id') id: string) {
    try {
      return await this.membershipService.findById(id);
    } catch (error) {
      console.error('Error in findOne membership:', error);
      throw error;
    }
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a membership' })
  @ApiResponse({ status: 200, description: 'Membership updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(
    @Param('id') id: string,
    @Body() updateMembership: UpdateMembershipDto,
    @Req() req: any
  ) {
    try {
      if (!id) {
        throw new BadRequestException('Membership ID is required');
      }

      // Verify user has permission to update this membership
      const membership = await this.membershipService.findById(id);
      if (!membership) {
        throw new NotFoundException(`Membership with ID ${id} not found`);
      }

      // Only tribe founder or the user themselves can update the membership
      const tribe = await this.membershipService.getTribeForMembership(id);
      if (tribe.founder.toString() !== req.user.sub && membership.user.toString() !== req.user.sub) {
        throw new ForbiddenException('You do not have permission to update this membership');
      }

      const updateData = {
        ...updateMembership,
        updatedAt: new Date(),
      };
      
      return await this.membershipService.update(id, updateData);
    } catch (error) {
      console.error('Error updating membership:', error);
      throw error;
    }
  }

  @Get('tribe/:tribeId')
  @ApiOperation({ summary: 'Get all memberships by tribe' })
  @ApiResponse({ status: 200, description: 'Return all memberships by tribe' })
  async getAllMembershipsByTribe(
    @Param('tribeId') tribeId: string,
    @Req() req: any
  ) {
    try {
      // Verify user has permission to view tribe memberships
      const hasAccess = await this.membershipService.canUserAccessTribe(tribeId, req.user.sub);
      if (!hasAccess) {
        throw new ForbiddenException('You do not have permission to view this tribe\'s memberships');
      }

      return await this.membershipService.getAllMembershipsByTribe(tribeId);
    } catch (error) {
      console.error('Error getting tribe memberships:', error);
      throw error;
    }
  }

  @Get('tribe/:tribeId/status/:status')
  @ApiOperation({ summary: 'Get all memberships by tribe and status' })
  @ApiResponse({ status: 200, description: 'Return memberships by tribe and status.' })
  async getAllMembershipsByTribeAndStatus(
    @Param('tribeId') tribeId: string,
    @Param('status') status: MembershipStatus,
    @Req() req: any
  ) {
    try {
      // Verify user has permission to view tribe memberships
      const hasAccess = await this.membershipService.canUserAccessTribe(tribeId, req.user.sub);
      if (!hasAccess) {
        throw new ForbiddenException('You do not have permission to view this tribe\'s memberships');
      }

      return await this.membershipService.getAllMembershipsByTribeAndStatus(tribeId, status);
    } catch (error) {
      console.error('Error getting tribe memberships by status:', error);
      throw error;
    }
  }

  @Get('user/:userId/requests')
  @ApiOperation({ summary: 'Get all membership requests by user' })
  @ApiResponse({ status: 200, description: 'Return all membership requests by user.' })
  async getAllMembershipRequestsByUserId(
    @Param('userId') userId: string,
    @Req() req: any
  ) {
    try {
      // Verify user is requesting their own data
      if (req.user.sub !== userId) {
        throw new ForbiddenException('You can only view your own membership requests');
      }
      
      return await this.membershipService.getAllMembershipRequestsByUserId(userId);
    } catch (error) {
      console.error('Error getting user membership requests:', error);
      throw error;
    }
  }

  @Patch('exit/:userId/:tribeId')
  @ApiOperation({ summary: 'Exit from tribe' })
  @ApiResponse({ status: 200, description: 'User exited from tribe.' })
  async exitFromTribe(
    @Param('userId') userId: string,
    @Param('tribeId') tribeId: string,
    @Req() req: any
  ) {
    try {
      // Verify user is exiting their own membership
      if (req.user.sub !== userId) {
        throw new ForbiddenException('You can only exit from your own memberships');
      }

      return await this.membershipService.exitFromTribe(userId, tribeId);
    } catch (error) {
      console.error('Error exiting from tribe:', error);
      throw error;
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a pending membership' })
  @ApiResponse({ status: 200, description: 'Membership deleted successfully' })
  @ApiResponse({ status: 404, description: 'Membership not found' })
  async remove(
    @Param('id') id: string,
    @Req() req: any
  ) {
    try {
      const membership = await this.membershipService.findById(id);
      if (!membership) {
        throw new NotFoundException(`Membership with ID ${id} not found`);
      }

      // Verify user has permission to delete this membership
      const tribe = await this.membershipService.getTribeForMembership(id);
      if (tribe.founder.toString() !== req.user.sub && membership.user.toString() !== req.user.sub) {
        throw new ForbiddenException('You do not have permission to delete this membership');
      }

      return await this.membershipService.deleteMembership(id);
    } catch (error) {
      console.error('Error deleting membership:', error);
      throw error;
    }
  }

  @Get('user/:userId')
  @ApiOperation({ 
    summary: 'Get all tribes where a user is a member or founder',
    description: 'Retrieves all tribes where the user is either a founder or an active member.'
  })
  @ApiResponse({ status: 200, description: 'Returns list of tribes with complete information' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserTribes(
    @Param('userId') userId: string,
    @Req() req: any
  ) {
    try {
      // Verify that the requesting user is either the target user or has admin rights
      if (req.user.sub !== userId) {
        throw new ForbiddenException('You can only view your own tribes');
      }

      return await this.membershipService.getUserTribes(userId);
    } catch (error) {
      console.error('Error in getUserTribes:', error);
      throw error;
    }
  }
}