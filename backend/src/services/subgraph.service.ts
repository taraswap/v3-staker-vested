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

} 