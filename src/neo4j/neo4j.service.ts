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

  getSession(): Session {
    return this.driver.session();
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

  async createOrUpdateUserInterest(userId: string, tag: string, weight: number = 1): Promise<void> {
    const session: Session = this.driver.session();
    try {
      await session.run(
        `
        MERGE (u:User {id: $userId})
        MERGE (t:Tag {name: $tag})
        MERGE (u)-[r:INTERESTED_IN]->(t)
        ON CREATE SET r.weight = $weight
        ON MATCH SET r.weight = r.weight + $weight
        `,
        { userId, tag, weight },
      );
    } finally {
      await session.close();
    }
  }

  async removeUserInterest(userId: string, tag: string): Promise<void> {
    const session: Session = this.driver.session();
    try {
      await session.run(
        `
        MATCH (u:User {id: $userId})-[r:INTERESTED_IN]->(t:Tag {name: $tag})
        DELETE r
        `,
        { userId, tag },
      );
    } finally {
      await session.close();
    }
  }

  async getRelatedTags(tag: string, limit: number = 5): Promise<string[]> {
    const session: Session = this.driver.session();
    try {
      const result = await session.run(
        `
        MATCH (t1:Tag {name: $tag})<-[:INTERESTED_IN]-(u:User)-[:INTERESTED_IN]->(t2:Tag)
        WHERE t1 <> t2
        WITH t2, count(*) as cooccurrence
        RETURN t2.name as tag
        ORDER BY cooccurrence DESC
        LIMIT $limit
        `,
        { tag, limit },
      );

      return result.records.map(record => record.get('tag'));
    } finally {
      await session.close();
    }
  }

  async getSimilarUsers(userId: string, limit: number = 5): Promise<string[]> {
    const session: Session = this.driver.session();
    try {
      const result = await session.run(
        `
        MATCH (u1:User {id: $userId})-[:INTERESTED_IN]->(t:Tag)<-[:INTERESTED_IN]-(u2:User)
        WHERE u1 <> u2
        WITH u2, count(*) as commonInterests
        RETURN u2.id as userId
        ORDER BY commonInterests DESC
        LIMIT $limit
        `,
        { userId, limit },
      );

      return result.records.map(record => record.get('userId'));
    } finally {
      await session.close();
    }
  }

  async onModuleDestroy() {
    await this.driver.close();
  }
} 