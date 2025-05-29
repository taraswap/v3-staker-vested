import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PositionData {
  id: string;
  owner: string;
  pool: {
    id: string;
    liquidity: string;
    token0: {
      id: string;
      symbol: string;
    };
    token1: {
      id: string;
      symbol: string;
    };
  };
  token0: {
    id: string;
    symbol: string;
  };
  token1: {
    id: string;
    symbol: string;
  };
  liquidity: string;
  transaction: {
    timestamp: string;
  };
}

export interface PositionSnapshot {
  id: string;
  pool: {
    id: string;
  };
  collectedFeesToken0: string;
  collectedFeesToken1: string;
}

@Injectable()
export class SubgraphService {
  private readonly SUBGRAPH_URL = 'https://indexer.lswap.app/subgraphs/name/taraxa/uniswap-v3';

  constructor(private configService: ConfigService) { }

  async getPositionData(tokenId: string): Promise<PositionData | null> {
    const query = `
      query GetPosition($tokenId: String!) {
        position(id: $tokenId) {
          id
          owner
          pool {
            id
            liquidity
            token0 {
              id
              symbol
            }
            token1 {
              id
              symbol
            }
          }
          token0 {
            id
            symbol
          }
          token1 {
            id
            symbol
          }
          liquidity
          transaction {
            timestamp
          }
        }
      }
    `;

    try {
      const response = await fetch(this.SUBGRAPH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { tokenId },
        }),
      });

      const data = await response.json();

      if (data.errors) {
        console.error('Subgraph query error:', data.errors);
        return null;
      }

      return data.data?.position || null;
    } catch (error) {
      console.error('Failed to query subgraph:', error);
      return null;
    }
  }

  async checkPositionInRangeDuringPeriod(
    tokenId: string,
    poolAddress: string,
    startTimestamp: number,
    endTimestamp: number
  ): Promise<boolean> {
    const positionQuery = `
      query CheckPosition($tokenId: String!) {
        position(id: $tokenId) {
          id
          pool {
            id
          }
          liquidity
          tickLower {
            tickIdx
          }
          tickUpper {
            tickIdx
          }
        }
      }
    `;

    try {
      const positionResponse = await fetch(this.SUBGRAPH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: positionQuery,
          variables: { tokenId },
        }),
      });

      const positionData = await positionResponse.json();

      if (positionData.errors) {
        console.error('Position query error:', positionData.errors);
        return false;
      }

      const position = positionData.data?.position;
      if (!position) {
        return false;
      }

      if (position.pool.id.toLowerCase() !== poolAddress.toLowerCase()) {
        return false;
      }

      const liquidity = BigInt(position.liquidity || '0');
      if (liquidity === BigInt(0)) {
        return false;
      }

      const tickLower = parseInt(position.tickLower?.tickIdx || '0');
      const tickUpper = parseInt(position.tickUpper?.tickIdx || '0');

      return await this.checkPositionInRangeDuringSwaps(
        poolAddress,
        tickLower,
        tickUpper,
        startTimestamp,
        endTimestamp
      );

    } catch (error) {
      console.error('Failed to check position:', error);
      return false;
    }
  }

  async checkPositionInRangeDuringSwaps(
    poolAddress: string,
    tickLower: number,
    tickUpper: number,
    startTimestamp: number,
    endTimestamp: number
  ): Promise<boolean> {
    const query = `
      query CheckSwapsInRange($poolAddress: String!, $startTimestamp: BigInt!, $endTimestamp: BigInt!, $tickLower: BigInt!, $tickUpper: BigInt!) {
        swaps(
          first: 100,
          where: {
            pool: $poolAddress,
            timestamp_gte: $startTimestamp,
            timestamp_lte: $endTimestamp,
            tick_gte: $tickLower,
            tick_lte: $tickUpper
          }
          orderBy: timestamp
          orderDirection: desc
        ) {
          id
          timestamp
          tick
        }
      }
    `;

    try {
      const response = await fetch(this.SUBGRAPH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: {
            poolAddress,
            startTimestamp: startTimestamp.toString(),
            endTimestamp: endTimestamp.toString(),
            tickLower: tickLower.toString(),
            tickUpper: tickUpper.toString()
          },
        }),
      });

      const data = await response.json();

      if (data.errors) {
        console.error('Swaps query error:', data.errors);
      }

      const swaps = data.data?.swaps || [];

      if (swaps.length === 0) {
        return false;
      }

      return true;

    } catch (error) {
      console.error('Failed to check swaps:', error);
    }
  }
} 