export default () => ({
  TSWAP_TOKEN_ADDRESS: process.env.TSWAP_TOKEN_ADDRESS,
  REWARD_WALLET_PRIVATE_KEY: process.env.REWARD_WALLET_PRIVATE_KEY,
  RPC_URL: process.env.RPC_URL,
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  },
});
