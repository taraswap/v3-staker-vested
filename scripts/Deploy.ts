import { ethers } from 'hardhat'

async function main() {
  const [deployer] = await ethers.getSigners()

  console.log('Deploying contracts with the account:', deployer.address)

  // Deploy UniswapV3Staker
  const UniswapV3StakerFactory = await ethers.getContractFactory('UniswapV3Staker')

  const ONE_MINUTE_SECONDS = 60
  const ONE_HOUR_SECONDS = ONE_MINUTE_SECONDS * 60
  const ONE_DAY_SECONDS = ONE_HOUR_SECONDS * 24
  const ONE_MONTH_SECONDS = ONE_DAY_SECONDS * 30
  const ONE_YEAR_SECONDS = ONE_DAY_SECONDS * 365

  // 2592000
  const MAX_INCENTIVE_START_LEAD_TIME = ONE_MONTH_SECONDS
  // 1892160000
  const MAX_INCENTIVE_DURATION = ONE_YEAR_SECONDS * 2

  const uniswapV3Factory = '0x5EFAc029721023DD6859AFc8300d536a2d6d4c82' // Mainnet Uniswap V3 Factory
  const nonfungiblePositionManager = '0x1C5A295E9860d127D8A3E7af138Bb945c4377ae7' // Mainnet Uniswap V3 NonfungiblePositionManager

  const uniswapV3Staker = await UniswapV3StakerFactory.deploy(
    uniswapV3Factory,
    nonfungiblePositionManager,
    MAX_INCENTIVE_START_LEAD_TIME,
    MAX_INCENTIVE_DURATION
  )

  await uniswapV3Staker.deployed()

  console.log('UniswapV3Staker deployed to:', uniswapV3Staker.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
