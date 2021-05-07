// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-core/contracts/interfaces/IERC20Minimal.sol';
import '@uniswap/v3-periphery/contracts/libraries/PoolAddress.sol';
import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '@uniswap/v3-core/contracts/libraries/FixedPoint128.sol';
import '@uniswap/v3-core/contracts/libraries/FullMath.sol';
import '@openzeppelin/contracts/token/ERC721/ERC721Holder.sol';

import '@openzeppelin/contracts/math/Math.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';

/**
@title Uniswap V3 canonical staking interface
@author Omar Bohsali <omar.bohsali@gmail.com>
@author Dan Robinson <dan@paradigm.xyz>
*/
contract UniswapV3Staker is ERC721Holder {
    // TODO: should I use ownable or is this ok?
    address public immutable owner;
    IUniswapV3Factory public immutable factory;
    INonfungiblePositionManager public immutable nonfungiblePositionManager;

    /// @param _factory the Uniswap V3 factory
    /// @param _nonfungiblePositionManager the NFT position manager contract address
    constructor(address _factory, address _nonfungiblePositionManager) {
        factory = IUniswapV3Factory(_factory);
        nonfungiblePositionManager = INonfungiblePositionManager(
            _nonfungiblePositionManager
        );
        owner = msg.sender;
    }

    //
    // Part 1: Incentives
    //

    /// @notice Represents a staking incentive.
    struct Incentive {
        uint128 totalRewardUnclaimed;
        uint160 totalSecondsClaimedX128;
        uint32 endTime;
        address rewardToken;
    }

    /// @notice Calculate the key for a staking incentive
    /// @param creator Address that created this incentive
    /// @param rewardToken Token being distributed as a reward
    /// @param pair The UniswapV3 pair this incentive is on
    /// @param startTime When the incentive begins
    /// @param claimDeadline Time by which incentive rewards must be claimed
    function _getIncentiveId(
        address creator,
        address rewardToken,
        address pair,
        uint32 startTime,
        uint32 claimDeadline
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(creator, rewardToken, pair, startTime, claimDeadline)
            );
    }

    /// @notice bytes32 refers to the return value of _getIncentiveId
    mapping(bytes32 => Incentive) public incentives;

    event IncentiveCreated(
        address indexed rewardToken,
        address indexed pair,
        uint32 startTime,
        uint32 endTime,
        uint32 claimDeadline,
        uint128 indexed totalReward
    );

    /**
    @notice Creates a new liquidity mining incentive program.
    @param rewardToken The token being distributed as a reward
    @param pair The Uniswap V3 pair
    @param startTime When rewards should begin accruing
    @param endTime When rewards stop accruing
    @param claimDeadline When program should expire
    @param totalReward Total reward to be distributed
    */
    function create(
        address rewardToken,
        address pair,
        uint32 startTime,
        uint32 endTime,
        uint32 claimDeadline,
        uint128 totalReward
    ) external {
        /*
        Check:
        * Make sure this incentive does not already exist
        * claimDeadline must be no earlier than endTime, which must be later than startTime
        * Possibly: check that pair is a uniswap v3 pair?

        Effects:
        * Transfers totalRewardsUnclaimed of token from the caller to itself

        Interactions:
        * emit IncentiveCreated()
        */
        require(claimDeadline >= endTime, 'claimDeadline_not_gte_endTime');
        require(endTime < startTime, 'endTime_not_gte_startTime');

        // TODO: Do I need any security checks around msg.sender?
        bytes32 key =
            _getIncentiveId(
                msg.sender,
                rewardToken,
                pair,
                startTime,
                claimDeadline
            );

        // Check: this incentive does not already exist
        // TODO: is this right/safe?
        require(incentives[key].rewardToken == address(0), 'INCENTIVE_EXISTS');

        // Check + Effect: transfer reward token
        require(
            IERC20Minimal(rewardToken).transferFrom(
                msg.sender,
                address(this),
                totalReward
            ),
            'REWARD_TRANSFER_FAILED'
        );

        incentives[key] = Incentive(totalReward, 0, endTime, rewardToken);

        emit IncentiveCreated(
            rewardToken,
            pair,
            startTime,
            endTime,
            claimDeadline,
            totalReward
        );
    }

    /**
    @notice Deletes an incentive whose claimDeadline has passed.
    */
    function end(
        address rewardToken,
        address pair,
        uint32 startTime,
        uint32 claimDeadline
    ) external {
        /*
        Check:
        * Only callable by creator (msg.sender is hashed)
        * Only works when claimDeadline has passed

        Effects:
        * Transfer totalRewardsUnclaimed of token back to creator
        * Delete Incentive

        Interaction:
        */
        require(block.timestamp > claimDeadline, 'TIMESTAMP_LTE_CLAIMDEADLINE');
        bytes32 key =
            _getIncentiveId(
                msg.sender,
                rewardToken,
                pair,
                startTime,
                claimDeadline
            );

        Incentive memory incentive = incentives[key];
        require(incentives[key].rewardToken != address(0), 'INVALID_INCENTIVE');

        // TODO: double-check .transfer

        // TODO: handle failures
        IERC20Minimal(rewardToken).transfer(
            msg.sender,
            incentive.totalRewardUnclaimed
        );
        // TODO: Thinking if this should go before or after the transferFrom, maybe it doesnt matter.
        delete incentives[key];
    }

    //
    // Part 2: Deposits, Withdrawals
    //

    struct Deposit {
        address owner;
        uint32 numberOfStakes;
    }

    /// @dev deposits[tokenId] => Deposit
    mapping(uint256 => Deposit) deposits;

    event Deposited(uint256 tokenId);

    function deposit(uint256 tokenId) external {
        // TODO: Make sure the transfer succeeds and is a uniswap erc721
        // I think this is not secure
        nonfungiblePositionManager.safeTransferFrom(
            msg.sender,
            address(this),
            tokenId
        );

        deposits[tokenId] = Deposit(msg.sender, 0);
        emit Deposited(tokenId);
    }

    event Withdrawal(uint256 tokenId);

    function withdraw(uint256 tokenId, address to) external {
        require(
            deposits[tokenId].numberOfStakes == 0,
            'NUMBER_OF_STAKES_NOT_ZERO'
        );

        // TODO: do we have to check for a failure here? Also double-check
        // if safeTransferFrom is right.
        nonfungiblePositionManager.safeTransferFrom(address(this), to, tokenId);

        emit Withdrawal(tokenId);
    }

    //
    // Part 3: Staking, Unstaking
    //

    struct Stake {
        uint160 secondsPerLiquidityInitialX128;
        address pool;
    }

    /// @dev stakes[tokenId][incentiveHash] => Stake
    mapping(uint256 => mapping(bytes32 => Stake)) stakes;

    function _getPositionDetails(uint256 tokenId)
        internal
        view
        returns (
            address,
            int24,
            int24,
            uint128
        )
    {
        (
            ,
            ,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            ,
            ,
            ,

        ) = nonfungiblePositionManager.positions(tokenId);

        PoolAddress.PoolKey memory poolKey =
            PoolAddress.getPoolKey(token0, token1, fee);

        // Could do this via factory.getPool or locally via PoolAddress.
        // TODO: what happens if this is null
        return (
            PoolAddress.computeAddress(address(factory), poolKey),
            tickLower,
            tickUpper,
            liquidity
        );
    }

    function stake(
        uint256 tokenId,
        address creator,
        address rewardToken,
        uint32 startTime,
        uint32 endTime,
        uint32 claimDeadline
    ) external {
        /*
        It then creates a stake in the stakes mapping. stakes is
        a mapping from th token ID and incentive ID to information about that stake.

        Check:
        * Make sure you are the owner

        Effects:
        * increments numberOfStakes
        */

        /*
        This looks up your Deposit, checks that you are the owner
        */
        require(deposits[tokenId].owner == msg.sender, 'NOT_YOUR_DEPOSIT');

        // TODO: Make sure destructuring and ignoring liquidity correctly
        (address poolAddress, int24 tickLower, int24 tickUpper, ) =
            _getPositionDetails(tokenId);
        IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);

        bytes32 incentiveId =
            _getIncentiveId(
                creator,
                rewardToken,
                poolAddress,
                startTime,
                claimDeadline
            );

        (, uint160 secondsPerLiquidityInsideX128, ) =
            pool.snapshotCumulativesInside(tickLower, tickUpper);

        stakes[tokenId][incentiveId] = Stake(
            secondsPerLiquidityInsideX128,
            address(pool)
        );

        // TODO: make sure this writes to the struct
        deposits[tokenId].numberOfStakes += 1;
        // TODO: emit Stake event
    }

    function unstake(
        uint256 tokenId,
        address creator,
        address rewardToken,
        uint32 startTime,
        // uint32 endTime,
        uint32 claimDeadline,
        address to
    ) external {
        /*
        Check:
        * It checks that you are the owner of the Deposit,
        * It checks that there exists a Stake for the provided key
            (with non-zero secondsPerLiquidityInitialX128).
        */
        require(deposits[tokenId].owner == msg.sender, 'NOT_YOUR_DEPOSIT');

        /*
        Effects:
        deposit.numberOfStakes -= 1 - Make sure this decrements properly
        */
        deposits[tokenId].numberOfStakes -= 1;

        // TODO: Zero-out the Stake with that key.
        // stakes[tokenId]
        /*
        * It computes secondsPerLiquidityInPeriodX128 by computing
            secondsPerLiquidityInsideX128 using the Uniswap v3 core contract
            and subtracting secondsPerLiquidityInitialX128.
        */

        // TODO: make sure not null
        (
            address poolAddress,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity
        ) = _getPositionDetails(tokenId);

        IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);

        (, uint160 secondsPerLiquidityInsideX128, ) =
            pool.snapshotCumulativesInside(tickLower, tickUpper);

        bytes32 incentiveId =
            _getIncentiveId(
                creator,
                rewardToken,
                poolAddress,
                startTime,
                claimDeadline
            );

        uint160 secondsInPeriodX128 =
            (secondsPerLiquidityInsideX128 -
                stakes[tokenId][incentiveId].secondsPerLiquidityInitialX128) *
                liquidity;

        /*
        * It looks at the liquidity on the NFT itself and multiplies
            that by secondsPerLiquidityInRangeX96 to get secondsX96.
        * It computes reward rate for the Program and multiplies that
            by secondsX96 to get reward.
        * totalRewardsUnclaimed is decremented by reward. totalSecondsClaimed
            is incremented by seconds.
        */

        // TODO: check for overflows and integer types
        // uint160 secondsX96 = FullMath.mulDiv(secondsPerLiquidityInStakingPeriodX128, , denominator);
        //     SafeMath.mul(secondsPerLiquidityInStakingPeriodX128, liquidity);

        incentives[incentiveId].totalSecondsClaimedX128 += secondsInPeriodX128;

        uint160 totalSecondsUnclaimedX128 =
            uint32(Math.max(incentives[incentiveId].endTime, block.timestamp)) -
                startTime -
                incentives[incentiveId].totalSecondsClaimedX128;

        // This is probably wrong
        uint160 rewardRate =
            uint160(
                SafeMath.div(
                    incentives[incentiveId].totalRewardUnclaimed,
                    totalSecondsUnclaimedX128
                )
            );

        uint256 reward = SafeMath.mul(secondsInPeriodX128, rewardRate);

        // TODO: Before release: wrap this in try-catch properly
        // try {
        // TODO: incentive.rewardToken or rewardToken?
        IERC20Minimal(incentives[incentiveId].rewardToken).transfer(to, reward);
        // } catch {}
        // TODO: emit unstake event
    }
}
