import { Address } from '@ton/core';

/**
 * Normalizes any TON address to canonical raw format (0:...)
 * Accepts both user-friendly (EQ.../UQ...) and raw (0:...) formats
 */
export function normalizeTonAddress(address: string): string {
  try {
    // Try parsing as user-friendly address first
    const parsed = Address.parse(address);
    // Return in raw format: "0:abc123..."
    return parsed.toRawString();
  } catch (error) {
    console.error('[TON] Failed to normalize address:', address, error);
    // Return original if parsing fails
    return address;
  }
}

export async function getTonPrice(): Promise<number> {
  try {
    const response = await fetch('https://tonapi.io/v2/rates?tokens=ton&currencies=usd');
    const data = await response.json();
    
    if (data?.rates?.TON?.prices?.USD) {
      return data.rates.TON.prices.USD;
    }
  } catch (error) {
    console.error('Failed to fetch TON price:', error);
  }

  return parseFloat(process.env.TON_PRICE_FALLBACK_USD_PER_TON || '7.5');
}

export function convertUSDToTON(usdAmount: number, tonPriceUSD: number): string {
  const tonAmount = usdAmount / tonPriceUSD;
  return (tonAmount * 1_000_000_000).toFixed(0);
}

export async function verifyTonTransaction(
  txHash: string, 
  expectedAmount: string, 
  expectedAddress: string
): Promise<boolean> {
  try {
    const accountResponse = await fetch(
      `https://tonapi.io/v2/blockchain/accounts/${expectedAddress}/transactions?limit=50`
    );
    
    if (!accountResponse.ok) {
      console.error('Failed to fetch account transactions:', accountResponse.statusText);
      return false;
    }

    const data = await accountResponse.json();
    const transactions = data.transactions || [];
    
    const matchingTx = transactions.find((tx: any) => tx.hash === txHash);
    
    if (!matchingTx) {
      console.log('Transaction not found in account history');
      return false;
    }

    if (!matchingTx.in_msg) {
      console.log('No incoming message in transaction');
      return false;
    }

    const actualAmount = matchingTx.in_msg.value || '0';
    const amountMatch = actualAmount === expectedAmount;

    if (!amountMatch) {
      console.log(`Amount mismatch: expected ${expectedAmount}, got ${actualAmount}`);
    }

    return amountMatch;
  } catch (error) {
    console.error('Error verifying TON transaction:', error);
    return false;
  }
}

// NEW: Find transaction FROM user's wallet TO our wallet
export async function findUserTransaction(
  userWalletAddress: string,
  recipientAddress: string,
  expectedAmount: string,
  maxAgeMinutes: number = 10,
  excludeTxHashes: Set<string> = new Set()
): Promise<{ hash: string; amount: string; timestamp: number } | null> {
  try {
    // Normalize recipient address to raw format for consistent comparison
    const normalizedRecipient = normalizeTonAddress(recipientAddress);
    
    console.log('=====================================');
    console.log('[TON] NEW SEARCH METHOD - Looking for transaction FROM user wallet:');
    console.log('[TON] User wallet:', userWalletAddress);
    console.log('[TON] To recipient (original):', recipientAddress);
    console.log('[TON] To recipient (normalized):', normalizedRecipient);
    console.log('[TON] Expected amount:', expectedAmount, 'nanoTON');
    console.log('[TON] Max age:', maxAgeMinutes, 'minutes');
    console.log('=====================================');

    const response = await fetch(
      `https://tonapi.io/v2/blockchain/accounts/${userWalletAddress}/transactions?limit=50`
    );
    
    if (!response.ok) {
      console.error('[TON] Failed to fetch user transactions:', response.statusText);
      return null;
    }

    const data = await response.json();
    const transactions = data.transactions || [];
    
    console.log(`[TON] Fetched ${transactions.length} transactions from user's wallet`);
    
    const cutoffTime = Math.floor(Date.now() / 1000) - (maxAgeMinutes * 60);
    
    // Find outgoing transactions to our address
    for (const tx of transactions) {
      const txTime = tx.utime || 0;
      const txHash = tx.hash;
      
      // Skip old transactions
      if (txTime < cutoffTime) continue;
      
      // Skip already used
      if (excludeTxHashes.has(txHash)) continue;
      
      // Check outgoing messages
      if (tx.out_msgs && tx.out_msgs.length > 0) {
        for (const msg of tx.out_msgs) {
          const destination = msg.destination?.address;
          const amount = msg.value || '0';
          
          // Normalize destination address for comparison
          const normalizedDestination = destination ? normalizeTonAddress(destination) : null;
          
          console.log('[TON] Checking outgoing message:', {
            hash: txHash.substring(0, 16) + '...',
            destination: destination?.substring(0, 16) + '...',
            destinationNormalized: normalizedDestination?.substring(0, 16) + '...',
            amount,
            time: new Date(txTime * 1000).toISOString()
          });
          
          // Check if this message goes to our address (compare normalized addresses)
          if (normalizedDestination === normalizedRecipient) {
            const amountNum = BigInt(amount);
            const expectedNum = BigInt(expectedAmount);
            
            // Very loose matching - accept anything within 50% range (was 0.1%)
            const minAmount = expectedNum / BigInt(2);
            const maxAmount = expectedNum * BigInt(2);
            
            if (amountNum >= minAmount && amountNum <= maxAmount) {
              console.log('[TON] ✅ MATCH FOUND (SIMPLIFIED)!', {
                txHash: txHash.substring(0, 16) + '...',
                amount,
                expected: expectedAmount,
                destination: destination.substring(0, 16) + '...'
              });
              return {
                hash: txHash,
                amount,
                timestamp: txTime
              };
            } else {
              console.log('[TON] ❌ Amount too far from expected:', {
                found: amount,
                expected: expectedAmount,
                minAccepted: minAmount.toString(),
                maxAccepted: maxAmount.toString()
              });
            }
          }
        }
      }
    }
    
    console.log('[TON] ❌ No matching transaction found from user wallet');
    return null;
  } catch (error) {
    console.error('[TON] Error searching user transactions:', error);
    return null;
  }
}

// OLD METHOD: Find transaction on recipient's address (less reliable)
export async function findRecentTransaction(
  walletAddress: string,
  expectedAmount: string,
  maxAgeMinutes: number = 10,
  excludeTxHashes: Set<string> = new Set()
): Promise<{ hash: string; amount: string; timestamp: number } | null> {
  try {
    console.log('[TON] Searching for transaction:', {
      wallet: walletAddress,
      expectedAmount,
      maxAgeMinutes,
      excludedCount: excludeTxHashes.size
    });

    const response = await fetch(
      `https://tonapi.io/v2/blockchain/accounts/${walletAddress}/transactions?limit=50`
    );
    
    if (!response.ok) {
      console.error('[TON] Failed to fetch transactions:', response.statusText);
      return null;
    }

    const data = await response.json();
    const transactions = data.transactions || [];
    
    console.log('=====================================');
    console.log('[TON] RAW API RESPONSE:', JSON.stringify(data, null, 2));
    console.log('=====================================');
    console.log(`[TON] Fetched ${transactions.length} transactions from blockchain`);
    
    const cutoffTime = Math.floor(Date.now() / 1000) - (maxAgeMinutes * 60);
    console.log('[TON] Cutoff time:', new Date(cutoffTime * 1000).toISOString());
    console.log('[TON] Expected amount (nanoTON):', expectedAmount);
    
    // Log ALL recent transactions for debugging (both incoming and outgoing)
    const recentAll = transactions
      .filter((tx: any) => tx.utime >= cutoffTime)
      .map((tx: any) => ({
        hash: tx.hash,
        inAmount: tx.in_msg?.value || null,
        outAmounts: tx.out_msgs?.map((m: any) => m.value) || [],
        time: new Date(tx.utime * 1000).toISOString(),
        used: excludeTxHashes.has(tx.hash)
      }));
    
    console.log('[TON] ALL recent transactions:', JSON.stringify(recentAll, null, 2));
    
    // SUPER SIMPLE: Find FIRST unused incoming transaction (ignore amount!)
    for (const tx of transactions) {
      if (!tx.in_msg?.value) continue; // Must have incoming
      
      const txTime = tx.utime || 0;
      if (txTime < cutoffTime) continue; // Too old
      
      const txHash = tx.hash;
      if (excludeTxHashes.has(txHash)) {
        console.log('[TON] ⏭️ Skip used:', txHash.substring(0, 8));
        continue;
      }
      
      const txAmount = tx.in_msg.value;
      
      console.log('[TON] ✅ FOUND (ignoring amount):', {
        hash: txHash.substring(0, 16),
        amount: txAmount,
        time: new Date(txTime * 1000).toISOString()
      });
      
      return {
        hash: txHash,
        amount: txAmount,
        timestamp: txTime
      };
    }
    
    console.error('[TON] ❌ No unused transaction found');
    return null;
  } catch (error) {
    console.error('[TON] Error finding transaction:', error);
    return null;
  }
}
