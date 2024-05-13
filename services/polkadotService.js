// src/services/polkadotService.js
import { ApiPromise, WsProvider } from '@polkadot/api';
import fetch from 'node-fetch';
import { sendTransactionDetailsToNetlify } from '../utils/netlifyUtils.js';
import { SUBSCAN_URLS, PROVIDERS } from '../config/config.js';
import { supabaseAnon } from '../lib/supabaseClient.js';
import { sendTransactionDetailsToSupabase } from './supabaseService.js';

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

export async function getTransactionDetails(address, subscanUrl, api, providerName, maxAttempts = 15, pollInterval = 5000) {
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
        return sortedTransfers;
      }
    }

    return [];
  }

  async function getExistingTransactionHashes() {
    const { data, error } = await supabaseAnon
      .from('transactions')
      .select('hash');

    if (error) {
      console.error('Error fetching existing transaction hashes from Supabase:', error.message);
      return [];
    }

    return data.map(transaction => transaction.hash);
  }

  let attempts = 0;
  let newTransactionsFound = false;
  const existingTransactionHashes = await getExistingTransactionHashes();

  while (attempts < maxAttempts && !newTransactionsFound) {
    const transactionDetails = await fetchTransactionDetails();

    if (transactionDetails.length > 0) {
      const newTransactions = transactionDetails.filter(transaction => !existingTransactionHashes.includes(transaction.hash));

      if (newTransactions.length > 0) {
        newTransactionsFound = true;

        const tokenDecimals = api.registry.chainDecimals[0];
        const tokenSymbol = api.registry.chainTokens[0];

        const txDetails = newTransactions.map(transaction => ({
          walletAddress: address,
          fromAddress: transaction.from,
          amount: transaction.amount,
          transactionHash: transaction.hash,
          blockNumber: transaction.block_num,
          timestamp: transaction.block_timestamp,
          fee: transaction.fee,
          tokenSymbol,
          tokenDecimals,
          tokenName: providerName,
        }));

        await Promise.all(txDetails.map(sendTransactionDetailsToSupabase));

        return txDetails;
      }
    }

    attempts++;
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  console.log('No new transaction details found after multiple attempts.');
  return [];
}

export function subscribeToBalanceChanges(apis, addresses, previousBalances, providers, subscanUrls) {
  return addresses.map((address, walletIndex) =>
    apis.map((api, providerIndex) =>
      api.query.system.account(address, async (balance) => {
        const newBalance = balance.data.free.toHuman();
        const previousBalance = previousBalances[walletIndex][providerIndex];
        const provider = providers[providerIndex];

        if (newBalance !== previousBalance) {
          console.log(`Balance changed for wallet ${address} on provider ${provider.name}: ${newBalance}`);

          // Compare the new balance with the previous balance
          if (newBalance > previousBalance) {
            console.log(`Balance increased for wallet ${address} from ${previousBalance} to ${newBalance}`);

            // Get the last block hash
            const lastBlockHash = await api.rpc.chain.getBlockHash();

            // Get the block header
            const blockHeader = await api.derive.chain.getHeader(lastBlockHash);

            // Get the appropriate Subscan URL based on the provider
            const subscanUrl = subscanUrls.find(url => url.name === provider.name)?.url;

            // Get the transaction details using Subscan API
            const txDetails = await getTransactionDetails(address, subscanUrl, api, provider.name);
            console.log('Transaction details:', txDetails);
          }

          // Update the previous balance with the new balance
          previousBalances[walletIndex][providerIndex] = newBalance;
        }
      })
    )
  );
}