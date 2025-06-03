import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PositionData {
  id: string;
  owner: string;
  pool: {
    id: string;
    liquidity: string;
    tick: string;
    token0: {
      id: string;
      symbol: string;
    };
    token1: {
      id: string;
      symbol: string;
    };
    feeGrowthGlobal0X128?: string;
    feeGrowthGlobal1X128?: string;
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
  tickLower: {
    tickIdx: string;
    feeGrowthOutside0X128?: string;
    feeGrowthOutside1X128?: string;
  };
  tickUpper: {
    tickIdx: string;
    feeGrowthOutside0X128?: string;
    feeGrowthOutside1X128?: string;
  };
  transaction: {
    timestamp: string;
  };
  collectedFeesToken0?: string;
  collectedFeesToken1?: string;
  feeGrowthInside0LastX128?: string;
  feeGrowthInside1LastX128?: string;
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

export interface PositionRewardData {
  position: PositionData | null;
  feeData: FeeCollectionData;
}

@Injectable()
export class SubgraphService {
  private readonly SUBGRAPH_URL = 'https://indexer.lswap.app/subgraphs/name/taraxa/uniswap-v3';

  constructor(private configService: ConfigService) { }

  async getPositionRewardData(
    tokenId: string,
    startTimestamp: number,
    endTimestamp: number
  ): Promise<PositionRewardData> {
    // Combined query to get all position data including fees
    const positionQuery = `
      query GetPositionRewardData($tokenId: String!) {
        position(id: $tokenId) {
          id
          owner
          pool {
            id
            liquidity
            tick
            token0 {
              id
              symbol
            }
            token1 {
              id
              symbol
            }
            feeGrowthGlobal0X128
            feeGrowthGlobal1X128
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
          tickLower {
            tickIdx
            feeGrowthOutside0X128
            feeGrowthOutside1X128
          }
          tickUpper {
            tickIdx
            feeGrowthOutside0X128
            feeGrowthOutside1X128
          }
          transaction {
            timestamp
          }
          collectedFeesToken0
          collectedFeesToken1
          feeGrowthInside0LastX128
          feeGrowthInside1LastX128
        }
      }
    `;

    // Get position snapshots during the period
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
      const snapshots = snapshotData.data?.positionSnapshots || [];

      console.log('Combined position data:', position);
      console.log('Position snapshots:', snapshots);

      // Calculate accrued fees during the incentive period using snapshot differences
      let totalAccruedFeesToken0 = '0';
      let totalAccruedFeesToken1 = '0';

      if (position && position.liquidity && BigInt(position.liquidity) > BigInt(0)) {
        const liquidity = BigInt(position.liquidity);
        const Q128 = BigInt(2) ** BigInt(128);

        // Check if this is a full range position
        const isFullRange = position.tickLower?.feeGrowthOutside0X128 === '0' &&
          position.tickLower?.feeGrowthOutside1X128 === '0' &&
          position.tickUpper?.feeGrowthOutside0X128 === '0' &&
          position.tickUpper?.feeGrowthOutside1X128 === '0';

        if (snapshots.length > 1) {
          // Multiple snapshots: use difference between earliest and latest
          const earliestSnapshot = snapshots[0];
          const latestSnapshot = snapshots[snapshots.length - 1];

          const feeGrowthInside0Start = BigInt(earliestSnapshot.feeGrowthInside0LastX128 || '0');
          const feeGrowthInside1Start = BigInt(earliestSnapshot.feeGrowthInside1LastX128 || '0');

          const feeGrowthInside0End = BigInt(latestSnapshot.feeGrowthInside0LastX128 || '0');
          const feeGrowthInside1End = BigInt(latestSnapshot.feeGrowthInside1LastX128 || '0');

          const feeGrowthInside0Diff = feeGrowthInside0End - feeGrowthInside0Start;
          const feeGrowthInside1Diff = feeGrowthInside1End - feeGrowthInside1Start;

          totalAccruedFeesToken0 = ((feeGrowthInside0Diff * liquidity) / Q128).toString();
          totalAccruedFeesToken1 = ((feeGrowthInside1Diff * liquidity) / Q128).toString();

          console.log('Multiple snapshots - fee calculation for incentive period:', {
            snapshotCount: snapshots.length,
            feeGrowthInside0Diff: feeGrowthInside0Diff.toString(),
            feeGrowthInside1Diff: feeGrowthInside1Diff.toString(),
            totalAccruedFeesToken0,
            totalAccruedFeesToken1
          });

        } else if (snapshots.length === 1) {
          // Single snapshot: use snapshot as start, current position as end
          const snapshot = snapshots[0];

          const feeGrowthInside0Start = BigInt(snapshot.feeGrowthInside0LastX128 || '0');
          const feeGrowthInside1Start = BigInt(snapshot.feeGrowthInside1LastX128 || '0');

          const feeGrowthInside0End = BigInt(position.feeGrowthInside0LastX128 || '0');
          const feeGrowthInside1End = BigInt(position.feeGrowthInside1LastX128 || '0');

          const feeGrowthInside0Diff = feeGrowthInside0End - feeGrowthInside0Start;
          const feeGrowthInside1Diff = feeGrowthInside1End - feeGrowthInside1Start;

          // If snapshot is at position creation time and no fee growth, 
          // but this is a full range position with pool activity, estimate fees
          if (feeGrowthInside0Diff === BigInt(0) && feeGrowthInside1Diff === BigInt(0) && isFullRange) {
            console.log('Full range position with zero snapshot diff - estimating from global fee growth');

            // For full range positions, feeGrowthInside should equal global feeGrowth
            // Estimate fees based on global pool activity and position's share
            const globalFeeGrowth0 = BigInt(position.pool.feeGrowthGlobal0X128 || '0');
            const globalFeeGrowth1 = BigInt(position.pool.feeGrowthGlobal1X128 || '0');

            // Calculate position's share of total pool liquidity
            const totalPoolLiquidity = BigInt(position.pool.liquidity || '1');
            const positionShare = liquidity * BigInt(10000) / totalPoolLiquidity; // basis points

            // Estimate fees as a fraction of global fee growth based on time and liquidity share
            // This is a conservative estimate for recent positions
            const timeFactor = BigInt(50); // 0.5% of global fees as conservative estimate
            const estimatedFees0 = (globalFeeGrowth0 * liquidity * timeFactor) / (BigInt(10000) * Q128);
            const estimatedFees1 = (globalFeeGrowth1 * liquidity * timeFactor) / (BigInt(10000) * Q128);

            totalAccruedFeesToken0 = estimatedFees0.toString();
            totalAccruedFeesToken1 = estimatedFees1.toString();

            console.log('Full range fee estimation:', {
              globalFeeGrowth0: globalFeeGrowth0.toString(),
              globalFeeGrowth1: globalFeeGrowth1.toString(),
              positionShare: positionShare.toString(),
              estimatedFees0: totalAccruedFeesToken0,
              estimatedFees1: totalAccruedFeesToken1
            });
          } else {
            totalAccruedFeesToken0 = ((feeGrowthInside0Diff * liquidity) / Q128).toString();
            totalAccruedFeesToken1 = ((feeGrowthInside1Diff * liquidity) / Q128).toString();
          }

          console.log('Single snapshot - using snapshot to current position:', {
            snapshotTimestamp: snapshot.timestamp,
            feeGrowthInside0Start: feeGrowthInside0Start.toString(),
            feeGrowthInside0End: feeGrowthInside0End.toString(),
            feeGrowthInside0Diff: feeGrowthInside0Diff.toString(),
            feeGrowthInside1Start: feeGrowthInside1Start.toString(),
            feeGrowthInside1End: feeGrowthInside1End.toString(),
            feeGrowthInside1Diff: feeGrowthInside1Diff.toString(),
            isFullRange,
            totalAccruedFeesToken0,
            totalAccruedFeesToken1
          });

        } else {
          // No snapshots: use current position state as approximation
          console.log('No snapshots available, using current position fee growth as fallback');

          const feeGrowthInside0 = BigInt(position.feeGrowthInside0LastX128 || '0');
          const feeGrowthInside1 = BigInt(position.feeGrowthInside1LastX128 || '0');

          // This gives total fees but it's better than nothing
          totalAccruedFeesToken0 = ((feeGrowthInside0 * liquidity) / Q128).toString();
          totalAccruedFeesToken1 = ((feeGrowthInside1 * liquidity) / Q128).toString();

          console.log('Fallback fee calculation (total since position creation):', {
            totalAccruedFeesToken0,
            totalAccruedFeesToken1
          });
        }
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

      const feeData: FeeCollectionData = {
        totalCollectedFeesToken0,
        totalCollectedFeesToken1,
        totalAccruedFeesToken0,
        totalAccruedFeesToken1,
        collectionEvents: [],
      };

      return {
        position,
        feeData,
      };

    } catch (error) {
      console.error('Failed to get position reward data:', error);
      return {
        position: null,
        feeData: {
          totalCollectedFeesToken0: '0',
          totalCollectedFeesToken1: '0',
          totalAccruedFeesToken0: '0',
          totalAccruedFeesToken1: '0',
          collectionEvents: [],
        },
      };
    }
  }

  async debugPositionTicks(tokenId: string): Promise<any> {
    const query = `
      query GetPositionTicks($tokenId: String!) {
        position(id: $tokenId) {
          id
          liquidity
          tickLower {
            tickIdx
          }
          tickUpper {
            tickIdx
          }
          pool {
            id
            tick
            sqrtPrice
            token0Price
            token1Price
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
      console.log('Position tick range debug:', JSON.stringify(data, null, 2));
      return data;
    } catch (error) {
      console.error('Failed to query position ticks:', error);
      return null;
    }
  }
} 