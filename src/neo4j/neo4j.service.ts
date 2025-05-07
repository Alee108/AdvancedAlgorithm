import { Injectable, OnModuleDestroy } from '@nestjs/common';
import neo4j, { Driver, Session } from 'neo4j-driver';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class Neo4jService implements OnModuleDestroy {
  private driver: Driver;

  constructor(private configService: ConfigService) {
    const uri = this.configService.get<string>('NEO4J_URI');
    const username = this.configService.get<string>('NEO4J_USERNAME');
    const password = this.configService.get<string>('NEO4J_PASSWORD');

    if (!uri || !username || !password) {
      throw new Error('Missing Neo4j configuration');
    }

    this.driver = neo4j.driver(
      uri,
      neo4j.auth.basic(username, password),
    );
  }

  async createUser(userId: string, username: string, name: string, surname: string): Promise<void> {
    const session: Session = this.driver.session();
    try {
      await session.run(
        `
        CREATE (u:User {
          id: $userId,
          username: $username,
          name: $name,
          surname: $surname
        })
        `,
        { userId, username, name, surname },
      );
    } finally {
      await session.close();
    }
  }

  async createFollowRelationship(followerId: string, followingId: string): Promise<void> {
    const session: Session = this.driver.session();
    try {
      await session.run(
        `
        MATCH (follower:User {id: $followerId})
        MATCH (following:User {id: $followingId})
        MERGE (follower)-[r:FOLLOWS]->(following)
        `,
        { followerId, followingId },
      );
    } finally {
      await session.close();
    }
  }

  async removeFollowRelationship(followerId: string, followingId: string): Promise<void> {
    const session: Session = this.driver.session();
    try {
      await session.run(
        `
        MATCH (follower:User {id: $followerId})-[r:FOLLOWS]->(following:User {id: $followingId})
        DELETE r
        `,
        { followerId, followingId },
      );
    } finally {
      await session.close();
    }
  }

  async onModuleDestroy() {
    await this.driver.close();
  }
} 