# Hardhat Tests for Daemon Bridge

Hardhat Tests for Daemon Bridge.

## Run Test native token to native token

Exchange sepolia/ETH to Optimism sepolia/ETH
```shell
npx hardhat test test/optimism.js
```

## Run Test token to token

Exchange sepolia/LINK to Optimism sepolia/LINK
```shell
npx hardhat test test/optimism-LINK.js
```

Exchange sepolia/LINK to Arbitrum sepolia/LINK
```shell
npx hardhat test test/arbitrum-LINK.js
```

## Run All Tests

```shell
npx hardhat test
```
