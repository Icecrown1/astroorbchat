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
    
    console.log(`[TON] Fetched ${transactions.length} transactions from blockchain`);
    
    const cutoffTime = Math.floor(Date.now() / 1000) - (maxAgeMinutes * 60);
    console.log('[TON] Cutoff time:', new Date(cutoffTime * 1000).toISOString());
    
    // Log all recent incoming transactions for debugging
    const recentIncoming = transactions
      .filter((tx: any) => tx.in_msg && tx.utime >= cutoffTime)
      .map((tx: any) => ({
        hash: tx.hash,
        amount: tx.in_msg.value,
        time: new Date(tx.utime * 1000).toISOString(),
        used: excludeTxHashes.has(tx.hash)
      }));
    
    console.log('[TON] Recent incoming transactions:', JSON.stringify(recentIncoming, null, 2));
    
    // Find matching transaction by amount and time, excluding already used ones
    for (const tx of transactions) {
      if (!tx.in_msg) continue;
      
      const txAmount = tx.in_msg.value || '0';
      const txTime = tx.utime || 0;
      const txHash = tx.hash;
      
      // Skip if already used
      if (excludeTxHashes.has(txHash)) {
        console.log('[TON] Skipping already used transaction:', txHash);
        continue;
      }
      
      // Log comparison details with type information
      console.log('[TON] Comparing transaction:', {
        txHash: txHash.substring(0, 10) + '...',
        txAmount,
        txAmountType: typeof txAmount,
        expectedAmount,
        expectedAmountType: typeof expectedAmount,
        strictMatch: txAmount === expectedAmount,
        txTime: new Date(txTime * 1000).toISOString(),
        cutoffTime: new Date(cutoffTime * 1000).toISOString(),
        timeMatch: txTime >= cutoffTime
      });
      
      // More flexible amount matching (allow small differences due to fees/rounding)
      const txAmountNum = BigInt(txAmount);
      const expectedAmountNum = BigInt(expectedAmount);
      const tolerance = BigInt(Math.floor(Number(expectedAmountNum) * 0.001)); // 0.1% tolerance
      const amountDiff = txAmountNum > expectedAmountNum 
        ? txAmountNum - expectedAmountNum 
        : expectedAmountNum - txAmountNum;
      
      const amountMatch = amountDiff <= tolerance;
      
      console.log('[TON] Amount comparison:', {
        txAmountNum: txAmountNum.toString(),
        expectedAmountNum: expectedAmountNum.toString(),
        difference: amountDiff.toString(),
        tolerance: tolerance.toString(),
        match: amountMatch
      });
      
      if (amountMatch && txTime >= cutoffTime) {
        console.log('[TON] ✅ Found matching transaction:', {
          hash: txHash,
          amount: txAmount,
          timestamp: txTime
        });
        
        return {
          hash: txHash,
          amount: txAmount,
          timestamp: txTime
        };
      }
    }
    
    console.error('[TON] ❌ No matching unused transaction found. Expected:', expectedAmount);
    return null;
  } catch (error) {
    console.error('[TON] Error finding transaction:', error);
    return null;
  }
}
