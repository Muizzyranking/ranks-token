# Ranks Token (RANKS)

A secure and efficient SIP-010 compliant fungible token implementation on the Stacks blockchain, built with Clarity.

## Overview

Ranks Token is a fungible token that implements the [SIP-010](https://github.com/stacksgov/sips/blob/main/sips/sip-010/sip-010-fungible-token-standard.md) standard, ensuring compatibility with Stacks ecosystem wallets and exchanges.

## Features

- Full SIP-010 compliance
- Secure token transfer mechanisms
- Built-in mint and burn capabilities (admin-only)
- Transfer memo support
- Efficient gas optimization

## Contract Functions

### Core SIP-010 Functions
- `transfer`
- `transfer-memo`
- `get-name`
- `get-symbol`
- `get-decimals`
- `get-balance`
- `get-total-supply`
- `get-token-uri`

### Administrative Functions
- `mint`
- `burn`

## Security

The contract implements various security measures:
- Principal-based authorization
- Overflow checks
- Read-only functions where appropriate
- Guard clauses for critical operations

## Testing

Tests are provided in the `tests` directory and can be run using Clarinet: 

```
clarinet test
```

## Development

### Prerequisites
- [Clarinet](https://github.com/hirosystems/clarinet)
- [Stacks CLI](https://docs.stacks.co/references/stacks-cli)

### Setup
1. Clone the repository
2. Install dependencies
3. Run tests using Clarinet