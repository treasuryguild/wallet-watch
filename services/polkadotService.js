// src/services/polkadotService.js
import { ApiPromise, WsProvider } from '@polkadot/api';
import fetch from 'node-fetch';
import { sendTransactionDetailsToNetlify } from '../utils/netlifyUtils.js';
import { SUBSCAN_URLS } from '../config/config.js';
import { supabaseAnon } from '../lib/supabaseClient.js';

export async function connectToProviders(urls) {
  const providers = urls.map(url => new WsProvider(url));
  return Promise.all(providers.map(provider => ApiPromise.create({ provider })));
}

export async function getInitialBalances(apis, addresses) {
  return Promise.all(
    addresses.map(async (address) => {
      const balances = await Promise.all(apis.map(api => api.query.system.account(address)));
      return balances.map(balance => balance.data.free.toHuman());
    })
  );
}

async function delay(numBlocks) {
  const delayDuration = numBlocks * 6000; // Assuming an average block time of 6 seconds
  await new Promise(resolve => setTimeout(resolve, delayDuration));
}

export async function getTransactionDetails(address, subscanUrl, maxAttempts = 15, pollInterval = 5000) {
  async function fetchTransactionDetails() {
    const apiUrl = `${subscanUrl}/api/v2/scan/transfers`;
    const params = {
      address: address,
      row: 10,
      page: 0,
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (response.ok) {
      const data = await response.json();

      if (data && data.data && data.data.transfers && data.data.transfers.length > 0) {
        // Sort the transfers by timestamp in descending order
        const sortedTransfers = data.data.transfers.sort((a, b) => b.block_timestamp - a.block_timestamp);
        return sortedTransfers[0];
      }
    }

    return null;
  }

  async function checkTransactionInSupabase(transactionHash) {
    const { data, error } = await supabaseAnon
      .from('transactions')
      .select('hash')
      .eq('hash', transactionHash)
      .single();

    if (error) {
      console.error('Error checking transaction in Supabase:', error.message);
      return false;
    }

    return data !== null;
  }

  let attempts = 0;
  let newTransactionFound = false;

  while (attempts < maxAttempts && !newTransactionFound) {
    const transactionDetails = await fetchTransactionDetails();

    if (transactionDetails) {
      const { hash: transactionHash } = transactionDetails;

      const existsInSupabase = await checkTransactionInSupabase(transactionHash);
      console.log('Transaction exists in Supabase:', existsInSupabase);

      if (!existsInSupabase) {
        console.log('New transaction found:', transactionDetails);
        newTransactionFound = true;
        return {
          walletAddress: address,
          fromAddress: transactionDetails.from,
          amount: transactionDetails.amount,
          transactionHash: transactionDetails.hash,
          blockNumber: transactionDetails.block_num,
          timestamp: transactionDetails.block_timestamp,
          fee: transactionDetails.fee,
        };
      }
    }

    attempts++;
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  console.log('No new transaction details found after multiple attempts.');
  return null;
}

export function subscribeToBalanceChanges(apis, addresses, previousBalances, wsUrls, subscanUrls) {
  return addresses.map((address, walletIndex) =>
    apis.map((api, providerIndex) =>
      api.query.system.account(address, async (balance) => {
        const newBalance = balance.data.free.toHuman();
        const previousBalance = previousBalances[walletIndex][providerIndex];

        if (newBalance !== previousBalance) {
          const providerUrl = wsUrls[providerIndex] || 'Unknown Provider';
          console.log(`Balance changed for wallet ${address} on provider ${providerUrl}: ${newBalance}`);

          // Compare the new balance with the previous balance
          if (newBalance > previousBalance) {
            console.log(`Balance increased for wallet ${address} from ${previousBalance} to ${newBalance}`);

            // Get the last block hash
            const lastBlockHash = await api.rpc.chain.getBlockHash();

            // Get the block header
            const blockHeader = await api.derive.chain.getHeader(lastBlockHash);

            // Get the appropriate Subscan URL based on the provider
            const subscanUrl = SUBSCAN_URLS[providerIndex];

            // Get the transaction details using Subscan API
            const txDetails = await getTransactionDetails(address, subscanUrl);
            console.log('Transaction details:', txDetails);
          }

          // Update the previous balance with the new balance
          previousBalances[walletIndex][providerIndex] = newBalance;
        }
      })
    )
  );
}