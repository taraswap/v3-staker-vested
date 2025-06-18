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

  /**
   * Calculate current feeGrowthInside using Uniswap V3 formula
   * feeGrowthInside = feeGrowthGlobal - feeGrowthBelow - feeGrowthAbove
   */
  private calculateCurrentFeeGrowthInside(
    position: PositionData
  ): { feeGrowthInside0X128: bigint; feeGrowthInside1X128: bigint } {
    const currentTick = parseInt(position.pool.tick);
    const tickLower = parseInt(position.tickLower.tickIdx);
    const tickUpper = parseInt(position.tickUpper.tickIdx);

    const feeGrowthGlobal0X128 = BigInt(position.pool.feeGrowthGlobal0X128 || '0');
    const feeGrowthGlobal1X128 = BigInt(position.pool.feeGrowthGlobal1X128 || '0');

    const feeGrowthOutside0Lower = BigInt(position.tickLower.feeGrowthOutside0X128 || '0');
    const feeGrowthOutside1Lower = BigInt(position.tickLower.feeGrowthOutside1X128 || '0');
    const feeGrowthOutside0Upper = BigInt(position.tickUpper.feeGrowthOutside0X128 || '0');
    const feeGrowthOutside1Upper = BigInt(position.tickUpper.feeGrowthOutside1X128 || '0');

    // Calculate feeGrowthBelow
    let feeGrowthBelow0X128: bigint;
    let feeGrowthBelow1X128: bigint;
    if (currentTick >= tickLower) {
      feeGrowthBelow0X128 = feeGrowthOutside0Lower;
      feeGrowthBelow1X128 = feeGrowthOutside1Lower;
    } else {
      feeGrowthBelow0X128 = feeGrowthGlobal0X128 - feeGrowthOutside0Lower;
      feeGrowthBelow1X128 = feeGrowthGlobal1X128 - feeGrowthOutside1Lower;
    }

    // Calculate feeGrowthAbove
    let feeGrowthAbove0X128: bigint;
    let feeGrowthAbove1X128: bigint;
    if (currentTick < tickUpper) {
      feeGrowthAbove0X128 = feeGrowthOutside0Upper;
      feeGrowthAbove1X128 = feeGrowthOutside1Upper;
    } else {
      feeGrowthAbove0X128 = feeGrowthGlobal0X128 - feeGrowthOutside0Upper;
      feeGrowthAbove1X128 = feeGrowthGlobal1X128 - feeGrowthOutside1Upper;
    }

    // Calculate feeGrowthInside
    const feeGrowthInside0X128 = feeGrowthGlobal0X128 - feeGrowthBelow0X128 - feeGrowthAbove0X128;
    const feeGrowthInside1X128 = feeGrowthGlobal1X128 - feeGrowthBelow1X128 - feeGrowthAbove1X128;

    return { feeGrowthInside0X128, feeGrowthInside1X128 };
  }

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

      let totalAccruedFeesToken0 = '0';
      let totalAccruedFeesToken1 = '0';

      if (position && position.liquidity && BigInt(position.liquidity) > BigInt(0)) {
        const liquidity = BigInt(position.liquidity);
        const Q128 = BigInt(2) ** BigInt(128);

        // Calculate current feeGrowthInside using Uniswap V3 formula
        const { feeGrowthInside0X128: currentFeeGrowthInside0, feeGrowthInside1X128: currentFeeGrowthInside1 } =
          this.calculateCurrentFeeGrowthInside(position);

        // Get the baseline feeGrowthInside values (when fees were last collected)
        const feeGrowthInside0Last = BigInt(position.feeGrowthInside0LastX128 || '0');
        const feeGrowthInside1Last = BigInt(position.feeGrowthInside1LastX128 || '0');

        // Calculate the difference to get accrued fees since last collection
        const feeGrowthInside0Diff = currentFeeGrowthInside0 - feeGrowthInside0Last;
        const feeGrowthInside1Diff = currentFeeGrowthInside1 - feeGrowthInside1Last;

        // Calculate accrued fees using the standard Uniswap V3 formula
        totalAccruedFeesToken0 = ((feeGrowthInside0Diff * liquidity) / Q128).toString();
        totalAccruedFeesToken1 = ((feeGrowthInside1Diff * liquidity) / Q128).toString();
      }

      // Calculate collected fees during the period from snapshots
      let totalCollectedFeesToken0 = '0';
      let totalCollectedFeesToken1 = '0';

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
} 