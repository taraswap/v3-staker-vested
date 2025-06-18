-- migrations/001_initial.sql
CREATE TABLE incentives (
    id SERIAL PRIMARY KEY,
    incentive_id VARCHAR(66) NOT NULL,
    reward_token VARCHAR(42) NOT NULL,
    pool_address VARCHAR(42) NOT NULL,
    start_time BIGINT NOT NULL,
    end_time BIGINT NOT NULL,
    vesting_period BIGINT NOT NULL,
    total_reward_unclaimed BIGINT NOT NULL,
    total_seconds_claimed_x128 BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reward_claims (
    id SERIAL PRIMARY KEY,
    user_address VARCHAR(42) NOT NULL,
    reward_token VARCHAR(42) NOT NULL,
    amount BIGINT NOT NULL,
    claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);