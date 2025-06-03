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

export interface FeeCollectionData {
  totalCollectedFeesToken0: string;
  totalCollectedFeesToken1: string;
  totalAccruedFeesToken0: string;
  totalAccruedFeesToken1: string;
  collectionEvents: Array<{
    timestamp: string;
    amountToken0: string;
    amountToken1: string;
  }>;
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

  // async checkPositionInRangeDuringPeriod(
  //   tokenId: string,
  //   poolAddress: string,
  //   startTimestamp: number,
  //   endTimestamp: number
  // ): Promise<boolean> {
  //   const positionQuery = `
  //     query CheckPosition($tokenId: String!) {
  //       position(id: $tokenId) {
  //         id
  //         pool {
  //           id
  //         }
  //         liquidity
  //         tickLower {
  //           tickIdx
  //         }
  //         tickUpper {
  //           tickIdx
  //         }
  //       }
  //     }
  //   `;

  //   try {
  //     const positionResponse = await fetch(this.SUBGRAPH_URL, {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({
  //         query: positionQuery,
  //         variables: { tokenId },
  //       }),
  //     });

  //     const positionData = await positionResponse.json();

  //     if (positionData.errors) {
  //       console.error('Position query error:', positionData.errors);
  //       return false;
  //     }

  //     const position = positionData.data?.position;
  //     if (!position) {
  //       return false;
  //     }

  //     if (position.pool.id.toLowerCase() !== poolAddress.toLowerCase()) {
  //       return false;
  //     }

  //     const liquidity = BigInt(position.liquidity || '0');
  //     if (liquidity === BigInt(0)) {
  //       return false;
  //     }

  //     const tickLower = parseInt(position.tickLower?.tickIdx || '0');
  //     const tickUpper = parseInt(position.tickUpper?.tickIdx || '0');

  //     return await this.checkPositionInRangeDuringSwaps(
  //       poolAddress,
  //       tickLower,
  //       tickUpper,
  //       startTimestamp,
  //       endTimestamp
  //     );

  //   } catch (error) {
  //     console.error('Failed to check position:', error);
  //     return false;
  //   }
  // }

  // async checkPositionInRangeDuringSwaps(
  //   poolAddress: string,
  //   tickLower: number,
  //   tickUpper: number,
  //   startTimestamp: number,
  //   endTimestamp: number
  // ): Promise<boolean> {
  //   const query = `
  //     query CheckSwapsInRange($poolAddress: String!, $startTimestamp: BigInt!, $endTimestamp: BigInt!, $tickLower: BigInt!, $tickUpper: BigInt!) {
  //       swaps(
  //         first: 100,
  //         where: {
  //           pool: $poolAddress,
  //           timestamp_gte: $startTimestamp,
  //           timestamp_lte: $endTimestamp,
  //           tick_gte: $tickLower,
  //           tick_lte: $tickUpper
  //         }
  //         orderBy: timestamp
  //         orderDirection: desc
  //       ) {
  //         id
  //         timestamp
  //         tick
  //       }
  //     }
  //   `;

  //   try {
  //     const response = await fetch(this.SUBGRAPH_URL, {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({
  //         query,
  //         variables: {
  //           poolAddress,
  //           startTimestamp: startTimestamp.toString(),
  //           endTimestamp: endTimestamp.toString(),
  //           tickLower: tickLower.toString(),
  //           tickUpper: tickUpper.toString()
  //         },
  //       }),
  //     });

  //     const data = await response.json();

  //     if (data.errors) {
  //       console.error('Swaps query error:', data.errors);
  //     }

  //     const swaps = data.data?.swaps || [];

  //     if (swaps.length === 0) {
  //       return false;
  //     }

  //     return true;

  //   } catch (error) {
  //     console.error('Failed to check swaps:', error);
  //   }
  // }

  async getPositionFeeCollectionData(
    tokenId: string,
    startTimestamp: number,
    endTimestamp: number
  ): Promise<FeeCollectionData> {
    // Get position data to access current accrued fees
    // Note: Some subgraphs may not have tokensOwed fields directly on position
    const positionQuery = `
      query GetPositionFees($tokenId: String!) {
        position(id: $tokenId) {
          id
          collectedFeesToken0
          collectedFeesToken1
          feeGrowthInside0LastX128
          feeGrowthInside1LastX128
          liquidity
          pool {
            id
            feeGrowthGlobal0X128
            feeGrowthGlobal1X128
          }
          tickLower {
            feeGrowthOutside0X128
            feeGrowthOutside1X128
          }
          tickUpper {
            feeGrowthOutside0X128
            feeGrowthOutside1X128
          }
        }
      }
    `;

    // Get position snapshots during the period to calculate fee growth
    const snapshotQuery = `
      query GetPositionSnapshots($tokenId: String!, $startTimestamp: BigInt!, $endTimestamp: BigInt!) {
        positionSnapshots(
          where: {
            position: $tokenId,
            timestamp_gte: $startTimestamp,
            timestamp_lte: $endTimestamp
          }
          orderBy: timestamp
          orderDirection: asc
        ) {
          id
          timestamp
          collectedFeesToken0
          collectedFeesToken1
          feeGrowthInside0LastX128
          feeGrowthInside1LastX128
        }
      }
    `;

    try {
      const [positionResponse, snapshotResponse] = await Promise.all([
        fetch(this.SUBGRAPH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: positionQuery,
            variables: { tokenId },
          }),
        }),
        fetch(this.SUBGRAPH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: snapshotQuery,
            variables: {
              tokenId,
              startTimestamp: startTimestamp.toString(),
              endTimestamp: endTimestamp.toString(),
            },
          }),
        }),
      ]);

      const [positionData, snapshotData] = await Promise.all([
        positionResponse.json(),
        snapshotResponse.json(),
      ]);

      if (positionData.errors) {
        console.error('Position query error:', positionData.errors);
      }

      if (snapshotData.errors) {
        console.error('Snapshot query error:', snapshotData.errors);
      }

      const position = positionData.data?.position;
      console.log('position', position)
      const snapshots = snapshotData.data?.positionSnapshots || [];
      console.log('snapshots', snapshots)

      // Calculate accrued fees using fee growth data
      let totalAccruedFeesToken0 = '0';
      let totalAccruedFeesToken1 = '0';

      if (position && position.liquidity && BigInt(position.liquidity) > BigInt(0)) {
        const liquidity = BigInt(position.liquidity);
        const Q128 = BigInt(2) ** BigInt(128);

        // Get fee growth values
        const feeGrowthInside0 = BigInt(position.feeGrowthInside0LastX128 || '0');
        const feeGrowthInside1 = BigInt(position.feeGrowthInside1LastX128 || '0');

        // Calculate accrued fees: (feeGrowthInside * liquidity) / Q128
        // This gives us the total fees that should be owed to this position
        totalAccruedFeesToken0 = ((feeGrowthInside0 * liquidity) / Q128).toString();
        totalAccruedFeesToken1 = ((feeGrowthInside1 * liquidity) / Q128).toString();

        console.log('Fee calculation:', {
          liquidity: liquidity.toString(),
          feeGrowthInside0: feeGrowthInside0.toString(),
          feeGrowthInside1: feeGrowthInside1.toString(),
          calculatedAccruedFeesToken0: totalAccruedFeesToken0,
          calculatedAccruedFeesToken1: totalAccruedFeesToken1
        });
      }

      // Calculate collected fees during the period from snapshots
      let totalCollectedFeesToken0 = '0';
      let totalCollectedFeesToken1 = '0';

      if (snapshots.length > 0) {
        const latestSnapshot = snapshots[snapshots.length - 1];
        const earliestSnapshot = snapshots[0];

        totalCollectedFeesToken0 = (
          BigInt(latestSnapshot.collectedFeesToken0 || '0') -
          BigInt(earliestSnapshot.collectedFeesToken0 || '0')
        ).toString();

        totalCollectedFeesToken1 = (
          BigInt(latestSnapshot.collectedFeesToken1 || '0') -
          BigInt(earliestSnapshot.collectedFeesToken1 || '0')
        ).toString();
      }

      return {
        totalCollectedFeesToken0,
        totalCollectedFeesToken1,
        totalAccruedFeesToken0,
        totalAccruedFeesToken1,
        collectionEvents: [], // No collect events since query was problematic
      };

    } catch (error) {
      console.error('Failed to get fee collection data:', error);
      return {
        totalCollectedFeesToken0: '0',
        totalCollectedFeesToken1: '0',
        totalAccruedFeesToken0: '0',
        totalAccruedFeesToken1: '0',
        collectionEvents: [],
      };
    }
  }

  // async getPositionFeeEstimateFromSwaps(
  //   tokenId: string,
  //   poolAddress: string,
  //   startTimestamp: number,
  //   endTimestamp: number
  // ): Promise<{ estimatedFeesToken0: string; estimatedFeesToken1: string; swapCount: number }> {
  //   // First get position tick range
  //   const positionQuery = `
  //     query GetPosition($tokenId: String!) {
  //       position(id: $tokenId) {
  //         id
  //         liquidity
  //         tickLower {
  //           tickIdx
  //         }
  //         tickUpper {
  //           tickIdx
  //         }
  //         pool {
  //           id
  //           feeTier
  //         }
  //       }
  //     }
  //   `;

  //   // Get swaps in the position's range during the period
  //   const swapQuery = `
  //     query GetSwapsInRange($poolAddress: String!, $startTimestamp: BigInt!, $endTimestamp: BigInt!, $tickLower: BigInt!, $tickUpper: BigInt!) {
  //       swaps(
  //         first: 1000,
  //         where: {
  //           pool: $poolAddress,
  //           timestamp_gte: $startTimestamp,
  //           timestamp_lte: $endTimestamp,
  //           tick_gte: $tickLower,
  //           tick_lte: $tickUpper
  //         }
  //         orderBy: timestamp
  //         orderDirection: desc
  //       ) {
  //         id
  //         timestamp
  //         tick
  //         amount0
  //         amount1
  //         amountUSD
  //       }
  //     }
  //   `;

  //   try {
  //     const positionResponse = await fetch(this.SUBGRAPH_URL, {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({
  //         query: positionQuery,
  //         variables: { tokenId },
  //       }),
  //     });

  //     const positionData = await positionResponse.json();

  //     if (positionData.errors) {
  //       console.error('Position query error:', positionData.errors);
  //       return { estimatedFeesToken0: '0', estimatedFeesToken1: '0', swapCount: 0 };
  //     }

  //     const position = positionData.data?.position;
  //     if (!position) {
  //       return { estimatedFeesToken0: '0', estimatedFeesToken1: '0', swapCount: 0 };
  //     }

  //     const tickLower = parseInt(position.tickLower?.tickIdx || '0');
  //     const tickUpper = parseInt(position.tickUpper?.tickIdx || '0');
  //     const feeTier = parseInt(position.pool?.feeTier || '3000'); // Default to 0.3%

  //     const swapResponse = await fetch(this.SUBGRAPH_URL, {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({
  //         query: swapQuery,
  //         variables: {
  //           poolAddress,
  //           startTimestamp: startTimestamp.toString(),
  //           endTimestamp: endTimestamp.toString(),
  //           tickLower: tickLower.toString(),
  //           tickUpper: tickUpper.toString()
  //         },
  //       }),
  //     });

  //     const swapData = await swapResponse.json();

  //     if (swapData.errors) {
  //       console.error('Swap query error:', swapData.errors);
  //       return { estimatedFeesToken0: '0', estimatedFeesToken1: '0', swapCount: 0 };
  //     }

  //     const swaps = swapData.data?.swaps || [];

  //     // Estimate fees based on swap volume and fee tier
  //     // Fee = (swap amount * fee tier) / 1000000
  //     let estimatedFeesToken0 = BigInt(0);
  //     let estimatedFeesToken1 = BigInt(0);

  //     for (const swap of swaps) {
  //       const amount0 = BigInt(Math.abs(parseInt(swap.amount0 || '0')));
  //       const amount1 = BigInt(Math.abs(parseInt(swap.amount1 || '0')));

  //       // Apply fee tier percentage
  //       const fee0 = (amount0 * BigInt(feeTier)) / BigInt(1000000);
  //       const fee1 = (amount1 * BigInt(feeTier)) / BigInt(1000000);

  //       estimatedFeesToken0 += fee0;
  //       estimatedFeesToken1 += fee1;
  //     }

  //     return {
  //       estimatedFeesToken0: estimatedFeesToken0.toString(),
  //       estimatedFeesToken1: estimatedFeesToken1.toString(),
  //       swapCount: swaps.length,
  //     };

  //   } catch (error) {
  //     console.error('Failed to estimate fees from swaps:', error);
  //     return { estimatedFeesToken0: '0', estimatedFeesToken1: '0', swapCount: 0 };
  //   }
  // }
} 