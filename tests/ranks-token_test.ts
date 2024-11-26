import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.5.4/index.ts';
import { assertEquals } from 'https://deno.land/std@0.170.0/testing/asserts.ts';

// Helper function to get account balance
async function getBalance(chain: Chain, account: string, caller: Account) {
    return chain.callReadOnlyFn(
        "ranks-token",
        "get-balance",
        [types.principal(account)],
        caller.address
    );
}

Clarinet.test({
    name: "Basic token functionality tests",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        
        // Test initial values
        let maxSupply = chain.callReadOnlyFn("ranks-token", "get-max-supply", [], deployer.address);
        maxSupply.result.expectOk().expectUint(1000000000000);
        
        let paused = chain.callReadOnlyFn("ranks-token", "is-paused", [], deployer.address);
        paused.result.expectOk().expectBool(false);
        
        let treasury = chain.callReadOnlyFn("ranks-token", "get-treasury", [], deployer.address);
        treasury.result.expectOk().expectPrincipal(deployer.address);
    }
});

Clarinet.test({
    name: "Test pause mechanism",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        const wallet2 = accounts.get("wallet_2")!;
        
        // Pause contract
        let block = chain.mineBlock([
            Tx.contractCall("ranks-token", "pause-contract", [], deployer.address)
        ]);
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Try to transfer while paused
        block = chain.mineBlock([
            Tx.contractCall("ranks-token", "mint", 
                [types.uint(1000000), types.principal(wallet1.address)], 
                deployer.address
            ),
            Tx.contractCall("ranks-token", "transfer",
                [types.uint(500000), types.principal(wallet1.address), 
                 types.principal(wallet2.address), types.none()],
                wallet1.address
            )
        ]);
        
        // Mint should fail when paused
        block.receipts[0].result.expectErr().expectUint(104); // err-paused
        // Transfer should fail when paused
        block.receipts[1].result.expectErr().expectUint(104); // err-paused
        
        // Unpause contract
        block = chain.mineBlock([
            Tx.contractCall("ranks-token", "unpause-contract", [], deployer.address)
        ]);
        block.receipts[0].result.expectOk().expectBool(true);
    }
});

Clarinet.test({
    name: "Test authorized minters",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        const wallet2 = accounts.get("wallet_2")!;
        
        // Add authorized minter
        let block = chain.mineBlock([
            Tx.contractCall("ranks-token", "add-authorized-minter",
                [types.principal(wallet1.address)],
                deployer.address
            )
        ]);
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Test minting from authorized minter
        block = chain.mineBlock([
            Tx.contractCall("ranks-token", "mint",
                [types.uint(1000000), types.principal(wallet2.address)],
                wallet1.address
            )
        ]);
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Remove authorized minter
        block = chain.mineBlock([
            Tx.contractCall("ranks-token", "remove-authorized-minter",
                [types.principal(wallet1.address)],
                deployer.address
            )
        ]);
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Test minting after removal
        block = chain.mineBlock([
            Tx.contractCall("ranks-token", "mint",
                [types.uint(1000000), types.principal(wallet2.address)],
                wallet1.address
            )
        ]);
        block.receipts[0].result.expectErr().expectUint(103); // err-not-authorized
    }
});

Clarinet.test({
    name: "Test blacklist functionality",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        const wallet2 = accounts.get("wallet_2")!;
        
        // First mint some tokens
        let block = chain.mineBlock([
            Tx.contractCall("ranks-token", "mint",
                [types.uint(1000000), types.principal(wallet1.address)],
                deployer.address
            )
        ]);
        
        // Add wallet1 to blacklist
        block = chain.mineBlock([
            Tx.contractCall("ranks-token", "add-to-blacklist",
                [types.principal(wallet1.address)],
                deployer.address
            )
        ]);
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Try to transfer from blacklisted address
        block = chain.mineBlock([
            Tx.contractCall("ranks-token", "transfer",
                [types.uint(500000), types.principal(wallet1.address),
                 types.principal(wallet2.address), types.none()],
                wallet1.address
            )
        ]);
        block.receipts[0].result.expectErr().expectUint(107); // err-blacklisted
    }
});

Clarinet.test({
    name: "Test allowance and transfer-from",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        const wallet2 = accounts.get("wallet_2")!;
        
        // Mint tokens to wallet1
        let block = chain.mineBlock([
            Tx.contractCall("ranks-token", "mint",
                [types.uint(1000000), types.principal(wallet1.address)],
                deployer.address
            )
        ]);
        
        // Approve wallet2 to spend wallet1's tokens
        block = chain.mineBlock([
            Tx.contractCall("ranks-token", "approve",
                [types.principal(wallet2.address), types.uint(500000)],
                wallet1.address
            )
        ]);
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Check allowance
        let allowance = chain.callReadOnlyFn(
            "ranks-token",
            "get-allowance",
            [types.principal(wallet1.address), types.principal(wallet2.address)],
            deployer.address
        );
        allowance.result.expectOk().expectUint(500000);
        
        // Use transfer-from
        block = chain.mineBlock([
            Tx.contractCall("ranks-token", "transfer-from",
                [types.uint(300000), types.principal(wallet1.address),
                 types.principal(wallet2.address), types.none()],
                wallet2.address
            )
        ]);
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Check updated allowance
        allowance = chain.callReadOnlyFn(
            "ranks-token",
            "get-allowance",
            [types.principal(wallet1.address), types.principal(wallet2.address)],
            deployer.address
        );
        allowance.result.expectOk().expectUint(200000);
    }
});

Clarinet.test({
    name: "Test max supply and treasury management",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        
        // Set new max supply
        let block = chain.mineBlock([
            Tx.contractCall("ranks-token", "set-max-supply",
                [types.uint(2000000000000)],
                deployer.address
            )
        ]);
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Set new treasury
        block = chain.mineBlock([
            Tx.contractCall("ranks-token", "set-treasury",
                [types.principal(wallet1.address)],
                deployer.address
            )
        ]);
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Verify new treasury
        let treasury = chain.callReadOnlyFn(
            "ranks-token",
            "get-treasury",
            [],
            deployer.address
        );
        treasury.result.expectOk().expectPrincipal(wallet1.address);
    }
});

Clarinet.test({
    name: "Test zero amount transfers",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        const wallet2 = accounts.get("wallet_2")!;
        
        // Try to transfer zero amount
        let block = chain.mineBlock([
            Tx.contractCall("ranks-token", "transfer",
                [types.uint(0), types.principal(wallet1.address),
                 types.principal(wallet2.address), types.none()],
                wallet1.address
            )
        ]);
        block.receipts[0].result.expectErr().expectUint(108); // err-zero-amount
    }
}); 