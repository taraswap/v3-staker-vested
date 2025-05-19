-- migrations/001_initial.sql
CREATE TABLE positions (
    id SERIAL PRIMARY KEY,
    token_id BIGINT NOT NULL,
    owner_address VARCHAR(42) NOT NULL,
    tick_lower INTEGER NOT NULL,
    tick_upper INTEGER NOT NULL,
    liquidity BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE stakes (
    id SERIAL PRIMARY KEY,
    position_id INTEGER REFERENCES positions(id),
    incentive_id INTEGER REFERENCES incentives(id),
    seconds_per_liquidity_inside_initial_x128 BIGINT NOT NULL,
    seconds_inside_initial INTEGER NOT NULL,
    liquidity BIGINT NOT NULL,
    staked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reward_claims (
    id SERIAL PRIMARY KEY,
    user_address VARCHAR(42) NOT NULL,
    reward_token VARCHAR(42) NOT NULL,
    amount BIGINT NOT NULL,
    claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);