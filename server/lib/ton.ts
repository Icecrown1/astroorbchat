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
