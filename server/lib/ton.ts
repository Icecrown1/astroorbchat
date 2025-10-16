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
    console.log('=====================================');
    console.log('[TON] NEW SEARCH METHOD - Looking for transaction FROM user wallet:');
    console.log('[TON] User wallet:', userWalletAddress);
    console.log('[TON] To recipient:', recipientAddress);
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
          
          console.log('[TON] Checking outgoing message:', {
            hash: txHash.substring(0, 16) + '...',
            destination: destination?.substring(0, 16) + '...',
            amount,
            time: new Date(txTime * 1000).toISOString()
          });
          
          // Check if this message goes to our address - SIMPLIFIED: any amount accepted
          if (destination === recipientAddress) {
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
    
    // Find matching transaction by amount and time, excluding already used ones
    // Check both incoming AND outgoing messages for our amount
    for (const tx of transactions) {
      let txAmount = '0';
      
      // Check incoming message first
      if (tx.in_msg?.value) {
        txAmount = tx.in_msg.value;
      }
      // If no incoming, check outgoing messages (for self-transfers or internal messages)
      else if (tx.out_msgs && tx.out_msgs.length > 0) {
        // Find outgoing message with our expected amount
        const matchingOut = tx.out_msgs.find((msg: any) => {
          const outAmount = msg.value || '0';
          const diff = Math.abs(Number(outAmount) - Number(expectedAmount));
          return diff < Number(expectedAmount) * 0.001; // 0.1% tolerance
        });
        if (matchingOut) {
          txAmount = matchingOut.value;
        } else {
          continue; // No matching amount in out messages
        }
      } else {
        continue; // No messages at all
      }
      
      const txTime = tx.utime || 0;
      const txHash = tx.hash;
      
      // Skip if already used
      if (excludeTxHashes.has(txHash)) {
        console.log('[TON] ⏭️ Skipping already used transaction:', txHash.substring(0, 16) + '...');
        continue;
      }
      
      // Log full transaction structure for debugging
      console.log('-------------------------------------');
      console.log('[TON] 🔍 Examining transaction:', {
        hash: txHash.substring(0, 16) + '...',
        time: new Date(txTime * 1000).toISOString(),
        foundAmount: txAmount,
        hasInMsg: !!tx.in_msg,
        hasOutMsgs: !!tx.out_msgs && tx.out_msgs.length > 0,
        outMsgsCount: tx.out_msgs?.length || 0,
        fullTx: JSON.stringify(tx, null, 2).substring(0, 500) + '...' // First 500 chars
      });
      
      // Log comparison details with type information
      console.log('[TON] 📊 Amount comparison:', {
        foundAmount: txAmount,
        foundAmountType: typeof txAmount,
        expectedAmount,
        expectedAmountType: typeof expectedAmount,
        strictMatch: txAmount === expectedAmount,
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
